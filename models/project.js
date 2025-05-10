const mongoose = require('mongoose');

const phaseSchema = new mongoose.Schema({
    file: String,
    note: String,
    submittedAt: Date,
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    feedback: [{
        comment: String,
        givenBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, { _id: false });

const projectSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Project title is required']
    },
    description: String,
    department: String,
    supervisors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }],
    coSupervisors: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    }],
    evaluators:
    [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    }],
    evaluations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Evaluation'
    }],
    status: {
        type: String,
        enum: ['available', 'pending', 'assigned', 'approved', 'rejected', 'in_progress', 'completed'],
        default: 'available',
    },
    isStudentIdea: {
        type: Boolean,
        default: false,
    },
    ideaSubmittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    teamMembers: [{
        member: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        role: {
            type: String,
            enum: ['leader', 'member'],
        }
    }],
    applicants: [{
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        appliedAt: {
            type: Date,
            default: Date.now,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        }
    }],
    selectedStudent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    rejectionReason: String,
    approvedAt: Date,
    rejectedAt: Date,
    documents: [{
        name: String,
        filePath: String,
        uploadDate: {
          type: Date,
          default: Date.now
        }
    }],
    phases: {
        proposal: phaseSchema,
        literatureReview: phaseSchema,
        planning: phaseSchema,
        design: phaseSchema,
        implementation: phaseSchema,
        presentation: phaseSchema,
        reportPaper: phaseSchema,
        poster: phaseSchema
    },
}, {
    timestamps: true,
});

// Virtual for easy access to all feedback
projectSchema.virtual('allFeedback').get(function() {
    const feedback = [];
    for (const phase in this.phases) {
        if (this.phases[phase]?.feedback?.length) {
            this.phases[phase].feedback.forEach(fb => {
                feedback.push({
                    phase,
                    ...fb.toObject()
                });
            });
        }
    }
    return feedback;
});

module.exports = mongoose.model('Project', projectSchema);