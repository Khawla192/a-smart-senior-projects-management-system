const mongoose = require('mongoose');

const committeeAssignmentSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    supervisors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }],
    externalEvaluation: {
        type: Boolean,
        default: false,
    },
    assignedDate: {
        type: Date,
        default: Date.now,
    }
}, { timestamps: true });

module.exports = mongoose.model('CommitteeAssignment', committeeAssignmentSchema);