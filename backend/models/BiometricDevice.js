const mongoose = require('mongoose');

const biometricDeviceSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    deviceType: {
        type: String,
        enum: ['fingerprint', 'face-recognition', 'iris', 'rfid', 'qr-code', 'manual'],
        required: true
    },
    deviceName: {
        type: String,
        required: true
    },
    serialNumber: {
        type: String,
        required: true,
        unique: true
    },
    location: String,
    
    // API Integration
    apiEndpoint: String,
    apiKey: String,
    apiSecret: String,
    
    // Geofencing
    latitude: Number,
    longitude: Number,
    allowedRadius: { type: Number, default: 100 }, // meters
    
    // Enrolled employees
    enrolledEmployees: [{
        employeeId: mongoose.Schema.Types.ObjectId,
        enrollmentDate: Date,
        enrollmentData: String // biometric template/data
    }],
    
    // Status
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance'],
        default: 'active'
    },
    
    lastSync: Date,
    syncStatus: {
        type: String,
        enum: ['pending', 'syncing', 'synced', 'failed'],
        default: 'pending'
    }
}, { timestamps: true });

module.exports = mongoose.models.BiometricDevice || mongoose.model('BiometricDevice', biometricDeviceSchema);
