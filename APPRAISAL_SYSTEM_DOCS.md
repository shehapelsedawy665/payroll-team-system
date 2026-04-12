## Performance Appraisal System - نظام تقييم الأداء الشامل

### Overview
A comprehensive performance appraisal system for managing employee evaluations, ratings, feedback, and development planning. This system supports:

- **Appraisal Cycles**: Create and manage evaluation periods
- **Templates**: Reusable competency and rating frameworks
- **Self-Assessment**: Employees rate themselves
- **Manager Ratings**: Managers evaluate their team members
- **360 Feedback**: Peer and upward feedback (optional)
- **Calibration**: HR ensures consistent rating standards
- **Development Plans**: Create personalized growth paths
- **Analytics**: Performance dashboards and insights

---

## Architecture

### Database Models

#### 1. **AppraisalCycle**
Defines the appraisal period and configuration.
```javascript
{
  companyId: ObjectId,
  name: String,
  startDate: Date,
  endDate: Date,
  templateId: ObjectId,
  status: 'pending' | 'active' | 'closed',
  description: String,
  completionPercentage: Number
}
```

#### 2. **AppraisalTemplate**
Reusable templates with competencies and rating scales.
```javascript
{
  companyId: ObjectId,
  name: String,
  competencies: [{
    name: String,
    category: String,
    proficiencyLevels: [{
      level: Number,
      label: String,
      description: String
    }],
    weight: Number
  }],
  ratingLevels: [{
    rating: String,
    label: String,
    scoreRange: { min: Number, max: Number }
  }],
  calibrationSettings: {
    enabled: Boolean,
    targetDistribution: {
      exceptional: Number,
      exceeds: Number,
      meets: Number,
      below: Number,
      unsatisfactory: Number
    }
  }
}
```

#### 3. **Appraisal**
Individual appraisal form for each employee.
```javascript
{
  companyId: ObjectId,
  cycleId: ObjectId,
  employeeId: ObjectId,
  managerId: ObjectId,
  templateId: ObjectId,
  
  // Self-assessment
  employeeSelfRating: {
    submittedAt: Date,
    competencies: [{
      competencyName: String,
      rating: Number,
      selfComment: String
    }]
  },
  
  // Manager's assessment
  managerRating: {
    submittedAt: Date,
    competencies: [{
      competencyName: String,
      rating: Number,
      managerComment: String
    }],
    overallPerformance: Number
  },
  
  // Scores
  scores: {
    selfAssessmentScore: Number,
    managerRatingScore: Number,
    calibratedScore: Number,
    finalRating: String
  },
  
  status: 'draft' | 'employee-submitted' | 'manager-submitted' | 'approved',
  developmentPlan: {}
}
```

---

## API Endpoints

### Appraisal Cycles

#### Create Cycle
```http
POST /api/appraisal/cycles
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Q4 2024 Review",
  "startDate": "2024-10-01",
  "endDate": "2024-12-31",
  "templateId": "template_id",
  "description": "Year-end performance review"
}
```

#### Get All Cycles
```http
GET /api/appraisal/cycles
Authorization: Bearer {token}
```

#### Get Specific Cycle
```http
GET /api/appraisal/cycles/{cycleId}
Authorization: Bearer {token}
```

#### Update Cycle
```http
PUT /api/appraisal/cycles/{cycleId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Updated Name",
  "endDate": "2024-12-15"
}
```

#### Close Cycle
```http
POST /api/appraisal/cycles/{cycleId}/close
Authorization: Bearer {token}
```

---

### Appraisal Templates

#### Create Template
```http
POST /api/appraisal/templates
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Manager Competencies",
  "competencies": [
    {
      "name": "Leadership",
      "category": "behavioral",
      "proficiencyLevels": [
        { "level": 1, "label": "Developing" },
        { "level": 2, "label": "Competent" },
        { "level": 3, "label": "Proficient" },
        { "level": 4, "label": "Expert" },
        { "level": 5, "label": "Master" }
      ]
    }
  ],
  "ratingLevels": [
    { "rating": "5-Exceptional", "scoreRange": { "min": 4.5, "max": 5 } },
    { "rating": "4-Exceeds", "scoreRange": { "min": 4, "max": 4.49 } },
    { "rating": "3-Meets", "scoreRange": { "min": 3, "max": 3.99 } }
  ]
}
```

#### Get Templates
```http
GET /api/appraisal/templates
Authorization: Bearer {token}
```

#### Update Template
```http
PUT /api/appraisal/templates/{templateId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Updated Template Name",
  "competencies": [...]
}
```

---

### Appraisal Forms

