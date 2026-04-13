const jwt = require("jwt-simple");
const moment = require("moment");

// Import secret key
const libjwt = require("../services/jwt");
const secret = libjwt.secret;

// Authentication middleware
exports.authentificate = (req, res, next) => {
  // Get token from cookie
  const token = req.cookies.authToken;

  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized - Token not found",
    });
  }

  // Decode token
  try {
    let payload = jwt.decode(token, secret);

    // Check token expiration
    if (payload.exp <= moment().unix()) {
      res.clearCookie("authToken"); // Remove expired token from client
      return res.status(401).send({
        status: "error",
        message: "Token expired",
      });
    }

    // Add user data to request
    req.user = payload;
  } catch (error) {
    res.clearCookie("authToken"); // Remove invalid token from client
    return res.status(401).json({
      status: "error",
      message: "Invalid token",
    });
  }

  // Continue with controller actions
  next();
};
