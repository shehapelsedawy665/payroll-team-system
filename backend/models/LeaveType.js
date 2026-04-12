/**
 * @file backend/models/LeaveType.js
 * @description Leave types and policies (annual, sick, emergency, etc.)
 */

const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        enum: ['سنوية', 'مرضية', 'طارئة', 'حج', 'وضع', 'بدون راتب', 'تطوع'],
        // English: Annual, Sick, Emergency, Hajj, Maternity, Unpaid, Volunteer
    },
    nameEn: {
        type: String,
        enum: ['Annual', 'Sick', 'Emergency', 'Hajj', 'Maternity', 'Unpaid', 'Volunteer']
    },
    defaultDaysPerYear: {
        type: Number,
        default: 0
    },
    isPaid: {
        type: Boolean,
        default: true
    },
    isExtendable: {
        type: Boolean,
        default: false
    },
    requiresApproval: {
        type: Boolean,
        default: true
    },
    approvalLevel: {
        type: String,
        enum: ['direct_manager', 'hr', 'both'],
        default: 'hr'
    },
    minAndMaxDays: {
        minDaysPerRequest: { type: Number, default: 1 },
        maxDaysPerRequest: { type: Number, default: 30 },
        minAdvanceNotice: { type: Number, default: 0 } // days before
    },
    carryOverPolicy: {
        allowCarryOver: { type: Boolean, default: false },
        maxCarryOverDays: { type: Number, default: 0 },
        carriedOverExpiryMonths: { type: Number, default: 12 }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound index for company + type
leaveTypeSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = mongoose.models.LeaveType || mongoose.model('LeaveType', leaveTypeSchema);
