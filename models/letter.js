const {Schema, model} = require('mongoose');

const LetterSchema = Schema({
    author: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    diary: {
        type: String,
        required: false
    },
    language: {
        type: String,
        required: true
    }, 
    audio: { // Filepath del audio
        type: String
    },
    sharedWith: [{ // Array con IDs de user con los que se compartió
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    created_at: {
        type: Date,
        default: Date.now
    },
    deleted: {
        type: Boolean,
        default: false
    }
})

module.exports = model("Letter", LetterSchema, "letters")