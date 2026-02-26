const nodemailer = require("nodemailer");
const { User } = require("../models/user");
const { VerificationCode } = require("../models/verificationCode");
const bcrypt = require("bcrypt");
const jwt = require("../services/jwt");
const path = require("path");
const fs = require("fs");

const sendVerificationCode = async (req, res) => {
  const { email } = req.body;
  const purpose =
    typeof req.body.purpose === "string" ? req.body.purpose : "register";
  const allowedPurposes = new Set(["register", "password_reset"]);
  if (!allowedPurposes.has(purpose)) {
    return res.status(400).json({
      code: -1,
      message: "Invalid purpose",
    });
  }

  // Validar el email
  if (!email) return res.status(400).json({ message: "Email requerido" });

  // Genera un código aleatorio de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000);
  const hashedCode = await bcrypt.hash(code.toString(), 10);

  // Calcula la fecha de expiración (7 minutos desde ahora)
  const expiresAt = new Date(Date.now() + 7 * 60 * 1000);

  try {
    // Buscar y actualizar el código de verificación existente o crear uno nuevo
    const verificationCode = await VerificationCode.findOneAndUpdate(
      { email }, // Filtro: buscar por email
      { code: hashedCode, expiresAt, verified: false, purpose }, // Actualizar estos campos
      { new: true, upsert: true }, // Crear uno nuevo si no existe
    );
  } catch (error) {
    return res.status(500).json({
      message: "Error al guardar el código de verificación",
      error: error.message,
    });
  }

  // Configura tu transporter SMTP (esto es un ejemplo con Gmail)
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    const templatePath = path.join(
      process.cwd(),
      "templates",
      "verificationCode.html",
    );
    let html = fs.readFileSync(templatePath, "utf8");
    html = html
      .replace("${code}", code)
      .replace("${new Date().getFullYear()}", new Date().getFullYear());

    const subjectByPurpose = {
      register: "Verification Code - Register",
      password_reset: "Verification Code - Password Reset",
    };
    const resTrans = await transporter.sendMail({
      from: `"Letterex 🐸" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subjectByPurpose[purpose] || "Verification Code",
      html: html,
    });

    if (resTrans.rejected && resTrans.rejected.length > 0) {
      return res.status(500).json({
        message: "Email inválido",
        error: error.message,
      });
    }
    return res.status(201).json({
      message: "Código enviado",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error enviando el email de verificación",
      error: error.message,
    });
  }
};

// Función privada para validar códigos de verificación
const _validateVerificationCode = async (
  email,
  code,
  purpose,
  markAsUsed = true,
  allowAlreadyUsed = false,
) => {
  const allowedPurposes = new Set(["register", "password_reset"]);

  if (!email || !code) {
    return { error: "Email and code are required" };
  }

  if (!allowedPurposes.has(purpose)) {
    return { error: "Invalid purpose" };
  }

  try {
    const verificationCode = await VerificationCode.findOne({ email, purpose });

    if (!verificationCode) {
      return { error: "Invalid verification code" };
    }

    const isMatch = await bcrypt.compare(
      code.toString(),
      verificationCode.code,
    );
    if (!isMatch) {
      return { error: "Invalid verification code" };
    }

    if (verificationCode.verified && !allowAlreadyUsed) {
      return { error: "Verification code already used" };
    }

    if (new Date() > verificationCode.expiresAt) {
      return { error: "Verification code has expired" };
    }

    if (markAsUsed) {
      verificationCode.verified = true;
      await verificationCode.save();
    }

    return { success: true, verificationCode };
  } catch (error) {
    return { error: `Error verifying code: ${error.message}` };
  }
};

const verifyCode = async (req, res) => {
  const { email, code } = req.body;
  const purpose =
    typeof req.body.purpose === "string" ? req.body.purpose : "register";

  const result = await _validateVerificationCode(
    email,
    code,
    purpose,
    true,
    false,
  );

  if (result.error) {
    return res.status(result.error.includes("already used") ? 400 : 404).json({
      status: "error",
      message: result.error,
    });
  }

  return res.status(200).json({
    status: "success",
    message: "Verification code verified successfully",
  });
};

const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        status: "error",
        message: "Email, code and new password are required",
      });
    }

    // Validar el código de reset
    const result = await _validateVerificationCode(
      email,
      code,
      "password_reset",
      false,
      true,
    );

    if (result.error) {
      return res
        .status(result.error.includes("already used") ? 400 : 404)
        .json({
          status: "error",
          message: result.error,
        });
    }

    // Buscar al usuario en la base de datos
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Cifrar la nueva contraseña
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar la contraseña en la base de datos
    user.password = hashedNewPassword;
    await user.save();

    // Marcar el código como utilizado
    result.verificationCode.verified = true;
    await result.verificationCode.save();

    return res.status(200).json({
      status: "success",
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({
      status: "error",
      message: `Error resetting password: ${error.message}`,
    });
  }
};

const register = async (req, res) => {
  try {
    // Recoger parámetros
    const params = req.body;

    // Validación
    if (
      !params.nickname ||
      !params.email ||
      !params.password ||
      !params.masterLanguage ||
      !params.learningLanguage
    ) {
      return res.status(400).json({
        status: "error",
        message: "Parámetros de registro incompletos",
        parameters: params,
      });
    }

    // Evitar usuarios duplicados
    let users = await User.find({ email: params.email });
    if (users.length > 0) {
      return res.status(400).json({
        status: 1,
        message: "Este email ya está en uso",
      });
    }

    users = await User.find({ nickname: params.nickname });
    if (users.length > 0) {
      return res.status(400).json({
        status: 2,
        message: "Este nickname ya está en uso",
      });
    }

    // Cifrar contraseña
    const hashedPassword = await bcrypt.hash(params.password, 10);

    // Crear objeto usuario
    const user = new User({
      ...params,
      password: hashedPassword,
    });

    // Guardar usuario en BD
    const userSaved = await user.save();

    // Éxito
    return res.status(200).json({
      status: 0,
      message: "Registro exitoso",
      user: userSaved,
    });
  } catch (error) {
    console.error("Error en el registro:", error);
    return res.status(500).json({
      status: -1,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

const login = async (req, res) => {
  // Recoger parámetros
  const params = req.body;

  // Validación
  if (!params.email || !params.password) {
    return res.status(400).json({
      status: -1,
      message: "Parámetros de login incompletos",
      parameters: params,
    });
  }

  // Buscar usuario con ese email (params.email puede contener el email o el nickname)
  let user = await User.findOne({ email: params.email });
  if (!user) {
    user = await User.findOne({ nickname: params.email });
  }
  if (!user) {
    return res.status(200).json({
      status: 1,
      message: "User not registered",
    });
  }

  // Verificar contraseña
  let pwd = bcrypt.compareSync(params.password, user.password); // La que ingresó el user CON la que hay en la db
  if (!pwd) {
    return res.status(200).json({
      status: 2,
      message: "Wrong password",
    });
  }

  // Generar token JWT
  const token = jwt.createToken(user);

  // Eliminar contraseña y rol del objeto a devolver
  const userData = user.toObject();
  delete userData.password;
  delete userData.role;

  // Éxito
  return res
    .cookie("authToken", token, {
      httpOnly: true, // No accesible desde JavaScript
      secure: process.env.NODE_ENV === "production", // HTTPS en producción
      sameSite: "strict", // Protege contra CSRF
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
    })
    .status(200)
    .json({
      status: 0,
      message: "Login exitoso",
      userData,
      token, // Opcional: lo puedes quitar ya que va en la cookie
    });
};

const profile = async (req, res) => {
  // Recibir parámetro id de usuario
  const id = req.params.id;

  // Si no hay id utilizar el del token
  if (!id && req.user && req.user.id) {
    id = req.user.id;
  }

  if (!id) {
    return res.status(400).json({
      status: "error",
      message: "Identificador del usuario nulo",
    });
  }

  // Obtener usuario de BD
  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({
      status: "error",
      message: "Usuario no encontrado",
    });
  }

  // Eliminar constraseña y rol del objeto a devolver
  const userResponse = user.toObject(); // Convierte el documento de Mongoose a un objeto plano
  userResponse.profilePictureUrl = `/api/users/profile-picture/${userResponse.id}`;
  delete userResponse.password;
  delete userResponse.role;

  // Devolver usuario
  return res.status(200).json({
    status: "success",
    user: userResponse,
  });
};

const listUsers = async (req, res) => {
  let page = 1;
  let itemsPerPage = 10;
  if (req.params.page) {
    page = parseInt(req.params.page);
  }

  try {
    // Contar los usuarios
    let totalUsers = await User.countDocuments({}).exec();

    // Búsqueda de users
    let users = await User.find({})
      .sort("_id")
      .paginate(page, itemsPerPage)
      .exec();

    if (!users) {
      return response.status(404).send({
        status: "error",
        message: "No users avaliable",
      });
    }

    return res.status(200).send({
      status: "success",
      users,
      page,
      itemsPerPage,
      totalUsers,
      totalPages: Math.ceil(totalUsers / itemsPerPage),
    });
  } catch (error) {
    return res.status(400).json({
      status: "error",
      message: "Error al obtener la lista de usuarios",
    });
  }
};

const update = async (req, res) => {
  try {
    // Obtener ID del usuario desde el token (autenticado previamente)
    const userId = req.user.id;

    // Recoger datos de la petición
    const { image, ...updateData } = req.body;
    // Validar que no se intente cambiar información no permitida sin autorización explícita
    if (updateData.password || updateData.email || updateData.nickname) {
      return res.status(400).json({
        status: "error",
        message:
          "No puedes actualizar ni la contraseña, ni el nickname ni el email desde esta función",
      });
    }
    // Actualizar el usuario en la base de datos
    const updatedUser = await User.findByIdAndUpdate(
      userId, // Filtro por el ID del usuario
      updateData, // Datos a actualizar
      { new: true }, // Devuelve el usuario actualizado
    );

    // Validar que el usuario exista y haya sido actualizado
    if (!updatedUser) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado o no se pudo actualizar",
      });
    }

    // Eliminar datos sensibles del objeto devuelto
    const userResponse = updatedUser.toObject();
    delete userResponse.password;
    delete userResponse.role;

    // Responder con éxito
    return res.status(200).json({
      status: "success",
      message: "Usuario actualizado con éxito",
      userData: userResponse,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Error en el servidor al actualizar el usuario",
      error: error.message,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    // Obtener el ID del usuario autenticado desde el token
    const userId = req.user.id;

    // Recoger parámetros de la petición
    const { currentPassword, newPassword } = req.body;

    // Validar que se envíen los datos necesarios
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: "error",
        message:
          "Parámetros incompletos. Proporcione la contraseña actual y la nueva.",
      });
    }

    // Buscar al usuario en la base de datos
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado",
      });
    }

    // Verificar que la contraseña actual sea correcta
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        status: "wrong-password",
        message: "La contraseña actual es incorrecta",
      });
    }

    // Cifrar la nueva contraseña
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar la contraseña en la base de datos
    user.password = hashedNewPassword;
    await user.save();

    // Responder con éxito
    return res.status(200).json({
      status: "success",
      message: "Contraseña actualizada con éxito",
    });
  } catch (error) {
    console.error("Error al cambiar la contraseña:", error);
    return res.status(500).json({
      status: "error",
      message: "Error en el servidor al cambiar la contraseña",
      error: error.message,
    });
  }
};

const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "No se subió ninguna imagen",
      });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado",
      });
    }

    // Eliminar cualquier versión anterior del archivo (diferente extensión)
    //if (user.image !== "default.png") {
    const folder = path.resolve("./uploads/profile_pictures");
    const files = fs.readdirSync(folder);
    const oldFiles = files.filter(
      (f) => f.startsWith(userId) && f !== req.file.filename,
    );

    for (const file of oldFiles) {
      try {
        fs.unlinkSync(path.join(folder, file));
      } catch (err) {
        console.warn(`⚠️ No se pudo eliminar ${file}:`, err.message);
      }
    }
    //}

    // Guardar el nuevo nombre del archivo en la base de datos
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { image: req.file.filename },
      { new: true },
    );

    return res.status(200).json({
      status: "success",
      message: "Foto de perfil actualizada con éxito",
      userId: user.id,
      profilePicture: updatedUser.image,
    });
  } catch (error) {
    console.error("Error al subir la foto de perfil:", error);
    return res.status(500).json({
      status: "error",
      message: "Error al subir la foto de perfil",
    });
  }
};

const deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    if (!user.image || user.image === "default.png") {
      return res.status(400).json({
        status: "error",
        message: "No profile picture to delete.",
      });
    }

    // Borrar imagen anterior
    const imagePath = path.resolve(`./uploads/profile_pictures/${user.image}`);
    try {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    } catch (err) {
      console.warn("⚠️ Error al eliminar imagen:", err.message);
    }

    // Actualizar campo a default
    user.image = "default.png";
    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Image deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting profile picture:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

const getProfilePicture = async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findById(userId);

    // Si no existe el usuario o la imagen no está definida, usar default
    const imageName = user && user.image ? user.image : "default.png";
    const filePath = path.resolve(`./uploads/profile_pictures/${imageName}`);

    // Si el archivo no existe, usar default
    const finalPath = fs.existsSync(filePath)
      ? filePath
      : path.resolve(`./uploads/profile_pictures/default.png`);

    return res.sendFile(finalPath);
  } catch (error) {
    console.error("Error al obtener la imagen:", error);
    return res.status(500).json({
      status: "error",
      message: "Error al obtener la imagen",
    });
  }
};

const searchUsers = async (req, res) => {
  try {
    // Obtener el término de búsqueda desde los parámetros
    const searchTerm = req.query.q;
    if (!searchTerm) {
      return res.status(400).json({
        status: "error",
        message: "Debe proporcionar un término de búsqueda",
      });
    }

    // Expresión regular para hacer la búsqueda case-insensitive
    const searchRegex = new RegExp(searchTerm, "i");

    // Obtener página y definir elementos por página
    const page = parseInt(req.query.page) || 1; // Página por defecto: 1
    const itemsPerPage = 10; // Máximo de usuarios por página

    // Buscar usuarios con paginación
    const users = await User.find({
      $or: [{ nickname: searchRegex }, { email: searchRegex }],
    })
      .select("-password -role") // Excluir datos sensibles
      .sort("_id") // Ordenar por ID
      .paginate(page, itemsPerPage);

    // Contar total de usuarios coincidentes
    const totalUsers = await User.countDocuments({
      $or: [{ nickname: searchRegex }, { email: searchRegex }],
    });

    return res.status(200).json({
      status: "success",
      users,
      page,
      itemsPerPage,
      totalUsers,
      totalPages: Math.ceil(totalUsers / itemsPerPage),
    });
  } catch (error) {
    console.error("Error al buscar usuarios:", error);
    return res.status(500).json({
      status: "error",
      message: "Error en el servidor al buscar usuarios",
      error: error.message,
    });
  }
};

const checkNickname = async (req, res) => {
  const { nickname } = req.params;

  if (!nickname) {
    return res.status(400).json({ status: -1, message: "Falta el nickname" });
  }

  const user = await User.findOne({ nickname }); // User con ese nickname

  return res.status(200).json({ status: 0, inUse: !!user }); // Devuelve true si el nickname está en uso, false si no.
};

const checkEmail = async (req, res) => {
  const { email } = req.params;
  if (!email) {
    return res.status(400).json({ result: -1, message: "Falta el email" });
  }
  const user = await User.findOne({ email });
  return res.status(200).json({ result: 0, inUse: !!user });
};

const deleteAccount = async (req, res) => {
  const userId = req.user.id; // Usa .id si es lo que usas en el resto del código
  const password = req.body.password;

  if (!password) {
    return res.status(400).json({ status: -1, message: "Falta la contraseña" });
  }

  // Verificar la contraseña
  const user = await User.findById(userId);
  if (!user) {
    return res
      .status(404)
      .json({ status: -1, message: "Usuario no encontrado" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res
      .status(401)
      .json({ status: -1, message: "Contraseña incorrecta" });
  }

  // Eliminar usuario de la base de datos
  const deleted = await User.findByIdAndDelete(userId);

  if (deleted) {
    return res.status(200).json({
      status: "success",
      message: "Cuenta eliminada exitosamente",
    });
  }
  return res.status(500).json({
    status: "error",
    message: "Error en el servidor al eliminar cuenta",
  });
};

const logout = async (req, res) => {
  try {
    res.clearCookie("authToken");

    return res.status(200).json({
      status: "success",
      message: "Logout exitoso",
    });
  } catch (error) {
    console.error("Error en logout:", error);
    return res.status(500).json({
      status: "error",
      message: "Error en logout",
      error: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  profile,
  listUsers,
  update,
  changePassword,
  uploadProfilePicture,
  deleteProfilePicture,
  getProfilePicture,
  searchUsers,
  checkNickname,
  checkEmail,
  sendVerificationCode,
  verifyCode,
  resetPassword,
  logout,
  deleteAccount,
};
