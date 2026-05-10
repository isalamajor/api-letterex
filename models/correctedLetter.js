const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const CorrectionSchema = new Schema({
  textOriginal: {
    type: String,
    required: true,
  }, // Original text with the error
  textCorrected: {
    type: String,
    required: true,
  }, // Corrected text

  startIndex: {
    type: Number,
    required: true,
  }, // Start position of the error
  endIndex: {
    type: Number,
    required: true,
  }, // Length of incorrect text
});

const CorrectedletterSchema = new Schema(
  {
    originalLetter: {
      type: Schema.Types.ObjectId,
      ref: "Letter",
      required: true,
    }, // Original letter
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // User who reviews
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // User who sent it
    sentBack: {
      type: Boolean,
      default: false,
    }, // Reviewer sent it back (can no longer be modified)
    seen: {
      type: Boolean,
      default: false,
    }, // If the user received a new letter to correct
    corrections: [CorrectionSchema], // Array of corrections
    comments: {
      type: String,
    }, // General comments (optional)
    corrected_at: {
      type: Date,
      default: Date.now,
    },
    received_at: {
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

module.exports = model(
  "Correctedletter",
  CorrectedletterSchema,
  "corrected_letters",
);
