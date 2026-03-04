const express = require("express");
const router = express.Router();
const CorrectedLetterController = require("../controllers/correctedLetter");
const auth = require("../middlewares/auth");

// Definir rutas
router.patch(
  "/send-back/:correctedLetterId",
  auth.authentificate,
  CorrectedLetterController.sendBack,
);
router.get(
  "/corrections/:originalLetterId",
  auth.authentificate,
  CorrectedLetterController.getCorrectionsByLetter,
); // Obtener correcciones que me han hecho
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
); // Contar cartas corregidas del usuario logeado o del id por idioma
router.delete(
  "/:correctedLetterId",
  auth.authentificate,
  CorrectedLetterController.deleteCorrectedLetter,
); // Delete corrected letter and original letter (only if author deleted it before)

// Exportar router
module.exports = router;
