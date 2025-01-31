const Letter = require("../models/letter");
const User = require("../models/user");
const CorrectedLetter = require("../models/correctedLetter");


const saveLetter = async (req, res) => {
    try {
        const { title, content, diary, language, created_at } = req.body;
        const userId = req.user.id; 

        if (!title || !content || !language || !created_at) { // created at formato "2025-01-30"
            return res.status(400).json({
                status: "error",
                message: "Title, content, date and language are required." 
            });
        }

        const newLetter = new Letter({
            author: userId,
            title,
            content,
            diary: diary || null,
            language,
            created_at: created_at || Date.now
        });

        const savedLetter = await newLetter.save();
        return res.status(200).json({ 
            status: "success",
            message: "Letter saved successfully.",
            letter: savedLetter 
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error saving letter",
            error: error.message
        });
    }
};


const viewLetter = async (req, res) => {
    try {
        const { letterId } = req.params;
        const userId = req.user.id;

        // Buscar la carta por su ID
        const letter = await Letter.findById(letterId);
        if (!letter) {
            return res.status(404).json({ message: "Letter not found." });
        }

        // Verificar que el usuario sea el autor o que la carta haya sido compartida con él
        if (letter.author.toString() !== userId && !letter.sharedWith.includes(userId)) {
            return res.status(403).json({ message: "Unauthorized to view this letter." });
        }

        // Crear el objeto con la información de la carta
        const letterDetails = {
            created_at: letter.created_at,
            title: letter.title,
            content: letter.content,
            diary: letter.diary || null,
            language: letter.language,
            audio: letter.audio || null
        };

        return res.status(200).json({
            message: "Letter retrieved successfully.",
            letter: letterDetails
        });

    } catch (error) {
        return res.status(500).json({
            message: "Error retrieving letter",
            error: error.message
        });
    }
};


const editLetter = async (req, res) => {
    try {
        const { letterId } = req.params;
        const { title, content, diary, language, sharedWith } = req.body;
        const userId = req.user.id;

        const letter = await Letter.findById(letterId);
        if (!letter) {
            return res.status(404).json({ message: "Letter not found." });
        }

        if (letter.author.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized to edit this letter." });
        }

        letter.title = title || letter.title;
        letter.content = content || letter.content;
        letter.diary = diary !== undefined ? diary : letter.diary;
        letter.language = language || letter.language;
        letter.sharedWith = sharedWith || letter.sharedWith;

        const updatedLetter = await letter.save();
        return res.status(200).json({ message: "Letter updated successfully.", letter: updatedLetter });
    } catch (error) {
        return res.status(500).json({ message: "Error updating letter", error: error.message });
    }
};


const deleteLetter = async (req, res) => {
    try {
        const { letterId } = req.params;
        const userId = req.user.id;

        const letter = await Letter.findById(letterId);
        if (!letter) {
            return res.status(404).json({ message: "Letter not found." });
        }

        if (letter.author.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized to delete this letter." });
        }

        await Letter.findByIdAndDelete(letterId);
        return res.status(200).json({ message: "Letter deleted successfully." });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting letter", error: error.message });
    }
};


const listLetters = async (req, res) => {
    try {
        const userId = req.user.id;

        // Obtener solo los campos necesarios, excluyendo contenido y audio
        const letters = await Letter.find({ author: userId })
            .select("title diary language created_at sharedWith");

        return res.status(200).json({ letters });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching letters", error: error.message });
    }
};


const listLettersPlusCorrections = async (req, res) => {
    try {
        const userId = req.user.id;

        // Obtener solo las cartas del usuario, excluyendo contenido y audio
        const letters = await Letter.find({ author: userId })
            .select("title diary language created_at sharedWith");

        // Obtener correcciones de cada carta
        const lettersWithCorrections = await Promise.all(
            letters.map(async (letter) => {
                // Buscar todas las correcciones asociadas a esta carta
                const corrections = await CorrectedLetter.find({ originalLetter: letter._id });

                // Devolver la carta junto con las correcciones
                return {
                    ...letter.toObject(), // Convierte el objeto Mongoose en un objeto normal
                    corrections: corrections // Devuelve las correcciones completas
                };
            })
        );

        return res.status(200).json({ letters: lettersWithCorrections });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching letters", error: error.message });
    }
};



const shareLetter = async (req, res) => {
    try {
        const { letterId } = req.params;
        const { sharedWith } = req.body;
        const userId = req.user.id;

        // Buscar la carta original
        const letter = await Letter.findById(letterId);
        if (!letter) {
            return res.status(404).json({ message: "Letter not found." });
        }

        // Verificar que el usuario es el autor de la carta
        if (letter.author.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized to share this letter." });
        }

        // Actualizar la carta para agregar los usuarios con los que se comparte
        letter.sharedWith = [...new Set([...letter.sharedWith, ...sharedWith])];
        await letter.save();

        // Crear un nuevo objeto CorrectedLetter para cada usuario en sharedWith
        const correctedLetters = await Promise.all( 
            sharedWith.map(async (friendId) => {

                const newCorrectedLetter = new CorrectedLetter({
                    originalLetter: letterId,
                    sender: letter.author,
                    reviewer: friendId,
                    corrections: [],
                    sentBack: false
                });

                // Guardar el nuevo CorrectedLetter
                return await newCorrectedLetter.save();
            })
        );

        return res.status(200).json({
            message: "Letter shared successfully.",
            letter,
            correctedLetters
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error sharing letter",
            error: error.message
        });
    }
};


module.exports = { 
    saveLetter,
    viewLetter, 
    editLetter, 
    deleteLetter, 
    listLetters, 
    listLettersPlusCorrections,
    shareLetter
};


/* Lo que devuelve listLettersPlusCorrections:
{
    "letters": [
        {
            "_id": "65bc9f5eaf1d8b2e9a4d3c71",
            "title": "Carta 1",
            "diary": "Mi diario",
            "language": "es",
            "created_at": "2025-02-01T12:00:00.000Z",
            "sharedWith": ["65a1b2c3d4e5f67890abcd12"],
            "corrections": [
                {
                    "_id": "65bc9f6aaf1d8b2e9a4d3c72",
                    "originalLetter": "65bc9f5eaf1d8b2e9a4d3c71",
                    "reviewer": "65a1b2c3d4e5f67890abcd12",
                    "sender": "65bc9f5eaf1d8b2e9a4d3c74",
                    "sentBack": false,
                    "corrections": [],
                    "comments": "Revisada parcialmente"
                },
                {
                    "_id": "65bc9f75af1d8b2e9a4d3c73",
                    "originalLetter": "65bc9f5eaf1d8b2e9a4d3c71",
                    "reviewer": "65b2c3d4e5f67890abcd123",
                    "sender": "65bc9f5eaf1d8b2e9a4d3c74",
                    "sentBack": true,
                    "corrections": ["Error en la gramática"],
                    "comments": "Revisión final"
                }
            ]
        },
        {
            "_id": "65bc9f6eaf1d8b2e9a4d3c74",
            "title": "Carta 2",
            "diary": null,
            "language": "en",
            "created_at": "2025-02-02T12:00:00.000Z",
            "sharedWith": [],
            "corrections": []
        }
    ]
}
 */