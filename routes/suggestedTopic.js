const express = require("express");
const router = express.Router();
const SuggestedTopicController = require("../controllers/suggestedTopic");
const auth = require("../middlewares/auth");


// Definir rutas
router.post("/", auth.authentificate, SuggestedTopicController.postTopic); // Guardar una carta
router.delete("/:topicId", auth.authentificate, SuggestedTopicController.deleteTopic); // Obtener info y contenido
router.get("/:communityId", auth.authentificate, SuggestedTopicController.getCommunityTopics)

// Exportar router
module.exports = router;
