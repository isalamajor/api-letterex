const Letter = require("../models/letter");
const { User } = require("../models/user");
const CorrectedLetter = require("../models/correctedLetter");
const Follow = require("../models/follow");

const saveLetter = async (req, res) => {
  try {
    // Save body content
    const { title, content, diary, language, created_at } = req.body; // created_at format "2025-01-30"
    // Save body content
    const now = new Date();
    const created_at_conv = new Date(
      created_at.year,
      created_at.month - 1,
      created_at.day,
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds(),
    );

    const userId = req.user.id;

    if (!title || !content || !language || !created_at_conv) {
      // created_at format "2025-01-30"
      return res.status(400).json({
        status: "error",
        message: "Title, content, date and language are required.",
      });
    }

    const newLetter = new Letter({
      author: userId,
      title,
      content,
      diary: diary || null,
      language,
      created_at: created_at_conv || Date.now,
    });

    const savedLetter = await newLetter.save();
    return res.status(200).json({
      status: "success",
      message: "Letter saved successfully.",
      letter: savedLetter,
    });
  } catch (error) {
    console.error("Error saving letter:", error);
    return res.status(500).json({
      status: "error",
      message: "Error saving letter",
      error: error.message,
    });
  }
};

const viewLetter = async (req, res) => {
  try {
    const { letterId } = req.params;
    const userId = req.user.id;

    // Find the letter by its ID
    const letter = await Letter.findById(letterId);
    if (!letter) {
      return res.status(404).json({ message: "Letter not found." });
    }

    // Verify that the user is the author or that the letter has been shared with them
    if (
      letter.author.toString() !== userId &&
      !letter.sharedWith.includes(userId)
    ) {
      return res
        .status(403)
        .json({ message: "Unauthorized to view this letter." });
    }

    // Get the nickname and image of the users with whom the letter was shared
    const sharedWithDetails = await Promise.all(
      letter.sharedWith.map(async (friendId) => {
        const friend =
          await User.findById(friendId).select("_id nickname image");
        return friend ? friend.toObject() : null; // Convert to a plain object or return null if it doesn't exist
      }),
    );

    // Create object with letter information
    const letterDetails = {
      created_at: letter.created_at,
      title: letter.title,
      content: letter.content,
      diary: letter.diary || null,
      language: letter.language,
      audio: letter.audio || null,
      sharedWith: sharedWithDetails.filter(Boolean) || [],
    };

    return res.status(200).json({
      message: "Letter retrieved successfully.",
      letter: letterDetails,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error retrieving letter",
      error: error.message,
    });
  }
};

const editLetter = async (req, res) => {
  try {
    const letterId = req.params.id;
    const { title, content, diary, language, sharedWith } = req.body;
    const userId = req.user.id;

    const letter = await Letter.findById(letterId);

    if (!letter) {
      return res.status(404).json({ message: "Letter not found." });
    }

    if (letter.author.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Unauthorized to edit this letter." });
    }

    letter.title = title || letter.title;
    letter.content = content || letter.content;
    letter.diary = diary !== undefined ? diary : letter.diary;
    letter.language = language || letter.language;
    letter.sharedWith = sharedWith || letter.sharedWith;
    const updatedLetter = await letter.save();
    return res
      .status(200)
      .json({ message: "Letter updated successfully.", letter: updatedLetter });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error updating letter", error: error.message });
  }
};

const editDiary = async (req, res) => {
  try {
    const userId = req.user.id;
    const letterId = req.body.letterId;
    const newDiary = req.body.diary;

    const letter = Letter.findById(letterId);

    if (!userId || letter.author !== userId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized to edit this letter",
      });
    }

    if (!newDiary) {
      return res.status(400).json({
        status: "error",
        message: "New diary name is missing",
      });
    }

    if (newDiary === "Unclassified" || newDiary.trim() === "") {
      letterd.iary = undefined;
    } else {
      letter.diary = newDiary;
    }
    const letterUpdated = await letter.save();
    console.log("updated user: ", letterUpdated);

    if (letterUpdated && letterUpdated.diary === newDiary) {
      return res.status(200).json({
        status: "success",
        message: "Updated the letter's diary successfully",
      });
    }

    return res.status(400).json({
      status: "error",
      message: "Failed to update diary for this letter",
    });
  } catch (error) {
    return res.status(400).json({
      status: "error",
      message: "Error editing a letter's diary: " + error,
    });
  }
};

