// backend/models/PayrollRecord.js
const mongoose = require('mongoose');

const PayrollRecordSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    month: { type: String, required: true },
    payload: {
        days: Number,
        gross: Number,
        net: Number,
        proratedBasic: Number,
        proratedTrans: Number,
        totalAdditions: Number,
        totalOtherDeductions: Number,
        insuranceEmployee: Number,
        insuranceCompany: Number,
        currentTaxable: Number,
        monthlyTax: Number,
        martyrs: Number,
        additions: Array,
        deductions: Array,
        costToCompany: Number,
        socialInsuranceEmpShare: Number,
        socialInsuranceCompShare: Number,
        absenceDeduction: Number,
        penaltyDeduction: Number,
        loanDeduction: Number,
        totalDeductions: Number,
        overtimeAddition: Number,
        grossSalary: Number
    },
    netSalary: Number,
    hasAnomaly: { type: Boolean, default: false },
    anomalyReason: [String],
    status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.PayrollRecord || mongoose.model('PayrollRecord', PayrollRecordSchema);
