const express = require("express");
const router = express.Router();
const LetterController = require("../controllers/letter");
const auth = require("../middlewares/auth");


// Definir rutas
console.log(LetterController);
router.post("/new", auth.authentificate, LetterController.saveLetter); // Guardar una carta
router.get("/view/:letterId", auth.authentificate, LetterController.viewLetter); // Obtener info y contenido 
router.put("/edit/:id", auth.authentificate, LetterController.editLetter); // Editar una carta
router.delete("/delete/:id", auth.authentificate, LetterController.deleteLetter); // Eliminar una carta
router.get("/list", auth.authentificate, LetterController.listLetters); // Listar todas las cartas del usuario
router.post("/share/:id", auth.authentificate, LetterController.shareLetter); // Compartir una carta
router.get("/diaries", auth.authentificate, LetterController.getUserDiaries); // Listar diarios del usuario


// Exportar router
module.exports = router;