const deleteLetter = async (letterId) => {
  try {
    const letter = await Letter.findById(letterId);
    if (!letter) {
      return -2;
    }

    // If it was not shared, delete it permanently
    if (letter.sharedWith.length === 0) {
      await Letter.findByIdAndDelete(letterId);
      return 0;
    }

    letter.deleted = true;
    res = await letter.save();

    if (!res) {
      return -1;
    }
    return 0;
  } catch (error) {
    return -1;
  }
};

const deleteLetters = async (req, res) => {
  try {
    const letterIds = req.body.letters;
    const userId = req.user.id;
    let countDeleted = 0;

    if (!Array.isArray(letterIds) || letterIds.length === 0) {
      return res.status(400).json({ message: "No letter IDs provided." });
    }

    const results = await Promise.all(
      letterIds.map((letterId) => deleteLetter(letterId)),
    );
    countDeleted = results.filter((result) => result === 0).length;

    if (countDeleted === letterIds.length) {
      return res
        .status(200)
        .json({ message: "All letters deleted successfully.", countDeleted });
    } else if (countDeleted < letterIds.length) {
      return res.status(201).json({
        message: "Some letters deleted successfully, not all.",
        countDeleted,
      });
    }
    return res.status(500).json({ message: "Error deleting letters." });
  } catch (error) {
    console.error("Error deleting letters:", error);
    return res
      .status(500)
      .json({ message: "Error deleting letters", error: error.message });
  }
};

const buildLettersWithCorrections = async (letters) => {
  return Promise.all(
    letters.map(async (letter) => {
      // Get details of the users with whom the letter is shared
      const sharedWithDetails = await Promise.all(
        letter.sharedWith.map(async (friendId) => {
          const friend = await User.findById(friendId).select("nickname image");
          if (!friend) return null; // If the user does not exist, return null

          // Check whether there are corrections sent back by this user
          const correctionSentBack = await CorrectedLetter.findOne({
            originalLetter: letter._id,
            reviewer: friendId,
            sentBack: true,
          });

          if (!correctionSentBack) {
            return {
              ...friend.toObject(),
              correctionSentBack: false,
              correctedLetterId: null,
            };
          }

          return {
            ...friend.toObject(),
            correctionSentBack: !!correctionSentBack,
            correctedLetterId: correctionSentBack._id,
          };
        }),
      );
      const letterObj = letter.toObject();
      letterObj.sharedWith = sharedWithDetails.filter((user) => user !== null);
      return letterObj;
    }),
  );
};

const listLetters = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const itemsPerPage = Math.max(parseInt(req.query.itemsPerPage) || 10, 1);
    const skip = (page - 1) * itemsPerPage;
    const searchTerm =
      typeof req.query.q === "string" ? req.query.q.trim() : "";
    const query = { author: userId, deleted: false };

    if (searchTerm) {
      const searchRegex = new RegExp(
        searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      query.$or = [
        { title: searchRegex },
        { diary: searchRegex },
        { language: searchRegex },
      ];
    }

    const totalLetters = await Letter.countDocuments(query);

    const lettersWithCorrections = await Letter.aggregate([
      { $match: query },
      { $sort: { created_at: -1 } },
      { $skip: skip },
      { $limit: itemsPerPage },
      // 1. Join the Users collection to get friend details
      {
        $lookup: {
          from: "users",
          localField: "sharedWith",
          foreignField: "_id",
          as: "sharedWithDetails",
        },
      },
      // 2. Join with CorrectedLetter to see whether there are corrections
      {
        $lookup: {
          from: "correctedletters",
          let: { letterId: "$_id", friends: "$sharedWith" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$originalLetter", "$$letterId"] },
                    { $eq: ["$sentBack", true] },
                  ],
                },
              },
            },
          ],
          as: "corrections",
        },
      },
      // 3. Format the final output
      {
        $project: {
          id: "$_id",
          _id: 0,
          title: 1,
          diary: 1,
          language: 1,
          created_at: 1,
          sharedWith: {
            $map: {
              input: "$sharedWithDetails",
              as: "friend",
              in: {
                id: "$$friend._id",
                _id: 0,
                nickname: "$$friend.nickname",
                image: "$$friend.image",
                correctionSentBack: {
                  $in: ["$$friend._id", "$corrections.reviewer"],
                },
                // We look up the ID of that friend's specific correction
                correctedLetterId: {
                  $arrayElemAt: [
                    {
                      $map: {
                        input: {
                          $filter: {
                            input: "$corrections",
                            as: "c",
                            cond: { $eq: ["$$c.reviewer", "$$friend._id"] },
                          },
                        },
                        as: "filtered",
                        in: "$$filtered._id",
                      },
                    },
                    0,
                  ],
                },
              },
            },
          },
        },
      },
    ]);
    return res.status(200).json({
      letters: lettersWithCorrections,
      page,
      itemsPerPage,
      totalLetters,
      totalPages: Math.ceil(totalLetters / itemsPerPage),
    });
  } catch (error) {
    console.error("Error fetching letters:", error);
    return res
      .status(500)
      .json({ message: "Error fetching letters", error: error.message });
  }
};

