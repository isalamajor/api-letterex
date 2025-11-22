const { User } = require("../models/user");
const Follow = require("../models/follow");
const CorrectedLetter = require("../models/correctedLetter");
const FriendRequest = require("../models/friendRequest");
const mongoose = require("mongoose");

const pruebaFollow = (req, res) => {
    return res.status(200).json({
        message: "Mensaje enviado desde user controller"
    })
}


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


const sendFriendRequest = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token
        const userId = req.user.id;

        // Recoger el ID del usuario al que se desea enviar la solicitud
        const receiverId = req.params.id;

        console.log("Sending friend request from ", userId, " to ", receiverId);

        if (!userId || !receiverId || receiverId === "undefined" || userId === receiverId) {
            return res.status(400).json({
                status: "error",
                message: "Solicitud de amistad inválida"
            });
        }

        // Verificar que los usuarios no sean ya amigos
        const areFriends = await Follow.findOne({
            $or: [
                { user1: userId, user2: receiverId },
                { user1: receiverId, user2: userId }
            ]
        });

        if (areFriends) {
            return res.status(400).json({
                status: "error",
                message: "Ambos usuarios ya son amigos"
            });
        }

        // Verificar que no exista una solicitud de amistad previa
        const existingRequest = await FriendRequest.findOne({
            sender: userId,
            receiver: receiverId
        });

        if (existingRequest) {
            return res.status(400).json({
                status: "error",
                message: "Ya existe una solicitud de amistad pendiente"
            });
        }

        // Crear una nueva solicitud de amistad
        const friendRequest = new FriendRequest({
            sender: userId,
            receiver: receiverId
        });

        const savedRequest = await friendRequest.save();

        if (!savedRequest) {
            return res.status(500).json({
                status: "error",
                message: "No se pudo enviar la solicitud de amistad"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Solicitud de amistad enviada correctamente",
            friendRequest: savedRequest
        });
    } catch (error) {
        console.error("Error al enviar la solicitud de amistad:", error);
        return res.status(500).json({
            status: "error",
            message: "Error al intentar enviar la solicitud de amistad",
            error: error.message
        });
    }
};



const listFriendRequests = async (req, res) => {
    try {
        const userId = req.user.id;

        const requests = await FriendRequest.find({ receiver: userId })
            .sort({ created_at: -1 })    
            .populate("sender", "_id nickname image");

        const requestDetails = requests.map(request => ({
            ...request.toObject(),
            sender: {
                ...request.sender.toObject(),
                profilePictureUrl: `/api/users/profile-picture/${request.sender._id}`
            }
        }));

        return res.status(200).json({
            status: "success",
            requests: requestDetails,
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error al obtener las solicitudes de amistad recibidas",
            error: error.message,
        });
    }
};


const acceptFriendRequest = async (req, res) => {
    try {
        const userId = req.user.id; // Usuario autenticado (receptor de la solicitud)
        const senderId = req.params.id; // ID del usuario que envió la solicitud
        console.log("Aceptar solicitud de amistad de:", senderId, userId);
        // Verificar si la solicitud existe
        const request = await FriendRequest.findOne({ sender: senderId, receiver: userId });

        if (!request) {
            return res.status(404).json({
                status: "error",
                message: "No se encontró la solicitud de amistad",
            });
        }

        // Crear una relación de Follow
        const newFollow = new Follow({
            user1: userId,
            user2: senderId,
        });

        await newFollow.save();

        // Eliminar la solicitud de amistad
        await FriendRequest.findByIdAndDelete(request._id);

        return res.status(200).json({
            status: "success",
            message: "Solicitud de amistad aceptada correctamente",
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error al aceptar la solicitud de amistad",
            error: error.message,
        });
    }
};



const rejectFriendRequest = async (req, res) => {
    try {
        const userId = req.user.id; // Usuario autenticado (receptor de la solicitud)
        const senderId = req.params.id; // ID del usuario que envió la solicitud

        // Verificar si la solicitud existe
        const request = await FriendRequest.findOne({ sender: senderId, receiver: userId });

        if (!request) {
            return res.status(404).json({
                status: "error",
                message: "No se encontró la solicitud de amistad",
            });
        }

        // Eliminar la solicitud de amistad
        await FriendRequest.findByIdAndDelete(request._id);

        return res.status(200).json({
            status: "success",
            message: "Solicitud de amistad rechazada correctamente",
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error al rechazar la solicitud de amistad",
            error: error.message,
        });
    }
};


