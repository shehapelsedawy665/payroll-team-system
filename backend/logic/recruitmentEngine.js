// Recruitment and Candidate Management Engine
const Candidate = require('../models/Candidate');
const JobPosting = require('../models/JobPosting');
const Offer = require('../models/Offer');

class RecruitmentEngine {
  /**
   * Calculate skill match between candidate and job requirements
   */
  async calculateSkillMatch(candidate, jobPosting) {
    try {
      const candidateSkills = new Set(candidate.skills.map(s => s.toLowerCase()));
      const jobSkills = new Set(jobPosting.skills.map(s => s.toLowerCase()));
      
      let matchedSkills = 0;
      let totalJobSkills = jobSkills.size;
      
      jobSkills.forEach(skill => {
        if (candidateSkills.has(skill)) {
          matchedSkills++;
        }
      });
      
      const matchPercentage = totalJobSkills > 0 ? (matchedSkills / totalJobSkills) * 100 : 0;
      const score = Math.round(matchPercentage / 20); // Convert to 1-5 scale
      
      return {
        matchPercentage: Math.round(matchPercentage),
        matchedSkills: Array.from(jobSkills).filter(s => candidateSkills.has(s)),
        missingSkills: Array.from(jobSkills).filter(s => !candidateSkills.has(s)),
        score: Math.min(5, Math.max(1, score))
      };
    } catch (error) {
      console.error('Error calculating skill match:', error);
      return null;
    }
  }

  /**
   * Calculate experience match
   */
  calculateExperienceMatch(candidate, jobPosting) {
    try {
      const candidateExp = candidate.experience?.years || 0;
      const experienceLevels = {
        'Entry Level': { min: 0, max: 2 },
        'Mid Level': { min: 2, max: 5 },
        'Senior': { min: 5, max: 10 },
        'Lead': { min: 8, max: 15 },
        'Executive': { min: 10, max: 100 }
      };
      
      const required = experienceLevels[jobPosting.experience] || { min: 0, max: 100 };
      const isExperienced = candidateExp >= required.min && candidateExp <= required.max;
      
      let score = 1;
      if (candidateExp >= required.min && candidateExp <= required.max) {
        score = 5;
      } else if (candidateExp >= required.min - 1 && candidateExp <= required.max + 2) {
        score = 4;
      } else if (candidateExp >= required.min - 2 && candidateExp <= required.max + 3) {
        score = 3;
      } else {
        score = 2;
      }
      
      return {
        candidateExperience: candidateExp,
        requiredRange: required,
        isMatch: isExperienced,
        score: score
      };
    } catch (error) {
      console.error('Error calculating experience match:', error);
      return { score: 3 };
    }
  }

  /**
   * Calculate salary expectation fit
   */
  calculateSalaryFit(candidate, jobPosting) {
    try {
      const candidateMin = candidate.expectedSalary?.min || 0;
      const candidateMax = candidate.expectedSalary?.max || 0;
      const jobMin = jobPosting.salaryRange?.min || 0;
      const jobMax = jobPosting.salaryRange?.max || 0;
      
      const withinRange = candidateMin <= jobMax && candidateMax >= jobMin;
      
      let fit = 'Negotiable';
      if (candidateMax < jobMin) {
        fit = 'Below Budget';
      } else if (candidateMin > jobMax) {
        fit = 'Above Budget';
      } else if (withinRange) {
        fit = 'Within Budget';
      }
      
      return {
        candidateExpectation: { min: candidateMin, max: candidateMax },
        jobRange: { min: jobMin, max: jobMax },
        fit: fit,
        withinRange: withinRange
      };
    } catch (error) {
      console.error('Error calculating salary fit:', error);
      return { fit: 'Unknown' };
    }
  }

  /**
   * Generate comprehensive candidate ranking score
   */
  async generateCandidateScore(candidate, jobPosting) {
    try {
      const skillMatch = await this.calculateSkillMatch(candidate, jobPosting);
      const experienceMatch = this.calculateExperienceMatch(candidate, jobPosting);
      const salaryFit = this.calculateSalaryFit(candidate, jobPosting);
      
      // Weighted scoring: 50% skills, 30% experience, 20% salary fit
      const overallScore = (skillMatch.score * 0.5) + 
                          (experienceMatch.score * 0.3) + 
                          (salaryFit.withinRange ? 5 : 3) * 0.2;
      
      const roundedScore = Math.round(overallScore * 10) / 10;
      
      let recommendation = 'Proceed';
      if (roundedScore >= 4.5) {
        recommendation = 'Strong Match - Prioritize';
      } else if (roundedScore >= 4) {
        recommendation = 'Good Match - Proceed';
      } else if (roundedScore >= 3) {
        recommendation = 'Potential - Consider';
      } else {
        recommendation = 'Not Recommended';
      }
      
      return {
        overallScore: roundedScore,
        recommendation,
        skillMatch,
        experienceMatch,
        salaryFit,
        breakdown: {
          skills: (skillMatch.score * 0.5).toFixed(2),
          experience: (experienceMatch.score * 0.3).toFixed(2),
          salary: (salaryFit.withinRange ? 5 : 3) * 0.2
        }
      };
    } catch (error) {
      console.error('Error generating candidate score:', error);
      return null;
    }
  }

