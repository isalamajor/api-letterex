const { Schema, model } = require("mongoose");
const { LANGUAGES } = require("../constants");

const LetterSchema = Schema(
  {
    author: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    diary: {
      type: String,
      required: false,
    },
    language: {
      type: String,
      required: true,
      enum: {
        values: LANGUAGES,
        message: "{VALUE} is not a valid language",
      },
    },
    audio: {
      // Filepath del audio
      type: String,
    },
    sharedWith: [
      {
        // Array con IDs de user con los que se compartió
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    created_at: {
      type: Date,
      default: Date.now,
    },
    deleted: {
      type: Boolean,
      default: false,
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

module.exports = model("Letter", LetterSchema, "letters");
