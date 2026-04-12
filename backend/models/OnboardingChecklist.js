const mongoose = require('mongoose');

const onboardingChecklistSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  offerAcceptanceDate: Date,
  joiningDate: {
    type: Date,
    required: true
  },
  expectedCompletionDate: Date,
  completionPercentage: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'Completed', 'On Hold'],
    default: 'Not Started'
  },
  tasks: [{
    taskId: mongoose.Schema.Types.ObjectId,
    taskName: String,
    category: String,
    priority: String,
    dueDate: Date,
    assignedTo: mongoose.Schema.Types.ObjectId,
    assignedToName: String,
    completed: {
      type: Boolean,
      default: false
    },
    completedDate: Date,
    completedBy: mongoose.Schema.Types.ObjectId,
    comments: String
  }],
  manager: mongoose.Schema.Types.ObjectId,
  hrContact: mongoose.Schema.Types.ObjectId,
  feedback: String,
  finalReview: {
    reviewedBy: mongoose.Schema.Types.ObjectId,
    reviewDate: Date,
    feedback: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

onboardingChecklistSchema.index({ companyId: 1, employeeId: 1 });
onboardingChecklistSchema.index({ status: 1 });
onboardingChecklistSchema.index({ joiningDate: 1 });

module.exports = mongoose.model('OnboardingChecklist', onboardingChecklistSchema);
