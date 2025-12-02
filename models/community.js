const {Schema, model} = require('mongoose');
const { LANGUAGES } = require('../constants')

const CommunitySchema = Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    language: {
        type: String,
        required: true,
        enum: {
            values: LANGUAGES,
            message: "{VALUE} is not a valid language"
        }
    },
    isPrivate: {
        type: Boolean,
        defautl: false
    },
    creator: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        user: { 
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        points: {
            type: Number,
            default: 0
        },
        joined_at: {
            type: Date,
            default: Date.now
        }
     }],
     pendingRequests: [{
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        requested_at: {
            type: Date,
            default: Date.now
        }
    }],
    image: {
        type: String,
        default: "default-community.png"
    },
    created_at: {
        type: Date,
        default: Date.now
    }
})


module.exports = model("Community", CommunitySchema, "communities")