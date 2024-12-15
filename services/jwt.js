const jwt = require("jwt-simple");
const moment = require("moment");

// Clave secreta
const secret = "ClaVE_SecreTA_890_ProYECto_APi_2"

// Función para generar tokens
createToken = (user) => {
    const payload = { // Info del usuario que vamos a tener disponible en la sesión
        id: user._id,
        nickname: user.nickname,
        email: user.email,
        masterLanguage: user.masterLanguage,
        masterLanguage2: user.masterLanguage2,
        learningLanguage: user.learningLanguage,
        learningLanguage2: user.learningLanguage2,
        learningLanguage3: user.learningLanguage3,
        role: user.role,
        image: user.image,
        created_at: user.created_at,
        iat: moment().unix(), // Momento en el que se crea el payload
        ex: moment().add(10, "days").unix() // Fecha de expiración de la sesión
    };

    return jwt.encode(payload, secret); // Generar JWT
}

module.exports = {
    createToken, 
    secret
}