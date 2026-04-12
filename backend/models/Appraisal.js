/**
 * @file backend/models/Appraisal.js
 * @description Individual appraisal forms with ratings, feedback, and scores
 */

const mongoose = require('mongoose');

const appraisalSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    cycleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AppraisalCycle',
        required: true,
        index: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AppraisalTemplate'
    },
    
    // Self-assessment section
    employeeSelfRating: {
        submittedAt: Date,
        competencies: [{
            competencyName: String,
            rating: Number,
            selfComment: String
        }],
        goalProgressData: [{
            goalId: String,
            goalDescription: String,
            targetAchievement: String,
            actualAchievement: String,
            progressPercentage: Number,
            comment: String
        }],
        strengthsIdentified: String,
        areasForDevelopment: String
    },
    
    // Manager's assessment
    managerRating: {
        submittedAt: Date,
        competencies: [{
            competencyName: String,
            rating: Number,
            managerComment: String,
            evidenceProvided: String // Specific examples supporting the rating
        }],
        overallPerformance: Number,
        overallComment: String,
        strengths: String,
        developmentAreas: String,
        recommendedActions: String,
        promotionRecommendation: {
            type: String,
            enum: ['ready-now', 'ready-in-1yr', 'potential', 'not-ready', 'no-opinion'],
            default: 'no-opinion'
        }
    },
    
    // 360 feedback (if enabled)
    peerFeedback: [{
        peerId: mongoose.Schema.Types.ObjectId,
        feedback: String,
        ratings: [{
            competency: String,
            rating: Number
        }],
        submittedAt: Date
    }],
    
    // Overall scores and calculations
    scores: {
        selfAssessmentScore: Number,
        managerRatingScore: Number,
        peerFeedbackAverageScore: Number,
        calibratedScore: Number, // After HR/manager calibration
        finalRating: {
            type: String,
            enum: ['5-Exceptional', '4-Exceeds', '3-Meets', '2-Below', '1-Unsatisfactory'],
            default: '3-Meets'
        }
    },
    
    // Approvals and workflow
    status: {
        type: String,
        enum: ['draft', 'employee-submitted', 'manager-review', 'manager-submitted', 'calibration', 'approved', 'archived'],
        default: 'draft'
    },
    managerApprovedAt: Date,
    managerApprovedBy: mongoose.Schema.Types.ObjectId,
    hrApprovedAt: Date,
    hrApprovedBy: mongoose.Schema.Types.ObjectId,
    
    // Development plan
    developmentPlan: {
        plannedActivities: String,
        trainingNeeds: [String],
        mentoringAssignments: String,
        targetDevelopmentDate: Date
    },
    
    // Ratings history for tracking changes
    ratingHistory: [{
        previousRating: String,
        newRating: String,
        changedAt: Date,
        changedBy: mongoose.Schema.Types.ObjectId,
        reason: String
    }],
    
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

appraisalSchema.index({ employeeId: 1, cycleId: 1 }, { unique: true });
appraisalSchema.index({ cycleId: 1, status: 1 });
appraisalSchema.index({ managerId: 1, status: 1 });

module.exports = mongoose.models.Appraisal || mongoose.model('Appraisal', appraisalSchema);
