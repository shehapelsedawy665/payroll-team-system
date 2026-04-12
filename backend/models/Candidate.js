const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  jobPostingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting',
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: String,
  location: String,
  resume: String, // URL or file path
  resumeText: String, // Extracted text for searching
  skills: [String],
  experience: {
    years: Number,
    description: String
  },
  currentCompany: String,
  currentDesignation: String,
  education: [{
    degree: String,
    field: String,
    institution: String,
    year: Number
  }],
  expectedSalary: {
    min: Number,
    max: Number,
    currency: { type: String, default: 'SAR' }
  },
  noticePeriod: {
    type: String,
    enum: ['Immediate', '15 Days', '1 Month', '2 Months', '3 Months'],
    default: '1 Month'
  },
  stage: {
    type: String,
    enum: ['Applied', 'Screening', 'Interview1', 'Interview2', 'Interview3', 'Offer', 'Accepted', 'Rejected', 'OnHold'],
    default: 'Applied'
  },
  pipelineHistory: [{
    stage: String,
    timestamp: Date,
    comments: String,
    ratedBy: mongoose.Schema.Types.ObjectId
  }],
  rating: {
    skillsMatch: Number, // 1-5
    culturalFit: Number, // 1-5
    overallScore: Number, // 1-5
    comments: String
  },
  interviews: [{
    interviewDate: Date,
    interviewer: mongoose.Schema.Types.ObjectId,
    type: String,
    feedback: String,
    rating: Number
  }],
  appliedDate: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    enum: ['Direct Apply', 'Referral', 'Job Portal', 'Recruiter', 'LinkedIn', 'University'],
    default: 'Direct Apply'
  },
  referredBy: mongoose.Schema.Types.ObjectId,
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

candidateSchema.index({ companyId: 1, jobPostingId: 1 });
candidateSchema.index({ email: 1 });
candidateSchema.index({ stage: 1 });
candidateSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Candidate', candidateSchema);
