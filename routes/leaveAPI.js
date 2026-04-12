/**
 * @file routes/leaveAPI.js
 * @description Enhanced leave request API with approval workflow
 */

const express = require('express');
const router = express.Router();
const LeaveRequest = require('../backend/models/LeaveRequest');
const LeaveBalance = require('../backend/models/LeaveBalance');
const LeaveType = require('../backend/models/LeaveType');
const Employee = require('../backend/models/Employee');
const {
    checkLeaveEligibility,
    submitLeaveRequest,
    approveLeaveRequest,
    hrApproveLeaveRequest,
    cancelLeaveRequest,
    getLeaveBalance,
    initializeLeaveBalance
} = require('../backend/modules/leave/leaveEngine');
const auth = require('../backend/middleware/auth');
const connectDB = require('../backend/config/db');

connectDB();
router.use(auth);

// ==================== LEAVE TYPES ====================

/**
 * GET /api/leave/types
 * Get all leave types for company
 */
router.get('/types', async (req, res) => {
    try {
        const types = await LeaveType.find({ companyId: req.user.companyId, isActive: true });
        res.json({
            success: true,
            types
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== LEAVE BALANCE ====================

/**
 * GET /api/leave/balance?year=2026
 * Get employee's leave balance
 */
router.get('/balance', async (req, res) => {
    try {
        const { year } = req.query;
        const currentYear = parseInt(year) || new Date().getFullYear();

        // Find employee by userId
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) {
            return res.status(404).json({ error: 'Employee profile not found' });
        }

        const balance = await getLeaveBalance(employee._id, currentYear);

        res.json({
            success: true,
            ...balance
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/leave/balance/:employeeId?year=2026
 * Get any employee's leave balance (HR only)
 */
router.get('/balance/:employeeId', async (req, res) => {
    try {
        if (req.user.role !== 'hr' && req.user.role !== 'manager') {
            return res.status(403).json({ error: 'Only HR/Managers can view others\' balances' });
        }

        const { year } = req.query;
        const currentYear = parseInt(year) || new Date().getFullYear();

        const balance = await getLeaveBalance(req.params.employeeId, currentYear);

        res.json({
            success: true,
            ...balance
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== LEAVE REQUESTS ====================

/**
 * POST /api/leave/request
 * Submit new leave request
 */
router.post('/request', async (req, res) => {
    try {
        const {
            leaveTypeId,
            startDate,
            endDate,
            reason,
            attachments
        } = req.body;

        if (!leaveTypeId || !startDate || !endDate) {
            return res.status(400).json({ error: 'leaveTypeId, startDate, endDate required' });
        }

        // Get employee
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) {
            return res.status(404).json({ error: 'Employee profile not found' });
        }

        const leaveRequest = await submitLeaveRequest({
            employeeId: employee._id,
            companyId: employee.companyId,
            leaveTypeId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason,
            attachments: attachments || []
        });

        res.status(201).json({
            success: true,
            message: 'Leave request submitted',
            leaveRequest
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/leave/my-requests?status=pending
 * Get current employee's leave requests
 */
router.get('/my-requests', async (req, res) => {
    try {
        const { status, year } = req.query;

        // Find employee
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) {
            return res.status(404).json({ error: 'Employee profile not found' });
        }

        let query = { employeeId: employee._id };

        if (status) {
            query.status = status;
        }

        if (year) {
            const startYear = new Date(`${year}-01-01`);
            const endYear = new Date(`${parseInt(year) + 1}-01-01`);
            query.startDate = { $gte: startYear, $lt: endYear };
        }

        const requests = await LeaveRequest.find(query)
            .populate('leaveTypeId', 'nameEn')
            .sort({ startDate: -1 });

        res.json({
            success: true,
            requests
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/leave/request/:id/cancel
 * Cancel leave request
 */
router.put('/request/:id/cancel', async (req, res) => {
    try {
        const { reason } = req.body;

        const leaveRequest = await LeaveRequest.findById(req.params.id);
        if (!leaveRequest) {
            return res.status(404).json({ error: 'Leave request not found' });
        }

        // Only employee or HR can cancel
        const employee = await Employee.findOne({ userId: req.user._id });
        if (leaveRequest.employeeId.toString() !== employee._id.toString() && req.user.role !== 'hr') {
            return res.status(403).json({ error: 'Not authorized to cancel this request' });
        }

        const cancelled = await cancelLeaveRequest(req.params.id, req.user._id, reason);

        res.json({
            success: true,
            message: 'Leave request cancelled',
            leaveRequest: cancelled
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ==================== MANAGER APPROVAL ====================

/**
 * GET /api/leave/pending?role=manager
 * Get pending leave requests for manager/HR approval
 */
router.get('/pending', async (req, res) => {
    try {
        const { role } = req.query;
        let statusFilter;

        if (req.user.role === 'manager') {
            statusFilter = ['pending_manager', 'submitted'];
        } else if (req.user.role === 'hr') {
            statusFilter = ['pending_hr'];
        } else {
            return res.status(403).json({ error: 'Only managers/HR can view pending requests' });
        }

        const requests = await LeaveRequest.find({
            companyId: req.user.companyId,
            status: { $in: statusFilter }
        })
        .populate('employeeId', 'name jobId email')
        .populate('leaveTypeId', 'nameEn')
        .sort({ startDate: 1 });

        res.json({
            success: true,
            requests
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/leave/request/:id/manager-approve
 * Manager approves or rejects leave request
 */
router.put('/request/:id/manager-approve', async (req, res) => {
    try {
        if (req.user.role !== 'manager' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only managers can approve' });
        }

        const { action, notes } = req.body; // action: 'approved' or 'rejected'

        if (!['approved', 'rejected'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        const approved = await approveLeaveRequest(
            req.params.id,
            action,
            req.user._id,
            notes
        );

        res.json({
            success: true,
            message: `Leave request ${action}`,
            leaveRequest: approved
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * PUT /api/leave/request/:id/hr-approve
 * HR approves or rejects leave request
 */
router.put('/request/:id/hr-approve', async (req, res) => {
    try {
        if (req.user.role !== 'hr' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only HR can approve at this level' });
        }

        const { action, notes } = req.body;

        if (!['approved', 'rejected'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        const approved = await hrApproveLeaveRequest(
            req.params.id,
            action,
            req.user._id,
            notes
        );

        res.json({
            success: true,
            message: `Leave request ${action} by HR`,
            leaveRequest: approved
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ==================== HR FUNCTIONS ====================

/**
 * POST /api/leave/init-balance
 * Initialize leave balances for employee (HR only)
 */
router.post('/init-balance', async (req, res) => {
    try {
        if (req.user.role !== 'hr' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only HR can initialize balances' });
        }

        const { employeeId, year } = req.body;

        if (!employeeId || !year) {
            return res.status(400).json({ error: 'employeeId and year required' });
        }

        const leaveTypes = await LeaveType.find({
            companyId: req.user.companyId,
            isActive: true
        });

        const balances = await initializeLeaveBalance(employeeId, req.user.companyId, year, leaveTypes);

        res.json({
            success: true,
            message: 'Leave balances initialized',
            balances
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/leave/company-report?month=2026-04
 * Get company-wide leave report (HR only)
 */
router.get('/company-report', async (req, res) => {
    try {
        if (req.user.role !== 'hr' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only HR can view company reports' });
        }

        const { startDate, endDate } = req.query;

        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = {
                startDate: { $gte: new Date(startDate) },
                endDate: { $lte: new Date(endDate) }
            };
        }

        const reports = {
            approved: await LeaveRequest.countDocuments({
                companyId: req.user.companyId,
                status: 'approved',
                ...dateFilter
            }),
            pending: await LeaveRequest.countDocuments({
                companyId: req.user.companyId,
                status: { $in: ['pending_manager', 'pending_hr', 'submitted'] },
                ...dateFilter
            }),
            rejected: await LeaveRequest.countDocuments({
                companyId: req.user.companyId,
                status: 'rejected',
                ...dateFilter
            })
        };

        res.json({
            success: true,
            reports
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/leave/check-eligibility
 * Check if employee can request leave (before submitting)
 */
router.get('/check-eligibility', async (req, res) => {
    try {
        const { leaveTypeId, startDate, endDate, totalDays } = req.query;

        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) {
            return res.status(404).json({ error: 'Employee profile not found' });
        }

        const eligibility = await checkLeaveEligibility(
            employee._id,
            leaveTypeId,
            new Date(startDate),
            new Date(endDate),
            parseInt(totalDays) || 1
        );

        res.json({
            success: true,
            ...eligibility
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
