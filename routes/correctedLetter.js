const express = require("express");
const router = express.Router();
const CorrectedLetterController = require("../controllers/correctedLetter");
const auth = require("../middlewares/auth");

// Definir rutas
router.patch("/send-back/:correctedLetterId", auth.authentificate, CorrectedLetterController.sendBack);
router.get("/corrections/:originalLetterId", auth.authentificate, CorrectedLetterController.getCorrectionsByLetter);
router.get("/received/", auth.authentificate, CorrectedLetterController.getReceivedLetters);

// Exportar router
module.exports = router;
