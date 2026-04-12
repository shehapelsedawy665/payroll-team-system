## Performance Appraisal System - Quick Reference Guide

### 🚀 **Quick Start**

#### 1. **Create Appraisal Cycle**
```bash
POST /api/appraisal/cycles
{
  "name": "Q1 2024 Review",
  "startDate": "2024-01-01",
  "endDate": "2024-03-31",
  "templateId": "template_id",
  "description": "Quarterly performance review"
}
```

#### 2. **Create Appraisal Template**
```bash
POST /api/appraisal/templates
{
  "name": "Standard Framework",
  "competencies": [
    {
      "name": "Communication",
      "proficiencyLevels": [
        { "level": 1, "label": "Developing" },
        { "level": 5, "label": "Master" }
      ]
    }
  ],
  "ratingLevels": [
    { "rating": "5-Exceptional", "scoreRange": { "min": 4.5, "max": 5 } },
    { "rating": "3-Meets", "scoreRange": { "min": 3, "max": 3.99 } }
  ]
}
```

#### 3. **Bulk Create Appraisals**
```bash
POST /api/appraisal/forms/create-batch
{
  "cycleId": "cycle_id",
  "employeeFilter": {}
}
```

#### 4. **Employee Submits Self-Assessment**
```bash
POST /api/appraisal/forms/{appraisalId}/self-assessment
{
  "competencies": [
    { "rating": 4, "selfComment": "Strong in this area" }
  ]
}
```

#### 5. **Manager Submits Rating**
```bash
POST /api/appraisal/forms/{appraisalId}/manager-rating
{
  "competencies": [
    { "rating": 4, "managerComment": "Exceeds expectations" }
  ],
  "overallPerformance": 4
}
```

#### 6. **Get Cycle Summary**
```bash
GET /api/appraisal/cycles/{cycleId}/summary
```
Response: Total, draft, submitted, approved counts + rating distribution

#### 7. **Calculate Salary Increment**
```bash
GET /api/hr-integration/salary-increment/{appraisalId}
```
Response: Current salary, increment %, new salary

#### 8. **Check Promotion Eligible**
```bash
GET /api/hr-integration/promotion-eligibility/{appraisalId}
```
Response: Eligible?, readiness level, recommended role

#### 9. **Generate Succession Plan**
```bash
GET /api/hr-integration/succession-plan/{cycleId}
```
Response: Ready now, ready in 1yr, high potential, not ready

#### 10. **Generate HR Action Items**
```bash
GET /api/hr-integration/action-items/{cycleId}
```
Response: Immediate, short-term, medium-term, long-term actions

---

### 📊 **Rating Scale**

| Rating | Score | Description |
|--------|-------|-------------|
| 5-Exceptional | 4.5-5.0 | Far exceeds expectations |
| 4-Exceeds | 4.0-4.49 | Exceeds expectations |
| 3-Meets | 3.0-3.99 | Meets expectations |
| 2-Below | 2.0-2.99 | Below expectations |
| 1-Unsatisfactory | 1.0-1.99 | Does not meet expectations |

---

### 💰 **Performance-Based Benefits**

#### Salary Increment (Default)
- 5-Exceptional: +10%
- 4-Exceeds: +8%
- 3-Meets: +5%
- 2-Below: +2%
- 1-Unsatisfactory: 0%

#### Bonus Percentage
- 5-Exceptional: 100% bonus
- 4-Exceeds: 75% bonus
- 3-Meets: 50% bonus
- 2-Below: 25% bonus
- 1-Unsatisfactory: 0% bonus

#### Leave Allocation
- 5-Exceptional: +5 days
- 4-Exceeds: +3 days
- 3-Meets: Standard
- 2-Below: -2 days
- 1-Unsatisfactory: -5 days

---

### 👥 **Promotion Readiness**

#### Ready Now
- Rating: 5-Exceptional or 4-Exceeds
- Tenure: ≥12 months
- Manager: Recommends
- Action: Process immediately

#### Ready in 1 Year
- Rating: 4-Exceeds or 3-Meets high end
- Potential demonstrated
- Action: Groom and develop

#### High Potential
- Rating: 3-Meets
- Shows promise
- Action: Monitor and guide

#### Not Ready
- Rating: 2-Below or below
- Action: Performance improvement plan

---

### 📈 **Export Formats**

#### Export as CSV
```bash
GET /api/appraisal/cycles/{cycleId}/export/csv
```
Fields: Employee, Department, Role, Ratings, Status, Final Score

#### Export as Excel
```bash
GET /api/appraisal/cycles/{cycleId}/export/excel
```
Multi-sheet report with competencies, scores, distributions

#### Export as JSON
```bash
GET /api/appraisal/cycles/{cycleId}/export/json
```
Structured data for external system integration

#### Calibration Report
```bash
GET /api/appraisal/cycles/{cycleId}/export/calibration
```
Distribution analysis, deviations from targets, adjustment recommendations

---

### 🎯 **Common Tasks**

