const Letter = require("../models/letter");
const correctedLetter = require("../models/correctedLetter");
const { User } = require("../models/user");
const CorrectedLetter = require("../models/correctedLetter");


const saveLetter = async (req, res) => {
    try {
        console.log("req.body", req.body);
        // Guardar contenido del body
        const { title, content, diary, language, created_at } = req.body; // created_at formato "2025-01-30"
        // Guardar contenido del body
        const now = new Date();
        const created_at_conv = new Date(
            created_at.year,
            created_at.month - 1,
            created_at.day,
            now.getHours(),
            now.getMinutes(),
            now.getSeconds(),
            now.getMilliseconds()
          );
        
        console.log("Variables asignadas:", { content, title, diary, language, created_at_conv });
        const userId = req.user.id; 

        if (!title || !content || !language || !created_at_conv) { // created at formato "2025-01-30"
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
            created_at: created_at_conv || Date.now
        });

        const savedLetter = await newLetter.save();
        return res.status(200).json({ 
            status: "success",
            message: "Letter saved successfully.",
            letter: savedLetter 
        });
    } catch (error) {
        console.error("Error saving letter:", error);
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
            audio: letter.audio || null,
            sharedWith: letter.sharedWith || []
        };
        console.log("letterDetails", letterDetails);
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
        const letterId  = req.params.id;
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


        // Para cada usuario de sharedWith, mirar si existe una CorrectedLetter con sentBack = true. Añadir a usuario el campo correctionSentBack
        const lettersWithCorrections = await Promise.all(
            letters.map(async (letter) => {
                
                // Obtener detalles de los usuarios con los que se comparte la carta
                const sharedWithDetails = await Promise.all(
                    letter.sharedWith.map(async (friendId) => {
                        console.log("friendId", friendId);
                        const friend = await User.findById(friendId).select("nickname image");
                        console.log("friend", friend);
                        if (!friend) return null; // Si no existe el usuario, retornar null
                        
                        // Verificar si hay correcciones enviadas de vuelta por este usuario
                        const correctionSentBack = await CorrectedLetter.findOne({
                            originalLetter: letter._id,
                            reviewer: friendId,
                            sentBack: true
                        });
                        
                        if (!correctionSentBack) {
                            return {
                                ...friend.toObject(),
                                correctionSentBack: false, // No se ha enviado de vuelta
                                correctedLetterId: null // No hay carta corregida
                            };
                        }

                        return {
                            ...friend.toObject(),
                            correctionSentBack: !!correctionSentBack, // Añadir campo correctionSentBack
                            correctedLetterId: correctionSentBack._id
                        };
                    })
                );
                //console.log("sharedWithDetails", sharedWithDetails);
                const letterObj = letter.toObject();
                letterObj.sharedWith = sharedWithDetails.filter(user => user !== null); // Filtrar usuarios nulos 
                return letterObj; // Convertir a objeto normal
            })
        );          
        return res.status(200).json({ letters: lettersWithCorrections });
    } catch (error) {
        console.error("Error fetching letters:", error);
        return res.status(500).json({ message: "Error fetching letters", error: error.message });
    }
};


const shareLetter = async (req, res) => {
    try {
        const letterId = req.params.id;
        console.log("letterId", letterId);
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


const getUserDiaries = async (userId) => {
    try {
        // Buscar todas las cartas del usuario
        const letters = await Letter.find({ author: userId }).select("diary");
        
        // Filtrar y devolver los diarios únicos
        const diaries = [...new Set(letters.map(letter => letter.diary).filter(diary => diary))];
        return res.status(200).json({
            message: "success",
            diaries: diaries
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error getting diaries",
            error: error.message
        });
    }
}


const countLetters = async (req, res) => {
    try {
      let userId = req.params.id;
  
      // Si no hay ID en params, usar el autenticado
      if (!userId && req.user && req.user.id) {
        userId = req.user.id;
      }
  
      if (!userId) {
        return res.status(400).json({
          status: "error",
          message: "User ID not provided",
          counts: {}
        });
      }
  
      // Agrupar por idioma y contar
      const countsByLanguage = await Letter.aggregate([
        { $match: { author: userId } },
        { $group: { _id: "$language", count: { $sum: 1 } } }
      ]);
  
      // Transformar el resultado a objeto { idioma: count }
      const result = countsByLanguage.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});
  
      res.status(200).json({
        status: "success",
        counts: result,
      });
  
    } catch (error) {
      console.error("Error counting letters:", error);
      res.status(500).json({
        status: "error",
        message: "Error counting letters",
        counts: {}
      });
    }
  };
  


module.exports = { 
    saveLetter,
    viewLetter, 
    editLetter, 
    deleteLetter, 
    listLetters, 
    shareLetter,
    getUserDiaries,
    countLetters
};