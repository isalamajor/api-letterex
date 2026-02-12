const {Schema, model} = require('mongoose');

const SharedLetterSchema = Schema({
    letterRef: {
        type: Schema.Types.ObjectId,
        ref: "Letter",
        required: true
    },
    taken: { // SharedLetter in a forum can be taken by 1 or 2 users, if taken by 2 it deletes from board
        type: Number,
        default: 0
    },
    community: {
        type: Schema.Types.ObjectId,
        ref: "Community",
        required: true
    }
})


module.exports = model("SharedLetter", SharedLetterSchema, "sharedletters")