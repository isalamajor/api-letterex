const nodemailer = require('nodemailer');
const { User, VerificationCode } = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("../services/jwt");
const mongoosePaginate = require("mongoose-pagination");
const path = require("path");
const fs = require('fs');


const sendVerificationCode = async (req, res) => {
    const { email } = req.params;

    // Validar el email
    if (!email) return res.status(400).json({ message: 'Email requerido' });

    // Genera un código aleatorio de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000);

    // Calcula la fecha de expiración (7 minutos desde ahora)
    const expiresAt = new Date(Date.now() + 7 * 60 * 1000);

    try {
        // Buscar y actualizar el código de verificación existente o crear uno nuevo
        const verificationCode = await VerificationCode.findOneAndUpdate(
            { email }, // Filtro: buscar por email
            { code, expiresAt, verified: false }, // Actualizar estos campos
            { new: true, upsert: true } // Crear uno nuevo si no existe
        );
        console.log("Código de verificación guardado o actualizado:", verificationCode);

    } catch (error) {
        return res.status(500).json({ 
            code: -1,
            message: "Error al guardar el código de verificación",
            error: error.message
        });
    }

    // Configura tu transporter SMTP (esto es un ejemplo con Gmail)
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    try {
        const templatePath = path.join(process.cwd(), "templates", "verificationCode.html");
        let html = fs.readFileSync(templatePath, "utf8");
        html = html.replace('${code}', code).replace('${new Date().getFullYear()}', new Date().getFullYear());

        const resTrans = await transporter.sendMail({
            from: `"Letterex 🐸" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verification Code - Register',
            html: html
        });
        console.log("resTrans: ", resTrans);
        return res.status(200).json({ 
            code: 0,
            message: 'Código enviado'
        });
    } catch (error) {
        return res.status(500).json({ 
            code: -1,
            message: "Error enviando el email de verificación",
            error: error.message 
        });
    }
};


const verifyCode = async (req, res) => {
    const { email, code } = req.body;
    // Validar que se envíen los parámetros necesarios
    if (!email || !code) {
        return res.status(400).json({
            status: "error",
            code: -1,
            message: "Some fields are missing"
        });
    }

    try {
        // Buscar el código de verificación en la base de datos
        const verificationCode = await VerificationCode.findOne({ email, code });

        // Verificar si existe
        if (!verificationCode) {
            return res.status(404).json({
                status: "error",
                code: -2,
                message: "Wrong verification code"
            });
        }

        // Verificar si el código ya fue utilizado
        if (verificationCode.verified) {
            return res.status(400).json({
                status: "error",
                code: -3,
                message: "Verification code already used"
            });
        }

        // Verificar si el código ha expirado
        if (new Date() > verificationCode.expiresAt) {
            return res.status(400).json({
                status: "error",
                code: -4,
                message: "Verification code has expired"
            });
        }

        // Marcar el código como utilizado
        verificationCode.verified = true;
        await verificationCode.save();

        return res.status(200).json({
            status: "success",
            code: 0,
            message: "Verification code verified successfully"
        });
    } catch (error) {
        console.error("Error al verificar el código:", error);
        return res.status(500).json({
            status: "error",
            code: -1,
            message: "Error verifying code",
            error: error.message
        });
    }
};


const register = async (req, res) => {
    try {
        // Recoger parámetros
        const params = req.body;

        // Validación
        if (!params.nickname || !params.email || !params.password || !params.masterLanguage || !params.learningLanguage) {
            return res.status(400).json({
                status: "error",
                message: "Parámetros de registro incompletos",
                parameters: params
            });
        }

        // Evitar usuarios duplicados
        let users = await User.find({ email: params.email });
        if (users.length > 0) {
            return res.status(400).json({
                status: 1,
                message: "Este email ya está en uso"
            });
        }
        
        users = await User.find({ nickname: params.nickname });
        if (users.length > 0) {
            return res.status(400).json({
                status: 2,
                message: "Este nickname ya está en uso"
            });
        }
        
        // Cifrar contraseña
        const hashedPassword = await bcrypt.hash(params.password, 10);

        // Crear objeto usuario
        const user = new User({
            ...params,
            password: hashedPassword
        });

        // Guardar usuario en BD
        const userSaved = await user.save();

        // Éxito
        return res.status(200).json({
            status: 0,
            message: "Registro exitoso",
            user: userSaved
        });
    } catch (error) {
        console.error("Error en el registro:", error);
        return res.status(500).json({
            status: -1,
            message: "Error en el servidor",
            error: error.message
        });
    }
};


const login = async (req, res) => {
    // Recoger parámetros
    const params = req.body;

    // Validación
    if (!params.email || !params.password ) {
        return res.status(400).json({
            status: -1,
            message: "Parámetros de login incompletos",
            parameters: params
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
            message: "User not registered"
        });
    }
    
    // Verificar contraseña
    let pwd = bcrypt.compareSync(params.password, user.password) // La que ingresó el user CON la que hay en la db
    if (!pwd) {
        return res.status(200).json({
            status: 2,
            message: "Wrong password"
        });
    }

    // Generar token JWT
    const token = jwt.createToken(user);

    // Eliminar contraseña y rol del objeto a devolver
    const userData = user.toObject();
    delete userData.password;
    delete userData.role;

    // Éxito
    return res.status(200).json({
        status: 0,
        message: "Login exitoso",
        userData,
        token
    });
}


const profile = async (req, res) => {
    // Recibir parámetro id de usuario
    const id = req.params.id;
    console.log("ID de usuario recibido:", id);

    // Si no hay id utilizar el del token
    if (!id && req.user && req.user.id) {
        id = req.user.id;
    }

    if (!id) {
        return res.status(400).json({
            status: "error",
            message: "Identificador del usuario nulo"
        });
    }

    // Obtener usuario de BD
    const user = await User.findById(id);
    if (!user) {
        return res.status(404).json({
            status: "error",
            message: "Usuario no encontrado"
        });
    }

    console.log("Usuario encontrado:", user);


    // Eliminar constraseña y rol del objeto a devolver
    const userResponse = user.toObject(); // Convierte el documento de Mongoose a un objeto plano
    userResponse.profilePictureUrl = `/api/users/profile-picture/${userResponse._id}`;
    delete userResponse.password;
    delete userResponse.role;

    // Devolver usuario
    return res.status(200).json({
        status: "success",
        user: userResponse
    })
}


const listUsers = async (req, res) => {
    let page = 1;
    let itemsPerPage = 10;
    if (req.params.page) { page = parseInt(req.params.page) }

    try {
        // Contar los usuarios
        let totalUsers = await User.countDocuments({}).exec();

        // Búsqueda de users
        let users = await User.find({})
            .sort('_id')
            .paginate(page, itemsPerPage)
            .exec()
        
        if (!users) {
            return response.status(404).send({
                status: "error",
                message: "No users avaliable"
            });
        }

        return res.status(200).send({
            status: 'success',
            users,
            page,
            itemsPerPage,
            totalUsers,
            totalPages:Math.ceil(totalUsers/itemsPerPage) 
        })
    } catch(error) {
        return res.status(400).json({
            status: "error",
            message: "Error al obtener la lista de usuarios"
        })
    }
}

const update = async (req, res) => {
    try {
        // Obtener ID del usuario desde el token (autenticado previamente)
        const userId = req.user.id;

        // Recoger datos de la petición
        const updateData = req.body;
        // Validar que no se intente cambiar información no permitida sin autorización explícita
        if (updateData.password || updateData.email || updateData.nickname) {
            return res.status(400).json({
                status: "error",
                message: "No puedes actualizar ni la contraseña, ni el nickname ni el email desde esta función"
            });
        }
        console.log("Datos a actualizar:", updateData);
        // Actualizar el usuario en la base de datos
        const updatedUser = await User.findByIdAndUpdate(
            userId,                // Filtro por el ID del usuario
            updateData,            // Datos a actualizar
            { new: true }          // Devuelve el usuario actualizado
        );

        console.log("Usuario actualizado:", updatedUser);
        // Validar que el usuario exista y haya sido actualizado
        if (!updatedUser) {
            return res.status(404).json({
                status: "error",
                message: "Usuario no encontrado o no se pudo actualizar"
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
            userData: userResponse
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error en el servidor al actualizar el usuario",
            error: error.message
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
                message: "Parámetros incompletos. Proporcione la contraseña actual y la nueva."
            });
        }

        // Buscar al usuario en la base de datos
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "Usuario no encontrado"
            });
        }

        // Verificar que la contraseña actual sea correcta
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({
                status: "wrong-password",
                message: "La contraseña actual es incorrecta"
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
            message: "Contraseña actualizada con éxito"
        });
    } catch (error) {
        console.error("Error al cambiar la contraseña:", error);
        return res.status(500).json({
            status: "error",
            message: "Error en el servidor al cambiar la contraseña",
            error: error.message
        });
    }
};


const uploadProfilePicture = async (req, res) => {
    try {
        // Verificar archivo recibido
        if (!req.file) {
            return res.status(400).json({
                status: "error",
                message: "No se subió ninguna imagen"
            });
        }
        
        // Verificar si el usuario existe
        const userId = req.user.id; 
        const user = await User.findById(userId);
        if (!user) {
            // Si el usuario no existe, eliminar el archivo subido subido por multer
            fs.unlinkSync(req.file.path);
            return res.status(404).json({
                status: "error",
                message: "Usuario no encontrado"
            });
        }
        
        const oldImageName = user.image;
        const oldImagePath = path.resolve(`./uploads/profile_pictures/${oldImageName}`);
        console.log("Imagen anterior:", oldImageName);
        console.log("Nueva imagen:", req.file.filename);

        // Actualizar la ruta de la imagen en la base de datos
        user.image = req.file.filename; // Guardamos solo el nombre del archivo
        const resSave = await user.save();
        console.log("resSave: ", resSave);

        // Eliminar la imagen anterior si existe
        if (oldImageName && oldImageName !== "default.png") {
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
        }

        return res.status(200).json({
            status: "success",
            message: "Foto de perfil actualizada con éxito",
            userId: user._id,
            profilePicture: user.image
        });
    } catch (error) {
        console.log("Error al subir la foto de perfil:", error);
        return res.status(500).json({
            status: "error",
            message: "Error en al subir la foto de perfil"
        });
    }
};
    

const getProfilePicture = async (req, res) => {
    const userId = req.params.id;
    try {
        // Buscar usuario en la BD
        const user = await User.findById(userId);

        if (!user || !user.image) {
            return res.status(404).json({
                status: "error",
                message: "Usuario o imagen no encontrado"
            });
        }
        // Ruta de la imagen
        const filePath = path.resolve(`./uploads/profile_pictures/${user.image}`);
        
        console.log(filePath);
        // Verifica si el archivo existe
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                status: "error",
                message: "La imagen no existe"
            });
        }

        // Envía el archivo al cliente
        console.log("Enviando imagen de perfil:", filePath);
        res.sendFile(filePath);
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error al obtener la imagen"
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
                message: "Debe proporcionar un término de búsqueda"
            });
        }

        // Expresión regular para hacer la búsqueda case-insensitive
        const searchRegex = new RegExp(searchTerm, "i");

        // Obtener página y definir elementos por página
        const page = parseInt(req.query.page) || 1; // Página por defecto: 1
        const itemsPerPage = 10; // Máximo de usuarios por página

        // Buscar usuarios con paginación
        const users = await User.find({
            $or: [
                { nickname: searchRegex },
                { email: searchRegex }
            ]
        })
        .select("-password -role") // Excluir datos sensibles
        .sort("_id") // Ordenar por ID
        .paginate(page, itemsPerPage);

        // Contar total de usuarios coincidentes
        const totalUsers = await User.countDocuments({
            $or: [
                { nickname: searchRegex },
                { email: searchRegex }
            ]
        });

        return res.status(200).json({
            status: "success",
            users,
            page,
            itemsPerPage,
            totalUsers,
            totalPages: Math.ceil(totalUsers / itemsPerPage)
        });
    } catch (error) {
        console.error("Error al buscar usuarios:", error);
        return res.status(500).json({
            status: "error",
            message: "Error en el servidor al buscar usuarios",
            error: error.message
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
        return res.status(404).json({ status: -1, message: "Usuario no encontrado" });
    }

    // Si no tienes user.comparePassword, usa bcrypt:
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ status: -1, message: "Contraseña incorrecta" });
    }

    // Eliminar usuario de la base de datos
    const deleted = await User.findByIdAndDelete(userId);

    if (deleted) {
        return res.status(200).json({
            status: "success",
            message: "Cuenta eliminada exitosamente"
        });
    }
    return res.status(500).json({
        status: "error",
        message: "Error en el servidor al eliminar cuenta"
    });
};

module.exports = { 
    register, 
    login, 
    profile, 
    listUsers, 
    update, 
    changePassword, 
    uploadProfilePicture, 
    getProfilePicture,
    searchUsers,
    checkNickname,
    checkEmail,
    sendVerificationCode,
    verifyCode,
    deleteAccount
};