const listDiaryLetters = async (req, res) => {
  try {
    const userId = req.user.id;
    const diaryFilter =
      typeof req.query.diary === "string" ? req.query.diary.trim() : "";
    const searchTerm =
      typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (!diaryFilter) {
      return res.status(400).json({
        message: "Diary is required.",
      });
    }
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const itemsPerPage = Math.max(parseInt(req.query.itemsPerPage) || 10, 1);
    const skip = (page - 1) * itemsPerPage;
    const query = { author: userId, deleted: false };

    if (diaryFilter.toLowerCase() === "unclassified") {
      query.$or = [
        { diary: { $exists: false } },
        { diary: null },
        { diary: "" },
      ];
    } else {
      query.diary = diaryFilter;
    }

    if (searchTerm) {
      const searchRegex = new RegExp(
        searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      query.$or = [{ title: searchRegex }, { language: searchRegex }];
    }

    const totalLetters = await Letter.countDocuments(query);

    const letters = await Letter.find(query)
      .select("title language created_at")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(itemsPerPage)
      .lean();

    const lettersWithId = letters.map((letter) => ({
      id: letter._id.toString(),
      title: letter.title,
      language: letter.language,
      created_at: letter.created_at,
    }));

    return res.status(200).json({
      letters: lettersWithId,
      page,
      itemsPerPage,
      totalLetters,
      totalPages: Math.ceil(totalLetters / itemsPerPage),
    });
  } catch (error) {
    console.error("Error fetching diary letters:", error);
    return res.status(500).json({
      message: "Error fetching diary letters",
      error: error.message,
    });
  }
};

const searchLettersByTitle = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }
    const searchTerm = typeof req.query.q === "string" ? req.query.q : "";

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const itemsPerPage = Math.max(parseInt(req.query.itemsPerPage) || 10, 1);
    const skip = (page - 1) * itemsPerPage;
    const searchRegex = new RegExp(
      searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    const query = { author: userId, deleted: false, title: searchRegex };

    const letters = await Letter.find(query)
      .select("title diary language created_at sharedWith")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(itemsPerPage);

    const totalLetters = await Letter.countDocuments(query);
    const lettersWithCorrections = await buildLettersWithCorrections(letters);

    return res.status(200).json({
      letters: lettersWithCorrections,
      page,
      itemsPerPage,
      totalLetters,
      totalPages: Math.ceil(totalLetters / itemsPerPage),
    });
  } catch (error) {
    console.error("Error fetching letters by title:", error);
    return res
      .status(500)
      .json({ message: "Error fetching letters", error: error.message });
  }
};

