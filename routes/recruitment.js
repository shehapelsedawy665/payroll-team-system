const express = require('express');
const router = express.Router();
const JobPosting = require('../models/JobPosting');
const Candidate = require('../models/Candidate');
const Offer = require('../models/Offer');
const recruitmentEngine = require('../logic/recruitmentEngine');
const auth = require('../middleware/auth');

// Middleware to verify HR role
const isHR = (req, res, next) => {
  if (req.user && (req.user.role === 'HR' || req.user.role === 'Admin')) {
    return next();
  }
  res.status(403).json({ error: 'Unauthorized - HR access required' });
};

// ===== JOB POSTINGS =====

/**
 * POST /api/recruitment/job-postings
 * Create new job posting
 */
router.post('/job-postings', auth, isHR, async (req, res) => {
  try {
    const { jobTitle, department, description, requirements, skills, salaryRange, experience, jobType, location } = req.body;
    
    if (!jobTitle || !department || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const jobPosting = new JobPosting({
      companyId: req.user.companyId,
      jobTitle,
      department,
      description,
      requirements,
      skills,
      salaryRange,
      experience,
      jobType,
      location,
      hiringManager: req.user.id,
      createdBy: req.user.id,
      status: 'draft'
    });
    
    await jobPosting.save();
    
    res.status(201).json({
      success: true,
      jobPosting,
      message: 'Job posting created successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recruitment/job-postings
 * List all job postings
 */
router.get('/job-postings', auth, async (req, res) => {
  try {
    const { status, department } = req.query;
    const query = { companyId: req.user.companyId };
    
    if (status) query.status = status;
    if (department) query.department = department;
    
    const jobPostings = await JobPosting.find(query)
      .sort({ createdAt: -1 })
      .populate('hiringManager', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName');
    
    res.json({
      success: true,
      count: jobPostings.length,
      jobPostings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recruitment/job-postings/:id
 * Get single job posting with candidates
 */
router.get('/job-postings/:id', auth, async (req, res) => {
  try {
    const jobPosting = await JobPosting.findById(req.params.id)
      .populate('hiringManager', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName');
    
    if (!jobPosting) {
      return res.status(404).json({ error: 'Job posting not found' });
    }
    
    // Get pipeline summary
    const pipelineSummary = await recruitmentEngine.getHiringPipelineSummary(jobPosting._id);
    
    res.json({
      success: true,
      jobPosting,
      pipelineSummary
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/recruitment/job-postings/:id
 * Update job posting
 */
router.put('/job-postings/:id', auth, isHR, async (req, res) => {
  try {
    const jobPosting = await JobPosting.findById(req.params.id);
    if (!jobPosting) {
      return res.status(404).json({ error: 'Job posting not found' });
    }
    
    Object.assign(jobPosting, req.body);
    jobPosting.updatedAt = new Date();
    
    await jobPosting.save();
    
    res.json({
      success: true,
      jobPosting,
      message: 'Job posting updated'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/recruitment/job-postings/:id/publish
 * Publish job posting
 */
router.post('/job-postings/:id/publish', auth, isHR, async (req, res) => {
  try {
    const jobPosting = await JobPosting.findById(req.params.id);
    if (!jobPosting) {
      return res.status(404).json({ error: 'Job posting not found' });
    }
    
    jobPosting.status = 'active';
    jobPosting.postedDate = new Date();
    if (!jobPosting.closingDate) {
      const closingDate = new Date();
      closingDate.setDate(closingDate.getDate() + 30); // 30 days from now
      jobPosting.closingDate = closingDate;
    }
    
    await jobPosting.save();
    
    res.json({
      success: true,
      jobPosting,
      message: 'Job posting published'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/recruitment/job-postings/:id/close
 * Close job posting
 */
router.post('/job-postings/:id/close', auth, isHR, async (req, res) => {
  try {
    const jobPosting = await JobPosting.findById(req.params.id);
    if (!jobPosting) {
      return res.status(404).json({ error: 'Job posting not found' });
    }
    
    jobPosting.status = 'closed';
    await jobPosting.save();
    
    res.json({
      success: true,
      jobPosting,
      message: 'Job posting closed'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== CANDIDATES =====

/**
 * POST /api/recruitment/candidates
 * Submit job application
 */
router.post('/candidates', async (req, res) => {
  try {
    const { jobPostingId, firstName, lastName, email, phone, skills, experience, resume, expectedSalary } = req.body;
    
    if (!jobPostingId || !firstName || !lastName || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const jobPosting = await JobPosting.findById(jobPostingId);
    if (!jobPosting) {
      return res.status(404).json({ error: 'Job posting not found' });
    }
    
    // Check if candidate already applied
    const existingCandidate = await Candidate.findOne({
      jobPostingId,
      email
    });
    
    if (existingCandidate) {
      return res.status(400).json({ error: 'Candidate already applied for this position' });
    }
    
    const candidate = new Candidate({
      companyId: jobPosting.companyId,
      jobPostingId,
      firstName,
      lastName,
      email,
      phone,
      skills: skills || [],
      experience,
      resume,
      expectedSalary,
      stage: 'Applied'
    });
    
    await candidate.save();
    
    // Increment applicants count
    jobPosting.applicantsCount += 1;
    await jobPosting.save();
    
    res.status(201).json({
      success: true,
      candidate,
      message: 'Application submitted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recruitment/job-postings/:jobId/candidates
 * Get all candidates for a job
 */
router.get('/job-postings/:jobId/candidates', auth, async (req, res) => {
  try {
    const candidates = await Candidate.find({ jobPostingId: req.params.jobId })
      .sort({ appliedDate: -1 });
    
    res.json({
      success: true,
      count: candidates.length,
      candidates
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recruitment/job-postings/:jobId/candidates/ranked
 * Get ranked candidates for a job
 */
router.get('/job-postings/:jobId/candidates/ranked', auth, isHR, async (req, res) => {
  try {
    const result = await recruitmentEngine.rankCandidatesForJob(req.params.jobId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recruitment/candidates/:id
 * Get candidate details
 */
router.get('/candidates/:id', auth, async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id)
      .populate('jobPostingId', 'jobTitle department');
    
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    // Generate candidate score
    const jobPosting = await JobPosting.findById(candidate.jobPostingId);
    const score = await recruitmentEngine.generateCandidateScore(candidate, jobPosting);
    
    res.json({
      success: true,
      candidate,
      score
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/recruitment/candidates/:id/stage
 * Move candidate to next stage
 */
router.put('/candidates/:id/stage', auth, isHR, async (req, res) => {
  try {
    const { stage, comments } = req.body;
    
    const result = await recruitmentEngine.moveToNextStage(
      req.params.id,
      stage,
      comments,
      req.user.id
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
 * POST /api/recruitment/candidates/:id/rate
 * Rate candidate
 */
router.post('/candidates/:id/rate', auth, isHR, async (req, res) => {
  try {
    const { skillsMatch, culturalFit, comments } = req.body;
    
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    const overallScore = Math.round((skillsMatch + culturalFit) / 2);
    candidate.rating = {
      skillsMatch,
      culturalFit,
      overallScore,
      comments
    };
    
    await candidate.save();
    
    res.json({
      success: true,
      candidate,
      message: 'Candidate rated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== OFFERS =====

/**
 * POST /api/recruitment/offers
 * Create job offer
 */
router.post('/offers', auth, isHR, async (req, res) => {
  try {
    const { candidateId, jobPostingId, compensation, joinDate } = req.body;
    
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    const totalPackage = (compensation.baseSalary?.amount || 0) + 
                        (compensation.bonus || 0) + 
                        (compensation.allowances?.reduce((sum, a) => sum + a.amount, 0) || 0);
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // 7 days validity
    
    const offer = new Offer({
      companyId: req.user.companyId,
      candidateId,
      jobPostingId,
      candidateName: `${candidate.firstName} ${candidate.lastName}`,
      candidateEmail: candidate.email,
      compensation: {
        ...compensation,
        totalPackage
      },
      joinDate,
      expiryDate,
      status: 'Draft',
      createdBy: req.user.id
    });
    
    await offer.save();
    
    res.status(201).json({
      success: true,
      offer,
      message: 'Offer created successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recruitment/offers
 * Get all offers
 */
router.get('/offers', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const query = { companyId: req.user.companyId };
    
    if (status) query.status = status;
    
    const offers = await Offer.find(query)
      .sort({ createdAt: -1 })
      .populate('candidateId', 'firstName lastName email');
    
    res.json({
      success: true,
      count: offers.length,
      offers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/recruitment/offers/:id/send
 * Send offer to candidate
 */
router.put('/offers/:id/send', auth, isHR, async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    
    offer.status = 'Sent';
    offer.approvedBy = req.user.id;
    offer.approvalDate = new Date();
    
    await offer.save();
    
    // Move candidate to Offer stage
    await Candidate.findByIdAndUpdate(offer.candidateId, { stage: 'Offer' });
    
    res.json({
      success: true,
      offer,
      message: 'Offer sent to candidate'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/recruitment/offers/:id/accept
 * Accept offer (by candidate)
 */
router.put('/offers/:id/accept', async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    
    if (new Date() > offer.expiryDate) {
      return res.status(400).json({ error: 'Offer has expired' });
    }
    
    offer.status = 'Accepted';
    offer.acceptanceDate = new Date();
    
    await offer.save();
    
    // Move candidate to Accepted stage
    await Candidate.findByIdAndUpdate(offer.candidateId, { stage: 'Accepted' });
    
    res.json({
      success: true,
      offer,
      message: 'Offer accepted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/recruitment/offers/:id/reject
 * Reject offer (by candidate)
 */
router.put('/offers/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    
    const offer = await Offer.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    
    offer.status = 'Rejected';
    offer.rejectionDate = new Date();
    offer.rejectionReason = reason;
    
    await offer.save();
    
    // Move candidate to Rejected stage
    await Candidate.findByIdAndUpdate(offer.candidateId, { stage: 'Rejected' });
    
    res.json({
      success: true,
      offer,
      message: 'Offer rejected'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== RECRUITMENT ANALYTICS =====

/**
 * GET /api/recruitment/job-postings/:id/pipeline
 * Get hiring pipeline for a job
 */
router.get('/job-postings/:id/pipeline', auth, isHR, async (req, res) => {
  try {
    const pipeline = await recruitmentEngine.getHiringPipelineSummary(req.params.id);
    
    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }
    
    res.json({
      success: true,
      pipeline
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recruitment/job-postings/:id/top-candidates
 * Get top candidates for a job
 */
router.get('/job-postings/:id/top-candidates', auth, isHR, async (req, res) => {
  try {
    const result = await recruitmentEngine.getTopCandidates(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/recruitment/job-postings/:id/time-to-hire
 * Get time-to-hire metrics
 */
router.get('/job-postings/:id/time-to-hire', auth, isHR, async (req, res) => {
  try {
    const result = await recruitmentEngine.calculateTimeToHire(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
