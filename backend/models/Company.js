// backend/models/Company.js
const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
    name: { type: String, required: true },
    adminPassword: { type: String }, // Add this field for admin login
    subscriptionPlan: { type: String, default: 'Standard' },
    maxEmployees: { type: Number, default: 50 },
    settings: {
        taxYear: { type: Number, default: 2026 },
        currency: { type: String, default: 'EGP' },
        absentDayRate: { type: Number, default: 1 },
        overtimeRate: { type: Number, default: 1.5 },
        overtimeHolRate: { type: Number, default: 2.0 },
        medicalLimit: { type: Number, default: 10000 },
        taxExemptionLimit: { type: Number, default: 40000 },
        personalExemption: { type: Number, default: 20000 },
        workDaysPerWeek: { type: Number, default: 5 },
        dailyWorkHours: { type: Number, default: 8 },
        lateThreshold: { type: Number, default: 120 },
        monthCalcType: { type: String, default: "30" }
    }
}, { timestamps: true });

module.exports = mongoose.models.Company || mongoose.model('Company', CompanySchema);
