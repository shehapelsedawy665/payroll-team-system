const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    date: { type: String, required: true }, // Format: "YYYY-MM-DD"
    month: { type: String, required: true }, // Format: "YYYY-MM"
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    
    // Check-in/out tracking
    checkIn: { type: String, default: null }, // Format: "HH:MM"
    checkOut: { type: String, default: null },
    checkInSource: { type: String, enum: ['manual', 'biometric', 'api'], default: 'manual' },
    checkOutSource: { type: String, enum: ['manual', 'biometric', 'api'], default: 'manual' },
    
    // Status tracking
    status: { 
        type: String, 
        enum: ['present', 'absent', 'late', 'half-day', 'holiday', 'weekend', 'leave'], 
        default: 'absent' 
    },
    
    // Time calculations
    workHours: { type: Number, default: 0 }, // Total hours worked
    lateMinutes: { type: Number, default: 0 }, // Minutes late
    earlyDepartureMinutes: { type: Number, default: 0 }, // Minutes left early
    breakTaken: { type: Number, default: 0 }, // Minutes of break taken
    overtime: { type: Number, default: 0 }, // Overtime hours
    overtimeStatus: { type: String, enum: ['none', 'earned', 'paid'], default: 'none' },
    
    // Penalties & bonuses
    isAbsenceDeductible: { type: Boolean, default: false },
    isLatePenalty: { type: Boolean, default: false },
    lateDeductionDays: { type: Number, default: 0 },
    absentDeductionDays: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 }, // Attendance bonus
    
    // Additional info
    geolocation: {
        checkInLat: Number,
        checkInLong: Number,
        checkOutLat: Number,
        checkOutLong: Number,
        distance: Number // Distance from office in meters
    },
    deviceInfo: {
        checkInDevice: String, // Biometric device ID or 'Manual Entry'
        checkOutDevice: String
    },
    notes: String,
    approvedBy: mongoose.Schema.Types.ObjectId, // HR approval
    isApproved: { type: Boolean, default: false },
    requiresApproval: { type: Boolean, default: false } // For anomalies
}, { timestamps: true });

AttendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ companyId: 1, month: 1 });
AttendanceSchema.index({ date: 1 });

module.exports = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);