#### Create Batch Appraisals
```http
POST /api/appraisal/forms/create-batch
Content-Type: application/json
Authorization: Bearer {token}

{
  "cycleId": "cycle_id",
  "employeeFilter": {}
}
```

#### Get Appraisal Form
```http
GET /api/appraisal/forms/{appraisalId}
Authorization: Bearer {token}
```

#### Submit Self-Assessment
```http
POST /api/appraisal/forms/{appraisalId}/self-assessment
Content-Type: application/json
Authorization: Bearer {token}

{
  "competencies": [
    {
      "rating": 4,
      "selfComment": "I demonstrated good leadership"
    }
  ],
  "strengthsIdentified": "...",
  "areasForDevelopment": "..."
}
```

#### Submit Manager Rating
```http
POST /api/appraisal/forms/{appraisalId}/manager-rating
Content-Type: application/json
Authorization: Bearer {token}

{
  "competencies": [
    {
      "rating": 4,
      "managerComment": "Performed well",
      "evidenceProvided": "Led project X successfully"
    }
  ],
  "overallPerformance": 4,
  "strengths": "...",
  "developmentAreas": "..."
}
```

#### Get Appraisals by Cycle
```http
GET /api/appraisal/cycles/{cycleId}/appraisals?status=manager-submitted
Authorization: Bearer {token}
```

#### Get My Appraisals
```http
GET /api/appraisal/my-appraisals?cycleId={cycleId}
Authorization: Bearer {token}
```

#### Get Cycle Summary
```http
GET /api/appraisal/cycles/{cycleId}/summary
Authorization: Bearer {token}
```

---

## Frontend Usage

### Initialize the Appraisal Manager
```javascript
let appraisalManager = new AppraisalManager();
```

### Load Cycles
```javascript
await appraisalManager.loadCycles();
```

### Create New Cycle
```javascript
appraisalManager.showNewCycleModal();
```

### Open Appraisal Form
```javascript
appraisalManager.openAppraisal(appraisalId);
```

### Submit Self-Assessment
```javascript
appraisalManager.submitSelfAssessment();
```

### Submit Manager Rating
```javascript
appraisalManager.submitManagerRating();
```

---

## Appraisal Engine Logic

The `appraisalEngine.js` contains core scoring and calculation logic:

### Calculate Scores
```javascript
const scores = calculateAppraisalScores(appraisal);
// Returns: { selfAssessmentScore, managerRatingScore, calibratedScore, finalRating }
```

### Calibrated Score (Weighted Average)
- Manager Rating: 50%
- Self-Assessment: 20%
- Peer Feedback: 20%
- Overall Performance: 10%

### Rating Scale
```
5 (4.5-5.0): Exceptional
4 (4.0-4.49): Exceeds Expectations
3 (3.0-3.99): Meets Expectations
2 (2.0-2.99): Below Expectations
1 (1.0-1.99): Unsatisfactory
```

### Validate Distribution
```javascript
const distribution = validateRatingDistribution(ratings, template);
// Checks if ratings follow bell curve constraints
```

### Calculate Performance Trend
```javascript
const trend = calculatePerformanceTrend(appraisals);
// Returns: { trend: 'improving' | 'stable' | 'declining', scores: [] }
```

### Generate Insights
```javascript
const insights = generateEmployeeInsights(appraisal);
// Returns: { performanceLevel, riskCategory, promotionReadiness }
```

---

## Workflow

### 1. **Setup Phase**
- Create appraisal template with competencies
- Create appraisal cycle with dates and template

### 2. **Distribution Phase**
- Create appraisal forms for all employees
- Notify employees and managers

### 3. **Self-Assessment Phase**
- Employees rate themselves on competencies
- Employees provide self-evaluation comments

### 4. **Manager Review Phase** 
- Managers access employee self-assessments
- Managers rate competencies with evidence
- Managers provide development recommendations

### 5. **360 Feedback Phase** (Optional)
- Peers provide feedback
- Upward feedback collected
- Anonymous feedback compiled

### 6. **Calibration Phase**
- HR reviews all ratings
- Ensures consistency and bell curve adherence
- Adjusts ratings if needed

### 7. **Approval Phase**
- Final ratings approved
- Development plans created
- Results communicated

---

## Key Features

### 1. **Flexible Competency Framework**
- Define competencies across categories (technical, behavioral, leadership)
- Custom proficiency levels for each competency
- Weighted competency scoring

### 2. **Multi-Rater Feedback**
- Self-assessment
- Manager rating (primary)
- 360 feedback (peer, upward, optional)
- Round-robin scoring

### 3. **Automated Scoring**
- Calculate composite scores from multiple inputs
- Apply organizational weights
- Map scores to rating levels
- Validate distribution curves

