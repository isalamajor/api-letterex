const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const CorrectionSchema = new Schema({
    textOriginal: {
        type: String, 
        required: true 
    }, // Texto original con el error
    textCorrected: {
        type: String, 
        required: true 
    }, // Texto corregido

    startIndex: { 
        type: Number, 
        required: true
    },  // Posición de inicio del error
    endIndex: { 
        type: Number, 
        required: true
    }   // Longitud del texto incorrecto
});

const CorrectedletterSchema = new Schema({
    originalLetter: { 
        type: Schema.Types.ObjectId,
        ref: "Letter", 
        required: true 
    }, // Carta original
    reviewer: { 
        type: Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    }, // Usuario que corrige
    sender: { 
        type: Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    }, // Usuario que la envió
    sentBack: {
        type: Boolean,
        default: false
    }, // Corrector la envió de vuelta (ya no se puede modificar)
    seen: {
        type: Boolean,
        default: false
    }, // Si el usuario que le enviaron una nueva carta para corregir
    corrections: [ CorrectionSchema ], // Array de correcciones
    comments: {
        type: String 
    }, // Comentarios generales (opcional)
    corrected_at: {
        type: Date,
        default: Date.now
    },
    received_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = model("Correctedletter", CorrectedletterSchema, "correctedletters")
