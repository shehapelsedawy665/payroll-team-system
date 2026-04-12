/**
 * @file backend/modules/leave/leaveEngine.js
 * @description Leave management business logic
 */

const LeaveBalance = require('../../models/LeaveBalance');
const LeaveRequest = require('../../models/LeaveRequest');
const LeaveType = require('../../models/LeaveType');
const Employee = require('../../models/Employee');

/**
 * Initialize leave balances for new employee
 */
const initializeLeaveBalance = async (employeeId, companyId, year, leaveTypes) => {
    try {
        const balances = [];

        for (const leaveType of leaveTypes) {
            const existing = await LeaveBalance.findOne({
                employeeId,
                year,
                leaveTypeId: leaveType._id
            });

            if (!existing) {
                const balance = new LeaveBalance({
                    companyId,
                    employeeId,
                    leaveTypeId: leaveType._id,
                    year,
                    allocatedDays: leaveType.defaultDaysPerYear || 0,
                    remainingDays: leaveType.defaultDaysPerYear || 0,
                    history: [{
                        date: new Date(),
                        action: 'allocated',
                        days: leaveType.defaultDaysPerYear || 0,
                        reason: `Initial allocation for ${year}`
                    }]
                });

                // Legacy fields
                if (leaveType.nameEn === 'Annual') {
                    balance.annualDays = leaveType.defaultDaysPerYear || 30;
                } else if (leaveType.nameEn === 'Sick') {
                    balance.sickDays = leaveType.defaultDaysPerYear || 8;
                }

                await balance.save();
                balances.push(balance);
            }
        }

        return balances;
    } catch (error) {
        throw new Error(`Initialize leave balance failed: ${error.message}`);
    }
};

/**
 * Check if employee is eligible to request leave
 */
const checkLeaveEligibility = async (employeeId, leaveTypeId, startDate, endDate, totalDays) => {
    try {
        const year = new Date(startDate).getFullYear();
        
        // Get leave balance
        const balance = await LeaveBalance.findOne({
            employeeId,
            leaveTypeId,
            year
        });

        if (!balance) {
            return {
                eligible: false,
                reason: 'No leave balance found for this year',
                availableDays: 0
            };
        }

        // Check available days
        const availableDays = balance.allocatedDays + balance.carriedOverDays - balance.approvedDays - balance.pendingDays;

        if (availableDays < totalDays) {
            return {
                eligible: false,
                reason: `Insufficient leave days. Available: ${availableDays}, Requested: ${totalDays}`,
                availableDays
            };
        }

        // Check for overlapping leaves
        const overlapping = await LeaveRequest.findOne({
            employeeId,
            leaveTypeId,
            status: { $in: ['approved', 'pending_manager', 'pending_hr'] },
            startDate: { $lte: endDate },
            endDate: { $gte: startDate }
        });

        if (overlapping) {
            return {
                eligible: false,
                reason: 'Overlapping leave request already exists',
                availableDays
            };
        }

        // Check advance notice requirement
        const leaveType = await LeaveType.findById(leaveTypeId);
        if (leaveType?.minAndMaxDays?.minAdvanceNotice > 0) {
            const minNoticeDate = new Date(startDate);
            minNoticeDate.setDate(minNoticeDate.getDate() - leaveType.minAndMaxDays.minAdvanceNotice);
            
            if (new Date() > minNoticeDate) {
                return {
                    eligible: false,
                    reason: `Requires ${leaveType.minAndMaxDays.minAdvanceNotice} days advance notice`,
                    availableDays
                };
            }
        }

        // Check min/max days per request
        if (leaveType?.minAndMaxDays) {
            if (totalDays < leaveType.minAndMaxDays.minDaysPerRequest) {
                return {
                    eligible: false,
                    reason: `Minimum ${leaveType.minAndMaxDays.minDaysPerRequest} days required`,
                    availableDays
                };
            }
            if (totalDays > leaveType.minAndMaxDays.maxDaysPerRequest) {
                return {
                    eligible: false,
                    reason: `Maximum ${leaveType.minAndMaxDays.maxDaysPerRequest} days allowed per request`,
                    availableDays
                };
            }
        }

        return {
            eligible: true,
            availableDays,
            balanceRemaining: availableDays - totalDays
        };
    } catch (error) {
        throw new Error(`Check eligibility failed: ${error.message}`);
    }
};

