const mongoose = require('mongoose');

const PenaltySchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    date: { type: Date, required: true },
    reason: String,
    deductionDays: { type: Number, default: 1 },
    deductionAmount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.models.Penalty || mongoose.model('Penalty', PenaltySchema);