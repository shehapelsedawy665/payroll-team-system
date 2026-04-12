# Recruitment & Onboarding System Documentation

## System Overview

The Recruitment & Onboarding System is a comprehensive module for managing the complete hiring lifecycle, from job posting through employee onboarding. This system enables HR teams to efficiently manage job openings, track candidates through the hiring pipeline, create offers, and ensure smooth onboarding of new employees.

**Status:** ✅ Production Ready  
**Version:** 2.0  
**Last Updated:** April 11, 2026

---

## Table of Contents

1. [Architecture](#architecture)
2. [Database Models](#database-models)
3. [API Endpoints](#api-endpoints)
4. [Business Logic](#business-logic)
5. [Frontend Interface](#frontend-interface)
6. [Quick Start Guide](#quick-start-guide)
7. [Workflows](#workflows)
8. [Analytics & Reporting](#analytics--reporting)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│         Frontend (HTML/CSS/JavaScript)                   │
│  ├─ recruitment.html      (Job postings, candidates)    │
│  ├─ js/recruitment.js     (Client-side logic)           │
│  └─ css/recruitment.css   (Styling)                     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│      API Routes (Express.js)                             │
│  ├─ routes/recruitment.js (Job, candidate, offer APIs) │
│  └─ routes/onboarding.js  (Onboarding task APIs)       │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│    Business Logic Engines                                │
│  ├─ backend/logic/recruitmentEngine.js                  │
│  └─ backend/logic/onboardingEngine.js                   │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│        Database Models                                   │
│  ├─ JobPosting                                          │
│  ├─ Candidate                                           │
│  ├─ Offer                                               │
│  ├─ OnboardingTask                                      │
│  └─ OnboardingChecklist                                 │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

**Recruitment Pipeline:**
```
Create Job → Publish → Receive Applications → Screening → 
Interviews → Offer → Accept → Onboard → Complete
```

---

## Database Models

### 1. JobPosting Model

**Purpose:** Stores job opening information and tracks applicants

**Schema:**
```javascript
{
  companyId: ObjectId,           // Reference to company
  department: String,             // e.g., "Engineering"
  jobTitle: String,              // e.g., "Senior Developer"
  description: String,           // Full job description
  requirements: [String],        // Required qualifications
  skills: [String],              // Required skills (for matching)
  experience: Enum,              // Entry/Mid/Senior/Lead/Executive
  salaryRange: {
    min: Number,
    max: Number,
    currency: String
  },
  jobType: Enum,                 // Full-time/Part-time/Contract
  location: String,
  remote: Boolean,
  status: Enum,                  // draft/active/paused/closed/filled
  postedDate: Date,
  closingDate: Date,
  applicantsCount: Number,
  hiringManager: ObjectId,       // Reference to User
  createdBy: ObjectId,           // Reference to User
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `(companyId, status)` - Fast filtering by company and status
- `department` - Quick department lookups
- `createdAt` - Recent postings

### 2. Candidate Model

**Purpose:** Tracks job applicants and their progress through the hiring pipeline

**Schema:**
```javascript
{
  companyId: ObjectId,
  jobPostingId: ObjectId,        // Reference to JobPosting
  firstName: String,
  lastName: String,
  email: String,                 // Unique per application
  phone: String,
  location: String,
  resume: String,                // URL or file path
  resumeText: String,            // Extracted text for search
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
    currency: String
  },
  noticePeriod: Enum,            // Immediate/15 Days/1-3 Months
  stage: Enum,                   // Applied/Screening/Interview1-3/Offer/Accepted/Rejected
  pipelineHistory: [{
    stage: String,
    timestamp: Date,
    comments: String,
    ratedBy: ObjectId
  }],
  rating: {
    skillsMatch: Number,         // 1-5
    culturalFit: Number,         // 1-5
    overallScore: Number,        // 1-5
    comments: String
  },
  interviews: [{
    interviewDate: Date,
    interviewer: ObjectId,
    type: String,
    feedback: String,
    rating: Number
  }],
  appliedDate: Date,
  source: Enum,                  // Direct Apply/Referral/Job Portal/Recruiter/LinkedIn
  lastUpdated: Date,
  createdAt: Date
}
```

**Indexes:**
- `(companyId, jobPostingId)` - All candidates for a job
- `email` - Prevent duplicate applications
- `stage` - Filter by pipeline stage
- `createdAt` - Recent applications

### 3. Offer Model

**Purpose:** Manages job offers and acceptance/rejection tracking

**Schema:**
```javascript
{
  companyId: ObjectId,
  candidateId: ObjectId,         // Reference to Candidate
  jobPostingId: ObjectId,
  candidateName: String,
  candidateEmail: String,
  jobTitle: String,
  department: String,
  offerDate: Date,
  expiryDate: Date,              // Auto-calculate: +7 days from creation
  status: Enum,                  // Draft/Sent/Accepted/Rejected/Withdrawn/Expired
  compensation: {
    baseSalary: {
      amount: Number,
      currency: String,
      frequency: Enum              // Monthly/Annual
    },
    bonus: Number,
    allowances: [{
      name: String,
      amount: Number
    }],
    benefits: [String],
    totalPackage: Number          // Calculated total
  },
  joinDate: Date,
  reportingTo: ObjectId,         // Manager ID
  employmentType: Enum,          // Permanent/Contract/Internship
  contractTerm: {
    months: Number,
    autoRenewal: Boolean
  },
  conditions: [{
    description: String,
    required: Boolean
  }],
  acceptanceDate: Date,
  rejectionDate: Date,
  rejectionReason: String,
  createdBy: ObjectId,
  approvedBy: ObjectId,
  approvalDate: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `(companyId, status)` - Filter offer status
- `candidateId` - Offers for a candidate
- `expiryDate` - Track expiring offers

### 4. OnboardingTask Model

**Purpose:** Templates for standardized onboarding tasks

**Schema:**
```javascript
{
  companyId: ObjectId,
  name: String,                  // e.g., "IT Equipment Setup"
  description: String,
  category: Enum,                // IT Setup/Documentation/Training/Orientation/System Access/Compliance/Other
  priority: Enum,                // Critical/High/Medium/Low
  daysDueAfterJoining: Number,  // Default: 1
  assignedTo: ObjectId,          // Default handler
  isTemplate: Boolean,           // Always true for this model
  department: String,            // Optional: specific department
  jobLevel: String,              // Optional: entry/mid/senior
  createdAt: Date
}
```

**Indexes:**
- `(companyId, isTemplate)` - Get all templates for company
- `category` - Filter by task category

### 5. OnboardingChecklist Model

**Purpose:** Instance of onboarding for a specific new employee

**Schema:**
```javascript
{
  companyId: ObjectId,
  employeeId: ObjectId,          // Reference to Employee
  offerAcceptanceDate: Date,
  joiningDate: Date,
  expectedCompletionDate: Date,  // Usually joining date + 30 days
  completionPercentage: Number,  // 0-100
  status: Enum,                  // Not Started/In Progress/Completed/On Hold
  tasks: [{
    taskId: ObjectId,            // Reference to task template
    taskName: String,
    category: String,
    priority: String,
    dueDate: Date,               // Calculated from joining date
    assignedTo: ObjectId,
    assignedToName: String,
    completed: Boolean,
    completedDate: Date,
    completedBy: ObjectId,
    comments: String
  }],
  manager: ObjectId,             // Employee's manager
  hrContact: ObjectId,           // HR representative
  feedback: String,
  finalReview: {
    reviewedBy: ObjectId,
    reviewDate: Date,
    feedback: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `(companyId, employeeId)` - Get checklist for employee
- `status` - Filter by completion status
- `joiningDate` - Recent hires

---

## API Endpoints

### Job Postings

#### POST /api/recruitment/job-postings
Create a new job posting (HR only)

**Request:**
```json
{
  "jobTitle": "Senior Software Engineer",
  "department": "Engineering",
  "description": "Looking for experienced developer...",
  "experience": "Senior",
  "salaryRange": { "min": 15000, "max": 25000 },
  "requirements": ["5+ years experience", "Node.js"],
  "skills": ["JavaScript", "Node.js", "MongoDB"],
  "jobType": "Full-time",
  "location": "Riyadh"
}
```

**Response:**
```json
{
  "success": true,
  "jobPosting": { ... },
  "message": "Job posting created successfully"
}
```

#### GET /api/recruitment/job-postings
Retrieve all job postings with filters

**Query Parameters:**
- `status` - Filter by status (draft/active/closed/filled)
- `department` - Filter by department

**Response:**
```json
{
  "success": true,
  "count": 5,
  "jobPostings": [...]
}
```

#### GET /api/recruitment/job-postings/:id
Get job posting details with pipeline summary

**Response:**
```json
{
  "success": true,
  "jobPosting": { ... },
  "pipelineSummary": {
    "totalCandidates": 45,
    "Applied": 30,
    "Screening": 10,
    "Interview1": 3,
    "Accepted": 2,
    "conversionRate": "4.44%"
  }
}
```

#### PUT /api/recruitment/job-postings/:id
Update job posting

#### POST /api/recruitment/job-postings/:id/publish
Publish draft job posting

#### POST /api/recruitment/job-postings/:id/close
Close job posting to new applications

---

### Candidates

#### POST /api/recruitment/candidates
Submit job application (public endpoint - no auth needed)

**Request:**
```json
{
  "jobPostingId": "...",
  "firstName": "Ahmed",
  "lastName": "Hassan",
  "email": "ahmed@example.com",
  "phone": "+966501234567",
  "skills": ["JavaScript", "React", "Node.js"],
  "experience": { "years": 5, "description": "..." },
  "expectedSalary": { "min": 15000, "max": 20000 }
}
```

#### GET /api/recruitment/job-postings/:jobId/candidates
Get all candidates for a job

**Response:**
```json
{
  "success": true,
  "count": 45,
  "candidates": [...]
}
```

#### GET /api/recruitment/job-postings/:jobId/candidates/ranked
Get ranked candidates (by skill match, experience, salary fit)

**Response:**
```json
{
  "success": true,
  "jobTitle": "Senior Developer",
  "totalCandidates": 45,
  "candidates": [
    {
      "candidateId": "...",
      "candidateName": "Ahmed Hassan",
      "overallScore": 4.5,
      "recommendation": "Strong Match - Prioritize",
      "skillMatch": { "matchPercentage": 90, "matchedSkills": [...] },
      "experienceMatch": { "score": 5 },
      "salaryFit": { "fit": "Within Budget" }
    }
  ]
}
```

#### GET /api/recruitment/candidates/:id
Get candidate details with skill analysis

**Response:**
```json
{
  "success": true,
  "candidate": { ... },
  "score": { ... }
}
```

#### PUT /api/recruitment/candidates/:id/stage
Move candidate through pipeline

**Request:**
```json
{
  "stage": "Interview1",
  "comments": "Passed initial screening"
}
```

#### POST /api/recruitment/candidates/:id/rate
Rate candidate on various criteria

**Request:**
```json
{
  "skillsMatch": 5,
  "culturalFit": 4,
  "comments": "Excellent technical skills..."
}
```

---

### Offers

#### POST /api/recruitment/offers
Create job offer (HR only)

**Request:**
```json
{
  "candidateId": "...",
  "jobPostingId": "...",
  "compensation": {
    "baseSalary": { "amount": 20000 },
    "bonus": 15,
    "allowances": [
      { "name": "Housing", "amount": 3000 },
      { "name": "Transportation", "amount": 1500 }
    ]
  },
  "joinDate": "2026-05-15"
}
```

#### GET /api/recruitment/offers
Get all offers with status filtering

**Query Parameters:**
- `status` - Draft/Sent/Accepted/Rejected

#### PUT /api/recruitment/offers/:id/send
Send offer to candidate (HR only)

#### PUT /api/recruitment/offers/:id/accept
Accept offer (candidate endpoint)

#### PUT /api/recruitment/offers/:id/reject
Reject offer (candidate endpoint)

**Request:**
```json
{
  "reason": "Accepted another position"
}
```

---

### Recruitment Analytics

#### GET /api/recruitment/job-postings/:id/pipeline
Get hiring pipeline breakdown for a job

**Response:**
```json
{
  "success": true,
  "pipeline": {
    "jobPostingId": "...",
    "totalCandidates": 45,
    "activeCount": 8,
    "acceptedCount": 2,
    "rejectedCount": 20,
    "pipelineBreakdown": {
      "Applied": 30,
      "Screening": 10,
      "Interview1": 3,
      "Interview2": 1,
      "Offer": 1,
      "Accepted": 0,
      "Rejected": 20
    },
    "conversionRate": "0%"
  }
}
```

#### GET /api/recruitment/job-postings/:id/top-candidates
Get top 5 candidates for a job (filtered by stage)

#### GET /api/recruitment/job-postings/:id/time-to-hire
Get time-to-hire metrics

**Response:**
```json
{
  "success": true,
  "totalHires": 2,
  "averageTimeToHire": 45,
  "candidates": [
    { "candidateName": "Ahmed Hassan", "daysTaken": 42 },
    { "candidateName": "Fatima Khan", "daysTaken": 48 }
  ]
}
```

---

### Onboarding Tasks

#### POST /api/onboarding/tasks
Create onboarding task template (HR/Manager only)

**Request:**
```json
{
  "name": "IT Equipment Setup",
  "description": "Provide laptop, mouse, keyboard...",
  "category": "IT Setup",
  "priority": "Critical",
  "daysDueAfterJoining": 1,
  "department": "Engineering"
}
```

#### GET /api/onboarding/tasks
Get all task templates

**Query Parameters:**
- `category` - Filter by category
- `department` - Filter by department

#### PUT /api/onboarding/tasks/:id
Update task template

#### DELETE /api/onboarding/tasks/:id
Delete task template

---

### Onboarding Checklists

#### POST /api/onboarding/checklists
Create onboarding checklist for new employee (HR/Manager only)

**Request:**
```json
{
  "employeeId": "...",
  "joiningDate": "2026-05-15"
}
```

**Response:**
```json
{
  "success": true,
  "checklistId": "...",
  "taskCount": 12,
  "message": "Onboarding checklist created with 12 tasks"
}
```

#### GET /api/onboarding/checklists/:employeeId
Get onboarding checklist for employee

#### GET /api/onboarding/progress/:employeeId
Get detailed progress on onboarding

**Response:**
```json
{
  "success": true,
  "employeeId": "...",
  "status": "In Progress",
  "completionPercentage": 58,
  "daysElapsed": 15,
  "daysRemaining": 15,
  "totalTasks": 12,
  "completedTasks": 7,
  "overdueTasks": 1,
  "tasksByCategory": {
    "IT Setup": [...],
    "Training": [...],
    "Documentation": [...]
  },
  "upcomingTasks": [...]
}
```

#### PUT /api/onboarding/checklists/:checklistId/tasks/:taskId
Mark onboarding task as completed

**Request:**
```json
{
  "comments": "Provided Dell laptop and peripherals"
}
```

#### POST /api/onboarding/checklists/:checklistId/custom-task
Add custom task to checklist

**Request:**
```json
{
  "taskName": "Team introduction",
  "category": "Orientation",
  "priority": "High",
  "daysDue": 2
}
```

#### GET /api/onboarding/pending-tasks
Get all pending onboarding tasks grouped by category

#### GET /api/onboarding/completion-rate
Get onboarding completion statistics

**Query Parameters:**
- `months` - Last N months (default: 3)

**Response:**
```json
{
  "success": true,
  "completionRate": "85.5%",
  "completedChecklists": 17,
  "totalChecklists": 20,
  "averageDaysToComplete": 28,
  "period": "Last 3 months"
}
```

#### GET /api/onboarding/summary
Get onboarding dashboard summary

**Response:**
```json
{
  "success": true,
  "summary": {
    "newEmployeesThisMonth": 4,
    "completedThisMonth": 3,
    "inProgress": 2,
    "overdue": 1,
    "atRisk": 0
  },
  "thisMonthCompletionRate": "75%"
}
```

---

## Business Logic

### RecruitmentEngine

Located in `backend/logic/recruitmentEngine.js`

#### calculateSkillMatch(candidate, jobPosting)
Analyze skill overlap between candidate and job requirements

**Returns:**
```javascript
{
  matchPercentage: 85,           // 0-100%
  matchedSkills: ["JavaScript", "Node.js"],
  missingSkills: ["React"],
  score: 5                       // 1-5 scale
}
```

#### calculateExperienceMatch(candidate, jobPosting)
Evaluate candidate experience against job level requirement

#### calculateSalaryFit(candidate, jobPosting)
Check salary expectation against job budget

#### generateCandidateScore(candidate, jobPosting)
Comprehensive ranking (50% skills, 30% experience, 20% salary)

**Returns:**
```javascript
{
  overallScore: 4.5,             // 1-5
  recommendation: "Strong Match - Prioritize",
  skillMatch: { ... },
  experienceMatch: { ... },
  salaryFit: { ... },
  breakdown: { skills: "2.5", experience: "1.5", salary: "1.0" }
}
```

#### moveToNextStage(candidateId, newStage, comments, ratedBy)
Transition candidate through pipeline with history tracking

#### rankCandidatesForJob(jobPostingId)
Sort all candidates by composite score

#### getHiringPipelineSummary(jobPostingId)
Pipeline breakdown and conversion metrics

#### getTopCandidates(jobPostingId, limit=5)
Get highest-scoring candidates in active stages

#### calculateTimeToHire(jobPostingId)
Average days from application to acceptance

### OnboardingEngine

Located in `backend/logic/onboardingEngine.js`

#### createOnboardingChecklist(employeeId, joiningDate, companyId)
Initialize checklist with all relevant tasks based on department

#### completeOnboardingTask(checklistId, taskId, completedBy, comments)
Mark task complete and update progress percentage

#### getOnboardingProgress(employeeId)
Detailed progress with task breakdown by category

#### getPendingTasksByCategory(companyId)
All incomplete tasks grouped by category with urgency

#### getOnboardingCompletionRate(companyId, monthsBack=3)
Historical completion statistics and average time-to-complete

#### addCustomTask(checklistId, taskName, category, priority, daysDue, assignedTo)
Add ad-hoc task to specific onboarding

#### getOnboardingSummary(companyId)
HR dashboard metrics (new hires, completed, at-risk)

---

## Frontend Interface

### Recruitment Dashboard
**File:** `public/recruitment.html`

**Features:**
- Job posting management (CRUD)
- Candidate pipeline with drag-and-drop
- Ranking and skill match visualization
- Offer management
- Analytics and reporting
- Onboarding progress tracking

**Tabs:**
1. **Job Postings** - Create, publish, manage openings
2. **Candidates** - View applications, stage candidates, rate skills
3. **Offers** - Create and track job offers
4. **Onboarding** - Monitor new hire checklist progress
5. **Analytics** - Pipeline, time-to-hire, hiring metrics

### JavaScript Class: RecruitmentManager
**File:** `public/js/recruitment.js`

Handles all client-side logic for recruitment operations:
- `loadJobs()` - Fetch all job postings
- `createJob()` - Submit new job posting
- `loadCandidates()` - Fetch candidates with filters
- `showCandidateDetail()` - Load candidate profile
- `updateCandidateStage()` - Move through pipeline
- `createOffer()` - Generate job offer
- `loadOnboarding()` - Display onboarding metrics
- `loadAnalytics()` - Show recruitment analytics

### Styling
**File:** `public/css/recruitment.css`

Responsive design with:
- Job cards with status badges
- Candidate list with skill visualization
- Pipeline stage charts
- Offer cards with compensation display
- Onboarding progress indicators
- Mobile-optimized breakpoints

---

## Quick Start Guide

### For HR: Creating Job Posting

1. **Navigate to Job Postings tab**
2. **Click "+ New Job Posting"**
3. **Fill in details:**
   - Job Title (e.g., "Senior Developer")
   - Department
   - Description
   - Experience Level
   - Salary Range
4. **Click Create**
5. **Publish job** (changes status from draft to active)
6. **Monitor applicants**

### For HR: Managing Candidates

1. **Go to Candidates tab**
2. **View applications** by job or all
3. **Click "View"** on candidate
4. **Review:**
   - Skills match (%)
   - Experience fit
   - Salary alignment
5. **Move to next stage:**
   - Screening → Interview1 → Interview2 → Offer
   - Or Rejected if not fit
6. **Rate candidate** on skills and cultural fit

### For HR: Creating Offer

1. **Go to Offers tab**
2. **Click "+ Create Offer"**
3. **Select candidate** (usually in Interview2 stage)
4. **Enter compensation:**
   - Base salary
   - Bonus percentage
   - Join date
5. **Click Create Offer**
6. **Send to candidate** (changes to "Sent" status)
7. **Track acceptance** (auto-moves candidate to "Accepted")

### For HR: Onboarding New Hire

1. **When offer accepted**, system auto-creates onboarding checklist
2. **Go to Onboarding tab**
3. **View tasks by category:**
   - IT Setup (priority: day 1)
   - Training (priority: week 1)
   - Orientation (priority: day 1)
4. **Complete tasks** as they're done
5. **Progress updates** automatically calculated
6. **Get alerts** on overdue or at-risk checklists

---

## Workflows

### Complete Hiring Workflow

```
1. JOB CREATION
   ├─ HR creates job posting (draft)
   ├─ Optionally add requirements/skills
   └─ Save as template for repeatability

2. JOB PUBLISHING
   ├─ HR publishes job (status: active)
   ├─ Set 30-day posting window
   └─ Job visible to applicants

3. APPLICATION SUBMISSION
   ├─ Candidate visits career page
   ├─ Submits application
   ├─ System auto-calculates skill match
   └─ HR notified of new application

4. SCREENING
   ├─ HR reviews candidate
   ├─ Views skill match analysis
   ├─ Decides: Move to Interview or Reject
   └─ Candidate receives status update

5. INTERVIEW PROCESS
   ├─ First Interview
   │  ├─ Interviewer conducts meeting
   │  ├─ Provides feedback and rating
   │  └─ System tracks in pipeline history
   ├─ Second Interview
   │  └─ Additional evaluation
   └─ Final Decision
      ├─ Move to Offer or Reject
      └─ Provide feedback to candidate

6. OFFER STAGE
   ├─ HR creates job offer
   │  └─ Defines compensation package
   ├─ HR sends offer to candidate
   ├─ Candidate reviews (7-day window)
   └─ Candidate accepts or rejects

7. ACCEPTANCE
   ├─ Offer status: Accepted
   ├─ System moves candidate to "Accepted"
   ├─ Employee record pre-created
   └─ Onboarding checklist auto-generated

8. ONBOARDING
   ├─ Tasks assigned by category
   ├─ IT Setup: Day 1 (laptop, access)
   ├─ Training: Week 1-2 (systems, process)
   ├─ Orientation: Day 1-3 (team, office)
   ├─ Each task tracked with completion
   └─ Manager monitors progress

9. COMPLETION
   ├─ All tasks marked complete
   ├─ Final HR review
   ├─ Onboarding closed
   └─ Employee ready for work
```

### Pipeline Stages

```
Applied (100%)
  ├─ Screening (50%)        [50% pass initial review]
  ├─ Interview1 (30%)       [60% pass first interview]
  ├─ Interview2 (15%)       [50% pass second interview]
  ├─ Offer (10%)            [67% accept offer]
  └─ Accepted (7%)          [70% reach this stage]
```

---

## Analytics & Reporting

### Key Metrics Tracked

1. **Pipeline Metrics**
   - Total applicants per job
   - Breakdown by stage
   - Conversion rate (applications → hires)
   - Funnel analysis

2. **Time Metrics**
   - Days from application to offer
   - Days from offer to acceptance
   - Average time-to-hire by department

3. **Quality Metrics**
   - Average skill match score
   - Candidate retention (are they successful)
   - Top referral sources

4. **Onboarding Metrics**
   - Completion rate (% completing within 30 days)
   - Average time-to-complete
   - Task completion by category
   - At-risk checklists (30+ days, <50% complete)

### Reports Available

1. **Pipeline Report** - Current status by job/department
2. **Candidate Ranking Report** - Scored candidates for comparison
3. **Time-to-Hire Report** - Efficiency metrics over time
4. **Onboarding Report** - Completion and success rates
5. **Recruitment Dashboard** - Real-time metrics and alerts

---

## Security & Access Control

### Role-Based Access

- **HR/Admin**
  - Create and publish jobs
  - Manage candidates (all stages)
  - Create and send offers
  - Manage onboarding tasks and checklists
  - View all analytics

- **Manager**
  - View candidates in their department
  - Conduct interviews
  - Rate candidates
  - Monitor team onboarding

- **Candidate** (Public)
  - Submit application to jobs
  - Accept/reject offer
  - View offer details

- **New Employee**
  - View onboarding progress
  - Mark tasks complete
  - Access training materials

### Data Protection

- Password hashing (bcryptjs)
- JWT token authentication
- Company data isolation
- Audit trail for all actions
- Sensitive data encryption (offer details)

---

## Performance Optimization

### Database Indexes
All models include strategic indexes for:
- Common filtering (company, status, stage)
- Sorting (date, priority)
- Lookups (email, ID)

### API Optimization
- Pagination for large datasets
- Field projection (only needed fields)
- Caching of frequently accessed data
- Batch operations for bulk updates

### Frontend Optimization
- Lazy loading of candidate lists
- Client-side filtering before API calls
- Debounced search inputs
- Efficient DOM updates

---

## Troubleshooting

### Common Issues

**Issue:** "Cannot find module" error for recruitment routes
**Solution:** Ensure routes/recruitment.js and routes/onboarding.js are created and server.js imports them

**Issue:** Candidates not appearing in database
**Solution:** Check MongoDB connection and ensure JobPosting exists before submitting application

**Issue:** Onboarding checklist not created
**Solution:** Ensure OnboardingTask templates exist for the company before creating checklist

**Issue:** Skill match showing 0%
**Solution:** Verify job posting has skills array populated and candidate has skills array populated

### Debug Mode

Enable detailed logging:
```javascript
// In recruitmentEngine.js
const DEBUG = true;

if (DEBUG) {
  console.log('Recruitment Engine Debug:', data);
}
```

---

## Future Enhancements

1. **Scheduling Integration**
   - Auto-schedule interviews
   - Calendar integration (Outlook, Google)
   - Interview reminders

2. **Advanced Analytics**
   - Predictive analytics (success likelihood)
   - Diversity tracking
   - Department benchmarking

3. **ATS Integrations**
   - LinkedIn integration
   - Job board syncing
   - Email automation

4. **Mobile App**
   - Interview scheduling on mobile
   - Offer acceptance on mobile
   - Onboarding checklist on mobile

5. **AI Features**
   - Resume parsing and extraction
   - Interview question suggestions
   - Candidate chatbot

---

## Support & Contact

For issues or feature requests, contact the development team.

**Documentation Version:** 3.0  
**Last Updated:** April 11, 2026  
**Status:** ✅ Production Ready
