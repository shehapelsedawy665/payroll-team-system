const mongoose = require('mongoose');

const LeaveBalanceSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    year: { type: Number, required: true },
    annualDays: { type: Number, default: 30 },
    usedDays: { type: Number, default: 0 },
    sickDays: { type: Number, default: 8 },
    usedSickDays: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.models.LeaveBalance || mongoose.model('LeaveBalance', LeaveBalanceSchema);