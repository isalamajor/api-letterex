const express = require("express");
const router = express.Router();
const UserController = require("../controllers/follow");


// Definir rutas
router.get("/prueba-follow", UserController.pruebaFollow);


// Exportar router
module.exports = router;
