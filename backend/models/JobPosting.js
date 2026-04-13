const mongoose = require('mongoose');

const jobPostingSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  department: {
    type: String,
    required: true
  },
  jobTitle: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  requirements: [{
    type: String
  }],
  skills: [{
    type: String
  }],
  experience: {
    type: String,
    enum: ['Entry Level', 'Mid Level', 'Senior', 'Lead', 'Executive'],
    default: 'Mid Level'
  },
  salaryRange: {
    min: Number,
    max: Number,
    currency: { type: String, default: 'SAR' }
  },
  jobType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
    default: 'Full-time'
  },
  location: String,
  remote: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'closed', 'filled'],
    default: 'draft'
  },
  postedDate: {
    type: Date,
    default: Date.now
  },
  closingDate: Date,
  applicantsCount: {
    type: Number,
    default: 0
  },
  preferredQualification: String,
  reportingTo: mongoose.Schema.Types.ObjectId,
  hiringManager: mongoose.Schema.Types.ObjectId,
  createdBy: mongoose.Schema.Types.ObjectId,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

jobPostingSchema.index({ companyId: 1, status: 1 });
jobPostingSchema.index({ department: 1 });
jobPostingSchema.index({ createdAt: -1 });

module.exports = mongoose.models.JobPosting || mongoose.model('JobPosting', jobPostingSchema);
