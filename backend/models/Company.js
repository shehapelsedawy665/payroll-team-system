// backend/models/Company.js
const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
    name: { type: String, required: true },
    subscriptionPlan: { type: String, default: 'Standard' }, // (Basic, Pro, Enterprise)
    maxEmployees: { type: Number, default: 50 },
    settings: {
        taxYear: { type: Number, default: 2026 },
        currency: { type: String, default: 'EGP' }
    }
}, { timestamps: true });

module.exports = mongoose.model('Company', CompanySchema);
