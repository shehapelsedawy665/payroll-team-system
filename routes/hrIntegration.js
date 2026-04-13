/**
 * @file routes/hrIntegration.js
 * @description API routes for HR integration with appraisals
 * Links performance ratings with compensation, promotions, training, etc.
 */

const express = require('express');
const router = express.Router();

const { authMiddleware, adminOnly, managerOnly } = require('../backend/middleware/auth');

// Import models
const Company = require('../backend/models/Company');
const Employee = require('../backend/models/Employee');
const Appraisal = require('../backend/models/Appraisal');

// Import integration logic
const hrIntegration = require('../backend/logic/hrIntegration');

/**
 * Calculate salary increment for an employee based on their appraisal
 */
router.get('/salary-increment/:appraisalId', authMiddleware, adminOnly, async (req, res) => {
    try {
        const appraisal = await Appraisal.findById(req.params.appraisalId)
            .populate('employeeId');

        if (!appraisal || appraisal.companyId.toString() !== req.user.companyId) {
            return res.status(404).json({ error: 'التقييم غير موجود' });
        }

        const company = await Company.findById(req.user.companyId);
        const increment = hrIntegration.calculateSalaryIncrement(
            appraisal.employeeId,
            appraisal.scores?.finalRating,
            company
        );

        res.json({
            employeeName: appraisal.employeeId.name,
            appraisalRating: appraisal.scores?.finalRating,
            increment
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Check promotion eligibility for an employee
 */
router.get('/promotion-eligibility/:appraisalId', authMiddleware, adminOnly, async (req, res) => {
    try {
        const appraisal = await Appraisal.findById(req.params.appraisalId)
            .populate('employeeId');

        if (!appraisal || appraisal.companyId.toString() !== req.user.companyId) {
            return res.status(404).json({ error: 'التقييم غير موجود' });
        }

        const company = await Company.findById(req.user.companyId);
        const eligibility = hrIntegration.determinePromotionEligibility(
            appraisal,
            appraisal.employeeId,
            company
        );

        res.json({
            employeeName: appraisal.employeeId.name,
            currentRole: appraisal.employeeId.jobTitle,
            appraisalRating: appraisal.scores?.finalRating,
            eligibility
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Calculate leave allocation based on performance
 */
router.get('/leave-allocation/:appraisalId', authMiddleware, async (req, res) => {
    try {
        const appraisal = await Appraisal.findById(req.params.appraisalId)
            .populate('employeeId');

        if (!appraisal || appraisal.companyId.toString() !== req.user.companyId) {
            return res.status(404).json({ error: 'التقييم غير موجود' });
        }

        const company = await Company.findById(req.user.companyId);
        const allocation = hrIntegration.calculateLeaveAllocation(
            appraisal.employeeId,
            appraisal.scores?.finalRating,
            company.settings?.leavePolicy
        );

        res.json({
            employeeName: appraisal.employeeId.name,
            appraisalRating: appraisal.scores?.finalRating,
            allocation
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Get compensation adjustment for an employee
 */
router.get('/compensation-adjustment/:appraisalId', authMiddleware, adminOnly, async (req, res) => {
    try {
        const appraisal = await Appraisal.findById(req.params.appraisalId)
            .populate('employeeId');

        if (!appraisal || appraisal.companyId.toString() !== req.user.companyId) {
            return res.status(404).json({ error: 'التقييم غير موجود' });
        }

        const company = await Company.findById(req.user.companyId);
        const adjustment = hrIntegration.calculateCompensationAdjustment(
            appraisal.employeeId,
            appraisal,
            company
        );

        res.json({
            employeeName: appraisal.employeeId.name,
            appraisalRating: appraisal.scores?.finalRating,
            adjustment
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Generate succession plan for the organization
 */
router.get('/succession-plan/:cycleId', authMiddleware, adminOnly, async (req, res) => {
    try {
        const appraisals = await Appraisal.find({
            cycleId: req.params.cycleId,
            companyId: req.user.companyId
        });

        const employees = await Employee.find({
            companyId: req.user.companyId,
            resignationDate: null
        });

        const company = await Company.findById(req.user.companyId);
        const succession = hrIntegration.generateSuccessionPlan(appraisals, employees, company);

        res.json({
            cycleId: req.params.cycleId,
            totalEmployees: employees.length,
            succession
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Identify training needs by department
 */
router.get('/training-needs/:cycleId', authMiddleware, adminOnly, async (req, res) => {
    try {
        const appraisals = await Appraisal.find({
            cycleId: req.params.cycleId,
            companyId: req.user.companyId
        });

        const employees = await Employee.find({
            companyId: req.user.companyId,
            resignationDate: null
        });

        const company = await Company.findById(req.user.companyId);
        const trainingNeeds = hrIntegration.identifyTrainingNeeds(
            appraisals,
            employees,
            company
        );

        res.json({
            cycleId: req.params.cycleId,
            departmentAnalysis: trainingNeeds
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Generate action items for HR based on appraisals
 */
router.get('/action-items/:cycleId', authMiddleware, adminOnly, async (req, res) => {
    try {
        const appraisals = await Appraisal.find({
            cycleId: req.params.cycleId,
            companyId: req.user.companyId,
            status: 'approved'
        });

        const employees = await Employee.find({
            companyId: req.user.companyId
        });

        const company = await Company.findById(req.user.companyId);
        const actions = hrIntegration.generateHRActionItems(
            appraisals,
            employees,
            company
        );

        res.json({
            cycleId: req.params.cycleId,
            totalAppraisals: appraisals.length,
            actionItems: actions
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * Bulk apply compensation adjustments
 * Takes all approved appraisals in a cycle and applies salary increments
 */
router.post('/apply-salary-increments/:cycleId', authMiddleware, adminOnly, async (req, res) => {
    try {
        const appraisals = await Appraisal.find({
            cycleId: req.params.cycleId,
            companyId: req.user.companyId,
            status: 'approved'
        }).populate('employeeId');

        const company = await Company.findById(req.user.companyId);
        const results = {
            successful: [],
            failed: [],
            summary: {
                totalProcessed: 0,
                totalIncrement: 0,
                averageIncrement: 0
            }
        };

        let totalIncrement = 0;

        for (const appraisal of appraisals) {
            try {
                const increment = hrIntegration.calculateSalaryIncrement(
                    appraisal.employeeId,
                    appraisal.scores?.finalRating,
                    company
                );

                if (parseFloat(increment.incrementAmount) > 0) {
                    // Update employee salary (only if incrementAmount > 0)
                    const updatedEmployee = await Employee.findByIdAndUpdate(
                        appraisal.employeeId._id,
                        {
                            basicSalary: increment.newSalary,
                            lastSalaryReviewDate: new Date(),
                            salaryReviewReason: `FY2026 Appraisal - Rating: ${appraisal.scores?.finalRating}`
                        },
                        { new: true }
                    );

                    results.successful.push({
                        employeeId: updatedEmployee._id,
                        employeeName: updatedEmployee.name,
                        previousSalary: increment.currentSalary,
                        newSalary: increment.newSalary,
                        increment: increment.incrementAmount,
                        incrementPercentage: increment.incrementRate
                    });

                    totalIncrement += parseFloat(increment.incrementAmount);
                }
            } catch (err) {
                results.failed.push({
                    employeeId: appraisal.employeeId._id,
                    employeeName: appraisal.employeeId.name,
                    error: err.message
                });
            }
        }

        results.summary.totalProcessed = results.successful.length;
        results.summary.totalIncrement = totalIncrement.toFixed(2);
        results.summary.averageIncrement = results.successful.length > 0
            ? (totalIncrement / results.successful.length).toFixed(2)
            : 0;

        res.json({
            message: `نجاح: تم معالجة ${results.successful.length} موظفاً`,
            results
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
