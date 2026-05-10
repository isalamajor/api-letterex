const CorrectedLetter = require("../models/correctedLetter");
const Letter = require("../models/letter");

const getLetterCorrectionById = async (req, res) => {
  try {
    const { correctedLetterId } = req.params;

    const correctedLetter = await CorrectedLetter.findById(correctedLetterId)
      .populate("originalLetter", "-sharedWith -diary") // Fetch the full original letter
      .populate("reviewer", "nickname image") // Fetch the reviewer
      .populate("sender", "nickname image"); // Fetch the sender

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
    const { corrections } = req.body; // Array of corrections the reviewer wants to add
    const { comments } = req.body; // General comments (optional)

    // Verify that an array of corrections was sent
    if (
      comments === "" &&
      (!Array.isArray(corrections) || corrections.length === 0)
    ) {
      return res
        .status(400)
        .json({ message: "Corrections must be an array and cannot be empty." });
    }

    // Find the corrected letter
    const correctedLetter = await CorrectedLetter.findById(correctedLetterId);
    if (!correctedLetter) {
      return res.status(404).json({ message: "Corrected letter not found." });
    }

    // Verify that the user is the reviewer
    if (correctedLetter.reviewer.toString() !== req.user.id) {
      return res.status(403).json({
        message: "You are not authorized to add corrections to this letter.",
      });
    }

    // Verify that the letter has not been sent back
    if (correctedLetter.sentBack) {
      return res.status(403).json({
        message: "Cannot add corrections to a letter that has been sent back.",
      });
    }

    // Replace the current corrections with the new ones
    correctedLetter.corrections = corrections;

    // If comments were provided, update them
    if (comments) {
      correctedLetter.comments = comments;
    }

    // Update correction date
    correctedLetter.corrected_at = Date.now();

    // Save the corrected letter with the new corrections
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

    // Find the corrected letter
    const correctedLetter = await CorrectedLetter.findById(correctedLetterId);
    if (!correctedLetter) {
      return res.status(404).json({ message: "Corrected letter not found." });
    }

    // Verify that the user is the reviewer
    if (correctedLetter.reviewer.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Unauthorized to send back this letter." });
    }

    // Update the corrected letter
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

    // Find all corrected letters related to the original one (letters corrected for me)
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
    // Find all letters to be corrected where the user is the reviewer
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

    // Get the list of unique senders
    const uniqueSenders = [
      ...new Map(
        correctedLetters
          .filter((cl) => cl.sender && cl.sender.nickname)
          .map((cl) => [cl.sender.nickname, cl.sender.nickname]),
      ).values(),
    ];

    // Mark letters as seen (after fetching them)
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
    const sentBackFilter = req.query.sentBack; // "true", "false", or undefined
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const itemsPerPage = Math.max(parseInt(req.query.itemsPerPage) || 10, 1);
    const skip = (page - 1) * itemsPerPage;

    // First, get all corrected letters for the user
    const allCorrectedLetters = await CorrectedLetter.find({ reviewer: userId })
      .populate("originalLetter", "-sharedWith -content -diary")
      .populate("sender", "_id image nickname")
      .sort({ received_at: -1 });

    const validLetters = allCorrectedLetters.filter((cl) => cl.originalLetter);

    // Filter by title if there is a search term
    const searchRegex = new RegExp(
      searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    const senderRegex = senderFilter
      ? new RegExp(senderFilter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const filteredLetters = validLetters.filter((cl) => {
      // Filter by title
      if (searchTerm && !searchRegex.test(cl.originalLetter.title))
        return false;

      // Filter by sender
      if (senderRegex && (!cl.sender || !senderRegex.test(cl.sender.nickname)))
        return false;

      // Filter by sentBack
      if (sentBackFilter !== undefined) {
        const sentBackBool =
          sentBackFilter === "true" || sentBackFilter === true;
        if (cl.sentBack !== sentBackBool) return false;
      }

      return true;
    });

    // Get the list of unique senders from all letters (unfiltered)
    const uniqueSenders = [
      ...new Set(
        validLetters
          .filter((cl) => cl.sender?.nickname)
          .map((cl) => cl.sender.nickname),
      ),
    ];

    // Apply pagination manually
    const paginatedLetters = filteredLetters.slice(skip, skip + itemsPerPage);
    const totalLetters = validLetters.length;
    const totalFiltered = filteredLetters.length;

    // Mark as seen
    await CorrectedLetter.updateMany({ reviewer: userId }, { seen: true });
    return res.status(200).json({
      status: "success",
      letters: paginatedLetters,
      senders: uniqueSenders,
      page,
      itemsPerPage,
      totalLetters,
      totalFiltered,
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

    // If there is no ID in params, use the authenticated one
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
    const correctedLetters = await CorrectedLetter.find({
      reviewer: userId,
      sentBack: true,
    }).populate("originalLetter", "language"); // Only fetch the language field

    // Count by language
    const countsByLanguage = correctedLetters.reduce((acc, doc) => {
      const lang = doc.originalLetter?.language;
      if (lang) {
        acc[lang] = (acc[lang] || 0) + 1;
      }
      return acc;
    }, {});

    res.status(200).json({
      status: "success",
      counts: countsByLanguage,
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
