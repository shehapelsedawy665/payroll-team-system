/**
 * @file routes/attendanceAPI.js
 * @description Enhanced attendance API routes with check-in/out, records, and approvals
 */

const express = require('express');
const router = express.Router();
const Attendance = require('../backend/models/Attendance');
const Shift = require('../backend/models/Shift');
const Employee = require('../backend/models/Employee');
const { calculateAttendance, getMonthlyAttendanceSummary, isWithinGeofence } = require('../backend/modules/attendance/attendanceEngine');
const { authMiddleware } = require('../backend/middleware/auth');
const { connectDB } = require('../backend/config/db');

// ==================== MIDDLEWARE ====================
router.use(authMiddleware); // All routes require authentication

/**
 * POST /api/attendance/checkin
 * Record employee check-in (manual or biometric)
 */
router.post('/checkin', async (req, res) => {
    try {
        const { employeeId, time, source = 'manual', latitude, longitude, deviceId } = req.body;

        // Validate
        if (!employeeId || !time) {
            return res.status(400).json({ error: 'employeeId and time are required' });
        }

        const employee = await Employee.findById(employeeId).populate('shiftId');
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        const today = new Date().toISOString().split('T')[0];
        
        // Find or create today's attendance record
        let attendance = await Attendance.findOne({ $and: [{ employeeId }, { date: today }] });
        
        if (!attendance) {
            attendance = new Attendance({
                employeeId,
                companyId: employee.companyId,
                date: today,
                month: today.substring(0, 7)
            });
        }

        // Check geofence if device location provided
        if (longitude && latitude && deviceId && employee.shiftId.biometricDeviceId) {
            const BiometricDevice = require('../backend/models/BiometricDevice');
            const device = await BiometricDevice.findById(employee.shiftId.biometricDeviceId);
            if (device && !isWithinGeofence(latitude, longitude, device.latitude, device.longitude, device.allowedRadius)) {
                return res.status(403).json({ 
                    error: 'Check-in outside allowed location', 
                    requiresManualApproval: true 
                });
            }
        }

        // Update attendance
        attendance.checkInTime = time;
        attendance.checkInSource = source;
        if (latitude && longitude) {
            attendance.checkInLocation = { latitude, longitude };
        }
        if (deviceId) {
            attendance.biometricDeviceId = deviceId;
        }

        await attendance.save();

        res.json({ 
            success: true, 
            message: 'Check-in recorded', 
            attendance: {
                date: attendance.date,
                checkInTime: attendance.checkInTime,
                status: 'checked-in'
            }
        });
    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/attendance/checkout
 * Record employee check-out and calculate attendance metrics
 */
router.post('/checkout', async (req, res) => {
    try {
        const { employeeId, time, source = 'manual', latitude, longitude, deviceId } = req.body;

        if (!employeeId || !time) {
            return res.status(400).json({ error: 'employeeId and time are required' });
        }

        const employee = await Employee.findById(employeeId).populate('shiftId');
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        const today = new Date().toISOString().split('T')[0];
        const attendance = await Attendance.findOne({ $and: [{ employeeId }, { date: today }] });

        if (!attendance) {
            return res.status(404).json({ error: 'No check-in record found for today' });
        }

        // Update checkout
        attendance.checkOutTime = time;
        attendance.checkOutSource = source;
        if (latitude && longitude) {
            attendance.checkOutLocation = { latitude, longitude };
        }

        // Calculate attendance metrics
        const calc = await calculateAttendance(
            employeeId,
            today,
            employee.shiftId,
            attendance.checkInTime,
            time,
            {
                source,
                deviceId,
                geolocation: { latitude, longitude }
            }
        );

        // Update attendance record with calculations
        attendance.status = calc.status;
        attendance.workHours = calc.workHours;
        attendance.lateMinutes = calc.lateMinutes;
        attendance.overtime = calc.overtime;
        attendance.bonus = calc.bonus;
        attendance.isAbsenceDeductible = calc.isAbsenceDeductible;
        attendance.lateDeductionDays = calc.lateDeductionDays;
        attendance.absentDeductionDays = calc.absentDeductionDays;
        attendance.requiresApproval = calc.requiresApproval;

        await attendance.save();

        res.json({
            success: true,
            message: 'Check-out recorded and attendance calculated',
            attendance: {
                date: attendance.date,
                checkInTime: attendance.checkInTime,
                checkOutTime: attendance.checkOutTime,
                status: attendance.status,
                workHours: attendance.workHours,
                lateMinutes: attendance.lateMinutes,
                overtime: attendance.overtime,
                requiresApproval: attendance.requiresApproval
            }
        });
    } catch (error) {
        console.error('Check-out error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/attendance/records
 * Get attendance records for employee in a specific month
 */
router.get('/records', async (req, res) => {
    try {
        const { employeeId, month } = req.query;

        if (!employeeId || !month) {
            return res.status(400).json({ error: 'employeeId and month (YYYY-MM) required' });
        }

        const records = await Attendance.find({ employeeId, month })
            .populate('employeeId', 'name jobId')
            .sort({ date: 1 });

        const summary = await getMonthlyAttendanceSummary(employeeId, month);

        res.json({
            success: true,
            month,
            records,
            summary
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/attendance/:id/approve
 * HR manager approves anomalies (late, early departure, etc)
 */
router.put('/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { approvedBy, approvalNotes, correctedStatus } = req.body;

        // Check if user is HR or Manager
        if (req.user.role !== 'hr' && req.user.role !== 'manager') {
            return res.status(403).json({ error: 'Only HR/Managers can approve attendance' });
        }

        const attendance = await Attendance.findByIdAndUpdate(
            id,
            {
                isApproved: true,
                approvedBy,
                approvalNotes,
                status: correctedStatus || undefined,
                approvalDate: new Date()
            },
            { new: true }
        );

        res.json({ success: true, message: 'Attendance approved', attendance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/attendance/dashboard?month=2026-04
 * Get attendance statistics dashboard for company
 */
router.get('/dashboard', async (req, res) => {
    try {
        const { month, departmentId } = req.query;

        if (!month) {
            return res.status(400).json({ error: 'month (YYYY-MM) is required' });
        }

        // Get all attendance records for month
        let query = { month };
        if (departmentId) {
            query.departmentId = departmentId;
        }

        const records = await Attendance.find(query)
            .populate('employeeId', 'name jobId departmentId');

        // Calculate statistics
        const stats = {
            totalEmployees: new Set(records.map(r => r.employeeId._id)).size,
            presentDays: records.filter(r => r.status === 'present').length,
            absentDays: records.filter(r => r.status === 'absent').length,
            lateDays: records.filter(r => r.status === 'late').length,
            halfDays: records.filter(r => r.status === 'half-day').length,
            averageWorkHours: (records.reduce((sum, r) => sum + (r.workHours || 0), 0) / records.length).toFixed(2),
            totalOvertimeHours: records.reduce((sum, r) => sum + (r.overtime || 0), 0).toFixed(2),
            totalPenaltyDays: records.reduce((sum, r) => sum + (r.lateDeductionDays || 0), 0).toFixed(2),
            attendanceRequiringApproval: records.filter(r => r.requiresApproval && !r.isApproved).length
        };

        // Department breakdown
        const byDept = {};
        records.forEach(r => {
            if (!byDept[r.employeeId.departmentId]) {
                byDept[r.employeeId.departmentId] = {
                    present: 0,
                    absent: 0,
                    late: 0,
                    halfDay: 0
                };
            }
            byDept[r.employeeId.departmentId][r.status.replace('-', '')] = (byDept[r.employeeId.departmentId][r.status.replace('-', '')] || 0) + 1;
        });

        res.json({
            success: true,
            month,
            stats,
            departmentBreakdown: byDept
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/attendance/my-records?month=2026-04
 * Get current employee's attendance records for a month
 */
router.get('/my-records', async (req, res) => {
    try {
        const { month } = req.query;
        const userId = req.user._id;

        if (!month) {
            return res.status(400).json({ error: 'month (YYYY-MM) required' });
        }

        // Find employee by userId
        const employee = await Employee.findOne({ userId });
        if (!employee) {
            return res.status(404).json({ error: 'Employee profile not found' });
        }

        const records = await Attendance.find({ 
            employeeId: employee._id, 
            month 
        }).sort({ date: 1 });

        const summary = await getMonthlyAttendanceSummary(employee._id, month);

        res.json({
            success: true,
            month,
            records,
            summary
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/attendance/manual-entry
 * HR manually enters attendance for employee (if device fails, etc)
 */
router.post('/manual-entry', async (req, res) => {
    try {
        // Check authorization
        if (req.user.role !== 'hr' && req.user.role !== 'manager') {
            return res.status(403).json({ error: 'Only HR/Managers can make manual entries' });
        }

        const { employeeId, date, status, workHours, notes } = req.body;

        if (!employeeId || !date || !status) {
            return res.status(400).json({ error: 'employeeId, date, and status required' });
        }

        const month = date.substring(0, 7);

        let attendance = await Attendance.findOne({ employeeId, date });
        if (!attendance) {
            attendance = new Attendance({
                employeeId,
                date,
                month,
                companyId: req.body.companyId
            });
        }

        attendance.status = status;
        attendance.workHours = workHours || 0;
        attendance.manualEntry = true;
        attendance.manualEntryBy = req.user._id;
        attendance.manualEntryNotes = notes;

        await attendance.save();

        res.json({ success: true, message: 'Manual entry recorded', attendance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
