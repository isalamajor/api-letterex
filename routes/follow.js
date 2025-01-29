const express = require("express");
const router = express.Router();
const FollowController = require("../controllers/follow");
const auth = require("../middlewares/auth");


// Definir rutas
router.post("/add/:id", auth.authentificate, FollowController.saveFollow);
router.delete("/unfollow/:id", auth.authentificate, FollowController.deleteFollow);
router.get("/friend-request/:id", auth.authentificate, FollowController.checkFriendRequestExists); // OK
router.get("/friends", auth.authentificate, FollowController.getFriends); // OK
router.post("/request-follow/:id", auth.authentificate, FollowController.sendFriendRequest); // OK
router.get("/friend-requests", auth.authentificate, FollowController.listFriendRequests); // OK
router.post("/friend-request/accept/:id", auth.authentificate, FollowController.acceptFriendRequest); // OK
router.post("/friend-request/reject/:id", auth.authentificate, FollowController.rejectFriendRequest); // OK



// Exportar router
module.exports = router;
