const jwt = require("jwt-simple");
const moment = require("moment");
require("dotenv").config({ path: ".env.local" });

// Secret key
const secret = process.env.SECRET_KEY_API;

// Function to generate tokens
createToken = (user) => {
  const payload = {
    // User info that we'll have available in the session
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
    iat: moment().unix(), // Moment when the payload is created
    ex: moment().add(10, "days").unix(), // Session expiration date
  };

  return jwt.encode(payload, secret); // Generate JWT
};

module.exports = {
  createToken,
  secret,
};
