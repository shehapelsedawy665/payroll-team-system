/**
 * @file backend/logic/hrIntegration.js
 * @description Integration between appraisals and other HR modules
 * Links performance ratings with salary increments, promotions, leaves, etc.
 */

/**
 * Calculate salary increment based on performance rating
 */
function calculateSalaryIncrement(employee, appraisalRating, company = {}) {
    const incrementRules = company.settings?.incrementRules || {
        '5-Exceptional': 0.10,       // 10% increment
        '4-Exceeds': 0.08,           // 8% increment
        '3-Meets': 0.05,             // 5% increment
        '2-Below': 0.02,             // 2% increment
        '1-Unsatisfactory': 0        // No increment
    };

    const basicSalary = employee.basicSalary || 0;
    const incrementRate = incrementRules[appraisalRating] || 0;
    const incrementAmount = basicSalary * incrementRate;

    return {
        currentSalary: basicSalary,
        incrementRate: (incrementRate * 100).toFixed(2),
        incrementAmount: incrementAmount.toFixed(2),
        newSalary: (basicSalary + incrementAmount).toFixed(2),
        effectiveDate: new Date()
    };
}

/**
 * Determine promotion eligibility based on performance
 */
function determinePromotionEligibility(appraisal, employee, company = {}) {
    const eligibility = {
        isEligible: false,
        reason: '',
        recommendedRole: null,
        readinessLevel: 'not-ready'
    };

    // Rating-based eligibility
    const excellentRatings = ['5-Exceptional', '4-Exceeds'];
    if (!excellentRatings.includes(appraisal.scores?.finalRating)) {
        eligibility.reason = `Current rating (${appraisal.scores?.finalRating}) does not meet promotion threshold`;
        return eligibility;
    }

    // Tenure requirement
    const hireDate = new Date(employee.hiringDate);
    const monthsEmployed = (new Date() - hireDate) / (1000 * 60 * 60 * 24 * 30);
    const requiredTenure = company.settings?.promotionTenureMonths || 12;

    if (monthsEmployed < requiredTenure) {
        eligibility.reason = `Tenure requirement not met: ${monthsEmployed.toFixed(1)} months employed vs ${requiredTenure} months required`;
        return eligibility;
    }

    // Manager recommendation
    if (appraisal.managerRating?.promotionRecommendation === 'not-ready') {
        eligibility.reason = 'Manager does not recommend promotion at this time';
        return eligibility;
    }

    // All checks passed
    eligibility.isEligible = true;
    eligibility.readinessLevel = appraisal.managerRating?.promotionRecommendation || 'ready-in-1yr';
    eligibility.reason = 'Employee meets all promotion criteria';

    // Recommend next role (would need role hierarchy mapping)
    const nextRoleMapping = company.settings?.roleHierarchy || {};
    eligibility.recommendedRole = nextRoleMapping[employee.jobTitle] || null;

    return eligibility;
}

/**
 * Link performance to leave allocation
 * High performers might get additional leave days
 */
function calculateLeaveAllocation(employee, appraisalRating, baseLeavePolicy = {}) {
    const leaveAllocation = {
        baseAnnualLeave: baseLeavePolicy.annualLeave || 20,
        bonusLeave: 0,
        totalLeave: baseLeavePolicy.annualLeave || 20,
        allocationType: 'standard'
    };

    // Bonus leave for high performers
    const bonusRules = {
        '5-Exceptional': 5,      // Extra 5 days
        '4-Exceeds': 3,          // Extra 3 days
        '3-Meets': 0,            // No bonus
        '2-Below': -2,           // Reduced
        '1-Unsatisfactory': -5   // Significantly reduced
    };

    leaveAllocation.bonusLeave = bonusRules[appraisalRating] || 0;
    leaveAllocation.totalLeave = Math.max(
        leaveAllocation.baseAnnualLeave + leaveAllocation.bonusLeave,
        10 // Minimum leave days
    );

    if (leaveAllocation.bonusLeave > 0) {
        leaveAllocation.allocationType = 'premium';
    } else if (leaveAllocation.bonusLeave < 0) {
        leaveAllocation.allocationType = 'restricted';
    }

    return leaveAllocation;
}

/**
 * Generate succession plan prospects
 */
function generateSuccessionPlan(appraisals, employees, company = {}) {
    const succession = {
        highPotential: [],
        readyNow: [],
        readyIn1Year: [],
        developmentNeeded: [],
        notReady: []
    };

    appraisals.forEach(appraisal => {
        const employee = employees.find(e => e._id.toString() === appraisal.employeeId.toString());
        if (!employee) return;

        const record = {
            employeeId: employee._id,
            employeeName: employee.name,
            currentRole: employee.jobTitle,
            department: employee.department,
            rating: appraisal.scores?.finalRating,
            promotionReadiness: appraisal.managerRating?.promotionRecommendation || 'no-opinion'
        };

        const readiness = appraisal.managerRating?.promotionRecommendation;

        if (readiness === 'ready-now') {
            succession.readyNow.push(record);
        } else if (readiness === 'ready-in-1yr') {
            succession.readyIn1Year.push(record);
        } else if (readiness === 'potential') {
            succession.highPotential.push(record);
        } else if (readiness === 'not-ready') {
            succession.notReady.push(record);
        } else {
            succession.developmentNeeded.push(record);
        }
    });

    return succession;
}

/**
 * Identify training and development needs by department
 */
