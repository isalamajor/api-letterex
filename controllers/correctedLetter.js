const CorrectedLetter = require("../models/correctedLetter");
const Letter = require("../models/letter");

const getLetterCorrectionById = async (req, res) => {
  try {
    const { correctedLetterId } = req.params;

    const correctedLetter = await CorrectedLetter.findById(correctedLetterId)
      .populate("originalLetter", "-sharedWith -diary") // Trae toda la carta original
      .populate("reviewer", "nickname image") // Trae el revisor
      .populate("sender", "nickname image"); // Trae el remitente

    if (!correctedLetter) {
      return res.status(404).json({ message: "Corrected letter not found." });
    }

    return res.status(200).json({
      status: "success",
      correctedLetter,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Error retrieving corrected letter",
      error: error.message,
    });
  }
};

const updateCorrections = async (req, res) => {
  try {
    const { correctedLetterId } = req.params;
    const { corrections } = req.body; // Array de correcciones que el revisor desea agregar
    const { comments } = req.body; // Comentarios generales (opcional)

    // Verificar que se ha enviado un array de correcciones
    if (
      comments === "" &&
      (!Array.isArray(corrections) || corrections.length === 0)
    ) {
      return res
        .status(400)
        .json({ message: "Corrections must be an array and cannot be empty." });
    }

    // Buscar la carta corregida
    const correctedLetter = await CorrectedLetter.findById(correctedLetterId);
    if (!correctedLetter) {
      return res.status(404).json({ message: "Corrected letter not found." });
    }

    // Verificar que el usuario es el revisor
    if (correctedLetter.reviewer.toString() !== req.user.id) {
      return res.status(403).json({
        message: "You are not authorized to add corrections to this letter.",
      });
    }

    // Verificar que la carta no ha sido enviada de vuelta
    if (correctedLetter.sentBack) {
      return res.status(403).json({
        message: "Cannot add corrections to a letter that has been sent back.",
      });
    }

    // Cambiar las correcciones actuales por las nuevas
    correctedLetter.corrections = corrections;

    // Si se han proporcionado comentarios, actualizarlos
    if (comments) {
      correctedLetter.comments = comments;
    }

    // Actualizar la fecha de corrección
    correctedLetter.corrected_at = Date.now();

    // Guardar la carta corregida con las nuevas correcciones
    await correctedLetter.save();

    return res.status(200).json({
      message: "Corrections updated successfully.",
      correctedLetter,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error adding corrections",
      error: error.message,
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
      return res
        .status(403)
        .json({ message: "Unauthorized to send back this letter." });
    }

    // Actualizar la carta corregida
    correctedLetter.sentBack = true;
    correctedLetter.corrected_at = Date.now();

    await correctedLetter.save();

    return res.status(200).json({
      message: "Corrected letter sent back successfully.",
      correctedLetter,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error sending back corrected letter",
      error: error.message,
    });
  }
};

const getCorrectionsByLetter = async (req, res) => {
  try {
    const { originalLetterId } = req.params;

    // Buscar todas las cartas corregidas relacionadas con la original (MIS cartas que me corrigieron)
    const correctedLetters = await CorrectedLetter.find({
      originalLetter: originalLetterId,
      sentBack: true,
    });

    return res.status(200).json({
      status: "success",
      correctedLetters,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Error retrieving corrected letters",
      error: error.message,
    });
  }
};

const getReceivedLetters = async (req, res) => {
  try {
    const userId = req.user.id;
    // Buscar todas las cartas a corregir donde el usuario es el revisor
    const correctedLettersRaw = await CorrectedLetter.find({ reviewer: userId })
      .select(
        "originalLetter sender sentBack corrected_at received_at seen deleted",
      )
      .populate("originalLetter", "-sharedWith -content -diary")
      .populate("sender", "_id image nickname")
      .sort({ received_at: -1 });

    const correctedLetters = correctedLettersRaw.filter(
      (cl) => cl.originalLetter !== null,
    );

    // Obtener lista de senders únicos
    const uniqueSenders = [
      ...new Map(
        correctedLetters
          .filter((cl) => cl.sender && cl.sender.nickname)
          .map((cl) => [cl.sender.nickname, cl.sender.nickname]),
      ).values(),
    ];

    // Marcar las cartas como vistas (después de haberlas obtenido)
    await CorrectedLetter.updateMany({ reviewer: userId }, { seen: true });

    return res.status(200).json({
      status: "success",
      letters: correctedLetters,
      senders: uniqueSenders,
    });
  } catch (error) {
    console.log("error fetching received corrected letters:", error);
    return res.status(500).json({
      status: "error",
      message: "Error fetching received corrected letters",
      error: error.message,
    });
  }
};

const searchReceivedLetters = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    const searchTerm = typeof req.query.q === "string" ? req.query.q : "";
    const senderFilter =
      typeof req.query.sender === "string" ? req.query.sender : "";
    const sentBackFilter = req.query.sentBack; // "true", "false", o undefined
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const itemsPerPage = Math.max(parseInt(req.query.itemsPerPage) || 10, 1);
    const skip = (page - 1) * itemsPerPage;

    // Primero obtener todas las correctedLetters del usuario
    const allCorrectedLetters = await CorrectedLetter.find({ reviewer: userId })
      .populate("originalLetter", "-sharedWith -content -diary")
      .populate("sender", "_id image nickname")
      .sort({ received_at: -1 });

    const validLetters = allCorrectedLetters.filter((cl) => cl.originalLetter);

    // Filtrar por título si hay término de búsqueda
    const searchRegex = new RegExp(
      searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    const senderRegex = senderFilter
      ? new RegExp(senderFilter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const filteredLetters = validLetters.filter((cl) => {
      // Filtrar por título
      if (searchTerm && !searchRegex.test(cl.originalLetter.title))
        return false;

      // Filtrar por sender
      if (senderRegex && (!cl.sender || !senderRegex.test(cl.sender.nickname)))
        return false;

      // Filtrar por sentBack
      if (sentBackFilter !== undefined) {
        const sentBackBool =
          sentBackFilter === "true" || sentBackFilter === true;
        if (cl.sentBack !== sentBackBool) return false;
      }

      return true;
    });

    // Obtener lista de senders únicos de todas las cartas (sin filtrar)
    const uniqueSenders = [
      ...new Map(
        validLetters
          .filter((cl) => cl.sender && cl.sender.nickname)
          .map((cl) => [cl.sender.nickname, cl.sender.nickname]),
      ).values(),
    ];

    // Aplicar paginación manualmente
    const paginatedLetters = filteredLetters.slice(skip, skip + itemsPerPage);
    const totalLetters = validLetters.length;
    const totalFiltered = filteredLetters.length;

    // Marcar como vistas
    await CorrectedLetter.updateMany({ reviewer: userId }, { seen: true });
    return res.status(200).json({
      status: "success",
      letters: paginatedLetters,
      senders: uniqueSenders,
      page,
      itemsPerPage,
      totalLetters,
      totalPages: Math.ceil(totalFiltered / itemsPerPage),
    });
  } catch (error) {
    console.log("error searching received corrected letters:", error);
    return res.status(500).json({
      status: "error",
      message: "Error searching received corrected letters",
      error: error.message,
    });
  }
};

const countCorrectedLetters = async (req, res) => {
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
        counts: {},
      });
    }
    // Agrupar por idioma y contar
    /*const countsByLanguage = await CorrectedLetter.aggregate([
        { $match: { reviewer: userId, sentBack: true } },
        { $group: { _id: "$language", count: { $sum: 1 } } }
      ]);*/
    const correctedLetters = await CorrectedLetter.find({
      reviewer: userId,
      sentBack: true,
    }).populate("originalLetter", "language"); // Solo traemos el campo language

    // Contar por idioma
    const countsByLanguage = correctedLetters.reduce((acc, doc) => {
      const lang = doc.originalLetter?.language;
      if (lang) {
        acc[lang] = (acc[lang] || 0) + 1;
      }
      return acc;
    }, {});

    // Transformar el resultado a objeto { idioma: count }
    /*const result = countsByLanguage.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});*/
    const result = countsByLanguage;

    res.status(200).json({
      status: "success",
      counts: result,
    });
  } catch (error) {
    console.error("Error counting letters:", error);
    res.status(500).json({
      status: "error",
      message: "Error counting letters",
      counts: {},
    });
  }
};

