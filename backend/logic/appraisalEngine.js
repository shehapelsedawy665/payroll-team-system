/**
 * @file backend/logic/appraisalEngine.js
 * @description Core appraisal calculation and scoring logic
 */

/**
 * Calculate overall appraisal scores based on competency ratings
 */
function calculateAppraisalScores(appraisal) {
    const scores = {};
    
    // Calculate self-assessment score
    if (appraisal.employeeSelfRating?.competencies) {
        const selfRatings = appraisal.employeeSelfRating.competencies
            .filter(c => c.rating)
            .map(c => c.rating);
        
        if (selfRatings.length > 0) {
            scores.selfAssessmentScore = (
                selfRatings.reduce((a, b) => a + b, 0) / selfRatings.length
            ).toFixed(2);
        }
    }
    
    // Calculate manager rating score
    if (appraisal.managerRating?.competencies) {
        const managerRatings = appraisal.managerRating.competencies
            .filter(c => c.rating)
            .map(c => c.rating);
        
        if (managerRatings.length > 0) {
            scores.managerRatingScore = (
                managerRatings.reduce((a, b) => a + b, 0) / managerRatings.length
            ).toFixed(2);
        }
    }
    
    // Calculate peer feedback average if available
    if (appraisal.peerFeedback?.length > 0) {
        const allPeerRatings = [];
        appraisal.peerFeedback.forEach(peer => {
            if (peer.ratings?.length > 0) {
                const peerAvg = peer.ratings.reduce((a, b) => a + b.rating, 0) / peer.ratings.length;
                allPeerRatings.push(peerAvg);
            }
        });
        
        if (allPeerRatings.length > 0) {
            scores.peerFeedbackAverageScore = (
                allPeerRatings.reduce((a, b) => a + b, 0) / allPeerRatings.length
            ).toFixed(2);
        }
    }
    
    // Calculate calibrated score (weighted average)
    scores.calibratedScore = calculateCalibratedScore(scores);
    
    // Determine final rating
    scores.finalRating = mapScoreToRating(scores.calibratedScore);
    
    return scores;
}

/**
 * Calculate calibrated score based on different inputs
 * Weights: Manager (50%), Self (20%), Peer (20%), Overall Performance (10%)
 */
function calculateCalibratedScore(scores) {
    let totalWeight = 0;
    let weightedScore = 0;
    
    // Manager rating (50% weight)
    if (scores.managerRatingScore) {
        weightedScore += parseFloat(scores.managerRatingScore) * 0.5;
        totalWeight += 0.5;
    }
    
    // Self-assessment (20% weight)
    if (scores.selfAssessmentScore) {
        weightedScore += parseFloat(scores.selfAssessmentScore) * 0.2;
        totalWeight += 0.2;
    }
    
    // Peer feedback (20% weight)
    if (scores.peerFeedbackAverageScore) {
        weightedScore += parseFloat(scores.peerFeedbackAverageScore) * 0.2;
        totalWeight += 0.2;
    }
    
    // If no other scores, use manager rating fully
    if (totalWeight === 0) {
        return 0;
    }
    
    return (weightedScore / totalWeight).toFixed(2);
}

/**
 * Map numeric score to rating level
 * Assumes 5-point scale (1-5)
 */
function mapScoreToRating(score) {
    if (!score) return '3-Meets';
    
    const numScore = parseFloat(score);
    
    if (numScore >= 4.5) return '5-Exceptional';
    if (numScore >= 4.0) return '4-Exceeds';
    if (numScore >= 3.0) return '3-Meets';
    if (numScore >= 2.0) return '2-Below';
    return '1-Unsatisfactory';
}

/**
 * Validate that ratings follow organizational distribution
 * Used during calibration to apply bell curve constraints
 */
function validateRatingDistribution(ratings, template) {
    const distribution = {
        exceptional: 0,
        exceeds: 0,
        meets: 0,
        below: 0,
        unsatisfactory: 0
    };
    
    // Count ratings
    ratings.forEach(rating => {
        if (rating === '5-Exceptional') distribution.exceptional++;
        else if (rating === '4-Exceeds') distribution.exceeds++;
        else if (rating === '3-Meets') distribution.meets++;
        else if (rating === '2-Below') distribution.below++;
        else if (rating === '1-Unsatisfactory') distribution.unsatisfactory++;
    });
    
    const total = ratings.length;
    const current = {
        exceptional: (distribution.exceptional / total * 100).toFixed(1),
        exceeds: (distribution.exceeds / total * 100).toFixed(1),
        meets: (distribution.meets / total * 100).toFixed(1),
        below: (distribution.below / total * 100).toFixed(1),
        unsatisfactory: (distribution.unsatisfactory / total * 100).toFixed(1)
    };
    
    const target = template?.calibrationSettings?.targetDistribution || {
        exceptional: 10,
        exceeds: 20,
        meets: 60,
        below: 8,
        unsatisfactory: 2
    };
    
    return {
        current,
        target,
        deviations: {
            exceptional: parseFloat(current.exceptional) - target.exceptional,
            exceeds: parseFloat(current.exceeds) - target.exceeds,
            meets: parseFloat(current.meets) - target.meets,
            below: parseFloat(current.below) - target.below,
            unsatisfactory: parseFloat(current.unsatisfactory) - target.unsatisfactory
        }
    };
}

