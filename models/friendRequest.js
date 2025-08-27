const { Schema, model } = require("mongoose");
const { User } = require("./user");

const FriendRequestSchema = Schema({
    sender: { // Usuario que envía la solicitud
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    receiver: { // Usuario que recibe la solicitud
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
});

module.exports = model("FriendRequest", FriendRequestSchema, "FriendRequests");
