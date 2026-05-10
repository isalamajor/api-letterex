const express = require("express");
const router = express.Router();
const UserController = require("../controllers/user");
const auth = require("../middlewares/auth");
const uploads = require("../middlewares/uploads");

// Define routes
router.post("/register", UserController.register);
router.post("/login", UserController.login);
router.post("/logout", UserController.logout);
router.get("/profile/:id?", auth.authentificate, UserController.profile);
router.get("/list-users/:page?", auth.authentificate, UserController.listUsers); // page? -> page is an optional parameter
router.put("/update", auth.authentificate, UserController.update);
router.put(
  "/change-password",
  auth.authentificate,
  UserController.changePassword,
); // currentPassword, newPassword
router.put(
  "/profile-picture",
  [auth.authentificate, uploads.single("file0")],
  UserController.uploadProfilePicture,
);
router.delete(
  "/profile-picture",
  auth.authentificate,
  UserController.deleteProfilePicture,
);
router.get("/profile-picture/:id", UserController.getProfilePicture);
router.get("/check-nickname/:nickname", UserController.checkNickname);
router.get("/check-email/:email", UserController.checkEmail);
router.post("/verification-code", UserController.sendVerificationCode);
router.post("/check-code", UserController.verifyCode);
router.put("/reset-password", UserController.resetPassword);
router.delete(
  "/delete-account",
  auth.authentificate,
  UserController.deleteAccount,
);

// Export router
module.exports = router;
