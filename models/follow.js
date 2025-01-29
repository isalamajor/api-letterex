const {Schema, model} = require('mongoose');

const FollowSchema = Schema({
    user1: {
        type: String,
        required: true
    },
    user2: {
        type: String,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    }
})

module.exports = model("Follow", FollowSchema, "follows")