const jwt = require("jwt-simple");
const moment = require("moment");

// Importar clave secreta
const libjwt = require("../services/jwt");
const secret = libjwt.secret;

// Middleware de Autentificación
exports.authentificate = (req, res, next) => {
    // Recibir cabecera de auth
    if (!req.headers.authorization) {
        return res.status(400).send({ // .send o .json ?
            status: "error",
            message: "Cabecera de autentificación vacía"
        });
    }
    
    // Limpar token - Cambiar cuantos quiera (+) valores de ' y "" por nada de forma global (g)
    let token = req.headers.authorization.replace(/['"]+/g, '');

    // Decodificar token
    try {
        let payload = jwt.decode(token, secret);

        // Comprobar expiración del token
        if (payload.exp <= moment().unix()) {
            return res.status(401).send({
                status: "error",
                message: "Token expirado"
            });
        }

        // Agregar datos del usuario 
        req.user = payload;

    } catch (error) {
        return res.status(404).send({
            status: "error",
            message: "Token inválido"
        });
    }

    // Continuar con acciones del controlador
    next();
}