const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    leaveType: { type: String, enum: ['sick', 'annual', 'unpaid', 'emergency'], required: true },
    reason: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: mongoose.Schema.Types.ObjectId
}, { timestamps: true });

module.exports = mongoose.models.Leave || mongoose.model('Leave', LeaveSchema);