const { Schema, model } = require("mongoose");

const VerificationCodeSchema = Schema(
  {
    email: {
      type: String,
      required: true,
    },
    code: {
      type: Number,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    verified: {
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

const VerificationCode = model(
  "VerificationCode",
  VerificationCodeSchema,
  "verification_codes",
);

module.exports = { VerificationCode };