const saveFollow = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token
        const userId = req.user.id;

        // Recoger parámetros de la petición
        const userToFollow = req.params.id;
        console.log(userToFollow);
        
        // Buscar al usuario en la base de datos
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "Usuario no encontrado"
            });
        }
        const user2 = await User.findById(userToFollow);
        if (!user2) {
            return res.status(404).json({
                status: "error",
                message: "Usuario a seguir no encontrado"
            });
        }
        
        // Crear objeto follow
        let newFollow = new Follow({
            user1: userId,
            user2: userToFollow
        })

        const followStored = newFollow.save();
        if (!followStored) {
            return res.status(500).json({
                status: "error",
                message: "Error storing follow"
            })
        }

        return res.status(200).json({
            status: "success",
            message: "Save follow OK"
        })
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error saving follow"
        })
    }
}


const deleteFollow = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token
        const userId = req.user.id;

        // Recoger el ID del usuario al que se desea dejar de seguir
        const userToUnfollow = req.params.id;

        // Verificar que la relación de seguimiento exista
        const follow = await Follow.findOneAndDelete({ user1: userId, user2: userToUnfollow });

        if (!follow) {
            return res.status(404).json({
                status: "error",
                message: "No se encontró relación de seguimiento para eliminar"
            });
        }

        // Confirmar la eliminación del follow
        return res.status(200).json({
            status: "success",
            message: "Has dejado de seguir al usuario correctamente"
        });
    } catch (error) {
        console.error("Error al eliminar el follow:", error);
        return res.status(500).json({
            status: "error",
            message: "Error al intentar eliminar el follow",
            error: error.message
        });
    }
};



const getFriends = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token
        const userId = req.user.id;

        // Buscar amistades mutuas
        const friends = await Follow.find({
            $or: [
                { user1: userId },
                { user2: userId }
            ]
        });

        // Extraer IDs de amigos
        const friendIds = new Set(); // Evitar duplicados

        friends.forEach((follow) => {
            if (follow.user1 === userId) {
                friendIds.add(follow.user2);
            } else {
                friendIds.add(follow.user1);
            }
        });
        
        // Para cada amigo, obtener su información básica
        const friendDetails = await Promise.all(
            Array.from(friendIds).map(async (friendId) => {
                const friend = await User.findById(friendId).select("nickname image _id");
                if (friend) {
                    const obj = friend.toObject();
                    obj.profilePictureUrl = `/api/users/profile-picture/${obj._id}`;
                    return obj;
                }
                return null;
            })
        );

        // Para cada amigo, obtener cuántas cartas se han intercambiado
        const lettersExchanged = await Promise.all(
            Array.from(friendIds).map(async (friendId) => {
                const count = await CorrectedLetter.countDocuments({
                    $or: [
                        { sender: userId, reviewer: friendId },
                        { sender: friendId, reviewer: userId }
                    ]
                });
                return { friendId, count };
            })
        );

        // Añadirlo a friendDetails
        lettersExchanged.forEach(({ friendId, count }) => {
            const friend = friendDetails.find(f => f._id.toString() === friendId.toString());
            if (friend) {
                friend.lettersExchanged = count;
            }
        });

        return res.status(200).json({
            status: "success",
            count: friendIds.size,
            friends: friendDetails
        });
    } catch (error) {
        console.error("Error al obtener la lista de amigos:", error);
        return res.status(500).json({
            status: "error",
            message: "Error al intentar obtener la lista de amigos",
            error: error.message
        });
    }
};



const getNonFriends = async (req, res) => {
    try {
        // Obtener el ID del usuario autenticado desde el token
        const userId = req.user.id;

        // Buscar usuarios que no son amigos
        const following = await Follow.distinct("user2", { user1: userId });
        const followers = await Follow.distinct("user1", { user2: userId });

        const nonFriends = await User.find({ _id: { $nin: [...new Set([...following, ...followers, userId])] } })
        .select("-email -password -role -bio -location");


        const nonFriendDetails = await Promise.all(
            nonFriends.map(async user => {
                // Verifica si existe una solicitud de amistad pendiente
                const existingRequest = await FriendRequest.findOne({
                    sender: userId,
                    receiver: user._id
                });

                return {
                    ...user.toObject(),
                    profilePictureUrl: `/api/users/profile-picture/${user._id}`,
                    friendRequestSent: !!existingRequest // true si existe, false si no
                };
            })
        );

        return res.status(200).json({
            status: "success",
            count: nonFriendDetails.length,
            users: nonFriendDetails
        });
    } catch (error) {
        console.error("Error al obtener la lista de no amigos:", error);
        return res.status(500).json({
            status: "error",
            message: "Error al intentar obtener la lista de no amigos",
            error: error.message
        });
    }
};



const getSuggestedUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const suggested = await getSuggestedUsersByPriority(userId, 12);

    if (suggested === -1) {
        return res.status(500).json({
            status: "error",
            message: "Error al intentar obtener usuarios sugeridos"
        });
    }
    return res.status(200).json({
      status: "success",
      users: suggested,
    });
  } catch (error) {
    console.error("Error al obtener usuarios sugeridos:", error);
    return res.status(500).json({
      status: "error",
      message: "Error al intentar obtener usuarios sugeridos",
      error: error.message,
    });
  }
};

const getSuggestedUsersByPriority = async (userId, limit = 10) => {

    try {
    
    let suggestedUsers = []
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const user = await User.findById(userId).select("learningLanguage learningLanguage2 learningLanguage3");
    const learningLanguages = [user.learningLanguage, user.learningLanguage2, user.learningLanguage3].filter(Boolean);
    const masterLanguages = [user.masterLanguage, user.masterLanguage2, user.masterLanguage3].filter(Boolean);

    // IDs de amigos (siguiendo o seguidos)
    const following = await Follow.distinct("user2", { user1: userId });
    const followers = await Follow.distinct("user1", { user2: userId });

    // IDs de solicitudes de amistad (enviadas o recibidas)
    const sentRequests = await FriendRequest.distinct("receiver", { sender: userId });
    const receivedRequests = await FriendRequest.distinct("sender", { receiver: userId });


    let excludedIds = [userObjectId, ...new Set([...following, ...followers, ...sentRequests, ...receivedRequests].map(id => new mongoose.Types.ObjectId(id)))];
    const conditions = [
    { $or : [
        { masterLanguage: { $in: learningLanguages} },
        { masterLanguage2 : { $in: learningLanguages } },
        { masterLanguage3: { $in: learningLanguages } }
    ] },
    { $or : [
        { learningLanguage: { $in: masterLanguages} },
        { learningLanguage2 : { $in: masterLanguages } },
        { learningLanguage3: { $in: masterLanguages } }
    ] },
    ]

    const usersToLearn = await User.aggregate([
        { $match: { ...conditions[0], _id: { $nin: excludedIds } } },
        { $sample: { size: limit } },
        { $project: {
            _id: 1,
            nickname: 1,
            image: 1,
            learningLanguage: 1,
            learningLanguage2: 1,
            learningLanguage3: 1,
            masterLanguage: 1,
            masterLanguage2: 1,
            masterLanguage3: 1,
            profilePictureUrl: { $concat: ["/api/users/profile-picture/", { $toString: "$_id" }] }
        }}
    ]);

    excludedIds.push(...usersToLearn.map(user => user._id))

    const usersToTeach = await User.aggregate([
        { $match: { ...conditions[1], _id: { $nin: excludedIds } } },
        { $sample: { size: limit - usersToLearn.length } },
        { $project: {
            _id: 1,
            nickname: 1,
            image: 1,
            learningLanguage: 1,
            learningLanguage2: 1,
            learningLanguage3: 1,
            masterLanguage: 1,
            masterLanguage2: 1,
            masterLanguage3: 1,
            profilePictureUrl: { $concat: ["/api/users/profile-picture/", { $toString: "$_id" }] }
        }}
    ]);

    suggestedUsers = [ ...new Set([...usersToLearn, ...usersToTeach])]
    excludedIds.push(...usersToTeach.map(user => user._id))


    // Rellenar el resto con usuarios random
    const remaining = limit - suggestedUsers.length
    if (remaining > 0) {
        const randomUsers = await User.aggregate([
        { $match: { _id: { $nin: excludedIds } }},
        { $sample: { size: remaining } },
        { $project: {
            _id: 1,
            nickname: 1,
            image: 1,
            learningLanguage: 1,
            learningLanguage2: 1,
            learningLanguage3: 1,
            masterLanguage: 1,
            masterLanguage2: 1,
            masterLanguage3: 1,
            profilePictureUrl: { $concat: ["/api/users/profile-picture/", { $toString: "$_id" }] }
        } }
        ])
        suggestedUsers.push(...randomUsers)
    }

    return suggestedUsers

} catch (error) {
    console.log("Error when obtaining suggested users by priority: ", error);
    return -1
}
}




module.exports = {
    checkFriendRequestExists, 
    pruebaFollow,
    saveFollow,
    deleteFollow,
    getFriends,
    sendFriendRequest,
    listFriendRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    getNonFriends,
    getSuggestedUsers
};
