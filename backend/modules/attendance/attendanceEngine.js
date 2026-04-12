/**
 * @file backend/modules/attendance/attendanceEngine.js
 * @description Advanced attendance calculation engine
 * Handles check-ins, check-outs, late arrivals, overtime, and penalties
 */

const Shift = require('./Shift');
const Attendance = require('./Attendance');

/**
 * Calculate time difference between two times (HH:MM format)
 * Returns difference in minutes
 */
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

/**
 * Convert minutes to HH:MM format
 */
function minutesToTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Main attendance calculation function
 * Called when employee checks in/out or at end of day
 */
const calculateAttendance = async (employeeId, date, shiftData, checkInTime, checkOutTime, options = {}) => {
    const {
        source = 'manual',
        lateThreshold = 120, // minutes after which it's marked late
        minimumWorkHours = 8, // hours required for "present" status
        overtimeAfterHours = 8,
        geolocation = null,
        deviceId = null
    } = options;

    try {
        // Get shift details if not provided
        let shift = shiftData;
        if (!shift && options.shiftId) {
            shift = await Shift.findById(options.shiftId);
        }

        if (!shift) {
            throw new Error('Shift information is required for attendance calculation');
        }

        const shiftStartMinutes = timeToMinutes(shift.startTime);
        const shiftEndMinutes = timeToMinutes(shift.endTime);
        const checkInMinutes = timeToMinutes(checkInTime);
        const checkOutMinutes = timeToMinutes(checkOutTime);

        // ==================== LATENESS CALCULATION ====================
        let lateMinutes = 0;
        let status = 'present';

        if (checkInTime && checkInMinutes > shiftStartMinutes + shift.gracePeriod) {
            lateMinutes = checkInMinutes - (shiftStartMinutes + shift.gracePeriod);
            status = 'late';
        }

        // ==================== WORK HOURS CALCULATION ====================
        let workHours = 0;
        let breakTaken = options.breakTaken || shift.breakDuration;

        if (checkInTime && checkOutTime) {
            const totalMinutes = checkOutMinutes - checkInMinutes;
            workHours = (totalMinutes - breakTaken) / 60;
        }

        // Determine final status
        if (!checkInTime) {
            status = 'absent';
        } else if (workHours < (minimumWorkHours / 2)) {
            status = 'half-day';
        } else if (status === 'late' && lateMinutes > lateThreshold) {
            status = 'late'; // Significant lateness
        } else if (workHours >= minimumWorkHours) {
            status = 'present';
        }

        // ==================== OVERTIME CALCULATION ====================
        let overtime = 0;
        let overtimeStatus = 'none';

        if (workHours > overtimeAfterHours) {
            overtime = workHours - overtimeAfterHours;
            overtimeStatus = 'earned'; // Default to earned (not paid unless specified)
        }

        // ==================== EARLY DEPARTURE ====================
        let earlyDepartureMinutes = 0;
        if (checkOutTime && checkOutMinutes < shiftEndMinutes - shift.gracePeriod) {
            earlyDepartureMinutes = (shiftEndMinutes - shift.gracePeriod) - checkOutMinutes;
        }

        // ==================== PENALTIES AND DEDUCTIONS ====================
        let isAbsenceDeductible = status === 'absent';
        let isLatePenalty = lateMinutes > lateThreshold;
        let lateDeductionDays = 0;
        let absentDeductionDays = 0;

        // Calculate deduction days for salary impact
        if (status === 'absent') {
            absentDeductionDays = 1;
        } else if (status === 'half-day') {
            absentDeductionDays = 0.5;
        } else if (isLatePenalty) {
            // Late penalties: if late by more than X minutes, deduct partial day
            if (lateMinutes > 120) {
                lateDeductionDays = 0.5; // Half day deduction for 2+ hours late
            } else if (lateMinutes > 60) {
                lateDeductionDays = 0.25; // Quarter day deduction
            }
        }

        // ==================== ATTENDANCE BONUS ====================
        let bonus = 0;
        if (status === 'present' && !isLatePenalty && workHours >= minimumWorkHours) {
            // Excellent attendance bonus
            bonus = options.attendanceBonus || 50; // Default 50 EGP
        }

        return {
            status,
            workHours: Number(workHours.toFixed(2)),
            lateMinutes,
            earlyDepartureMinutes,
            overtime: Number(overtime.toFixed(2)),
            overtimeStatus,
            isAbsenceDeductible,
            isLatePenalty,
            lateDeductionDays: Number(lateDeductionDays.toFixed(2)),
            absentDeductionDays: Number(absentDeductionDays.toFixed(2)),
            bonus,
            breakTaken,
            geolocation,
            deviceId,
            source,
            requiresApproval: status === 'half-day' || isLatePenalty || earlyDepartureMinutes > 60
        };
    } catch (error) {
        throw new Error(`Attendance calculation failed: ${error.message}`);
    }
};

/**
 * Batch calculate attendance for a company for a specific month
 */
const calculateMonthlyAttendance = async (companyId, month, employees) => {
    try {
        const results = {
            processed: 0,
            failed: 0,
            errors: []
        };

        for (const emp of employees) {
            try {
                const attendanceRecords = await Attendance.find({
                    employeeId: emp._id,
                    month
                });

                // Process each day's attendance
                for (const record of attendanceRecords) {
                    if (!record.isApproved && record.requiresApproval) {
                        // Flag for HR review
                        record.isApproved = false;
                    }
                }

                results.processed++;
            } catch (err) {
                results.failed++;
                results.errors.push(`Employee ${emp.name}: ${err.message}`);
            }
        }

        return results;
    } catch (error) {
        throw new Error(`Monthly calculation failed: ${error.message}`);
    }
};

/**
 * Calculate geofence compliance
 * Returns true if check-in location is within allowed radius of device
 */
const isWithinGeofence = (lat, long, deviceLat, deviceLong, radiusMeters) => {
    if (!lat || !long || !deviceLat || !deviceLong) return true; // Skip if no coordinates

    const R = 6371; // Earth's radius in km
    const dLat = (deviceLat - lat) * Math.PI / 180;
    const dLng = (deviceLong - long) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat * Math.PI / 180) * Math.cos(deviceLat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c * 1000; // distance in meters

    return distance <= radiusMeters;
};

/**
 * Get attendance summary for employee in a month
 */
const getMonthlyAttendanceSummary = async (employeeId, month) => {
    const records = await Attendance.find({ employeeId, month });

    const summary = {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        halfDays: 0,
        holidays: 0,
        leaveDays: 0,
        totalWorkHours: 0,
        totalOvertimeHours: 0,
        totalLateMinutes: 0,
        totalBonus: 0,
        totalLatePenaltyDays: 0
    };

    records.forEach(r => {
        summary.totalDays++;
        summary[`${r.status}Days`] = (summary[`${r.status}Days`] || 0) + 1;
        summary.totalWorkHours += r.workHours || 0;
        summary.totalOvertimeHours += r.overtime || 0;
        summary.totalLateMinutes += r.lateMinutes || 0;
        summary.totalBonus += r.bonus || 0;
        summary.totalLatePenaltyDays += r.lateDeductionDays || 0;
    });

    return summary;
};

module.exports = {
    calculateAttendance,
    calculateMonthlyAttendance,
    isWithinGeofence,
    getMonthlyAttendanceSummary,
    timeToMinutes,
    minutesToTime
};