/**
 * Submit leave request for approval
 */
const submitLeaveRequest = async (requestData) => {
    try {
        const {
            employeeId,
            companyId,
            leaveTypeId,
            startDate,
            endDate,
            reason,
            attachments = []
        } = requestData;

        // Validate eligibility first
        const eligibility = await checkLeaveEligibility(
            employeeId,
            leaveTypeId,
            startDate,
            endDate,
            requestData.totalDays || 1
        );

        if (!eligibility.eligible) {
            throw new Error(eligibility.reason);
        }

        // Create leave request
        const leaveRequest = new LeaveRequest({
            companyId,
            employeeId,
            leaveTypeId,
            startDate,
            endDate,
            reason,
            attachments,
            status: 'submitted',
            isEligible: true
        });

        // Determine who approves
        const leaveType = await LeaveType.findById(leaveTypeId);
        if (leaveType?.approvalLevel === 'manager') {
            leaveRequest.status = 'pending_manager';
            leaveRequest.managerApprovalStatus = 'pending';
        } else if (leaveType?.approvalLevel === 'hr') {
            leaveRequest.status = 'pending_hr';
            leaveRequest.hrApprovalStatus = 'pending';
        } else {
            // Both manager and HR need to approve
            leaveRequest.status = 'pending_manager';
            leaveRequest.managerApprovalStatus = 'pending';
        }

        await leaveRequest.save();

        // Update balance: add to pending days
        await LeaveBalance.findOneAndUpdate(
            { employeeId, leaveTypeId, year: new Date(startDate).getFullYear() },
            {
                $inc: { pendingDays: leaveRequest.totalDays },
                lastUpdated: new Date()
            }
        );

        return leaveRequest;
    } catch (error) {
        throw new Error(`Submit leave request failed: ${error.message}`);
    }
};

/**
 * Manager approves/rejects leave request
 */
const approveLeaveRequest = async (requestId, action, approverId, notes = '') => {
    try {
        if (!['approved', 'rejected'].includes(action)) {
            throw new Error('Invalid action. Use "approved" or "rejected"');
        }

        const leaveRequest = await LeaveRequest.findById(requestId);
        if (!leaveRequest) {
            throw new Error('Leave request not found');
        }

        leaveRequest.managerApprovalStatus = action;
        leaveRequest.managerApprovedBy = approverId;
        leaveRequest.managerApprovalDate = new Date();
        leaveRequest.managerApprovalNotes = notes;

        if (action === 'rejected') {
            leaveRequest.status = 'rejected';
            // Remove from pending days
            await LeaveBalance.findOneAndUpdate(
                { employeeId: leaveRequest.employeeId, leaveTypeId: leaveRequest.leaveTypeId, year: new Date(leaveRequest.startDate).getFullYear() },
                { $inc: { pendingDays: -leaveRequest.totalDays } }
            );
        } else {
            // Move to HR approval if needed
            const leaveType = await LeaveType.findById(leaveRequest.leaveTypeId);
            if (leaveType?.approvalLevel === 'both') {
                leaveRequest.status = 'pending_hr';
                leaveRequest.hrApprovalStatus = 'pending';
            } else {
                leaveRequest.status = 'approved';
                // Move from pending to approved
                await LeaveBalance.findOneAndUpdate(
                    { employeeId: leaveRequest.employeeId, leaveTypeId: leaveRequest.leaveTypeId, year: new Date(leaveRequest.startDate).getFullYear() },
                    {
                        $inc: { pendingDays: -leaveRequest.totalDays, approvedDays: leaveRequest.totalDays }
                    }
                );
            }
        }

        await leaveRequest.save();
        return leaveRequest;
    } catch (error) {
        throw new Error(`Approve leave request failed: ${error.message}`);
    }
};

/**
 * HR approves/rejects leave request
 */
