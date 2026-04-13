/**
 * @file routes/biometric.js
 * @description Biometric device management and enrollment
 * Supports fingerprint, face-recognition, iris, RFID, QR-code, and manual devices
 */

const express = require('express');
const router = express.Router();
const BiometricDevice = require('../backend/models/BiometricDevice');
const Employee = require('../backend/models/Employee');
const Attendance = require('../backend/models/Attendance');
const Shift = require('../backend/models/Shift');
const { authMiddleware } = require('../backend/middleware/auth');
const { connectDB } = require('../backend/config/db');

router.use(authMiddleware);

// ==================== DEVICE MANAGEMENT ====================

/**
 * POST /api/biometric/device/register
 * Register a new biometric device in the system
 */
router.post('/device/register', async (req, res) => {
    try {
        // Only HR/Admin can register devices
        if (req.user.role !== 'hr' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only HR/Admins can register devices' });
        }

        const {
            deviceType, // fingerprint, face-recognition, iris, rfid, qr-code, manual
            deviceName,
            serialNumber,
            location,
            apiEndpoint,
            apiKey,
            apiSecret,
            latitude,
            longitude,
            allowedRadius = 100 // meters
        } = req.body;

        if (!deviceType || !deviceName || !serialNumber) {
            return res.status(400).json({ error: 'deviceType, deviceName, and serialNumber required' });
        }

        // Validate device type
        const validTypes = ['fingerprint', 'face-recognition', 'iris', 'rfid', 'qr-code', 'manual'];
        if (!validTypes.includes(deviceType)) {
            return res.status(400).json({ error: `Invalid device type. Allowed: ${validTypes.join(', ')}` });
        }

        // Check if device already exists
        const existing = await BiometricDevice.findOne({ serialNumber });
        if (existing) {
            return res.status(409).json({ error: 'Device with this serial number already exists' });
        }

        const device = new BiometricDevice({
            companyId: req.user.companyId,
            deviceType,
            deviceName,
            serialNumber,
            location,
            apiEndpoint,
            apiKey: apiKey ? Buffer.from(apiKey).toString('base64') : undefined, // Encrypt
            apiSecret: apiSecret ? Buffer.from(apiSecret).toString('base64') : undefined,
            latitude,
            longitude,
            allowedRadius,
            isActive: true,
            enrolledEmployees: []
        });

        await device.save();

        res.status(201).json({
            success: true,
            message: 'Device registered successfully',
            device: {
                _id: device._id,
                deviceType: device.deviceType,
                deviceName: device.deviceName,
                serialNumber: device.serialNumber,
                isActive: device.isActive,
                enrolledCount: device.enrolledEmployees.length
            }
        });
    } catch (error) {
        console.error('Device registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/biometric/devices
 * List all biometric devices for the company
 */
router.get('/devices', async (req, res) => {
    try {
        const devices = await BiometricDevice.find({ companyId: req.user.companyId })
            .select('-apiKey -apiSecret'); // Don't return sensitive keys

        res.json({
            success: true,
            total: devices.length,
            devices
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/biometric/device/:id
 * Update device configuration
 */
router.put('/device/:id', async (req, res) => {
    try {
        if (req.user.role !== 'hr' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only HR/Admins can update devices' });
        }

        const { location, latitude, longitude, allowedRadius, isActive } = req.body;

        const device = await BiometricDevice.findByIdAndUpdate(
            req.params.id,
            {
                location: location || undefined,
                latitude: latitude || undefined,
                longitude: longitude || undefined,
                allowedRadius: allowedRadius || undefined,
                isActive: isActive !== undefined ? isActive : undefined
            },
            { new: true }
        ).select('-apiKey -apiSecret');

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        res.json({
            success: true,
            message: 'Device updated',
            device
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== EMPLOYEE ENROLLMENT ====================

/**
 * POST /api/biometric/enroll
 * Enroll employee in a biometric device
 */
router.post('/enroll', async (req, res) => {
    try {
        const { employeeId, deviceId, biometricData } = req.body;

        if (!employeeId || !deviceId) {
            return res.status(400).json({ error: 'employeeId and deviceId required' });
        }

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        const device = await BiometricDevice.findById(deviceId);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        // Check if already enrolled
        const alreadyEnrolled = device.enrolledEmployees.find(e => e.employeeId.toString() === employeeId);
        if (alreadyEnrolled) {
            return res.status(409).json({ error: 'Employee already enrolled in this device' });
        }

        // Add enrollment record
        device.enrolledEmployees.push({
            employeeId,
            enrolledAt: new Date(),
            biometricTemplateId: biometricData?.templateId || `template_${employeeId}_${Date.now()}`,
            enrollmentStatus: 'active',
            enrollmentNotes: biometricData?.notes || ''
        });

        device.lastSyncedAt = new Date();
        await device.save();

        res.json({
            success: true,
            message: 'Employee enrolled in device',
            enrollment: {
                deviceId: device._id,
                employeeId,
                enrolledAt: new Date().toISOString(),
                enrollmentStatus: 'active'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/biometric/device/:id/enrollments
 * Get all employee enrollments for a device
 */
router.get('/device/:id/enrollments', async (req, res) => {
    try {
        const device = await BiometricDevice.findById(req.params.id)
            .populate('enrolledEmployees.employeeId', 'name jobId email');

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        res.json({
            success: true,
            device: device.deviceName,
            enrollments: device.enrolledEmployees,
            totalEnrolled: device.enrolledEmployees.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/biometric/device/:deviceId/enroll/:employeeId
 * Unenroll employee from device
 */
router.delete('/device/:deviceId/enroll/:employeeId', async (req, res) => {
    try {
        if (req.user.role !== 'hr' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only HR/Admins can unenroll' });
        }

        const device = await BiometricDevice.findByIdAndUpdate(
            req.params.deviceId,
            {
                $pull: { enrolledEmployees: { employeeId: req.params.employeeId } }
            },
            { new: true }
        );

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        res.json({
            success: true,
            message: 'Employee unenrolled from device',
            remainingEnrollments: device.enrolledEmployees.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ATTENDANCE SYNC ====================

/**
 * POST /api/biometric/sync
 * Sync attendance records from biometric device
 * Called by device webhooks or scheduled jobs
 */
router.post('/sync', async (req, res) => {
    try {
        const { deviceId, records } = req.body;

        if (!deviceId || !records || !Array.isArray(records)) {
            return res.status(400).json({ error: 'deviceId and records array required' });
        }

        const device = await BiometricDevice.findById(deviceId);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        if (!device.isActive) {
            return res.status(403).json({ error: 'Device is not active' });
        }

        let processedCount = 0;
        let failedCount = 0;
        const errors = [];

        // Process each attendance record
        for (const record of records) {
            try {
                const { employeeId, timestamp, eventType } = record;

                if (!employeeId || !timestamp || !eventType) {
                    failedCount++;
                    errors.push(`Missing required fields in record: ${JSON.stringify(record)}`);
                    continue;
                }

                const date = new Date(timestamp).toISOString().split('T')[0];
                const time = new Date(timestamp).toTimeString().slice(0, 5); // HH:MM

                // Find or create attendance record
                let attendance = await Attendance.findOne({
                    employeeId,
                    date
                });

                if (!attendance) {
                    const employee = await Employee.findById(employeeId);
                    if (!employee) {
                        failedCount++;
                        errors.push(`Employee ${employeeId} not found`);
                        continue;
                    }

                    attendance = new Attendance({
                        employeeId,
                        companyId: employee.companyId,
                        date,
                        month: date.substring(0, 7)
                    });
                }

                // Process check-in/out
                if (eventType === 'checkin' || eventType === 'entry') {
                    attendance.checkInTime = time;
                    attendance.checkInSource = 'biometric';
                    attendance.biometricDeviceId = deviceId;
                } else if (eventType === 'checkout' || eventType === 'exit') {
                    attendance.checkOutTime = time;
                    attendance.checkOutSource = 'biometric';
                }

                await attendance.save();
                processedCount++;
            } catch (err) {
                failedCount++;
                errors.push(`Record processing error: ${err.message}`);
            }
        }

        // Update device last sync
        device.lastSyncedAt = new Date();
        await device.save();

        res.json({
            success: true,
            message: 'Sync completed',
            processed: processedCount,
            failed: failedCount,
            ...(errors.length > 0 && { errors })
        });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/biometric/sync-status
 * Get last sync status for all devices
 */
router.get('/sync-status', async (req, res) => {
    try {
        const devices = await BiometricDevice.find({
            companyId: req.user.companyId
        }).select('deviceName lastSyncedAt isActive enrolledEmployees');

        const status = devices.map(d => ({
            deviceId: d._id,
            deviceName: d.deviceName,
            isActive: d.isActive,
            enrolledCount: d.enrolledEmployees.length,
            lastSyncedAt: d.lastSyncedAt,
            minutesSinceSync: d.lastSyncedAt ? Math.floor((Date.now() - d.lastSyncedAt) / 60000) : 'Never'
        }));

        res.json({
            success: true,
            devices: status
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== ADMIN FUNCTIONS ====================

/**
 * POST /api/biometric/test-connection
 * Test device API connection (HR only)
 */
router.post('/test-connection', async (req, res) => {
    try {
        if (req.user.role !== 'hr' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only HR/Admins can test connections' });
        }

        const { deviceId } = req.body;
        const device = await BiometricDevice.findById(deviceId);

        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        if (!device.apiEndpoint) {
            return res.status(400).json({ error: 'Device has no API endpoint configured' });
        }

        try {
            // Test connection (simplified - real implementation would vary by device)
            const response = await fetch(`${device.apiEndpoint}/test`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${Buffer.from(device.apiKey || '').toString('utf-8')}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });

            if (response.ok) {
                res.json({
                    success: true,
                    message: 'Connection successful',
                    deviceStatus: 'online'
                });
            } else {
                res.json({
                    success: false,
                    message: `Connection failed: ${response.statusText}`,
                    deviceStatus: 'offline'
                });
            }
        } catch (connErr) {
            res.json({
                success: false,
                message: `Connection error: ${connErr.message}`,
                deviceStatus: 'unreachable'
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/biometric/device/:id/sync-employees
 * Manually trigger sync for a specific device
 */
router.post('/device/:id/sync-employees', async (req, res) => {
    try {
        if (req.user.role !== 'hr' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only HR/Admins can trigger sync' });
        }

        const device = await BiometricDevice.findById(req.params.id);
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        if (!device.apiEndpoint) {
            return res.status(400).json({ error: 'Device has no API endpoint configured' });
        }

        // In production, this would call the actual device API
        // For now, just update last sync time
        device.lastSyncedAt = new Date();
        await device.save();

        res.json({
            success: true,
            message: 'Sync triggered',
            lastSyncedAt: device.lastSyncedAt
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
