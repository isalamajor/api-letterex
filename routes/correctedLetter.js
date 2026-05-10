const express = require("express");
const router = express.Router();
const CorrectedLetterController = require("../controllers/correctedLetter");
const auth = require("../middlewares/auth");

// Define routes
router.patch(
  "/send-back/:correctedLetterId",
  auth.authentificate,
  CorrectedLetterController.sendBack,
);
router.get(
  "/corrections/:originalLetterId",
  auth.authentificate,
  CorrectedLetterController.getCorrectionsByLetter,
); // Get corrections made to me
router.get(
  "/correctedLetter/:correctedLetterId",
  auth.authentificate,
  CorrectedLetterController.getLetterCorrectionById,
); // Get my correction in progress or finished
router.get(
  "/received/",
  auth.authentificate,
  CorrectedLetterController.getReceivedLetters,
);
router.get(
  "/received/search",
  auth.authentificate,
  CorrectedLetterController.searchReceivedLetters,
);
router.put(
  "/update/:correctedLetterId",
  auth.authentificate,
  CorrectedLetterController.updateCorrections,
);
router.get(
  "/count/:id?",
  auth.authentificate,
  CorrectedLetterController.countCorrectedLetters,
); // Count corrected letters for the logged-in user or the specified ID by language
router.delete(
  "/:correctedLetterId",
  auth.authentificate,
  CorrectedLetterController.deleteCorrectedLetter,
); // Delete corrected letter and original letter (only if the author deleted it before)

// Export router
module.exports = router;
