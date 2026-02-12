const mongoose = require("mongoose");
const { User } = require("../models/user");
const Community = require("../models/community");
const CorrectedLetter = require("../models/correctedLetter");
const FriendRequest = require("../models/friendRequest");
const SuggestedTopic = require("../models/suggestedTopic");
const suggestedTopic = require("../models/suggestedTopic");


const postTopic = async (req, res) => {
    try {
        const userId = req.user.id
        const { communityId, title, description } = req.body

        if (!communityId || !title || !description) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing fields. Fields requiered: communityId, title, description'
            })
        }

        const community = await Community.findById(communityId)
        if (!community) {
            return res.status(404).json({
                status: 'error',
                message: `Community with id ${communityId} not found`
            })
        }
        if (!community.members.find(m => m.user.equals(userId))) {
            return res.status(401).json({
                status: 'error',
                message: `This user is not a member of community ${community.name}`
            })
        }

        const userData = await User.findById(userId).select("nickname").lean()
        if (!userData) {
            return res.status(400).json({
                status: 'error',
                message: 'An error occurred when obtaining user data'
            })
        }
        userData.id = userData._id
        delete userData._id

        const newTopic =  new SuggestedTopic({
            title: title,
            description: description,
            author: userId,
            community: communityId
        })

        const savedTopic = await newTopic.save()
        await savedTopic.populate('author', 'nickname')
        const topicObj = savedTopic.toObject()
        topicObj.id = savedTopic._id
        delete topicObj._id


        return res.status(200).json({
            status: 'success',
            message: 'Suggested topic posted successfully',
            suggestedTopic: topicObj
        })
        
    } catch (error) {
        return res.status(400).json({
            status: 'error',
            message: 'Error when posting suggested topic',
            error: error.message
        })
    }
}


const deleteTopic  = async (req, res) => {
    try {
        const userId = req.user.id
        const topicId = req.params.topicId
        console.log('user id', userId)

        const topic = await SuggestedTopic.findById(topicId)
        const community = await Community.findById(topic.community).select("creator")
        console.log('topic', topic)

        if (!topic) {
            return res.status(404).json({
                status: 'error',
                message: `Topic with id ${topic.community} not found`
            })
        }

        if (!topic.author.equals(userId) && !community.creator.equals(userId)) {
            return res.status(401).json({
                status: 'error',
                message: `This user is not authorized to perform this action`
            })
        }

        await topic.deleteOne() 

        return res.status(204).json({
            status: 'success',
            message: 'Suggested topic deleted successfully'
        })
        
    } catch (error) {
        return res.status(400).json({
            status: 'error',
            message: 'Error when deleting suggested topic',
            error: error.message
        })
    }
}

/*
const takeTopic = async (req, res) => {
    try {
        const userId = req.userId
        const topicId = req.params.topicId

        if (!topicId) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing fields. Fields requiered: communityId, title, description'
            })
        }

        const topic = await SuggestedTopic.findById(topicId).populate("community", "members")
        if (!topic) {
            return res.status(404).json({
                status: 'error',
                message: `Suggested Topic with id ${topicId} not found`
            })
        }

        if (!topic.community.members.find(m => m.user.equals(userId))) {
            return res.status(401).json({
                status: 'error',
                message: `This user is not a member of community ${community.name}, where this topic belongs`
            })
        }
        
        topic.likes++
        await topic.save()

        return res.status(200).json({
            status: 'success',
            message: 'Suggested topic posted successfully',
            suggestedTopic: topic
        })
        
    } catch (error) {
        return res.status(400).json({
            status: 'error',
            message: 'Error when posting suggested topic',
            error: error.message
        })
    }
}*/


const getCommunityTopics = async (req,res) => {
    try {
        const userId = req.userId
        const communityId = req.params.communityId
        
        const community = await Community.findById(communityId).select("members")
        if (community.members.filter(m => m.user.equals(userId)).lenth === 0) {
            return res.status(401).json({
                status: 'error',
                message: 'User is not part of this community so they cannot perform this action'
            })
        }

        const topics = await SuggestedTopic.find({ community: communityId }).populate("author", "nickname")
        const topicwithId = topics.map(t => {
            const topicObj = t.toObject()
            topicObj.id = t._id
            delete topicObj._id
            return topicObj
        })
        return res.status(200).json({
            status: 'success',
            topics: topicwithId
        })
        
    } catch (error) {
        return res.status(400).json({
            status: 'error',
            message: `Server error in getCommunityTopics: ${error}`
        })
    }
}


module.exports = { postTopic, deleteTopic, getCommunityTopics }
