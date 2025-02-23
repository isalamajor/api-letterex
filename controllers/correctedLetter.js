const CorrectedLetter = require("../models/correctedLetter");


const addCorrections = async (req, res) => {
    try {
        const { correctedLetterId } = req.params;
        const { corrections } = req.body; // Array de correcciones que el revisor desea agregar

        // Verificar que se ha enviado un array de correcciones
        if (!Array.isArray(corrections) || corrections.length === 0) {
            return res.status(400).json({ message: "Corrections must be an array and cannot be empty." });
        }

        // Buscar la carta corregida
        const correctedLetter = await CorrectedLetter.findById(correctedLetterId);
        if (!correctedLetter) {
            return res.status(404).json({ message: "Corrected letter not found." });
        }

        // Verificar que el usuario es el revisor 
        if (correctedLetter.reviewer.toString() !== req.user.id) {
            return res.status(403).json({ message: "You are not authorized to add corrections to this letter." });
        }

        // Verificar que la carta no ha sido enviada de vuelta
        if (correctedLetter.sentBack) {
            return res.status(403).json({ message: "Cannot add corrections to a letter that has been sent back." });
        }

        // Añadir las nuevas correcciones
        correctedLetter.corrections.push(...corrections);

        // Marcar que ha comenzado a corregir
        correctedLetter.startedCorrecting = true;

        // Guardar la carta corregida con las nuevas correcciones
        await correctedLetter.save();

        return res.status(200).json({
            message: "Corrections added successfully.",
            correctedLetter
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error adding corrections",
            error: error.message
        });
    }
};


const sendBack = async (req, res) => {
    try {
        const { correctedLetterId } = req.params;
        const userId = req.user.id;

        // Buscar la carta corregida
        const correctedLetter = await CorrectedLetter.findById(correctedLetterId);
        if (!correctedLetter) {
            return res.status(404).json({ message: "Corrected letter not found." });
        }

        // Verificar que el usuario es el revisor
        if (correctedLetter.reviewer.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized to send back this letter." });
        }

        // Actualizar la carta corregida
        correctedLetter.sentBack = true;
        correctedLetter.corrected_at = Date.now();

        await correctedLetter.save();

        return res.status(200).json({
            message: "Corrected letter sent back successfully.",
            correctedLetter
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error sending back corrected letter",
            error: error.message
        });
    }
};


const getCorrectionsByLetter = async (req, res) => {
    try {
        const { originalLetterId } = req.params;

        // Buscar todas las cartas corregidas relacionadas con la original (MIS cartas que me corrigieron)
        const correctedLetters = await CorrectedLetter.find({ originalLetter: originalLetterId })

        return res.status(200).json({
            status: "success", 
            correctedLetters
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error retrieving corrected letters",
            error: error.message
        });
    }
};


const getReceivedLetters = async (req, res) => {
    try {
        const userId = req.user.id;

        // Buscar todas las cartas a corregir donde el usuario es el revisor
        const correctedLetters = await CorrectedLetter.find({ reviewer: userId })

        return res.status(200).json({
            status: "success",
            correctedLetters
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error fetching received corrected letters",
            error: error.message
        });
    }
};

module.exports = {
    addCorrections,
    sendBack,
    getCorrectionsByLetter,
    getReceivedLetters
};
