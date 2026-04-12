const express = require('express');
const router = express.Router();
const OnboardingChecklist = require('../backend/models/OnboardingChecklist');
const OnboardingTask = require('../backend/models/OnboardingTask');
const Employee = require('../backend/models/Employee');
const onboardingEngine = require('../backend/logic/onboardingEngine');
const { authMiddleware } = require('../backend/middleware/auth');

// Middleware to verify HR or Manager role
const isHROrManager = (req, res, next) => {
  if (req.user && (req.user.role === 'HR' || req.user.role === 'Manager' || req.user.role === 'Admin')) {
    return next();
  }
  res.status(403).json({ error: 'Unauthorized - HR or Manager access required' });
};

// ===== ONBOARDING TASKS =====

/**
 * POST /api/onboarding/tasks
 * Create onboarding task template
 */
router.post('/tasks', authMiddleware, isHROrManager, async (req, res) => {
  try {
    const { name, description, category, priority, daysDueAfterJoining, department } = req.body;
    
    if (!name || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const task = new OnboardingTask({
      companyId: req.user.companyId,
      name,
      description,
      category,
      priority,
      daysDueAfterJoining: daysDueAfterJoining || 1,
      department,
      assignedTo: req.user.id,
      isTemplate: true
    });
    
    await task.save();
    
    res.status(201).json({
      success: true,
      task,
      message: 'Onboarding task template created'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/onboarding/tasks
 * Get all onboarding task templates
 */
router.get('/tasks', authMiddleware, async (req, res) => {
  try {
    const { category, department } = req.query;
    const query = { companyId: req.user.companyId, isTemplate: true };
    
    if (category) query.category = category;
    if (department) query.department = department;
    
    const tasks = await OnboardingTask.find(query).sort({ priority: -1 });
    
    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/onboarding/tasks/:id
 * Update onboarding task template
 */
router.put('/tasks/:id', authMiddleware, isHROrManager, async (req, res) => {
  try {
    const task = await OnboardingTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    Object.assign(task, req.body);
    await task.save();
    
    res.json({
      success: true,
      task,
      message: 'Task updated'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/onboarding/tasks/:id
 * Delete onboarding task template
 */
router.delete('/tasks/:id', authMiddleware, isHROrManager, async (req, res) => {
  try {
    await OnboardingTask.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Task deleted'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ONBOARDING CHECKLISTS =====

/**
 * POST /api/onboarding/checklists
 * Create onboarding checklist for new employee
 */
router.post('/checklists', authMiddleware, isHROrManager, async (req, res) => {
  try {
    const { employeeId, joiningDate } = req.body;
    
    if (!employeeId || !joiningDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    const result = await onboardingEngine.createOnboardingChecklist(
      employeeId,
      new Date(joiningDate),
      req.user.companyId
    );
    
    if (result.success) {
      return res.status(201).json(result);
    }
    
    res.status(400).json({ error: result.error });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/onboarding/checklists/:employeeId
 * Get onboarding checklist for employee
 */
router.get('/checklists/:employeeId', authMiddleware, async (req, res) => {
  try {
    const checklist = await OnboardingChecklist.findOne({
      employeeId: req.params.employeeId
    }).populate('tasks.assignedTo', 'firstName lastName email');
    
    if (!checklist) {
      return res.status(404).json({ error: 'No onboarding checklist found' });
    }
    
    res.json({
      success: true,
      checklist
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/onboarding/progress/:employeeId
 * Get detailed onboarding progress for employee
 */
router.get('/progress/:employeeId', authMiddleware, async (req, res) => {
  try {
    const result = await onboardingEngine.getOnboardingProgress(req.params.employeeId);
    
    if (result.success) {
      return res.json(result);
    }
    
    res.status(404).json({ error: result.error });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/onboarding/checklists/:checklistId/tasks/:taskId
 * Mark onboarding task as completed
 */
router.put('/checklists/:checklistId/tasks/:taskId', authMiddleware, async (req, res) => {
  try {
    const { comments } = req.body;
    
    const result = await onboardingEngine.completeOnboardingTask(
      req.params.checklistId,
      req.params.taskId,
      req.user.id,
      comments
    );
    
    if (result.success) {
      return res.json(result);
    }
    
    res.status(400).json({ error: result.error });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding/checklists/:checklistId/custom-task
 * Add custom task to onboarding checklist
 */
router.post('/checklists/:checklistId/custom-task', authMiddleware, isHROrManager, async (req, res) => {
  try {
    const { taskName, category, priority, daysDue, assignedTo } = req.body;
    
    if (!taskName || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await onboardingEngine.addCustomTask(
      req.params.checklistId,
      taskName,
      category,
      priority || 'Medium',
      daysDue || 5,
      assignedTo
    );
    
    if (result.success) {
      return res.json(result);
    }
    
    res.status(400).json({ error: result.error });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/onboarding/pending-tasks
 * Get all pending onboarding tasks by category
 */
router.get('/pending-tasks', authMiddleware, isHROrManager, async (req, res) => {
  try {
    const result = await onboardingEngine.getPendingTasksByCategory(req.user.companyId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/onboarding/completion-rate
 * Get onboarding completion statistics
 */
router.get('/completion-rate', authMiddleware, isHROrManager, async (req, res) => {
  try {
    const { months } = req.query;
    const result = await onboardingEngine.getOnboardingCompletionRate(
      req.user.companyId,
      parseInt(months) || 3
    );
    
    if (result.success) {
      return res.json(result);
    }
    
    res.status(400).json({ error: result.error });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/onboarding/summary
 * Get onboarding summary for HR dashboard
 */
router.get('/summary', authMiddleware, isHROrManager, async (req, res) => {
  try {
    const result = await onboardingEngine.getOnboardingSummary(req.user.companyId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding/checklists/:checklistId/complete
 * Mark entire checklist as completed
 */
router.post('/checklists/:checklistId/complete', authMiddleware, isHROrManager, async (req, res) => {
  try {
    const { feedback } = req.body;
    
    const checklist = await OnboardingChecklist.findById(req.params.checklistId);
    if (!checklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }
    
    if (checklist.completionPercentage < 100) {
      return res.status(400).json({ error: 'Cannot complete - not all tasks finished' });
    }
    
    checklist.status = 'Completed';
    checklist.finalReview = {
      reviewedBy: req.user.id,
      reviewDate: new Date(),
      feedback
    };
    
    await checklist.save();
    
    res.json({
      success: true,
      checklist,
      message: 'Onboarding completed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
