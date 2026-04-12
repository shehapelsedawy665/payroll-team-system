/**
 * @file backend/models/AppraisalTemplate.js
 * @description Appraisal form templates with customizable competencies and criteria
 */

const mongoose = require('mongoose');

const appraisalTemplateSchema = new mongoose.Schema({
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
    
    // Appraisal criteria/competencies
    competencies: [{
        name: String,
        description: String,
        weight: { type: Number, default: 1 }, // For weighted averaging
        ratingScale: {
            type: String,
            enum: ['1-5', '1-10', 'A-E', 'Poor-Excellent'],
            default: '1-5'
        },
        keyBehaviors: [String] // Examples: "Completes tasks on time", "Communicates effectively"
    }],
    
    // Performance goals section
    includeGoalsSetting: { type: Boolean, default: true },
    maxGoals: { type: Number, default: 5 },
    
    // Self-assessment option
    includeSelfAssessment: { type: Boolean, default: true },
    
    // 360 feedback integration
    include360Feedback: { type: Boolean, default: false },
    feedbackSources: {
        manager: { type: Boolean, default: true },
        peers: { type: Boolean, default: false },
        subordinates: { type: Boolean, default: false },
        clients: { type: Boolean, default: false }
    },
    
    // Calibration
    includeCalibration: { type: Boolean, default: false },
    ratingDistribution: {
        // E.g., "10% Exceeds, 30% Meets, 50% Meets, 10% Below"
        excellent: Number,
        exceeds: Number,
        meets: Number,
        below: Number
    },
    
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

appraisalTemplateSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.models.AppraisalTemplate || mongoose.model('AppraisalTemplate', appraisalTemplateSchema);
