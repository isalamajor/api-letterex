const { User } = require("../models/user");
const Community = require("../models/community");
const CorrectedLetter = require("../models/correctedLetter");
const FriendRequest = require("../models/friendRequest");
const mongoose = require("mongoose");


const checkFriendRequestExists = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token
        const userId = req.user.id;

        // Recoger el ID del usuario destino
        const requestingUser = req.params.id;

        // Verificar si existe una solicitud de amistad
        const existingRequest = await FriendRequest.findOne({
            sender: requestingUser,
            receiver: userId
        });

        if (existingRequest) {
            return res.status(200).json({
                status: "success",
                message: "Ya existe una solicitud de amistad",
                result: "1"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "No existe una solicitud de amistad",
            result: "0"
        });
    } catch (error) {
        console.error("Error al comprobar la solicitud de amistad:", error);
        return res.status(500).json({
            status: "error",
            message: "Error al comprobar la solicitud de amistad",
            error: error.message
        });
    }
};


const sendRequest = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token
        const userId = req.user.id;

        // Recoger el ID de la comunidad a la que se desea enviar la solicitud
        const communityId = req.params.id;

        if (!communityId) {
            return res.status(400).json({
                status: "error",
                message: "Missing fields"
            });
        }

        if (!userId) {
            return res.status(401).json({
                status: "error",
                message: "Unathorized"
            })
        }

        // Verificar que el usuario no sea ya parte de la comunidad
        const community = await Community.findById(communityId)

        if (community.members.findOne(m => m.user.equals(userId))) {
            return res.status(409).json({
                status: "error",
                message: "This user is already part of the community"
            })
        }

        // Verificar que no exista una solicitud previa
        if (community.pendingRequests.findOne(p => p.user.equals(userId))) {
            return res.status(409).json({
                status: "error",
                message: "This user already sent a request to be part of this community"
            })
        }

        // Crear una nueva solicitud
        community.pendingRequests.push({
            user: userId
        })

        await community.save()

        return res.status(200).json({
            status: "success",
            message: "Community request sent successfully"
        })

    } catch (error) {
        console.error("Error sending community request:", error);
        return res.status(500).json({
            status: "error",
            message: "Error sending community request",
            error: error.message
        });
    }
};



const listRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const communityId = req.params.communityId;
        
        // Missing fields
        if (!communityId) {
            return res.status(400).json({
                status: "error",
                message: "Fields missing. Required fields: communityId."
            })
        }
        
        // Unauthorized
        const community = await Community.findById(communityId).populate("pendingRequests.user", "nickname image")

        if (!community) {
            return res.status(404).json({
                status: "error",
                message: `Community with id ${communityId} does not exist`
            })
        }

        if (!community.creator.equals(userId)) {
            return res.status(403).json({
                status: "error",
                message: "User not authorized to perform this action"
            })
        }

        const pendingRequests = community.pendingRequests

        return res.status(200).json({
            status: "success",
            requests: pendingRequests
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error obtaining community requests",
            error: error.message,
        });
    }
};


const rejectRequest = async (req, res) => {
    try {
        const loggedUserId = req.user.id;
        const { communityId, userId } = req.body; 

        // Missing fields
        if (!communityId || !userId) {
            return res.status(400).json({
                status: "error",
                message: "Fields missing. Required fields: communityId, userId"
            })
        }
        
        // Unauthorized
        const community = Community.findById(communityId)

        if (!community) {
            return res.status(404).json({
                status: "error",
                message: `Community with id ${communityId} does not exist`
            })
        }

        if (!community.creator.equals(loggedUserId)) {
            return res.status(403).json({
                status: "error",
                message: "User not authorized to perform this action"
            })
        }

        // See if we actually had a request from that user
        const requestToAccept = community.pendingRequests.find(p => p.user.equals(userId))
        if (!requestToAccept) {
            return res.status(409).json({
                status: "error",
                message: "There is no request from this user to enter the community"
            })
        }

        // Delete pending request
        pendingRequestsUpdated = community.pendingRequests.filter(p => !p.user.equals(userId))
        community.pendingRequests = pendingRequestsUpdated
        await community.save()

        return res.status(200).json({
            status: "success",
            message: "User rejected to enter community"
        })

    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error rejecting member into community"
        })
    }
}


