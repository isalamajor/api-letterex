const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const CorrectionSchema = new Schema({
  textOriginal: {
    type: String,
    required: true,
  }, // Texto original con el error
  textCorrected: {
    type: String,
    required: true,
  }, // Texto corregido

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
    }, // Carta original
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // Usuario que corrige
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // User who sent it
    sentBack: {
      type: Boolean,
      default: false,
    }, // Corrector sent it back (can no longer be modified)
    seen: {
      type: Boolean,
      default: false,
    }, // Si el usuario que le enviaron una nueva carta para corregir
    corrections: [CorrectionSchema], // Array de correcciones
    comments: {
      type: String,
    }, // Comentarios generales (opcional)
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
