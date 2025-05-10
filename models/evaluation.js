const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    evaluations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Evaluation'
    }],
    evaluators: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    supervisors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    technicalQuality: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    technicalFeedback: String,
    originality: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    originalityFeedback: String,
    presentation: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    presentationFeedback: String,
    documentation: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    documentationFeedback: String,
    overallFeedback: String,
    recommendation: {
        type: String,
        enum: ['pass', 'pass_with_minor', 'pass_with_major', 'fail'],
        required: true
    },
    evaluationDate: {
        type: Date,
        default: Date.now
    }
});

// Ensure one evaluation per evaluator per project
evaluationSchema.index({ project: 1, evaluator: 1 }, { unique: true });

module.exports = mongoose.model('Evaluation', evaluationSchema);