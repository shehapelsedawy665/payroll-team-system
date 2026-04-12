const mongoose = require('mongoose');

const onboardingTaskSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  category: {
    type: String,
    enum: ['IT Setup', 'Documentation', 'Training', 'Orientation', 'System Access', 'Compliance', 'Other'],
    default: 'Orientation'
  },
  priority: {
    type: String,
    enum: ['Critical', 'High', 'Medium', 'Low'],
    default: 'Medium'
  },
  daysDueAfterJoining: {
    type: Number,
    default: 1
  },
  assignedTo: mongoose.Schema.Types.ObjectId, // Department head or manager
  isTemplate: {
    type: Boolean,
    default: true
  },
  department: String,
  jobLevel: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

onboardingTaskSchema.index({ companyId: 1, isTemplate: 1 });
onboardingTaskSchema.index({ category: 1 });

module.exports = mongoose.model('OnboardingTask', onboardingTaskSchema);
