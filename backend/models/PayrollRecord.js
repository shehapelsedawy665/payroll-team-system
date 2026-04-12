// backend/models/PayrollRecord.js
const mongoose = require('mongoose');

const PayrollRecordSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    month: { type: String, required: true }, // Format: "2026-04"
    payload: {
        gross: Number,
        net: Number,
        tax: Number,
        insurance: Number,
        basic: Number,
        additions: Array,
        deductions: Array,
        days: Number
    },
    status: { type: String, default: 'draft' } // draft, approved, paid
}, { timestamps: true });

module.exports = mongoose.models.Payroll || mongoose.model('Payroll', PayrollSchema);
