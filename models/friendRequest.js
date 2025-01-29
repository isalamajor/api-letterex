const { Schema, model } = require("mongoose");

const FriendRequestSchema = Schema({
    sender: { // Usuario que envía la solicitud
        type: String,
        required: true,
    },
    receiver: { // Usuario que recibe la solicitud
        type: String,
        required: true,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
});

module.exports = model("FriendRequest", FriendRequestSchema, "FriendRequests");