### 4. **Calibration Management**
- Review inconsistent ratings
- Apply bell curve constraints
- Ensure fair and consistent evaluations
- Override ratings with justification

### 5. **Development Planning**
- Identify training needs
- Create personalized development plans
- Assign mentors/coaches
- Track progress

### 6. **Performance Analytics**
- Dashboard with completion rates
- Rating distribution charts
- Top performers identification
- At-risk employee alerts
- Trend analysis across cycles

### 7. **Data Security**
- Role-based access control
- Users see only their data
- Managers see their team's evaluations
- HR/Admins see all data
- Audit trail for all changes

---

## Role Permissions

### Employee
- View own appraisal forms
- Complete self-assessments
- View own final ratings
- Access development plans

### Manager
- View team's appraisal forms
- Complete manager ratings
- View calibration results
- Access team analytics

### HR/Admin
- Create cycles and templates
- Activate cycles
- View all appraisals
- Perform calibration
- Generate reports
- Import/export data

---

## Database Indexes

For optimal performance:
```javascript
// AppraisalCycle indexes
db.appraisalcycles.createIndex({ companyId: 1, status: 1 })
db.appraisalcycles.createIndex({ startDate: 1, endDate: 1 })

// AppraisalTemplate indexes
db.appraisaltemplates.createIndex({ companyId: 1, isActive: 1 })
db.appraisaltemplates.createIndex({ companyId: 1, isDefault: 1 })

// Appraisal indexes
db.appraisals.createIndex({ employeeId: 1, cycleId: 1 }, { unique: true })
db.appraisals.createIndex({ cycleId: 1, status: 1 })
db.appraisals.createIndex({ managerId: 1, status: 1 })
```

---

## Common Use Cases

### 1. Running Year-End Review
1. Create template with company competencies
2. Create cycle for Q4 with start/end dates
3. Create batch appraisals for all employees
4. Notify employees of start date
5. Employees complete self-assessments
6. Managers complete ratings
7. HR performs calibration
8. Close cycle and generate reports

### 2. Identifying High Performers
```javascript
const topPerformers = appraisals.filter(a => 
  ['5-Exceptional', '4-Exceeds'].includes(a.scores.finalRating)
);
```

### 3. Creating Development Plans
1. Filter employees rated below expectations
2. Create development plans with training
3. Assign mentors
4. Track progress in next cycle

### 4. Monitoring Trends
```javascript
const trends = appraisals.map(a => 
  calculatePerformanceTrend(a.previousCycles)
);
```

---

## Customization

### Custom Rating Scale
Edit template to use 4-point or custom scales:
```javascript
ratingScale: '4-point'
ratingLevels: [
  { rating: '4', label: 'Exceeds', scoreRange: { min: 4, max: 4 } },
  { rating: '3', label: 'Meets', scoreRange: { min: 3, max: 3.99 } },
  // ...
]
```

### Custom Competencies
Add company-specific competencies in template:
```javascript
competencies: [
  { name: 'Innovation', category: 'technical' },
  { name: 'Customer Focus', category: 'behavioral' },
  { name: 'Strategic Thinking', category: 'leadership' }
]
```

### Custom Distribution Targets
Configure bell curve for your organization:
```javascript
targetDistribution: {
  exceptional: 10,  // 10% "Exceptional"
  exceeds: 20,      // 20% "Exceeds"
  meets: 60,        // 60% "Meets"
  below: 8,         // 8% "Below"
  unsatisfactory: 2 // 2% "Unsatisfactory"
}
```

---

## Error Handling

The system handles:
- Missing required fields
- Duplicate appraisals for same cycle
- Unauthorized access attempts
- Invalid score ranges
- Database connection errors

All errors return JSON with status codes:
```javascript
{
  error: "Error message",
  status: 400 | 401 | 403 | 404 | 500
}
```

---

## Performance Considerations

- Indexes on companyId, cycleId, employeeId, status
- Lazy load templates and cycles
- Cache rating mappings
- Paginate large result sets
- Archive old cycles to reduce data volume

---

## Future Enhancements

- [ ] PDF export for appraisal forms
- [ ] Email notifications at each workflow stage
- [ ] Succession planning integration
- [ ] Multi-language support
- [ ] Mobile app for managers
- [ ] Real-time collaboration on ratings
- [ ] Integration with learning management systems
- [ ] Skill gap analysis
- [ ] Compensation recommendation engine

---

## Support

For issues or questions about the appraisal system:
1. Check API response errors
2. Review console logs for details
3. Verify user permissions
4. Ensure data consistency
5. Contact HR development team

---

## License

© 2024 Payroll System. All rights reserved.