const hrApproveLeaveRequest = async (requestId, action, approverId, notes = '') => {
    try {
        if (!['approved', 'rejected'].includes(action)) {
            throw new Error('Invalid action. Use "approved" or "rejected"');
        }

        const leaveRequest = await LeaveRequest.findById(requestId);
        if (!leaveRequest) {
            throw new Error('Leave request not found');
        }

        leaveRequest.hrApprovalStatus = action;
        leaveRequest.hrApprovedBy = approverId;
        leaveRequest.hrApprovalDate = new Date();
        leaveRequest.hrApprovalNotes = notes;

        if (action === 'rejected') {
            leaveRequest.status = 'rejected';
            // Remove from pending, don't add to approved
            await LeaveBalance.findOneAndUpdate(
                { employeeId: leaveRequest.employeeId, leaveTypeId: leaveRequest.leaveTypeId, year: new Date(leaveRequest.startDate).getFullYear() },
                { $inc: { pendingDays: -leaveRequest.totalDays } }
            );
        } else {
            leaveRequest.status = 'approved';
            // Move from pending to approved
            await LeaveBalance.findOneAndUpdate(
                { employeeId: leaveRequest.employeeId, leaveTypeId: leaveRequest.leaveTypeId, year: new Date(leaveRequest.startDate).getFullYear() },
                {
                    $inc: { pendingDays: -leaveRequest.totalDays, approvedDays: leaveRequest.totalDays }
                }
            );
        }

        await leaveRequest.save();
        return leaveRequest;
    } catch (error) {
        throw new Error(`HR approve leave request failed: ${error.message}`);
    }
};

/**
 * Cancel approved leave request
 */
const cancelLeaveRequest = async (requestId, cancelledBy, reason = '') => {
    try {
        const leaveRequest = await LeaveRequest.findById(requestId);
        if (!leaveRequest) {
            throw new Error('Leave request not found');
        }

        if (leaveRequest.status === 'cancelled') {
            throw new Error('Leave request already cancelled');
        }

        leaveRequest.status = 'cancelled';
        leaveRequest.cancelledAt = new Date();
        leaveRequest.cancelledBy = cancelledBy;
        leaveRequest.cancellationReason = reason;

        // Update balance
        if (leaveRequest.status === 'approved') {
            await LeaveBalance.findOneAndUpdate(
                { employeeId: leaveRequest.employeeId, leaveTypeId: leaveRequest.leaveTypeId, year: new Date(leaveRequest.startDate).getFullYear() },
                { $inc: { approvedDays: -leaveRequest.totalDays } }
            );
        } else if (leaveRequest.status === 'pending_manager' || leaveRequest.status === 'pending_hr') {
            await LeaveBalance.findOneAndUpdate(
                { employeeId: leaveRequest.employeeId, leaveTypeId: leaveRequest.leaveTypeId, year: new Date(leaveRequest.startDate).getFullYear() },
                { $inc: { pendingDays: -leaveRequest.totalDays } }
            );
        }

        await leaveRequest.save();
        return leaveRequest;
    } catch (error) {
        throw new Error(`Cancel leave request failed: ${error.message}`);
    }
};

/**
 * Get employee leave summary
 */
const getLeaveBalance = async (employeeId, year = new Date().getFullYear()) => {
    try {
        const balances = await LeaveBalance.find({
            employeeId,
            year
        }).populate('leaveTypeId');

        const summary = {
            year,
            balances: balances.map(b => ({
                leaveType: b.leaveTypeId?.nameEn || 'Unknown',
                allocated: b.allocatedDays,
                approved: b.approvedDays,
                pending: b.pendingDays,
                remaining: b.allocatedDays + b.carriedOverDays - b.approvedDays - b.pendingDays,
                carriedOver: b.carriedOverDays
            }))
        };

        return summary;
    } catch (error) {
        throw new Error(`Get leave balance failed: ${error.message}`);
    }
};

module.exports = {
    initializeLeaveBalance,
    checkLeaveEligibility,
    submitLeaveRequest,
    approveLeaveRequest,
    hrApproveLeaveRequest,
    cancelLeaveRequest,
    getLeaveBalance
};
