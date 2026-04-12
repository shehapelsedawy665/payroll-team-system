/**
 * @file backend/models/LeaveBalance.js
 * @description Employee leave balances by type and year
 */

const mongoose = require('mongoose');

const LeaveBalanceSchema = new mongoose.Schema({
    employeeId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Employee', 
        required: true,
        index: true 
    },
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company', 
        required: true,
        index: true 
    },
    leaveTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LeaveType'
    },
    year: { 
        type: Number, 
        required: true 
    },
    
    // For legacy compatibility and quick access
    annualDays: { type: Number, default: 30 },
    usedDays: { type: Number, default: 0 },
    sickDays: { type: Number, default: 8 },
    usedSickDays: { type: Number, default: 0 },
    
    // New fields for enhanced tracking
    allocatedDays: { type: Number, default: 0 },
    approvedDays: { type: Number, default: 0 },
    pendingDays: { type: Number, default: 0 },
    carriedOverDays: { type: Number, default: 0 },
    remainingDays: { type: Number, default: 0 },
    
    history: [{
        date: Date,
        action: { type: String, enum: ['allocated', 'used', 'approved', 'rejected', 'cancelled', 'carried_over'] },
        days: Number,
        reason: String,
        requestId: mongoose.Schema.Types.ObjectId,
        changedBy: mongoose.Schema.Types.ObjectId
    }],
    
    lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// Unique index: company + employee + year + leaveType
LeaveBalanceSchema.index({ companyId: 1, employeeId: 1, year: 1 });
LeaveBalanceSchema.index({ employeeId: 1, year: 1 });

module.exports = mongoose.models.LeaveBalance || mongoose.model('LeaveBalance', LeaveBalanceSchema);