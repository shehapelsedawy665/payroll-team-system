const mongoose = require('mongoose');

const ShiftSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true },
    startTime: String, // "09:00"
    endTime: String,   // "17:00"
    breakDuration: { type: Number, default: 60 }, // in minutes
    workDays: [Number] // 0=Sunday to 6=Saturday
}, { timestamps: true });

module.exports = mongoose.models.Shift || mongoose.model('Shift', ShiftSchema);