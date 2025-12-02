const express = require("express");
const router = express.Router();
const CommunityController = require("../controllers/community");
const auth = require("../middlewares/auth");


// Definir rutas
router.post("/new", auth.authentificate, CommunityController.createCommunity); // Guardar una carta
router.post("/request/:id", auth.authentificate, CommunityController.sendRequest); // Send request to community with that id 
router.get("/request/:id", auth.authentificate, CommunityController.getRequests); // Obtain pendingRequest of community with that id
router.post("/request-accept", auth.authentificate, CommunityController.acceptRequest); // Accept pendingRequest, body: { communityId, userId } 
router.post("/request-reject/", auth.authentificate, CommunityController.rejectRequest); // Reject pendingRequest, body: { communityId, userId }
router.post("/exit/:id", auth.authentificate, CommunityController.exitCommunity); 
router.post("/kick", auth.authentificate, CommunityController.kickUser); // { communityId, userId }
router.get("/members/:id", auth.authentificate, CommunityController.getRequests);
router.get("/:language", auth.authentificate, CommunityController.getCommunities); // Obtener comunidades del usuario logeado o del id por idioma
router.get("/", auth.authentificate, CommunityController.getUserCommunities); // Obtener comunidades a las que pertenece el usuario
router.delete("/:id", auth.authentificate, CommunityController.deleteCommunity);
router.post("/:id", auth.authentificate, CommunityController.updateCommunity); // { communityId, description, isPrivate }
router.post("/picture/:id", auth.authentificate, CommunityController.uploadCommunityPicture);
router.delete("/picture/:id", auth.authentificate, CommunityController.deleteCommunity);



// Exportar router
module.exports = router;