const deleteCorrectedLetter = async (req, res) => {
  try {
    const { correctedLetterId } = req.params;
    const userId = req.user.id;

    const correctedLetter = await CorrectedLetter.findById(
      correctedLetterId,
    ).populate("originalLetter", "deleted");

    if (!correctedLetter) {
      return res.status(404).json({
        status: "error",
        message: "Corrected letter not found",
      });
    }

    if (correctedLetter.reviewer.toString() !== userId) {
      return res.status(403).json({
        status: "error",
        message: "User not authorized to delete this letter",
      });
    }

    if (!correctedLetter.originalLetter.deleted) {
      return res.status(402).json({
        status: "error",
        message: "Original letter not deleted by author",
      });
    }

    const resDelete = CorrectedLetter.findByIdAndDelete(correctedLetterId);

    // Once the corrected letter is deleted, we can also delete the original letter
    const resDeleteOriginal = await Letter.findByIdAndDelete(
      correctedLetter.originalLetter._id,
    );

    if (resDelete && resDeleteOriginal) {
      return res.status(200).json({
        status: "success",
        message: "Corrected Letter and Letter deleted successfully",
      });
    }

    return res.status(401).json({
      status: "error",
      message: "Error when deleting letter",
    });
  } catch (error) {
    console.error("Error deleting corrected letter:", error);
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

module.exports = {
  getLetterCorrectionById,
  updateCorrections,
  sendBack,
  getCorrectionsByLetter,
  getReceivedLetters,
  countCorrectedLetters,
  deleteCorrectedLetter,
  searchReceivedLetters,
};