#### Task 1: Annual Performance Review
```
1. Create cycle: POST /cycles
2. Create template: POST /templates
3. Bulk create appraisals: POST /forms/create-batch
4. Notify employees (manual or email)
5. Employees submit: POST /forms/{id}/self-assessment
6. Managers review: POST /forms/{id}/manager-rating
7. HR calibration: Manual or system validation
8. Close cycle: POST /cycles/{id}/close
9. Generate action items: GET /action-items/{cycleId}
10. Apply salary increments: POST /apply-salary-increments/{cycleId}
```

#### Task 2: Identify High Performers
```
1. Get cycle summary: GET /cycles/{cycleId}/summary
2. Generate succession plan: GET /succession-plan/{cycleId}
3. Review "ready now" candidates
4. Process promotions
5. Assign mentors/coaches
```

#### Task 3: Address Low Performers
```
1. Get action items: GET /action-items/{cycleId}
2. Review employees rated below expectations
3. Create Performance Improvement Plans
4. Schedule coaching/training
5. Monitor progress in next cycle
```

#### Task 4: Training Plan Development
```
1. Identify training needs: GET /training-needs/{cycleId}
2. Review by department
3. Prioritize top learning areas
4. Allocate budget
5. Enroll employees in programs
```

---

### 🔐 **Role-Based Access**

**Employee:**
- View own appraisal
- Complete self-assessment
- View own ratings (after approval)
- Access development plan

**Manager:**
- View team appraisals
- Complete manager ratings
- View team insights
- Monitor team development

**HR:**
- Full access to all appraisals
- Create cycles & templates
- View aggregated analytics
- Generate reports
- Process HR actions

**Admin:**
- Everything HR + system administration

---

### 📱 **Status Flow**

```
Draft
  ↓ (Employee completes)
Employee-Submitted
  ↓ (Manager completes)
Manager-Submitted
  ↓ (HR calibration/approval)
Approved
  ↓ (Optional: export/archive)
Archived
```

---

### ⚙️ **Configuration**

#### Update Company Settings
```bash
PUT /api/settings
{
  "incrementRules": {
    "5-Exceptional": 0.10,
    "4-Exceeds": 0.08
  },
  "promotionTenureMonths": 12,
  "bonusRules": {
    "5-Exceptional": 1.0,
    "4-Exceeds": 0.75
  }
}
```

---

### 📞 **Support Endpoints**

#### Get Cycle Details
```bash
GET /api/appraisal/cycles/{cycleId}
```

#### Get Appraisal Form
```bash
GET /api/appraisal/forms/{appraisalId}
```

#### Get Employee Insights
```bash
GET /api/appraisal/forms/{appraisalId}/insights
```

#### Get Templates
```bash
GET /api/appraisal/templates
```

#### Get My Appraisals
```bash
GET /api/appraisal/my-appraisals
```

---

### 🚦 **API Response Status Codes**

- `200`: Success - GET request
- `201`: Success - Resource created
- `400`: Bad request - Check parameters
- `401`: Unauthorized - Login required
- `403`: Forbidden - Insufficient permissions
- `404`: Not found - Resource doesn't exist
- `500`: Server error - Contact support

---

### 📋 **Key Fields in Each Model**

#### Appraisal
- Status: `draft` | `employee-submitted` | `manager-submitted` | `approved`
- Scores: `selfAssessmentScore`, `managerRatingScore`, `calibratedScore`, `finalRating`
- Ratings: `competencies[]`, `managerRating`, `employeeSelfRating`

#### Cycle
- Status: `planning` | `open` | `review` | `calibration` | `completed` | `closed`
- Dates: `startDate`, `endDate`, `submissionDeadline`, `reviewDeadline`

#### Template
- Competencies: Array of skills/behaviors to rate
- RatingLevels: 5-point or 4-point scales
- CalibrationSettings: Bell curve targets and distribution rules

---

### 💡 **Best Practices**

1. **Timing**: Allow 2-4 weeks for employees to complete self-assessments
2. **Communication**: Email reminders at each stage
3. **Calibration**: Review ratings distribution against targets
4. **Consistency**: Use same template across departments for fairness
5. **Documentation**: Managers should provide specific examples/evidence
6. **Feedback**: Share results with employees promptly
7. **Action**: Create development plans within 2 weeks of approval
8. **Follow-up**: Monitor progress quarterly

---

### ✅ **Checklist**

- [ ] Create appraisal template
- [ ] Configure company settings/rules
- [ ] Create appraisal cycle
- [ ] Communicate dates to employees
- [ ] Bulk create appraisal forms
- [ ] Monitor completion rates
- [ ] Conduct manager calibration
- [ ] Generate calibration report
- [ ] Approve final ratings
- [ ] Generate HR action items
- [ ] Apply salary increments
- [ ] Create development plans
- [ ] Schedule training
- [ ] Archive cycle

---

## 📚 **Complete Documentation Files**

1. **APPRAISAL_SYSTEM_DOCS.md** - Full system documentation
2. **HR_INTEGRATION_DOCS.md** - HR integration features
3. **APPRAISAL_API_TESTS.js** - API test suite
4. **This file** - Quick reference

---

**Version:** 2.0 | **Last Updated:** April 11, 2026 | **Status:** Production Ready
