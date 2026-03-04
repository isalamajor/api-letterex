const mongoose = require("mongoose");
const { User } = require("../models/user");
const Community = require("../models/community");

const createCommunity = async (req, res) => {
  try {
    // Obtener el ID del usuario autenticado desde el token
    const userId = req.user.id;
    const { name, language, description, isPrivate } = req.body;
    console.log(name);
    console.log(language);
    console.log(description);
    console.log(isPrivate);

    if (!name || !language || !description || isPrivate === null) {
      return res.status(400).json({
        status: "error",
        message:
          "Fields missing. Required fields: name, language, description, isPrivate",
      });
    }

    if (
      typeof name !== "string" ||
      name.trim() === "" ||
      typeof language !== "string" ||
      language.trim() === "" ||
      typeof description !== "string" ||
      description.trim() === "" ||
      typeof isPrivate !== "boolean"
    ) {
      return res.status(400).json({
        status: "error",
        message:
          "Invalid input: name, language, description must be non-empty strings and private must be boolean",
      });
    }

    const newCommunity = new Community({
      name: name,
      description: description,
      language: language,
      isPrivate: isPrivate,
      creator: userId,
      members: [{ user: userId }],
      pendingRequests: [],
    });

    await newCommunity.save();

    return res.status(200).json({
      status: "success",
      message: "Community created succesfully",
      community: newCommunity,
    });
  } catch (err) {
    console.log("Error when creating community:", err);
    return res.status(400).json({
      status: "error",
      message: "Error when creating community",
      error: err.message,
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
        message: "Missing fields",
      });
    }

    if (!userId) {
      return res.status(401).json({
        status: "error",
        message: "Unathorized",
      });
    }

    // Verificar que el usuario no sea ya parte de la comunidad
    const community = await Community.findById(communityId);

    if (community.members.find((m) => m.user.equals(userId))) {
      return res.status(409).json({
        status: "error",
        message: "This user is already part of the community",
      });
    }

    // Verificar que no exista una solicitud previa
    if (community.pendingRequests.find((p) => p.user.equals(userId))) {
      return res.status(409).json({
        status: "error",
        message:
          "This user already sent a request to be part of this community",
      });
    }

    // Crear una nueva solicitud
    community.pendingRequests.push({
      user: userId,
    });

    await community.save();

    return res.status(200).json({
      status: "success",
      message: "Community request sent successfully",
    });
  } catch (error) {
    console.error("Error sending community request:", error);
    return res.status(500).json({
      status: "error",
      message: "Error sending community request",
      error: error.message,
    });
  }
};

const listRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const communityId = req.params.id;

    // Missing fields
    if (!communityId) {
      return res.status(400).json({
        status: "error",
        message: "Fields missing. Required fields: communityId.",
      });
    }

    // Unauthorized
    const community = await Community.findById(communityId).populate(
      "pendingRequests.user",
      "nickname image",
    );

    if (!community) {
      return res.status(404).json({
        status: "error",
        message: `Community with id ${communityId} does not exist`,
      });
    }

    if (!community.creator.equals(userId)) {
      return res.status(403).json({
        status: "error",
        message: "User not authorized to perform this action",
      });
    }

    const pendingRequests = community.pendingRequests;

    return res.status(200).json({
      status: "success",
      requests: pendingRequests,
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
        message: "Fields missing. Required fields: communityId, userId",
      });
    }

    // Unauthorized
    const community = Community.findById(communityId);

    if (!community) {
      return res.status(404).json({
        status: "error",
        message: `Community with id ${communityId} does not exist`,
      });
    }

    if (!community.creator.equals(loggedUserId)) {
      return res.status(403).json({
        status: "error",
        message: "User not authorized to perform this action",
      });
    }

    // See if we actually had a request from that user
    const requestToAccept = community.pendingRequests.find((p) =>
      p.user.equals(userId),
    );
    if (!requestToAccept) {
      return res.status(409).json({
        status: "error",
        message: "There is no request from this user to enter the community",
      });
    }

    // Delete pending request
    pendingRequestsUpdated = community.pendingRequests.filter(
      (p) => !p.user.equals(userId),
    );
    community.pendingRequests = pendingRequestsUpdated;
    await community.save();

    return res.status(200).json({
      status: "success",
      message: "User rejected to enter community",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Error rejecting member into community",
    });
  }
};