const shareLetter = async (req, res) => {
  try {
    const letterId = req.params.id;
    const { sharedWith } = req.body;
    const userId = req.user.id;

    // Find the original letter
    const letter = await Letter.findById(letterId);
    if (!letter) {
      return res.status(404).json({ message: "Letter not found." });
    }

    // Verify that the user is the author of the letter
    if (letter.author.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Unauthorized to share this letter." });
    }

    // Filter only new users (not already in sharedWith)
    const existingSharedWith = letter.sharedWith.map((id) => id.toString());
    const newUsersToShare = sharedWith.filter(
      (friendId) => !existingSharedWith.includes(friendId.toString()),
    );

    // Verify that the 2-user limit is not exceeded
    const totalSharedWith = existingSharedWith.length + newUsersToShare.length;
    if (totalSharedWith > 2) {
      return res.status(400).json({
        message: `Cannot share with more than 2 people. Currently shared with ${existingSharedWith.length}, trying to add ${newUsersToShare.length}.`,
      });
    }

    // If there are no new users, return
    if (newUsersToShare.length === 0) {
      return res.status(400).json({
        message: "Letter already shared with these users.",
      });
    }

    // Verify that all target users are friends with the author before sharing.
    const friendshipChecks = await Promise.all(
      newUsersToShare.map(async (friendId) => {
        const friendship = await Follow.findOne({
          $or: [
            { user1: userId, user2: friendId.toString() },
            { user1: friendId.toString(), user2: userId },
          ],
        }).select("_id");
        return { friendId: friendId.toString(), isFriend: !!friendship };
      }),
    );

    const nonFriends = friendshipChecks
      .filter((item) => !item.isFriend)
      .map((item) => item.friendId);

    if (nonFriends.length > 0) {
      return res.status(403).json({
        message: "Cannot share letter with users who are not your friends.",
        nonFriends,
      });
    }

    // Update the letter to add only the new users
    letter.sharedWith = [...letter.sharedWith, ...newUsersToShare];
    await letter.save();

    // Create a new CorrectedLetter object only for the new users
    const correctedLetters = await Promise.all(
      newUsersToShare.map(async (friendId) => {
        const newCorrectedLetter = new CorrectedLetter({
          originalLetter: letterId,
          sender: letter.author,
          reviewer: friendId,
          corrections: [],
          sentBack: false,
          received_at: Date.now(),
        });

        // Save the new CorrectedLetter
        return await newCorrectedLetter.save();
      }),
    );

    return res.status(200).json({
      message: "Letter shared successfully.",
      letter,
      correctedLetters,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error sharing letter",
      error: error.message,
    });
  }
};

const getUserDiaries = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get unique diaries directly from the database to avoid loading all letters into memory
    const diaries = await Letter.distinct("diary", {
      author: userId,
      diary: { $exists: true, $nin: [null, ""] },
    });

    return res.status(200).json(diaries);
  } catch (error) {
    return res.status(500).json({
      message: "Error getting diaries",
      error: error.message,
    });
  }
};

const getUserDiariesWithCounts = async (req, res) => {
  try {
    const userId = req.user.id;

    const countsByDiary = await Letter.aggregate([
      { $match: { author: userId } },
      {
        $project: {
          diaryKey: {
            $let: {
              vars: {
                normalizedDiary: {
                  $trim: { input: { $ifNull: ["$diary", ""] } },
                },
              },
              in: {
                $cond: [
                  { $eq: ["$$normalizedDiary", ""] },
                  "unclassified",
                  "$$normalizedDiary",
                ],
              },
            },
          },
        },
      },
      { $group: { _id: "$diaryKey", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const diaries = countsByDiary.map((item) => ({
      diary: item._id,
      count: item.count,
    }));

    return res.status(200).json(diaries);
  } catch (error) {
    return res.status(500).json({
      message: "Error getting diaries counts",
      error: error.message,
    });
  }
};

const countLetters = async (req, res) => {
  try {
    let userId = req.params.id;

    // If there is no ID in params, use the authenticated one
    if (!userId && req.user && req.user.id) {
      userId = req.user.id;
    }

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "User ID not provided",
        counts: {},
      });
    }

    // Group by language and count
    const countsByLanguage = await Letter.aggregate([
      { $match: { author: userId } },
      { $group: { _id: "$language", count: { $sum: 1 } } },
    ]);

    // Transform the result into an object { language: count }
    const result = countsByLanguage.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.status(200).json({
      status: "success",
      counts: result,
    });
  } catch (error) {
    console.error("Error counting letters:", error);
    res.status(500).json({
      status: "error",
      message: "Error counting letters",
      counts: {},
    });
  }
};

module.exports = {
  saveLetter,
  viewLetter,
  editLetter,
  editDiary,
  deleteLetters,
  listLetters,
  listDiaryLetters,
  searchLettersByTitle,
  shareLetter,
  getUserDiaries,
  getUserDiariesWithCounts,
  countLetters,
};
