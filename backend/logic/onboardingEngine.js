// Onboarding and New Hire Management Engine
const OnboardingChecklist = require('../models/OnboardingChecklist');
const OnboardingTask = require('../models/OnboardingTask');
const Employee = require('../models/Employee');
const User = require('../models/User');

class OnboardingEngine {
  /**
   * Create onboarding checklist for new employee
   */
  async createOnboardingChecklist(employeeId, joiningDate, companyId) {
    try {
      const employee = await Employee.findById(employeeId);
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }
      
      // Get template tasks based on department and job level
      const templateTasks = await OnboardingTask.find({
        companyId,
        isTemplate: true,
        $or: [
          { department: employee.department },
          { department: null } // Company-wide tasks
        ]
      });
      
      // Create tasks with due dates
      const tasks = templateTasks.map(task => ({
        taskId: task._id,
        taskName: task.name,
        category: task.category,
        priority: task.priority,
        dueDate: new Date(joiningDate.getTime() + task.daysDueAfterJoining * 24 * 60 * 60 * 1000),
        assignedTo: task.assignedTo,
        completed: false
      }));
      
      const expectedCompletionDate = new Date(joiningDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      
      const checklist = new OnboardingChecklist({
        companyId,
        employeeId,
        joiningDate,
        expectedCompletionDate,
        tasks,
        status: 'Not Started'
      });
      
      await checklist.save();
      
      return {
        success: true,
        checklistId: checklist._id,
        taskCount: tasks.length,
        message: `Onboarding checklist created with ${tasks.length} tasks`
      };
    } catch (error) {
      console.error('Error creating onboarding checklist:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark onboarding task as completed
   */
  async completeOnboardingTask(checklistId, taskId, completedBy, comments = '') {
    try {
      const checklist = await OnboardingChecklist.findById(checklistId);
      if (!checklist) {
        return { success: false, error: 'Checklist not found' };
      }
      
      const taskIndex = checklist.tasks.findIndex(t => t.taskId.toString() === taskId);
      if (taskIndex === -1) {
        return { success: false, error: 'Task not found' };
      }
      
      checklist.tasks[taskIndex].completed = true;
      checklist.tasks[taskIndex].completedDate = new Date();
      checklist.tasks[taskIndex].completedBy = completedBy;
      checklist.tasks[taskIndex].comments = comments;
      
      // Update completion percentage
      const completedCount = checklist.tasks.filter(t => t.completed).length;
      checklist.completionPercentage = Math.round((completedCount / checklist.tasks.length) * 100);
      
      // Update status
      if (checklist.completionPercentage === 100) {
        checklist.status = 'Completed';
      } else if (checklist.completionPercentage > 0) {
        checklist.status = 'In Progress';
      }
      
      await checklist.save();
      
      return {
        success: true,
        completionPercentage: checklist.completionPercentage,
        status: checklist.status,
        message: `Task completed. Progress: ${checklist.completionPercentage}%`
      };
    } catch (error) {
      console.error('Error completing task:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get onboarding progress for an employee
   */
  async getOnboardingProgress(employeeId) {
    try {
      const checklist = await OnboardingChecklist.findOne({ 
        employeeId
      }).populate('tasks.assignedTo', 'firstName lastName email');
      
      if (!checklist) {
        return { success: false, error: 'No onboarding checklist found' };
      }
      
      const tasksByCategory = {};
      checklist.tasks.forEach(task => {
        if (!tasksByCategory[task.category]) {
          tasksByCategory[task.category] = [];
        }
        tasksByCategory[task.category].push(task);
      });
      
      const daysElapsed = Math.floor((new Date() - checklist.joiningDate) / (1000 * 60 * 60 * 24));
      const daysRemaining = checklist.expectedCompletionDate ? 
        Math.floor((checklist.expectedCompletionDate - new Date()) / (1000 * 60 * 60 * 24)) : 0;
      
      return {
        success: true,
        employeeId,
        joiningDate: checklist.joiningDate,
        status: checklist.status,
        completionPercentage: checklist.completionPercentage,
        daysElapsed,
        daysRemaining: Math.max(0, daysRemaining),
        totalTasks: checklist.tasks.length,
        completedTasks: checklist.tasks.filter(t => t.completed).length,
        overdueTasks: checklist.tasks.filter(t => !t.completed && new Date(t.dueDate) < new Date()).length,
        tasksByCategory,
        upcomingTasks: checklist.tasks
          .filter(t => !t.completed && new Date(t.dueDate) >= new Date())
          .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
          .slice(0, 5)
      };
    } catch (error) {
      console.error('Error getting onboarding progress:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all pending onboarding tasks by category
   */
  async getPendingTasksByCategory(companyId) {
    try {
      const checklists = await OnboardingChecklist.find({
        companyId,
        status: { $in: ['Not Started', 'In Progress'] }
      });
      
      const tasksByCategory = {};
      const now = new Date();
      
      checklists.forEach(checklist => {
        checklist.tasks.forEach(task => {
          if (!task.completed) {
            if (!tasksByCategory[task.category]) {
              tasksByCategory[task.category] = {
                total: 0,
                overdue: 0,
                dueToday: 0,
                upcoming: 0,
                tasks: []
              };
            }
            
            tasksByCategory[task.category].total++;
            tasksByCategory[task.category].tasks.push(task);
            
            const dueDate = new Date(task.dueDate);
            if (dueDate < now) {
              tasksByCategory[task.category].overdue++;
            } else if (dueDate.toDateString() === now.toDateString()) {
              tasksByCategory[task.category].dueToday++;
            } else {
              tasksByCategory[task.category].upcoming++;
            }
          }
        });
      });
      
      return {
        success: true,
        companyId,
        totalChecklists: checklists.length,
        tasksByCategory
      };
    } catch (error) {
      console.error('Error getting pending tasks:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate onboarding completion rate
   */
  async getOnboardingCompletionRate(companyId, monthsBack = 3) {
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - monthsBack);
      
      const completedChecklists = await OnboardingChecklist.countDocuments({
        companyId,
        status: 'Completed',
        joiningDate: { $lte: threeMonthsAgo }
      });
      
      const totalChecklists = await OnboardingChecklist.countDocuments({
        companyId,
        joiningDate: { $lte: threeMonthsAgo }
      });
      
      const completionRate = totalChecklists > 0 ? 
        ((completedChecklists / totalChecklists) * 100).toFixed(2) : 0;
      
      // Average time to complete
      const completedOnboardings = await OnboardingChecklist.find({
        companyId,
        status: 'Completed'
      });
      
      let totalDaysToComplete = 0;
      completedOnboardings.forEach(onboarding => {
        const lastCompletedTask = onboarding.tasks
          .filter(t => t.completed)
          .sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate))[0];
        
        if (lastCompletedTask) {
          const daysToComplete = Math.floor(
            (new Date(lastCompletedTask.completedDate) - onboarding.joiningDate) / (1000 * 60 * 60 * 24)
          );
          totalDaysToComplete += daysToComplete;
        }
      });
      
      const averageDaysToComplete = completedOnboardings.length > 0 ? 
        Math.round(totalDaysToComplete / completedOnboardings.length) : 0;
      
      return {
        success: true,
        completionRate: completionRate + '%',
        completedChecklists,
        totalChecklists,
        averageDaysToComplete,
        period: `Last ${monthsBack} months`
      };
    } catch (error) {
      console.error('Error calculating completion rate:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add custom task to existing checklist
   */
  async addCustomTask(checklistId, taskName, category, priority, daysDue = 5, assignedTo = null) {
    try {
      const checklist = await OnboardingChecklist.findById(checklistId);
      if (!checklist) {
        return { success: false, error: 'Checklist not found' };
      }
      
      const newTask = {
        taskName,
        category,
        priority,
        dueDate: new Date(checklist.joiningDate.getTime() + daysDue * 24 * 60 * 60 * 1000),
        assignedTo,
        completed: false
      };
      
      checklist.tasks.push(newTask);
      await checklist.save();
      
      return {
        success: true,
        message: 'Task added successfully',
        taskCount: checklist.tasks.length
      };
    } catch (error) {
      console.error('Error adding custom task:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get onboarding summary for HR dashboard
   */
  async getOnboardingSummary(companyId) {
    try {
      const now = new Date();
      
      const summary = {
        newEmployeesThisMonth: 0,
        completedThisMonth: 0,
        inProgress: 0,
        overdue: 0,
        atRisk: 0
      };
      
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const checklists = await OnboardingChecklist.find({ companyId });
      
      checklists.forEach(checklist => {
        if (checklist.joiningDate >= firstDayOfMonth) {
          summary.newEmployeesThisMonth++;
        }
        
        if (checklist.status === 'Completed' && 
            checklist.joiningDate >= firstDayOfMonth) {
          summary.completedThisMonth++;
        }
        
        if (checklist.status === 'In Progress') {
          summary.inProgress++;
        }
        
        // Check for overdue tasks
        const overdueTasks = checklist.tasks.filter(t => 
          !t.completed && new Date(t.dueDate) < now
        );
        
        if (overdueTasks.length > 0) {
          summary.overdue++;
        }
        
        // Check for at-risk (30+ days and less than 50% complete)
        const daysSinceJoining = Math.floor((now - checklist.joiningDate) / (1000 * 60 * 60 * 24));
        if (daysSinceJoining >= 30 && checklist.completionPercentage < 50) {
          summary.atRisk++;
        }
      });
      
      const thisMonthCompletionRate = summary.newEmployeesThisMonth > 0 ? 
        ((summary.completedThisMonth / summary.newEmployeesThisMonth) * 100).toFixed(1) : 0;
      
      return {
        success: true,
        summary,
        thisMonthCompletionRate: thisMonthCompletionRate + '%',
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting onboarding summary:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new OnboardingEngine();
