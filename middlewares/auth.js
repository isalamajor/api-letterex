const jwt = require("jwt-simple");
const moment = require("moment");

// Importar clave secreta
const libjwt = require("../services/jwt");
const secret = libjwt.secret;

// Authentication middleware
exports.authentificate = (req, res, next) => {
  // Recibir token de la cookie
  const token = req.cookies.authToken;

  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "No autorizado - Token no encontrado",
    });
  }

  // Decodificar token
  try {
    let payload = jwt.decode(token, secret);

    // Check token expiration
    if (payload.exp <= moment().unix()) {
      return res.status(401).send({
        status: "error",
        message: "Token expirado",
      });
    }

    // Agregar datos del usuario
    req.user = payload;
  } catch (error) {
    return res.status(401).json({
      status: "error",
      message: "Token inválido",
    });
  }

  // Continuar con acciones del controlador
  next();
};
