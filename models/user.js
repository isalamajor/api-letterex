const { Schema, model } = require('mongoose');

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
        required: true
    },
    masterLanguage2: {
        type: String,
        default: null
    },
    masterLanguage3: {
        type: String,
        default: null
    },
    learningLanguage: {
        type: String, 
        required: true
    }, 
    learningLanguage2: {
        type: String,
        default: null
    }, 
    learningLanguage3: {
        type: String,
        default: null
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
                required: true
            },
            city: {
                type: String,
                required: true
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