const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const CorrectionSchema = new Schema({
    startIndex: { 
        type: Number, 
        required: true
    },  // Posición de inicio del error
    length: { 
        type: Number, 
        required: true
    },      // Longitud del texto incorrecto
    correctedText: { 
        type: String, 
        required: true 
    } // Texto corregido
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
    startedCorrecting:  {
        type: Boolean,
        default: false
    }, // Corrector tiene una corrección guardada (empezó a corregir)
    sentBack: {
        type: Boolean,
        default: false
    }, // Corrector la envió de vuelta (ya no se puede modificar)
    corrections: [ CorrectionSchema ], // Array de correcciones
    comments: {
        type: String 
    }, // Comentarios generales (opcional)
    corrected_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = model("Correctedletter", CorrectedletterSchema, "correctedletters")
