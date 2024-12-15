const express = require("express");
const router = express.Router();
const UserController = require("../controllers/user");


// Definir rutas
router.get("/prueba-letter", UserController.pruebaUser);


// Exportar router
module.exports = router;
