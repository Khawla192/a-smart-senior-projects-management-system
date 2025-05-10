const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    subject: {
        type: String,
        required: true,
    },
    body: {
        type: String,
        required: true,
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    parentMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact',
    },
    replies: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact',
    }],
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);