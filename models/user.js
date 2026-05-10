const { Schema, model } = require("mongoose");
const { LANGUAGES } = require("../constants");
const languagesEnum = (LANGUAGES || []).concat(null);

const UserSchema = Schema(
  {
    nickname: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    masterLanguage: {
      type: String,
      required: true,
      enum: {
        values: languagesEnum,
        message: "{VALUE} is not a valid language",
      },
    },
    masterLanguage2: {
      type: String,
      default: null,
      enum: {
        values: languagesEnum,
        message: "{VALUE} is not a valid language",
      },
    },
    masterLanguage3: {
      type: String,
      default: null,
      enum: {
        values: languagesEnum,
        message: "{VALUE} is not a valid language",
      },
    },
    learningLanguage: {
      type: String,
      required: true,
      enum: {
        values: languagesEnum,
        message: "{VALUE} is not a valid language",
      },
    },
    learningLanguage2: {
      type: String,
      default: null,
      enum: {
        values: languagesEnum,
        message: "{VALUE} is not a valid language",
      },
    },
    learningLanguage3: {
      type: String,
      default: null,
      enum: {
        values: languagesEnum,
        message: "{VALUE} is not a valid language",
      },
    },
    role: {
      type: String,
      default: "role_user",
    },
    image: {
      type: String,
      default: null,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    bio: {
      type: String,
      required: false,
    },
    location: {
      type: {
        country: {
          type: String,
          required: false,
        },
        city: {
          type: String,
          required: false,
        },
      },
      required: false,
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

// Export both models
const User = model("User", UserSchema, "users");

module.exports = { User };
