/**
 * @file backend/models/LeaveRequest.js
 * @description Employee leave requests with approval workflow
 */

const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    leaveTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LeaveType',
        required: true
    },
    
    // Leave dates
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    totalDays: {
        type: Number,
        required: true
    },
    workingDaysOnly: {
        type: Boolean,
        default: true // Exclude weekends from count
    },
    
    // Request details
    reason: {
        type: String,
        maxlength: 500
    },
    attachments: [{
        filename: String,
        url: String,
        uploadedAt: Date
    }],
    
    // Approval workflow
    status: {
        type: String,
        enum: ['draft', 'submitted', 'pending_manager', 'pending_hr', 'approved', 'rejected', 'cancelled'],
        default: 'draft'
    },
    
    // Manager approval
    managerApprovalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    managerApprovedBy: mongoose.Schema.Types.ObjectId,
    managerApprovalDate: Date,
    managerApprovalNotes: String,
    
    // HR approval
    hrApprovalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    hrApprovedBy: mongoose.Schema.Types.ObjectId,
    hrApprovalDate: Date,
    hrApprovalNotes: String,
    
    // Cancellation
    cancelledAt: Date,
    cancelledBy: mongoose.Schema.Types.ObjectId,
    cancellationReason: String,
    
    // Auto-calculations
    isEligible: {
        type: Boolean,
        default: true
    },
    eligibilityCheckNotes: String,
    
    // Timestamps
    requestedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes for fast queries
leaveRequestSchema.index({ companyId: 1, employeeId: 1 });
leaveRequestSchema.index({ employeeId: 1, status: 1 });
leaveRequestSchema.index({ companyId: 1, status: 1 });
leaveRequestSchema.index({ startDate: 1, endDate: 1 });

// Pre-save: Calculate total days
leaveRequestSchema.pre('save', function(next) {
    if (this.startDate && this.endDate) {
        let count = 0;
        const current = new Date(this.startDate);
        while (current <= this.endDate) {
            const dayOfWeek = current.getDay();
            // Count if not Friday (5) and Saturday (6) or if including weekends
            if (!this.workingDaysOnly || (dayOfWeek !== 5 && dayOfWeek !== 6)) {
                count++;
            }
            current.setDate(current.getDate() + 1);
        }
        this.totalDays = count;
    }
    next();
});

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