function identifyTrainingNeeds(appraisals, employees, company = {}) {
    const trainingMatrix = {};

    appraisals.forEach(appraisal => {
        const employee = employees.find(e => e._id.toString() === appraisal.employeeId.toString());
        if (!employee) return;

        const dept = employee.department || 'Unassigned';
        if (!trainingMatrix[dept]) {
            trainingMatrix[dept] = {
                department: dept,
                totalEmployees: 0,
                lowPerformers: [],
                trainingNeeds: [],
                priorityAreas: {}
            };
        }

        trainingMatrix[dept].totalEmployees++;

        // Track low performers needing training
        if (['2-Below', '1-Unsatisfactory'].includes(appraisal.scores?.finalRating)) {
            trainingMatrix[dept].lowPerformers.push({
                employeeId: employee._id,
                employeeName: employee.name,
                rating: appraisal.scores?.finalRating,
                developmentNeeds: appraisal.developmentPlan?.trainingNeeds
            });
        }

        // Aggregate training needs
        if (appraisal.developmentPlan?.trainingNeeds) {
            appraisal.developmentPlan.trainingNeeds.forEach(need => {
                if (!trainingMatrix[dept].priorityAreas[need]) {
                    trainingMatrix[dept].priorityAreas[need] = 0;
                }
                trainingMatrix[dept].priorityAreas[need]++;
            });
        }
    });

    // Convert to array and sort by priority
    const result = Object.values(trainingMatrix).map(dept => {
        const sortedNeeds = Object.entries(dept.priorityAreas)
            .map(([need, count]) => ({ need, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5 needs

        return {
            ...dept,
            trainingNeeds: sortedNeeds
        };
    });

    return result;
}

/**
 * Calculate compensation adjustments based on appraisal
 */
function calculateCompensationAdjustment(employee, appraisal, company = {}) {
    const adjustment = {
        salaryIncrement: null,
        bonusPercentage: 0,
        allowanceAdjustments: []
    };

    // Salary increment based on rating
    adjustment.salaryIncrement = calculateSalaryIncrement(employee, appraisal.scores?.finalRating, company);

    // Bonus adjustment
    const bonusRules = company.settings?.bonusRules || {
        '5-Exceptional': 1.0,    // 100% of eligible bonus
        '4-Exceeds': 0.75,       // 75%
        '3-Meets': 0.50,         // 50%
        '2-Below': 0.25,         // 25%
        '1-Unsatisfactory': 0    // No bonus
    };

    adjustment.bonusPercentage = bonusRules[appraisal.scores?.finalRating] || 0;

    // Performance-based allowance adjustments
    const allowanceRules = company.settings?.allowanceRules || {};
    Object.entries(allowanceRules).forEach(([allowanceType, rules]) => {
        const adjustmentValue = rules[appraisal.scores?.finalRating];
        if (adjustmentValue !== undefined) {
            adjustment.allowanceAdjustments.push({
                allowanceType,
                currentAmount: employee[`${allowanceType}Allowance`] || 0,
                adjustmentPercentage: adjustmentValue,
                newAmount: ((employee[`${allowanceType}Allowance`] || 0) * (1 + adjustmentValue)).toFixed(2)
            });
        }
    });

    return adjustment;
}

/**
 * Generate HR action items based on appraisals
 */
function generateHRActionItems(appraisals, employees, company = {}) {
    const actions = {
        immediate: [],
        shortTerm: [],
        mediumTerm: [],
        longTerm: []
    };

    appraisals.forEach(appraisal => {
        const employee = employees.find(e => e._id.toString() === appraisal.employeeId.toString());
        if (!employee) return;

        const rating = appraisal.scores?.finalRating;

        // Immediate actions for low performers
        if (rating === '1-Unsatisfactory') {
            actions.immediate.push({
                employeeId: employee._id,
                employeeName: employee.name,
                action: 'Performance Improvement Plan (PIP) Required',
                priority: 'critical',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            });
        } else if (rating === '2-Below') {
            actions.shortTerm.push({
                employeeId: employee._id,
                employeeName: employee.name,
                action: 'Schedule Performance Review Discussion',
                priority: 'high',
                dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 2 weeks
            });
        }

        // Promotion actions for high performers
        if (['5-Exceptional', '4-Exceeds'].includes(rating)) {
            const promotionReady = appraisal.managerRating?.promotionRecommendation === 'ready-now';
            actions[promotionReady ? 'immediate' : 'mediumTerm'].push({
                employeeId: employee._id,
                employeeName: employee.name,
                action: promotionReady ? 'Process Promotion' : 'Groom for Leadership Position',
                priority: 'high',
                dueDate: new Date(Date.now() + (promotionReady ? 30 : 90) * 24 * 60 * 60 * 1000)
            });
        }

        // Compensation adjustments
        const compensation = calculateCompensationAdjustment(employee, appraisal, company);
        if (compensation.salaryIncrement.incrementAmount > 0) {
            actions.shortTerm.push({
                employeeId: employee._id,
                employeeName: employee.name,
                action: `Process Salary Increment: +${compensation.salaryIncrement.incrementRate}%`,
                priority: 'medium',
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
        }

        // Training and development
        if (appraisal.developmentPlan?.trainingNeeds?.length > 0) {
            actions.longTerm.push({
                employeeId: employee._id,
                employeeName: employee.name,
                action: `Arrange Training: ${appraisal.developmentPlan.trainingNeeds.join(', ')}`,
                priority: 'medium',
                dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
            });
        }
    });

    return actions;
}

module.exports = {
    calculateSalaryIncrement,
    determinePromotionEligibility,
    calculateLeaveAllocation,
    generateSuccessionPlan,
    identifyTrainingNeeds,
    calculateCompensationAdjustment,
    generateHRActionItems
};