const acceptRequest = async (req, res) => {
  try {
    const loggedUserId = req.user.id;
    const { communityId, userId } = req.body;

    // Missing fields
    if (!communityId || !userId) {
      return res.status(400).json({
        status: "error",
        message: "Fields missing. Required fields: communityId, userId",
      });
    }

    // Unauthorized
    const community = Community.findById(communityId);

    if (!community) {
      return res.status(404).json({
        status: "error",
        message: `Community with id ${communityId} does not exist`,
      });
    }

    if (!community.creator.equals(loggedUserId)) {
      return res.status(403).json({
        status: "error",
        message: "User not authorized to perform this action",
      });
    }

    // See if we actually had a request from that user
    const requestToAccept = community.pendingRequests.find((p) =>
      p.user.equals(userId),
    );
    if (!requestToAccept) {
      return res.status(409).json({
        status: "error",
        message: "There is no request from this user to enter the community",
      });
    }

    // Delete pending request and add member
    pendingRequestsUpdated = community.pendingRequests.filter(
      (p) => !p.user.equals(userId),
    );
    community.pendingRequests = pendingRequestsUpdated;
    community.members.push({ user: userId });
    await community.save();

    return res.status(200).json({
      status: "success",
      message: "User accepted into community",
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Error accepting member into community",
    });
  }
};

const kickUser = async (req, res) => {
  try {
    // Obtener el ID del usuario autenticado desde el token
    const loggedUserId = req.user.id;

    const { communityId, userId } = req.body;

    if (!communityId || !userId) {
      return res.status(400).json({
        status: "error",
        message: "Fields missing. Required fields: communityId, userId",
      });
    }

    const community = Community.findById(communityId);

    if (!community.creator.equals(loggedUserId)) {
      return res.status(403).json({
        status: "error",
        message: "User not authorized to perform this action",
      });
    }

    const userToKick = community.members.find((m) => m.user.equals(userId));

    if (!userToKick) {
      return res.status(409).json({
        status: "error",
        message:
          "This user whether does not exist or is not part of this community",
      });
    }

    const membersUpdated = community.members.filter(
      (m) => !m.user.equals(userId),
    );
    community.members = membersUpdated;
    await community.save();

    return res.status(200).json({
      status: "success",
      message: "User deleted from community",
    });
  } catch (error) {
    console.error("Error deleting community member:", error);
    return res.status(500).json({
      status: "error",
      message: "Error deleting community member",
      error: error.message,
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
        status: "error",
        message: "Unauthorized",
      });
    }

    if (!communityId) {
      return res.status(400).json({
        status: "error",
        message: "Fields missing. Required fields: communityId",
      });
    }

    const community = await Community.findById(communityId);

    if (!community) {
      return res.status(404).json({
        status: "error",
        message: `Community with id ${communityId} does not exist`,
      });
    }

    if (!community.members.findOne((m) => m.user.equals(userId))) {
      return res.status(409).json({
        status: "error",
        message: "User is not part of this community",
      });
    }

    community.members.filter((m) => !m.user.equals(userId));
    await community.save();

    return res.status(200).json({
      status: "success",
      message: "User exited community successfully",
    });
  } catch (error) {
    console.error("Error deleting community member (exit community):", error);
    return res.status(500).json({
      status: "error",
      message: "Error deleting community member (exit community)",
      error: error.message,
    });
  }
};

