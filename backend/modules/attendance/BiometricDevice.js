const mongoose = require('mongoose');

const BiometricDeviceSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    deviceId: { type: String, required: true, unique: true }, // Unique device identifier
    deviceName: { type: String, required: true }, // e.g., "Entrance Biometric Scanner - Floor 1"
    deviceType: { 
        type: String, 
        enum: ['fingerprint', 'face-recognition', 'iris', 'rfid', 'qr-code', 'manual'], 
        required: true 
    },
    
    // Location info
    location: String, // e.g., "Main Entrance", "Office 2nd Floor"
    latitude: Number,
    longitude: Number,
    allowedRadius: { type: Number, default: 100 }, // in meters, for geofencing
    
    // Configuration
    isActive: { type: Boolean, default: true },
    purpose: { 
        type: String, 
        enum: ['check-in', 'check-out', 'both'], 
        default: 'both' 
    },
    
    // API Integration
    apiEndpoint: String, // For third-party biometric systems
    apiKey: String, // Encrypted API key
    apiSecret: String, // Encrypted
    
    // Usage statistics
    totalScans: { type: Number, default: 0 },
    successfulScans: { type: Number, default: 0 },
    failedScans: { type: Number, default: 0 },
    lastActiveAt: Date,
    
    // Syncing
    lastSyncedAt: Date,
    enrolledEmployees: [String], // Array of employee IDs enrolled in device
    
    description: String,
    vendor: String, // e.g., "ZKTeco", "Hikvision", "3M"
}, { timestamps: true });

module.exports = mongoose.models.BiometricDevice || mongoose.model('BiometricDevice', BiometricDeviceSchema);
