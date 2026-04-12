/**
 * @file backend/models/AppraisalCycle.js
 * @description Appraisal cycle management (annual reviews, mid-year reviews, etc.)
 */

const mongoose = require('mongoose');

const appraisalCycleSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    description: String,
    cycleType: {
        type: String,
        enum: ['annual', 'semi-annual', 'quarterly', 'monthly', 'ad-hoc'],
        default: 'annual'
    },
    
    // Dates
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    submissionDeadline: Date,
    reviewDeadline: Date,
    calibrationDeadline: Date,
    
    // Associated template
    templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AppraisalTemplate',
        required: true
    },
    
    // Participants
    participants: [{
        employeeId: mongoose.Schema.Types.ObjectId,
        managerId: mongoose.Schema.Types.ObjectId,
        performerStatus: {
            type: String,
            enum: ['invited', 'started', 'self-submitted', 'submitted', 'not-started'],
            default: 'invited'
        },
        reviewerStatus: {
            type: String,
            enum: ['pending', 'in-progress', 'submitted', 'completed'],
            default: 'pending'
        }
    }],
    
    // Workflow
    status: {
        type: String,
        enum: ['planning', 'open', 'review', 'calibration', 'completed', 'closed'],
        default: 'planning'
    },
    
    allowEditing: { type: Boolean, default: true },
    allowRaterFeedback: { type: Boolean, default: true },
    showEmployeeRatings: { type: Boolean, default: false }, // Before final approval
    
    // Calibration settings
    requiresCalibration: { type: Boolean, default: false },
    calibrationGroups: [{
        groupName: String,
        members: [mongoose.Schema.Types.ObjectId] // Calibration panel members
    }],
    
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

appraisalCycleSchema.index({ companyId: 1, startDate: -1 });
appraisalCycleSchema.index({ status: 1 });

module.exports = mongoose.models.AppraisalCycle || mongoose.model('AppraisalCycle', appraisalCycleSchema);