/**
 * Calculate performance trends for an employee across multiple cycles
 */
function calculatePerformanceTrend(appraisals) {
    if (!appraisals || appraisals.length === 0) {
        return { trend: 'no-data', scores: [] };
    }
    
    const scores = appraisals
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map(a => parseFloat(a.scores?.calibratedScore || 0));
    
    if (scores.length < 2) {
        return { trend: 'insufficient-data', scores };
    }
    
    // Calculate trend (simple linear regression)
    const n = scores.length;
    const x = Array.from({ length: n }, (_, i) => i + 1);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = scores.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * scores[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    let trend = 'stable';
    if (slope > 0.1) trend = 'improving';
    else if (slope < -0.1) trend = 'declining';
    
    return { trend, slope: slope.toFixed(2), scores };
}

/**
 * Identify high performers, at-risk employees, and development needs
 */
function generateEmployeeInsights(appraisal) {
    const insights = {
        performanceLevel: '',
        riskCategory: 'standard',
        developmentPriorities: [],
        promotionReadiness: 'no-opinion'
    };
    
    const rating = appraisal.scores?.finalRating;
    const score = parseFloat(appraisal.scores?.calibratedScore || 0);
    
    // Performance level
    if (rating === '5-Exceptional') {
        insights.performanceLevel = 'high-performer';
        insights.promotionReadiness = 'ready-now';
    } else if (rating === '4-Exceeds') {
        insights.performanceLevel = 'above-average';
        insights.promotionReadiness = 'ready-in-1yr';
    } else if (rating === '3-Meets') {
        insights.performanceLevel = 'competent';
        insights.promotionReadiness = 'potential';
    } else if (rating === '2-Below') {
        insights.performanceLevel = 'below-average';
        insights.riskCategory = 'at-risk';
        insights.promotionReadiness = 'not-ready';
    } else {
        insights.performanceLevel = 'unsatisfactory';
        insights.riskCategory = 'critical';
        insights.promotionReadiness = 'not-ready';
    }
    
    // Development priorities
    if (appraisal.managerRating?.developmentAreas) {
        insights.developmentPriorities.push(appraisal.managerRating.developmentAreas);
    }
    
    if (appraisal.developmentPlan?.trainingNeeds?.length > 0) {
        insights.developmentPriorities.push(...appraisal.developmentPlan.trainingNeeds);
    }
    
    // Promotion readiness override if manager provided specific recommendation
    if (appraisal.managerRating?.promotionRecommendation) {
        insights.promotionReadiness = appraisal.managerRating.promotionRecommendation;
    }
    
    return insights;
}

/**
 * Generate performance dashboard data
 */
function generatePerformanceDashboard(appraisals) {
    const dashboard = {
        totalEmployees: appraisals.length,
        completionRate: 0,
        averageScore: 0,
        ratingDistribution: {},
        topPerformers: [],
        atRiskEmployees: [],
        departmentPerformance: {}
    };
    
    // Calculate completion rate
    const completed = appraisals.filter(a => 
        ['manager-submitted', 'approved', 'archived'].includes(a.status)
    ).length;
    dashboard.completionRate = ((completed / appraisals.length) * 100).toFixed(1);
    
    // Calculate average score
    const scores = appraisals
        .filter(a => a.scores?.calibratedScore)
        .map(a => parseFloat(a.scores.calibratedScore));
    if (scores.length > 0) {
        dashboard.averageScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
    }
    
    // Rating distribution
    dashboard.ratingDistribution = {
        '5-Exceptional': appraisals.filter(a => a.scores?.finalRating === '5-Exceptional').length,
        '4-Exceeds': appraisals.filter(a => a.scores?.finalRating === '4-Exceeds').length,
        '3-Meets': appraisals.filter(a => a.scores?.finalRating === '3-Meets').length,
        '2-Below': appraisals.filter(a => a.scores?.finalRating === '2-Below').length,
        '1-Unsatisfactory': appraisals.filter(a => a.scores?.finalRating === '1-Unsatisfactory').length
    };
    
    // Top performers (5 and 4 ratings)
    dashboard.topPerformers = appraisals
        .filter(a => ['5-Exceptional', '4-Exceeds'].includes(a.scores?.finalRating))
        .slice(0, 10)
        .map(a => ({
            employeeId: a.employeeId,
            rating: a.scores.finalRating,
            score: a.scores.calibratedScore
        }));
    
    // At-risk employees (2 and 1 ratings)
    dashboard.atRiskEmployees = appraisals
        .filter(a => ['2-Below', '1-Unsatisfactory'].includes(a.scores?.finalRating))
        .map(a => ({
            employeeId: a.employeeId,
            rating: a.scores.finalRating,
            score: a.scores.calibratedScore,
            developmentNeeds: a.developmentPlan?.trainingNeeds
        }));
    
    return dashboard;
}

module.exports = {
    calculateAppraisalScores,
    calculateCalibratedScore,
    mapScoreToRating,
    validateRatingDistribution,
    calculatePerformanceTrend,
    generateEmployeeInsights,
    generatePerformanceDashboard
};
