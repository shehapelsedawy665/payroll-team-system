const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    plan: { type: String, enum: ['trial', 'basic', 'pro', 'enterprise'], default: 'trial' },
    status: { type: String, enum: ['active', 'inactive', 'cancelled'], default: 'active' },
    startDate: { type: Date, default: Date.now },
    endDate: Date,
    features: {
        maxEmployees: Number,
        payrollMonths: Number,
        hasReports: Boolean,
        hasIntegrations: Boolean
    }
}, { timestamps: true });

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);