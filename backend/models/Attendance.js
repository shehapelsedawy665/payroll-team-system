const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    date: { type: String, required: true }, // Format: "YYYY-MM-DD"
    month: { type: String, required: true }, // Format: "YYYY-MM"
    status: { type: String, enum: ['present', 'absent', 'late', 'half'], default: 'present' },
    checkIn: { type: String, default: "" }, // Format: "HH:MM"
    checkOut: { type: String, default: "" },
    lateMinutes: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    notes: { type: String, default: "" }
}, { timestamps: true });

AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);