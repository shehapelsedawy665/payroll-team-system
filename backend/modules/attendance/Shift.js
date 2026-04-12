const mongoose = require('mongoose');

const ShiftSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true }, // e.g., "Morning Shift", "Night Shift"
    startTime: { type: String, required: true }, // Format: "HH:MM" (24-hour)
    endTime: { type: String, required: true },
    breakDuration: { type: Number, default: 60 }, // in minutes
    gracePeriod: { type: Number, default: 15 }, // in minutes (allowed lateness)
    workDays: [Number], // 0=Sunday to 6=Saturday (Egypt: Sun-Sat)
    isNightShift: { type: Boolean, default: false },
    overtimeAfter: { type: Number, default: 0 }, // hours after which overtime kicks in
    isActive: { type: Boolean, default: true },
    description: String
}, { timestamps: true });

module.exports = mongoose.models.Shift || mongoose.model('Shift', ShiftSchema);