const getMembers = async (req, res) => {
  try {
    // Obtener el ID del usuario autenticado desde el token
    const userId = req.user.id;

    // Get community id and page
    const communityId = req.params.id;
    const page = Number(req.query.pagination) + 1 || 1;
    const itemsPerPage = Number(req.query.itemsPerPage) || 6;
    console.log("getMembers", page, itemsPerPage);

    if (!communityId) {
      return res.status(400).json({
        status: "error",
        message: "Missing fields: communityId",
      });
    }

    // Get members
    const community = await Community.findById(communityId)
      .select("members")
      .populate("members.user", "nickname image");

    if (community.members.filter((m) => m.user.equals(userId)).length === 0) {
      return res.status(401).json({
        status: "error",
        message:
          "The user is not part of this community, so getMembers action is forbidden",
      });
    }

    let membersFormatted = community.members.map((m) => {
      return {
        id: m.user._id,
        nickname: m.user.nickname,
        image: m.user.image,
        points: m.points,
        joined_at: m.joined_at,
      };
    });

    let paginatedMembers = membersFormatted;
    if (page && itemsPerPage) {
      paginatedMembers = membersFormatted.slice(
        (page - 1) * itemsPerPage,
        page * itemsPerPage,
      );
    }

    return res.status(200).json({
      status: "success",
      members: paginatedMembers,
      total: membersFormatted.length,
    });
  } catch (error) {
    console.error("Error obtaining community members:", error);
    return res.status(500).json({
      status: "error",
      message: "Error obtaining community members",
      error: error.message,
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
        message: "User not authenticated",
      });
    }

    // Get community id
    const communityId = req.params.communityId;

    if (!communityId) {
      return res.status(400).json({
        status: "error",
        message: "Missing fields",
      });
    }
    const community = await Community.findById(communityId)
      .select("pendingRequests")
      .populate("pendingRequests.user", "nickname image");

    if (!community) {
      return res.status(404).json({
        status: "error",
        message: `Community with id ${communityId} not found`,
      });
    }

    if (!community.creator.equals(userId)) {
      return res.status(403).json({
        status: "error",
        message: "User not authorized to perform this action",
      });
    }

    return res.status(200).json({
      status: "success",
      members: community.pendingRequests,
    });
  } catch (error) {
    console.error("Error obtaining community requests:", error);
    return res.status(500).json({
      status: "error",
      message: "Error obtaining community requests",
      error: error.message,
    });
  }
};

const getCommunities = async (req, res) => {
  try {
    const userId = req.user.id;
    const language = req.params.language;

    if (!userId) {
      return res.status(404).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    if (!language) {
      return res.status(400).json({
        status: "error",
        message: "Missing field: language",
      });
    }

    const communites = await Community.find({
      language: language,
      members: {
        $not: {
          $elemMatch: { user: userId },
        },
      },
    }).populate("creator", "nickname");

    const communitesExpanded = communites.map((community) => {
      const c = community.toObject();
      const loggedUserSentRequest = !!community.pendingRequests.find(
        (request) => request.user.equals(userId),
      );
      const loggedUserIsMember = !!community.members.find((request) =>
        request.user.equals(userId),
      );
      return {
        ...c,
        creator: c.creator.nickname,
        members: c.members.length,
        id: c._id.toString(),
        _id: undefined,
        userIsMember: loggedUserIsMember,
        userSentRequest: loggedUserSentRequest,
      };
    });

    return res.status(200).json({
      status: "success",
      message: "Communities obtained successfully",
      communities: communitesExpanded,
    });
  } catch (error) {
    console.error("Error obtaining communities:", error);
    return res.status(500).json({
      status: "error",
      message: "Error obtaining communites",
      error: error.message,
    });
  }
};

const getUserCommunities = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      return res.status(404).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    const communites = await Community.find({
      members: {
        $elemMatch: { user: userId },
      },
    }).populate("creator", "nickname");

    const communitesExpanded = communites.map((community) => {
      const c = community.toObject();
      return {
        ...c,
        creator: c.creator.nickname,
        members: c.members.length,
        id: c._id.toString(),
        _id: undefined,
      };
    });

    return res.status(200).json({
      status: "success",
      message: "User communities obtained successfully",
      communities: communitesExpanded,
    });
  } catch (error) {
    console.error("Error obtaining user communities:", error);
    return res.status(500).json({
      status: "error",
      message: "Error obtaining user communites",
      error: error.message,
    });
  }
};

