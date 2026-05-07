const { Schema, model } = require("mongoose");

const FriendRequestSchema = Schema(
  {
    sender: {
      // User who sends the request
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      // Usuario que recibe la solicitud
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: {
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

module.exports = model("FriendRequest", FriendRequestSchema, "friend_requests");
