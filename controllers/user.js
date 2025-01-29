const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("../services/jwt");
const mongoosePaginate = require("mongoose-pagination");
const path = require("path");
const fs = require('fs');


const pruebaUser = (req, res) => {
    return res.status(200).json({
        message: "Mensaje enviado desde user controller",
        user: req.user
    });
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
                status: "error",
                message: "Este email ya está en uso"
            });
        }
        
        users = await User.find({ nickname: params.nickname });
        if (users.length > 0) {
            return res.status(400).json({
                status: "error",
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
            status: "success",
            message: "Registro exitoso",
            user: userSaved
        });
    } catch (error) {
        console.error("Error en el registro:", error);
        return res.status(500).json({
            status: "error",
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
            status: "error",
            message: "Parámetros de login incompletos",
            parameters: params
        });
    }
    
    // Buscar usuario
    let user = await User.findOne({ email: params.email }); // Buscar user con ese email
    if (!user) {
        return res.status(400).json({
            status: "error",
            message: "Email no registrado"
        });
    }
    
    // Verificar contraseña
    let pwd = bcrypt.compareSync(params.password, user.password) // La que ingresó el user CON la que hay en la db
    if (!pwd) {
        return res.status(400).json({
            status: "error",
            message: "Constraseña incorrecta"
        });
    }

    // Obtener token JWT
    const token = jwt.createToken(user);

    // Éxito
    return res.status(200).json({
        status: "success",
        message: "Login exitoso",
        user,
        token
    });
}


const profile = async (req, res) => {
    // Recibir parámetro id de usuario
    const id = req.params.id;

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

    // Eliminar constraseña y rol del objeto a devolver
    const userResponse = user.toObject(); // Convierte el documento de Mongoose a un objeto plano
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

        // Actualizar el usuario en la base de datos
        const updatedUser = await User.findByIdAndUpdate(
            userId,                // Filtro por el ID del usuario
            updateData,            // Datos a actualizar
            { new: true }          // Devuelve el usuario actualizado
        );

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
            user: userResponse
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
            return res.status(400).json({
                status: "error",
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

        // Actualizar la ruta de la imagen en la base de datos
        user.image = req.file.filename; // Guardamos solo el nombre del archivo
        await user.save();

        return res.status(200).json({
            status: "success",
            message: "Foto de perfil actualizada con éxito",
            userId: user._id,
            profilePicture: user.image
        });
    } catch (error) {
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
        res.sendFile(filePath);
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error al obtener la imagen"
        });
    }
};



module.exports = { 
    pruebaUser, 
    register, 
    login, 
    profile, 
    listUsers, 
    update, 
    changePassword, 
    uploadProfilePicture, 
    getProfilePicture 
};
