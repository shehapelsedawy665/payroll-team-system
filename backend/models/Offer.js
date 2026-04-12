const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true
  },
  jobPostingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting',
    required: true
  },
  candidateName: String,
  candidateEmail: String,
  jobTitle: String,
  department: String,
  offerDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: Date,
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Withdrawn', 'Expired'],
    default: 'Draft'
  },
  compensation: {
    baseSalary: {
      amount: Number,
      currency: { type: String, default: 'SAR' },
      frequency: { type: String, enum: ['Monthly', 'Annual'], default: 'Monthly' }
    },
    bonus: {
      type: Number,
      default: 0
    },
    allowances: [{
      name: String,
      amount: Number
    }],
    benefits: [String],
    totalPackage: Number
  },
  joinDate: Date,
  reportingTo: mongoose.Schema.Types.ObjectId,
  employmentType: {
    type: String,
    enum: ['Permanent', 'Contract', 'Internship'],
    default: 'Permanent'
  },
  contractTerm: {
    months: Number,
    autoRenewal: Boolean
  },
  conditions: [{
    description: String,
    required: { type: Boolean, default: true }
  }],
  acceptanceDate: Date,
  rejectionDate: Date,
  rejectionReason: String,
  createdBy: mongoose.Schema.Types.ObjectId,
  approvedBy: mongoose.Schema.Types.ObjectId,
  approvalDate: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

offerSchema.index({ companyId: 1, status: 1 });
offerSchema.index({ candidateId: 1 });
offerSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('Offer', offerSchema);
