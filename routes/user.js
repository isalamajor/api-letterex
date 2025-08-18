const express = require("express");
const router = express.Router();
const UserController = require("../controllers/user");
const auth = require("../middlewares/auth");
const multer = require("../middlewares/uploads");
const uploads = require("../middlewares/uploads");


// Definir rutas
router.get("/prueba-user", auth.authentificate, UserController.pruebaUser); // Meter en postman header Authorization : token
router.post("/register", UserController.register);
router.post("/login", UserController.login);
router.get("/profile/:id?", auth.authentificate, UserController.profile);
router.get("/list-users/:page?", auth.authentificate, UserController.listUsers); // page? -> page es un parámetro opcional
router.put("/update", auth.authentificate, UserController.update); 
router.put("/change-password", auth.authentificate, UserController.changePassword); // currentPassword, newPassword
router.put("/profile-picture", [auth.authentificate, uploads.single("file0")], UserController.uploadProfilePicture)
router.get("/profile-picture/:id", UserController.getProfilePicture);
router.get("/check-nickname/:nickname", UserController.checkNickname);
router.get("/check-email/:email", UserController.checkEmail);
router.post("/verificate-email/:email", UserController.sendVerificationCode)
router.post("/check-code", UserController.verifyCode);



// Exportar router
module.exports = router;
