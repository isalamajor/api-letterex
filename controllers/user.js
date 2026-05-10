const nodemailer = require("nodemailer");
const { User } = require("../models/user");
const Letter = require("../models/letter");
const CorrectedLetter = require("../models/correctedLetter");
const Follow = require("../models/follow");
const { VerificationCode } = require("../models/verificationCode");
const bcrypt = require("bcrypt");
const jwt = require("../services/jwt");
const path = require("path");
const fs = require("fs");
const { cloudinary, uploadBuffer } = require("../services/cloudinary");
const { buildProfilePictureUrl } = require("../services/profilePicture");

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

  // Validate email
  if (!email) return res.status(400).json({ message: "Email requerido" });

  try {
    // Generate random 6-digit code between 100k and 1M (excluded)
    const code = Math.floor(100000 + Math.random() * 900000);
    const hashedCode = await bcrypt.hash(code.toString(), 10);

    // Calculate expiration date (7 minutes from now)
    const expiresAt = new Date(Date.now() + 7 * 60 * 1000);

    // Find and update existing verification code or create new one
    const verificationCode = await VerificationCode.findOneAndUpdate(
      { email }, // Filter: search by email
      { code: hashedCode, expiresAt, verified: false, purpose }, // Update these fields
      { new: true, upsert: true }, // Create new one if it doesn't exist
    );

    // Configure SMTP transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Absolute path to HTML template
    const templatePath = path.join(
      process.cwd(),
      "templates",
      "verificationCode.html",
    );

    // Generate message
    const messageByPurpose = {
      register: "Here's your verification code to complete your registration:",
      password_reset: "Here's your verification code to reset your password:",
    };
    let html = fs.readFileSync(templatePath, "utf8");
    html = html
      .replace("${code}", code)
      .replace(
        "${message}",
        messageByPurpose[purpose] || messageByPurpose.register,
      )
      .replace("${new Date().getFullYear()}", new Date().getFullYear());

    const subjectByPurpose = {
      register: "Verification Code - Register",
      password_reset: "Verification Code - Password Reset",
    };

    // Send email
    const resTrans = await transporter.sendMail({
      from: `"Letterex" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subjectByPurpose[purpose] || "Verification Code",
      html: html,
    });

    // Response
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

// Private function to validate verification codes
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

    // Validate reset code
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

    // Find user in database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    user.password = hashedNewPassword;
    await user.save();

    // Mark code as used
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
    // Get parameters
    const params = req.body;

    // Validation
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

    // Prevent duplicate users
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

    // Hash password
    const hashedPassword = await bcrypt.hash(params.password, 10);

    // Create user object
    const user = new User({
      ...params,
      password: hashedPassword,
    });

    // Save the user to the database
    const userSaved = await user.save();

    // Success
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
  // Get parameters
  const params = req.body;

  // Validation
  if (!params.email || !params.password) {
    return res.status(400).json({
      status: -1,
      message: "Parámetros de login incompletos",
      parameters: params,
    });
  }

  // Find the user with that email (params.email may contain the email or the nickname)
  let user = await User.findOne({ email: params.email });
  if (!user) {
    user = await User.findOne({ nickname: params.email });
  }
  if (!user) {
    return res.status(404).json({
      status: 1,
      message: "User not registered",
    });
  }

  // Verify password
  // bcrypt.compare(plainTextPassword, hashedStoredPassword)
  let pwd = await bcrypt.compare(params.password, user.password);
  if (!pwd) {
    return res.status(401).json({
      status: 2,
      message: "Wrong password",
    });
  }

  // Generate JWT token
  const token = jwt.createToken(user);

  // Remove password and role from return object
  const userData = user.toObject();
  delete userData.password;
  delete userData.role;

  // Get countLetters and transform the result into an object { language: count }
  const countsByLanguage = await Letter.aggregate([
    { $match: { author: user.id } },
    { $group: { _id: "$language", count: { $sum: 1 } } },
  ]);
  const countLetters = countsByLanguage.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  // Get corrected letters and transform the result into an object { language: count }
  const correctedLetters = await CorrectedLetter.find({
    reviewer: user.id,
    sentBack: true,
  }).populate("originalLetter", "language");

  // Count by language
  const countCorrectedLetter = correctedLetters.reduce((acc, doc) => {
    const lang = doc.originalLetter?.language;
    if (lang) {
      acc[lang] = (acc[lang] || 0) + 1;
    }
    return acc;
  }, {});

  userData.countLetters = countLetters;
  userData.countCorrectedLetter = countCorrectedLetter;
  userData.profilePictureUrl = buildProfilePictureUrl(userData);

  const isProduction = process.env.NODE_ENV === "production";
  // Success
  return res
    .cookie("authToken", token, {
      httpOnly: true,
      secure: isProduction, // HTTPS in production
      sameSite: isProduction ? "none" : "lax",
      partitioned: true,
      maxAge: 2 * 24 * 60 * 60 * 1000, // 2  days
    })
    .status(200)
    .json({
      status: 0,
      message: "Login exitoso",
      userData,
    });
};

const profile = async (req, res) => {
  // Get user ID parameter
  let id = req.params.id;

  // If there is no id, use the one from the token
  if (!id && req.user && req.user.id) {
    id = req.user.id;
  }

  if (!id) {
    return res.status(400).json({
      status: "error",
      message: "Identificador del usuario nulo",
    });
  }

  // Get the user from the database
  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json({
      status: "error",
      message: "Usuario no encontrado",
    });
  }

  const authenticatedUserId = req.user.id;
  const isOwnProfile = authenticatedUserId.toString() === user.id.toString();

  const [countsByLanguage, correctedByLanguage, friendRelation] =
    await Promise.all([
      Letter.aggregate([
        { $match: { author: user.id } },
        { $group: { _id: "$language", count: { $sum: 1 } } },
      ]),
      CorrectedLetter.aggregate([
        { $match: { reviewer: user._id, sentBack: true } },
        {
          $lookup: {
            from: "letters",
            localField: "originalLetter",
            foreignField: "_id",
            as: "originalLetterDoc",
          },
        },
        { $unwind: "$originalLetterDoc" },
        { $group: { _id: "$originalLetterDoc.language", count: { $sum: 1 } } },
      ]),
      isOwnProfile
        ? Promise.resolve(null)
        : Follow.exists({
            $or: [
              { user1: authenticatedUserId, user2: user.id },
              { user1: user.id, user2: authenticatedUserId },
            ],
          }),
    ]);

  const countLetters = countsByLanguage.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const countCorrectedLetter = correctedByLanguage.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  // Remove password and role from the returned object
  const userResponse = user.toObject(); // Convert Mongoose document to plain object
  userResponse.profilePictureUrl = buildProfilePictureUrl(userResponse);
  userResponse.countLetters = countLetters;
  userResponse.countCorrectedLetter = countCorrectedLetter;
  if (!isOwnProfile) {
    userResponse.isFriend = !!friendRelation;
  }
  delete userResponse.password;
  delete userResponse.role;

  // Return the user
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
    // Count users
    let totalUsers = await User.countDocuments({}).exec();

    // Search users
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
    // Get the user ID from the token (authenticated beforehand)
    const userId = req.user.id;

    // Get request data
    const { image, ...updateData } = req.body;

    // Never allow updating id from body
    delete updateData.id;

    // Validate that unauthorized information is not being changed
    if (updateData.password || updateData.email || updateData.nickname) {
      return res.status(401).json({
        status: "error",
        message:
          "No puedes actualizar ni la contraseña, ni el nickname ni el email desde esta función",
      });
    }
    // Update the user in the database
    const updatedUser = await User.findByIdAndUpdate(
      userId, // Filter by the user's ID
      updateData, // Data to update
      { new: true }, // Return the updated user
    );

    // Validate that the user exists and was updated
    if (!updatedUser) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado o no se pudo actualizar",
      });
    }

    // Remove sensitive data from the returned object
    const userResponse = updatedUser.toObject();
    delete userResponse.password;
    delete userResponse.role;

    // Respond with success
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
    // Get the authenticated user's ID from the token
    const userId = req.user.id;

    // Get request parameters
    const { currentPassword, newPassword } = req.body;

    // Validate required data is provided
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: "error",
        message:
          "Parámetros incompletos. Proporcione la contraseña actual y la nueva.",
      });
    }

    // Find the user in the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado",
      });
    }

    // Verify current password is correct
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        status: "wrong-password",
        message: "La contraseña actual es incorrecta",
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    user.password = hashedNewPassword;
    await user.save();

    // Respond with success
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
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        status: "error",
        message: "No se subió ninguna imagen",
      });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado",
      });
    }

    const profilePicturePublicId = `letterex/profile_pictures/${userId}`;

    const uploadedImage = await uploadBuffer(req.file.buffer, {
      public_id: profilePicturePublicId,
      use_filename: false,
      unique_filename: false,
      overwrite: true,
      invalidate: true,
      resource_type: "image",
      transformation: [
        {
          width: 800,
          height: 800,
          crop: "limit",
        },
      ],
    });

    // Save the URL in the database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        image: uploadedImage.secure_url,
      },
      { new: true },
    );

    return res.status(200).json({
      status: "success",
      message: "Foto de perfil actualizada con éxito",
      userId: user.id,
      profilePicture: updatedUser.image,
      profilePictureUrl: buildProfilePictureUrl(updatedUser),
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

    const profilePicturePublicId = `letterex/profile_pictures/${userId}`;
    await cloudinary.uploader.destroy(profilePicturePublicId);

    // Reset fields to their default state
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

    // If the user has a Cloudinary URL, redirect directly to it.
    if (user && user.image && /^https?:\/\//i.test(user.image)) {
      return res.redirect(user.image);
    }

    // Fallback for legacy local images/default
    const imageName = user && user.image ? user.image : "default.png";
    const filePath = path.resolve(`./uploads/profile_pictures/${imageName}`);

    // Try sending the file; if it does not exist, use the default one
    try {
      await fs.promises.access(filePath);
      return res.sendFile(filePath);
    } catch {
      return res.sendFile(
        path.resolve(`./uploads/profile_pictures/default.png`),
      );
    }
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
    // Get the search term from parameters
    const searchTerm = req.query.q;
    if (!searchTerm) {
      return res.status(400).json({
        status: "error",
        message: "Debe proporcionar un término de búsqueda",
      });
    }

    // Regular expression for case-insensitive search
    const searchRegex = new RegExp(searchTerm, "i");

    // Get page and define items per page
    const page = parseInt(req.query.page) || 1; // Default page: 1
    const itemsPerPage = 10; // Maximum users per page

    // Search users with pagination
    const users = await User.find({
      $or: [{ nickname: searchRegex }, { email: searchRegex }],
    })
      .select("-password -role") // Exclude sensitive data
      .sort("_id") // Sort by ID
      .paginate(page, itemsPerPage);

    // Count total matching users
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

  const user = await User.findOne({ nickname }); // User with that nickname

  return res.status(200).json({ status: 0, inUse: !!user }); // Returns true if the nickname is in use, false otherwise
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
  const userId = req.user.id; // Use .id if that's what you use elsewhere in the code
  const password = req.body.password;

  if (!password) {
    return res.status(400).json({ status: -1, message: "Falta la contraseña" });
  }

  // Verify the password
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

  // Delete the user from the database
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