const acceptRequest = async (req, res) => {
    try {
        const loggedUserId = req.user.id;
        const { communityId, userId } = req.body; 

        // Missing fields
        if (!communityId || !userId) {
            return res.status(400).json({
                status: "error",
                message: "Fields missing. Required fields: communityId, userId"
            })
        }
        
        // Unauthorized
        const community = Community.findById(communityId)

        if (!community) {
            return res.status(404).json({
                status: "error",
                message: `Community with id ${communityId} does not exist`
            })
        }

        if (!community.creator.equals(loggedUserId)) {
            return res.status(403).json({
                status: "error",
                message: "User not authorized to perform this action"
            })
        }

        // See if we actually had a request from that user
        const requestToAccept = community.pendingRequests.find(p => p.user.equals(userId))
        if (!requestToAccept) {
            return res.status(409).json({
                status: "error",
                message: "There is no request from this user to enter the community"
            })
        }

        // Delete pending request and add member
        pendingRequestsUpdated = community.pendingRequests.filter(p => !p.user.equals(userId))
        community.pendingRequests = pendingRequestsUpdated
        community.members.push({ user: userId })
        await community.save()

        return res.status(200).json({
            status: "success",
            message: "User accepted into community"
        })

    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error accepting member into community"
        })
    }
}


const kickUser = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token
        const loggedUserId = req.user.id;

        const { communityId, userId } = req.body; 


        if (!communityId || !userId) {
            return res.status(400).json({
                status: "error",
                message: "Fields missing. Required fields: communityId, userId"
            })
        }

        const community = Community.findById(communityId)

        if (!community.creator.equals(loggedUserId)) {
            return res.status(403).json({
                status: "error",
                message: "User not authorized to perform this action"
            })
        }

        const userToKick = community.members.find(m => m.user.equals(userId))

        if (!userToKick) {
            return res.status(409).json({
                status: "error",
                message: "This user whether does not exist or is not part of this community"
            })
        }

        const membersUpdated = community.members.filter(m => !m.user.equals(userId))
        community.members = membersUpdated
        await community.save()

        return res.status(200).json({
            status: "success",
            message: "User deleted from community"
        });

    } catch (error) {
        console.error("Error deleting community member:", error);
        return res.status(500).json({
            status: "error",
            message: "Error deleting community member",
            error: error.message
        });
    }
};



const exitCommunity = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token
        const userId = req.user.id;
        const communityId = req.params.communityId; 

        if (!userId) {
            return res.status(404).json({
                status: 'error',
                message: 'Unauthorized'
            })  
        }

        if (!communityId) {
            return res.status(400).json({
                status: 'error',
                message: 'Fields missing. Required fields: communityId'
            })
        }

        const community = await Community.findById(communityId)

        if (!community) {
            return res.status(404).json({
                status: "error",
                message: `Community with id ${communityId} does not exist`
            })
        }

        if (!community.members.findOne(m => m.user.equals(userId))) {
            return res.status(409).json({
                status: "error",
                message: "User is not part of this community"
            })
        }

        community.members.filter(m => !m.user.equals(userId))
        await community.save()

        return res.status(200).json({
            status: "success",
            message: "User exited community successfully"
        })

    } catch (error) {
        console.error("Error deleting community member (exit community):", error);
        return res.status(500).json({
            status: "error",
            message: "Error deleting community member (exit community)",
            error: error.message
        });
    }
};


const getMembers = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token
        const userId = req.user.id;

        // Get community id
        const communityId = req.params.communityId

        // Get members
        const community = await Community.findById(communityId).select("members").populate("members.user", "nickname image")

        return res.status(200).json({
            status: "success",
            members: community.members
        });
    } catch (error) {
        console.error("Error obtaining community members:", error);
        return res.status(500).json({
            status: "error",
            message: "Error obtaining community members",
            error: error.message
        });
    }
};




const getRequests = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token
        const userId = req.user.id;

        if (!userId) {
            return res.status(401).json({
                status: "error",
                message: "User not authenticated"
            })
        }

        // Get community id
        const communityId = req.params.communityId

        if (!communityId) {
            return res.status(400).json({
                status: "error",
                message: "Missing fields"
            })
        }
        const community = await Community.findById(communityId).select("pendingRequests").populate("pendingRequests.user", "nickname image")

        if (!community) {
            return res.status(404).json({
                status: "error",
                message: `Community with id ${communityId} not found`
            })
        }

        if (!community.creator.equals(userId)) {
            return res.status(403).json({
                status: "error",
                message: "User not authorized to perform this action"
            })
        }

        return res.status(200).json({
            status: "success",
            members: community.pendingRequests
        });

    } catch (error) {
        console.error("Error obtaining community requests:", error);
        return res.status(500).json({
            status: "error",
            message: "Error obtaining community requests",
            error: error.message
        });
    }
};







module.exports = {
    sendRequest,
    listRequests,
    acceptRequest,
    rejectRequest,
    exitCommunity,
    kickUser,
    getRequests,
    getMembers
};