  /**
   * Move candidate through pipeline stages
   */
  async moveToNextStage(candidateId, newStage, comments = '', ratedBy = null) {
    try {
      const candidate = await Candidate.findById(candidateId);
      if (!candidate) {
        return { success: false, error: 'Candidate not found' };
      }
      
      const validStages = ['Applied', 'Screening', 'Interview1', 'Interview2', 'Interview3', 'Offer', 'Accepted', 'Rejected', 'OnHold'];
      if (!validStages.includes(newStage)) {
        return { success: false, error: 'Invalid stage' };
      }
      
      candidate.stage = newStage;
      candidate.pipelineHistory.push({
        stage: newStage,
        timestamp: new Date(),
        comments,
        ratedBy
      });
      
      await candidate.save();
      
      return {
        success: true,
        candidate,
        message: `Candidate moved to ${newStage}`
      };
    } catch (error) {
      console.error('Error moving candidate:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Rank all candidates for a job posting
   */
  async rankCandidatesForJob(jobPostingId) {
    try {
      const candidates = await Candidate.find({ 
        jobPostingId,
        stage: { $ne: 'Rejected' }
      });
      
      const jobPosting = await JobPosting.findById(jobPostingId);
      if (!jobPosting) {
        return { success: false, error: 'Job posting not found' };
      }
      
      const rankedCandidates = [];
      
      for (const candidate of candidates) {
        const score = await this.generateCandidateScore(candidate, jobPosting);
        rankedCandidates.push({
          candidateId: candidate._id,
          candidateName: `${candidate.firstName} ${candidate.lastName}`,
          currentStage: candidate.stage,
          ...score
        });
      }
      
      rankedCandidates.sort((a, b) => b.overallScore - a.overallScore);
      
      return {
        success: true,
        jobTitle: jobPosting.jobTitle,
        totalCandidates: rankedCandidates.length,
        candidates: rankedCandidates
      };
    } catch (error) {
      console.error('Error ranking candidates:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get hiring pipeline summary at a glance
   */
  async getHiringPipelineSummary(jobPostingId) {
    try {
      const pipeline = {};
      const stages = ['Applied', 'Screening', 'Interview1', 'Interview2', 'Interview3', 'Offer', 'Accepted', 'Rejected'];
      
      for (const stage of stages) {
        const count = await Candidate.countDocuments({ jobPostingId, stage });
        pipeline[stage] = count;
      }
      
      const totalCandidates = Object.values(pipeline).reduce((a, b) => a + b, 0);
      const activeCount = pipeline.Applied + pipeline.Screening + pipeline.Interview1 + 
                         pipeline.Interview2 + pipeline.Interview3 + pipeline.Offer;
      
      return {
        jobPostingId,
        totalCandidates,
        activeCount,
        acceptedCount: pipeline.Accepted,
        rejectedCount: pipeline.Rejected,
        pipelineBreakdown: pipeline,
        conversionRate: totalCandidates > 0 ? ((pipeline.Accepted / totalCandidates) * 100).toFixed(2) + '%' : '0%'
      };
    } catch (error) {
      console.error('Error getting pipeline summary:', error);
      return null;
    }
  }

  /**
   * Get top candidates for accelerated hiring
   */
  async getTopCandidates(jobPostingId, limit = 5) {
    try {
      const candidates = await Candidate.find({
        jobPostingId,
        stage: { $in: ['Screening', 'Interview1', 'Interview2', 'Offer'] }
      }).sort({ 'rating.overallScore': -1 }).limit(limit);
      
      return {
        success: true,
        count: candidates.length,
        topCandidates: candidates.map(c => ({
          id: c._id,
          name: `${c.firstName} ${c.lastName}`,
          email: c.email,
          stage: c.stage,
          overallScore: c.rating?.overallScore,
          experience: c.experience?.years,
          skills: c.skills
        }))
      };
    } catch (error) {
      console.error('Error getting top candidates:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate time-to-hire metrics
   */
  async calculateTimeToHire(jobPostingId) {
    try {
      const acceptedCandidates = await Candidate.find({
        jobPostingId,
        stage: 'Accepted'
      });
      
      if (acceptedCandidates.length === 0) {
        return { success: true, message: 'No accepted candidates yet' };
      }
      
      let totalDays = 0;
      const metrics = acceptedCandidates.map(candidate => {
        const daysTaken = Math.floor((candidate.lastUpdated - candidate.appliedDate) / (1000 * 60 * 60 * 24));
        totalDays += daysTaken;
        return {
          candidateName: `${candidate.firstName} ${candidate.lastName}`,
          daysTaken
        };
      });
      
      const averageTimeToHire = Math.round(totalDays / acceptedCandidates.length);
      
      return {
        success: true,
        totalHires: acceptedCandidates.length,
        averageTimeToHire,
        candidates: metrics
      };
    } catch (error) {
      console.error('Error calculating time to hire:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new RecruitmentEngine();
