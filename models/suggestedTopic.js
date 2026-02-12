const {Schema, model} = require('mongoose');

const SuggestedTopicSchema = Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minLength: 5,
        maxLength: 50
    },
    description: {
        type: String,
        required: true,
        trim: true,
        minLength: 25,
        maxLength: 200
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    community: {
        type: Schema.Types.ObjectId,
        ref: "Community",
        required: true
    },
    likes: {
        type: Number,
        default: 0
    }
})


module.exports = model("SuggestedTopic", SuggestedTopicSchema, "suggestedTopics")