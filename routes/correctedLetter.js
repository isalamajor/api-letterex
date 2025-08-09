const express = require("express");
const router = express.Router();
const CorrectedLetterController = require("../controllers/correctedLetter");
const auth = require("../middlewares/auth");

// Definir rutas
router.patch("/send-back/:correctedLetterId", auth.authentificate, CorrectedLetterController.sendBack);
router.get("/corrections/:originalLetterId", auth.authentificate, CorrectedLetterController.getCorrectionsByLetter); // Obtener correcciones que me han hecho
router.get("/correctedLetter/:correctedLetterId", auth.authentificate, CorrectedLetterController.getLetterCorrectionById); // Obtener mi corrección en proceso o terminada
router.get("/received/", auth.authentificate, CorrectedLetterController.getReceivedLetters);
router.put("/update/:correctedLetterId", auth.authentificate, CorrectedLetterController.updateCorrections);

// Exportar router
module.exports = router;