const deleteCommunity = async (req, res) => {
  try {
    const userId = req.user.id;
    const communityId = req.params.id;

    if (!communityId) {
      return res.status(400).json({
        status: "error",
        message: "Missing fields. Fields required in url: communityId",
      });
    }

    const community = await Community.findById(communityId);

    if (!community.creator.equals(userId)) {
      return res.status(403).json({
        status: "error",
        message: "User is not authorized to perform this action",
      });
    }

    await community.deleteOne();

    return res.status(200).json({
      status: "success",
      message: "Community deleted successfully",
    });
  } catch (error) {
    console.log("Error deleting community:", error);
    return res.status(400).json({
      status: "error",
      message: "Error when deleting community",
      error: error.message,
    });
  }
};

const updateCommunity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { communityId, description, isPrivate } = req.body;

    if (!communityId || !(description || isPrivate)) {
      return res.status(400).json({
        status: "error",
        message:
          "Missing fields. Fields required in url: communityId, and descripcion, isPrivate or both",
      });
    }

    if (typeof description !== String || typeof isPrivate !== Boolean) {
      return res.status(400).json({
        status: "error",
        message: "Description must be string and isPrivate must be Boolean",
      });
    }

    const community = await Community.findById(communityId);

    if (!community.creator.equals(userId)) {
      return res.status(403).json({
        status: "error",
        message: "User not authorized to perform this action",
      });
    }

    if (description && description.trim !== "") {
      community.description = description;
    }
    if (isPrivate !== undefined) {
      community.isPrivate = isPrivate;
    }

    await community.save();

    return res.status(200).json({
      status: "success",
      message: "Community updated succesfully",
      community: community,
    });
  } catch (error) {
    console.log("Error updating community:", error);
    return res.status(400).json({
      status: "error",
      message: "Error when updating community",
      error: error.message,
    });
  }
};

const uploadCommunityPicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "No image was uploaded",
      });
    }

    const userId = req.user.id;
    const communityId = req.params.id;

    const community = await Community.findById(communityId);
    const user = await User.findById(userId);
    if (!community.creator.equals(userId)) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({
        status: "error",
        message: "User not authorized to perform this action",
      });
    }

    // Remove any previous version of the file (different extension)
    const folder = path.resolve("./uploads/community_pictures");
    const files = fs.readdirSync(folder);
    const oldFiles = files.filter(
      (f) => f.startsWith(communityId) && f !== req.file.filename,
    );

    for (const file of oldFiles) {
      try {
        fs.unlinkSync(path.join(folder, file));
      } catch (err) {
        console.warn(`⚠️ Could not delete file ${file}:`, err.message);
      }
    }

    // Guardar el nuevo nombre del archivo en la base de datos
    community.image = req.file.filename;
    await community.save();

    return res.status(200).json({
      status: "success",
      message: "Community picture updated successfully",
      communityId: communityId,
      communityPicture: community.image,
    });
  } catch (error) {
    console.error("Error uploading community picture:", error);
    return res.status(500).json({
      status: "error",
      message: "Error uploading community picture",
      error: error.message,
    });
  }
};

const deleteCommunityPicture = async (req, res) => {
  try {
    const userId = req.user.id;
    const communityId = req.params.id;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        status: "error",
        message: "Community not found.",
      });
    }

    if (!community.creator.equals(userId)) {
      return res.status(403).json({
        status: "error",
        message: "User not authorized to perform this action",
      });
    }

    if (!community.image || community.image === "default-community.png") {
      return res.status(400).json({
        status: "error",
        message: "No community picture to delete.",
      });
    }

    // Borrar imagen anterior
    const imagePath = path.resolve(
      `./uploads/community_pictures/${community.image}`,
    );
    try {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    } catch (err) {
      console.warn("⚠️ Error deleting community picture:", err.message);
    }

    // Actualizar campo a default
    community.image = "default-community.png";
    await community.save();

    return res.status(200).json({
      status: "success",
      message: "Image deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting profile picture:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

module.exports = {
  createCommunity,
  sendRequest,
  listRequests, // REPETIDA GetRequests
  acceptRequest,
  rejectRequest,
  exitCommunity,
  kickUser,
  getRequests,
  getMembers,
  getCommunities,
  getUserCommunities,
  deleteCommunity,
  updateCommunity,
  uploadCommunityPicture,
  deleteCommunityPicture,
};
