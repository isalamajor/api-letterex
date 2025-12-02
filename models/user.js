const { Schema, model } = require('mongoose');
const { languages } = require('../constants')
const languagesEnum = (languages || []).concat(null);

const UserSchema = Schema({
    nickname: {
        type: String,
        required: true 
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    masterLanguage: {
        type: String,
        required: true,
        enum: {
            values: languagesEnum,
            message: "{VALUE} is not a valid language"
        }
    },
    masterLanguage2: {
        type: String,
        default: null,
        enum: {
            values: languagesEnum,
            message: "{VALUE} is not a valid language"
        }
    },
    masterLanguage3: {
        type: String,
        default: null,
        enum: {
            values: languagesEnum,
            message: "{VALUE} is not a valid language"
        }
    },
    learningLanguage: {
        type: String, 
        required: true,
        enum: {
            values: languagesEnum,
            message: "{VALUE} is not a valid language"
        }
    }, 
    learningLanguage2: {
        type: String,
        default: null,
        enum: {
            values: languagesEnum,
            message: "{VALUE} is not a valid language"
        }
    }, 
    learningLanguage3: {
        type: String,
        default: null,
        enum: {
            values: languagesEnum,
            message: "{VALUE} is not a valid language"
        }
    },
    role: {
        type: String,
        default: "role_user"
    },
    image: {
        type: String,
        default: "default.png"
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    bio: {
        type: String,
        required: false
    },
    location: {
        type: {
            country: {
                type: String,
                required: false
            },
            city: {
                type: String,
                required: false
            }
        },
        required: false
    }
});

const VerificationCodeSchema = Schema({
    email: {
        type: String,
        required: true
    },
    code: {
        type: Number,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    verified: {
        type: Boolean,
        default: false
    }
});

// Exportar ambos modelos
const User = model("User", UserSchema, "users");
const VerificationCode = model("VerificationCode", VerificationCodeSchema, "verification_codes");

module.exports = { User, VerificationCode };