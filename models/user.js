const {Schema, model} = require('mongoose');

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
    }
})

module.exports = model("User", UserSchema, "users")