const Letter = require("../models/letter");
const User = require("../models/user");


const saveLetter = async (req, res) => {
    try {
        const { title, content, diary, language, created_at } = req.body;
        const userId = req.user.id; 

        if (!title || !content || !language || !created_at) { // created at formato "2025-01-30"
            return res.status(400).json({
                status: "error",
                message: "Title, content, date and language are required." 
            });
        }

        const newLetter = new Letter({
            author: userId,
            title,
            content,
            diary: diary || null,
            language,
            created_at: created_at || Date.now
        });

        const savedLetter = await newLetter.save();
        return res.status(200).json({ 
            status: "success",
            message: "Letter saved successfully.",
            letter: savedLetter 
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error saving letter",
            error: error.message
        });
    }
};


const editLetter = async (req, res) => {
    try {
        const { letterId } = req.params;
        const { title, content, diary, language, sharedWith } = req.body;
        const userId = req.user.id;

        const letter = await Letter.findById(letterId);
        if (!letter) {
            return res.status(404).json({ message: "Letter not found." });
        }

        if (letter.author.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized to edit this letter." });
        }

        letter.title = title || letter.title;
        letter.content = content || letter.content;
        letter.diary = diary !== undefined ? diary : letter.diary;
        letter.language = language || letter.language;
        letter.sharedWith = sharedWith || letter.sharedWith;

        const updatedLetter = await letter.save();
        return res.status(200).json({ message: "Letter updated successfully.", letter: updatedLetter });
    } catch (error) {
        return res.status(500).json({ message: "Error updating letter", error: error.message });
    }
};


const deleteLetter = async (req, res) => {
    try {
        const { letterId } = req.params;
        const userId = req.user.id;

        const letter = await Letter.findById(letterId);
        if (!letter) {
            return res.status(404).json({ message: "Letter not found." });
        }

        if (letter.author.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized to delete this letter." });
        }

        await Letter.findByIdAndDelete(letterId);
        return res.status(200).json({ message: "Letter deleted successfully." });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting letter", error: error.message });
    }
};


const listUserLetters = async (req, res) => {
    try {
        const userId = req.user.id;
        const letters = await Letter.find({ author: userId });
        return res.status(200).json({ letters });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching letters", error: error.message });
    }
};


const shareLetter = async (req, res) => {
    try {
        const { letterId } = req.params;
        const { sharedWith } = req.body;
        const userId = req.user.id;

        const letter = await Letter.findById(letterId);
        if (!letter) {
            return res.status(404).json({ message: "Letter not found." });
        }

        if (letter.author.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized to share this letter." });
        }

        letter.sharedWith = [...new Set([...letter.sharedWith, ...sharedWith])];
        await letter.save();

        await Promise.all(sharedWith.map(async (friendId) => {
            await User.findByIdAndUpdate(friendId, {
                $push: { correctedLetter: letterId }
            });
        }));

        return res.status(200).json({ message: "Letter shared successfully.", letter });
    } catch (error) {
        return res.status(500).json({ message: "Error sharing letter", error: error.message });
    }
};


module.exports = { saveLetter, editLetter, deleteLetter, listUserLetters, shareLetter };
