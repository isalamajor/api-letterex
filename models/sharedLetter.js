const { Schema, model } = require("mongoose");

const SharedLetterSchema = Schema(
  {
    letterRef: {
      type: Schema.Types.ObjectId,
      ref: "Letter",
      required: true,
    },
    taken: {
      // SharedLetter in a forum can be taken by 1 or 2 users, if taken by 2 it deletes from board
      type: Number,
      default: 0,
    },
    community: {
      type: Schema.Types.ObjectId,
      ref: "Community",
      required: true,
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

module.exports = model("SharedLetter", SharedLetterSchema, "sharedletters");
