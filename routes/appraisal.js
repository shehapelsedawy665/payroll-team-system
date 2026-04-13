/**
 * @file routes/appraisal.js
 * @description Comprehensive appraisal management API routes
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly, managerOnly } = require('../backend/middleware/auth');

// Import models
const Company = require('../backend/models/Company');
const Employee = require('../backend/models/Employee');
const AppraisalCycle = require('../backend/models/AppraisalCycle');
const AppraisalTemplate = require('../backend/models/AppraisalTemplate');
const Appraisal = require('../backend/models/Appraisal');

// Import appraisal engine
let appraisalEngine = {};
try {
    appraisalEngine = require('../backend/logic/appraisalEngine');
} catch (e) {
    console.error('Appraisal engine not loaded:', e.message);
}

/**
 * ============================================================================
 * APPRAISAL CYCLE ROUTES
 * ============================================================================
 */

// Create a new appraisal cycle
router.post('/cycles', authMiddleware, adminOnly, async (req, res) => {
    try {
        const cycle = new AppraisalCycle({
            companyId: req.user.companyId,
            ...req.body
        });
        await cycle.save();
        res.status(201).json({
            message: 'تم إنشاء دورة التقييم بنجاح',
            cycle
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all appraisal cycles for company
router.get('/cycles', authMiddleware, async (req, res) => {
    try {
        const cycles = await AppraisalCycle.find({
            companyId: req.user.companyId
        }).sort({ startDate: -1 });
        
        res.json({
            total: cycles.length,
            cycles
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get specific cycle
router.get('/cycles/:id', authMiddleware, async (req, res) => {
    try {
        const cycle = await AppraisalCycle.findById(req.params.id);
        if (!cycle || cycle.companyId.toString() !== req.user.companyId) {
            return res.status(404).json({ error: 'الدورة غير موجودة' });
        }
        res.json(cycle);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update cycle
router.put('/cycles/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const cycle = await AppraisalCycle.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: new Date() },
            { new: true, runValidators: true }
        );
        if (!cycle) {
            return res.status(404).json({ error: 'الدورة غير موجودة' });
        }
        res.json({
            message: 'تم تحديث دورة التقييم بنجاح',
            cycle
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Close/Complete a cycle
router.post('/cycles/:id/close', authMiddleware, adminOnly, async (req, res) => {
    try {
        const cycle = await AppraisalCycle.findById(req.params.id);
        if (!cycle) {
            return res.status(404).json({ error: 'الدورة غير موجودة' });
        }
        
        cycle.status = 'closed';
        cycle.closedAt = new Date();
        await cycle.save();
        
        res.json({
            message: 'تم إغلاق دورة التقييم بنجاح',
            cycle
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * ============================================================================
 * APPRAISAL TEMPLATE ROUTES
 * ============================================================================
 */

// Create template
router.post('/templates', authMiddleware, adminOnly, async (req, res) => {
    try {
        const template = new AppraisalTemplate({
            companyId: req.user.companyId,
            ...req.body
        });
        await template.save();
        res.status(201).json({
            message: 'تم إنشاء نموذج التقييم بنجاح',
            template
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all templates
router.get('/templates', authMiddleware, async (req, res) => {
    try {
        const templates = await AppraisalTemplate.find({
            companyId: req.user.companyId,
            isActive: true
        });
        
        res.json({
            total: templates.length,
            templates
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update template
router.put('/templates/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const template = await AppraisalTemplate.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: new Date() },
            { new: true, runValidators: true }
        );
        if (!template) {
            return res.status(404).json({ error: 'النموذج غير موجود' });
        }
        res.json({
            message: 'تم تحديث نموذج التقييم بنجاح',
            template
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * ============================================================================
 * APPRAISAL FORM ROUTES
 * ============================================================================
 */

// Create appraisals for a cycle (bulk create for all employees)
router.post('/forms/create-batch', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { cycleId, employeeFilter = {} } = req.body;
        
        const cycle = await AppraisalCycle.findById(cycleId);
        if (!cycle || cycle.companyId.toString() !== req.user.companyId) {
            return res.status(404).json({ error: 'الدورة غير موجودة' });
        }
        
        // Get employees to create appraisals for
        const employees = await Employee.find({
            companyId: req.user.companyId,
            resignationDate: null,
            ...employeeFilter
        });
        
        const createdAppraisals = [];
        const errors = [];
        
        for (const employee of employees) {
            try {
                // Check if appraisal already exists
                const existing = await Appraisal.findOne({
                    cycleId,
                    employeeId: employee._id
                });
                
                if (!existing) {
                    const appraisal = new Appraisal({
                        companyId: req.user.companyId,
                        cycleId,
                        employeeId: employee._id,
                        managerId: employee.managerId,
                        templateId: cycle.templateId,
                        status: 'draft'
                    });
                    await appraisal.save();
                    createdAppraisals.push(appraisal._id);
                }
            } catch (err) {
                errors.push({
                    employeeId: employee._id,
                    employeeName: employee.name,
                    error: err.message
                });
            }
        }
        
        res.json({
            message: `تم إنشاء ${createdAppraisals.length} نموذج تقييم`,
            created: createdAppraisals.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get appraisal form for employee
router.get('/forms/:id', authMiddleware, async (req, res) => {
    try {
        const appraisal = await Appraisal.findById(req.params.id)
            .populate('employeeId', 'name email jobTitle')
            .populate('managerId', 'name email jobTitle')
            .populate('templateId');
        
        if (!appraisal) {
            return res.status(404).json({ error: 'نموذج التقييم غير موجود' });
        }
        
        // Check authorization
        const isEmployee = appraisal.employeeId._id.toString() === req.user.userId;
        const isManager = appraisal.managerId && appraisal.managerId._id.toString() === req.user.userId;
        const isAdmin = req.user.role === 'admin';
        
        if (!isEmployee && !isManager && !isAdmin) {
            return res.status(403).json({ error: 'ليس لديك صلاحية للوصول' });
        }
        
        res.json(appraisal);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Submit employee self-assessment
router.post('/forms/:id/self-assessment', authMiddleware, async (req, res) => {
    try {
        const appraisal = await Appraisal.findById(req.params.id);
        
        if (!appraisal) {
            return res.status(404).json({ error: 'نموذج التقييم غير موجود' });
        }
        
        // Verify it's the employee
        if (appraisal.employeeId.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'ليس لديك صلاحية للعديل' });
        }
        
        appraisal.employeeSelfRating = {
            ...req.body,
            submittedAt: new Date()
        };
        appraisal.status = 'employee-submitted';
        appraisal.updatedAt = new Date();
        
        await appraisal.save();
        
        res.json({
            message: 'تم حفظ التقييم الذاتي بنجاح',
            appraisal
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Submit manager rating
router.post('/forms/:id/manager-rating', authMiddleware, async (req, res) => {
    try {
        const appraisal = await Appraisal.findById(req.params.id);
        
        if (!appraisal) {
            return res.status(404).json({ error: 'نموذج التقييم غير موجود' });
        }
        
        // Verify it's the manager
        if (appraisal.managerId && appraisal.managerId.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'ليس لديك صلاحية للعديل' });
        }
        
        appraisal.managerRating = {
            ...req.body,
            submittedAt: new Date()
        };
        
        // Calculate scores
        const { calculateAppraisalScores } = appraisalEngine;
        if (calculateAppraisalScores) {
            appraisal.scores = calculateAppraisalScores(appraisal);
        }
        
        appraisal.status = 'manager-submitted';
        appraisal.managerApprovedAt = new Date();
        appraisal.managerApprovedBy = req.user.userId;
        appraisal.updatedAt = new Date();
        
        await appraisal.save();
        
        res.json({
            message: 'تم حفظ تقييم المدير بنجاح',
            appraisal
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get appraisals by cycle
router.get('/cycles/:cycleId/appraisals', authMiddleware, async (req, res) => {
    try {
        const { status, departmentId } = req.query;
        
        const filter = {
            cycleId: req.params.cycleId,
            companyId: req.user.companyId
        };
        
        if (status) filter.status = status;
        
        let appraisals = await Appraisal.find(filter)
            .populate('employeeId', 'name jobTitle department email')
            .populate('managerId', 'name email')
            .sort({ employeeId: 1 });
        
        // Filter by department if specified
        if (departmentId) {
            appraisals = appraisals.filter(a => a.employeeId.department === departmentId);
        }
        
        res.json({
            total: appraisals.length,
            appraisals
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get appraisals for current user (employee or manager)
router.get('/my-appraisals', authMiddleware, async (req, res) => {
    try {
        const { role, userId, companyId } = req.user;
        const { cycleId } = req.query;
        
        let appraisals = [];
        
        const filter = { companyId };
        if (cycleId) filter.cycleId = cycleId;
        
        if (role === 'employee' || role === 'manager') {
            // Get appraisals for this person as employee
            appraisals = await Appraisal.find({
                ...filter,
                employeeId: userId
            })
            .populate('cycleid');
        }
        
        if (role === 'manager' || role === 'admin') {
            // Get appraisals to review (for their reporting staff)
            const managed = await Appraisal.find({
                ...filter,
                managerId: userId,
                status: { $in: ['employee-submitted', 'manager-review'] }
            })
            .populate('employeeId', 'name jobTitle email');
            
            appraisals = [...appraisals, ...managed];
        }
        
        res.json({
            total: appraisals.length,
            appraisals
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get appraisal summary/statistics
router.get('/cycles/:cycleId/summary', authMiddleware, adminOnly, async (req, res) => {
    try {
        const appraisals = await Appraisal.find({
            cycleId: req.params.cycleId,
            companyId: req.user.companyId
        });
        
        const summary = {
            total: appraisals.length,
            draft: appraisals.filter(a => a.status === 'draft').length,
            employeeSubmitted: appraisals.filter(a => a.status === 'employee-submitted').length,
            managerSubmitted: appraisals.filter(a => a.status === 'manager-submitted').length,
            approved: appraisals.filter(a => a.status === 'approved').length,
            ratingDistribution: {
                exceptional: appraisals.filter(a => a.scores?.finalRating === '5-Exceptional').length,
                exceeds: appraisals.filter(a => a.scores?.finalRating === '4-Exceeds').length,
                meets: appraisals.filter(a => a.scores?.finalRating === '3-Meets').length,
                below: appraisals.filter(a => a.scores?.finalRating === '2-Below').length,
                unsatisfactory: appraisals.filter(a => a.scores?.finalRating === '1-Unsatisfactory').length
            }
        };
        
        res.json(summary);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * ============================================================================
 * EXPORT ROUTES
 * ============================================================================
 */

// Export cycle appraisals as CSV
router.get('/cycles/:cycleId/export/csv', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { Appraisal: AppraisalModel, Employee: EmployeeModel } = require('../backend/config/db');
        const { generateAppraisalsCSV } = require('../backend/logic/appraisalExporter');

        const appraisals = await AppraisalModel.find({
            cycleId: req.params.cycleId,
            companyId: req.user.companyId
        });

        const employees = await EmployeeModel.find({
            companyId: req.user.companyId
        });

        const csv = generateAppraisalsCSV(appraisals, employees);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="appraisals-${Date.now()}.csv"`);
        res.send(csv);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Export cycle appraisals as JSON
router.get('/cycles/:cycleId/export/json', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { Appraisal: AppraisalModel, Employee: EmployeeModel } = require('../backend/config/db');
        const { generateAppraisalsJSON } = require('../backend/logic/appraisalExporter');

        const cycle = await AppraisalCycle.findById(req.params.cycleId);
        const appraisals = await AppraisalModel.find({
            cycleId: req.params.cycleId,
            companyId: req.user.companyId
        });

        const employees = await EmployeeModel.find({
            companyId: req.user.companyId
        });

        const json = generateAppraisalsJSON(appraisals, employees, cycle);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="appraisals-${Date.now()}.json"`);
        res.json(json);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Generate calibration report
router.get('/cycles/:cycleId/export/calibration', authMiddleware, adminOnly, async (req, res) => {
    try {
        const cycle = await AppraisalCycle.findById(req.params.cycleId)
            .populate('templateId');

        if (!cycle || cycle.companyId.toString() !== req.user.companyId) {
            return res.status(404).json({ error: 'الدورة غير موجودة' });
        }

        const appraisals = await Appraisal.find({
            cycleId: req.params.cycleId,
            companyId: req.user.companyId
        });

        const distribution = {
            exceptional: appraisals.filter(a => a.scores?.finalRating === '5-Exceptional').length,
            exceeds: appraisals.filter(a => a.scores?.finalRating === '4-Exceeds').length,
            meets: appraisals.filter(a => a.scores?.finalRating === '3-Meets').length,
            below: appraisals.filter(a => a.scores?.finalRating === '2-Below').length,
            unsatisfactory: appraisals.filter(a => a.scores?.finalRating === '1-Unsatisfactory').length
        };

        const total = appraisals.length;
        const target = cycle.templateId?.calibrationSettings?.targetDistribution || {
            exceptional: 10,
            exceeds: 20,
            meets: 60,
            below: 8,
            unsatisfactory: 2
        };

        res.json({
            cycleName: cycle.name,
            totalAppraisals: total,
            distribution: {
                current: {
                    exceptional: ((distribution.exceptional / total) * 100).toFixed(1),
                    exceeds: ((distribution.exceeds / total) * 100).toFixed(1),
                    meets: ((distribution.meets / total) * 100).toFixed(1),
                    below: ((distribution.below / total) * 100).toFixed(1),
                    unsatisfactory: ((distribution.unsatisfactory / total) * 100).toFixed(1)
                },
                target,
                deviations: {
                    exceptional: (((distribution.exceptional / total) * 100).toFixed(1) - target.exceptional).toFixed(1),
                    exceeds: (((distribution.exceeds / total) * 100).toFixed(1) - target.exceeds).toFixed(1),
                    meets: (((distribution.meets / total) * 100).toFixed(1) - target.meets).toFixed(1),
                    below: (((distribution.below / total) * 100).toFixed(1) - target.below).toFixed(1),
                    unsatisfactory: (((distribution.unsatisfactory / total) * 100).toFixed(1) - target.unsatisfactory).toFixed(1)
                }
            }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get performance insights for an employee
router.get('/forms/:id/insights', authMiddleware, async (req, res) => {
    try {
        const appraisal = await Appraisal.findById(req.params.id)
            .populate('employeeId', 'name jobTitle')
            .populate('cycleId');

        if (!appraisal) {
            return res.status(404).json({ error: 'نموذج التقييم غير موجود' });
        }

        // Check authorization
        const isEmployee = appraisal.employeeId._id.toString() === req.user.userId;
        const isManager = appraisal.managerId && appraisal.managerId.toString() === req.user.userId;
        const isAdmin = req.user.role === 'admin';

        if (!isEmployee && !isManager && !isAdmin) {
            return res.status(403).json({ error: 'ليس لديك صلاحية للوصول' });
        }

        const { generateEmployeeInsights } = appraisalEngine;
        const insights = generateEmployeeInsights(appraisal);

        res.json({
            employeeId: appraisal.employeeId._id,
            employeeName: appraisal.employeeId.name,
            insights,
            scores: appraisal.scores,
            developmentPlan: appraisal.developmentPlan
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
