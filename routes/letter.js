const express = require("express");
const router = express.Router();
const LetterController = require("../controllers/letter");
const auth = require("../middlewares/auth");

// Define routes
router.post("/new", auth.authentificate, LetterController.saveLetter); // Save a letter
router.get("/view/:letterId", auth.authentificate, LetterController.viewLetter); // Get info and content
router.put("/edit/:id", auth.authentificate, LetterController.editLetter); // Edit a letter
router.put("/edit-diary", auth.authentificate, LetterController.editLetter); // Edit a letter's diary
router.delete("/delete/", auth.authentificate, LetterController.deleteLetters); // Delete a letter
router.get("/list", auth.authentificate, LetterController.listLetters); // List all the user's letters
router.get(
  "/list/diary",
  auth.authentificate,
  LetterController.listDiaryLetters,
); // List letters in a diary
router.get(
  "/list/search",
  auth.authentificate,
  LetterController.searchLettersByTitle,
); // Search letters by title and diary
router.post("/share/:id", auth.authentificate, LetterController.shareLetter); // Share a letter
router.get("/diaries", auth.authentificate, LetterController.getUserDiaries); // List the user's diaries
router.get(
  "/diaries/counts",
  auth.authentificate,
  LetterController.getUserDiariesWithCounts,
); // List diaries with letter counts
router.get("/count/:id?", auth.authentificate, LetterController.countLetters); // Count the logged-in user's letters or the specified user's letters by language

// Export router
module.exports = router;
