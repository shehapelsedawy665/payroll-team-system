## HR Integration System - نظام التكامل مع الموارد البشرية

### Overview
The HR Integration system links performance appraisals with core HR functions including compensation, promotions, training, and succession planning. This enables automatic calculation of salary increments, promotion eligibility, leave allocation adjustments, and strategic workforce planning.

---

## Key Features

### 1. **Salary Increment Calculation**
Automatically calculates salary increases based on performance ratings.

**Endpoint:** `GET /api/hr-integration/salary-increment/{appraisalId}`

**Default Increment Rules:**
```javascript
{
  '5-Exceptional': 0.10,     // 10% increase
  '4-Exceeds': 0.08,         // 8% increase
  '3-Meets': 0.05,           // 5% increase
  '2-Below': 0.02,           // 2% increase
  '1-Unsatisfactory': 0      // No increase
}
```

**Response Example:**
```json
{
  "employeeName": "Ahmed Hassan",
  "appraisalRating": "4-Exceeds",
  "increment": {
    "currentSalary": 10000,
    "incrementRate": "8.00",
    "incrementAmount": "800.00",
    "newSalary": "10800.00",
    "effectiveDate": "2024-01-01"
  }
}
```

---

### 2. **Promotion Eligibility Check**
Determines if an employee is ready for promotion based on:
- Performance rating (must be Exceeds or Exceptional)
- Tenure requirements (default: 12 months)
- Manager recommendation
- Role hierarchy mapping

**Endpoint:** `GET /api/hr-integration/promotion-eligibility/{appraisalId}`

**Response Example:**
```json
{
  "employeeName": "Fatima Ahmed",
  "currentRole": "Senior Developer",
  "appraisalRating": "5-Exceptional",
  "eligibility": {
    "isEligible": true,
    "readinessLevel": "ready-now",
    "reason": "Employee meets all promotion criteria",
    "recommendedRole": "Team Lead"
  }
}
```

**Readiness Levels:**
- `ready-now`: Immediate promotion candidate
- `ready-in-1yr`: Ready within one year
- `potential`: Has potential, needs development
- `not-ready`: Not ready for promotion

---

### 3. **Leave Allocation Adjustment**
Adjusts annual leave based on performance to incentivize high performers.

**Endpoint:** `GET /api/hr-integration/leave-allocation/{appraisalId}`

**Bonus Leave Rules:**
```javascript
{
  '5-Exceptional': +5,       // Extra 5 days
  '4-Exceeds': +3,           // Extra 3 days
  '3-Meets': 0,              // Standard allocation
  '2-Below': -2,             // Reduced by 2 days
  '1-Unsatisfactory': -5     // Significantly reduced
}
```

**Response Example:**
```json
{
  "employeeName": "Mohammed Al-Rashid",
  "appraisalRating": "4-Exceeds",
  "allocation": {
    "baseAnnualLeave": 20,
    "bonusLeave": 3,
    "totalLeave": 23,
    "allocationType": "premium"
  }
}
```

---

### 4. **Compensation Adjustment Package**
Comprehensive compensation review including salary, bonus, and allowances.

**Endpoint:** `GET /api/hr-integration/compensation-adjustment/{appraisalId}`

**Response Example:**
```json
{
  "employeeName": "Layla Ibrahim",
  "appraisalRating": "4-Exceeds",
  "adjustment": {
    "salaryIncrement": {
      "currentSalary": 15000,
      "incrementRate": "8.00",
      "incrementAmount": "1200.00",
      "newSalary": "16200.00"
    },
    "bonusPercentage": 0.75,
    "allowanceAdjustments": [
      {
        "allowanceType": "transportation",
        "currentAmount": 500,
        "adjustmentPercentage": 0.08,
        "newAmount": "540.00"
      }
    ]
  }
}
```

---

### 5. **Succession Planning**
Identifies high-potential employees and promotion candidates for strategic workforce planning.

**Endpoint:** `GET /api/hr-integration/succession-plan/{cycleId}`

**Response Example:**
```json
{
  "cycleId": "cycle_123",
  "totalEmployees": 150,
  "succession": {
    "readyNow": [
      {
        "employeeId": "emp_001",
        "employeeName": "Amira Khalid",
        "currentRole": "Senior Manager",
        "department": "Sales",
        "rating": "5-Exceptional",
        "promotionReadiness": "ready-now"
      }
    ],
    "readyIn1Year": [
      {
        "employeeId": "emp_045",
        "employeeName": "Omar Hassan",
        "currentRole": "Senior Specialist",
        "department": "IT",
        "rating": "4-Exceeds",
        "promotionReadiness": "ready-in-1yr"
      }
    ],
    "highPotential": [
      {
        "employeeId": "emp_089",
        "employeeName": "Noor Adel",
        "currentRole": "Specialist",
        "department": "HR",
        "rating": "4-Exceeds",
        "promotionReadiness": "potential"
      }
    ],
    "notReady": []
  }
}
```

---

### 6. **Training Needs Analysis**
Identifies department-wide training requirements based on performance gaps.

**Endpoint:** `GET /api/hr-integration/training-needs/{cycleId}`

**Response Example:**
```json
{
  "cycleId": "cycle_123",
  "departmentAnalysis": [
    {
      "department": "Sales",
      "totalEmployees": 25,
      "lowPerformers": [
        {
          "employeeId": "emp_120",
          "employeeName": "Hana Karim",
          "rating": "2-Below",
          "developmentNeeds": ["Customer Service", "Sales Techniques"]
        }
      ],
      "trainingNeeds": [
        { "need": "Customer Service", "count": 5 },
        { "need": "Sales Techniques", "count": 4 },
        { "need": "Leadership", "count": 3 }
      ]
    }
  ]
}
```

---

### 7. **HR Action Items**
Generates prioritized action items for HR to implement based on appraisals.

**Endpoint:** `GET /api/hr-integration/action-items/{cycleId}`

**Response Example:**
```json
{
  "cycleId": "cycle_123",
  "totalAppraisals": 150,
  "actionItems": {
    "immediate": [
      {
        "employeeId": "emp_200",
        "employeeName": "Samir Al-Mansouri",
        "action": "Performance Improvement Plan (PIP) Required",
        "priority": "critical",
        "dueDate": "2024-01-21"
      }
    ],
    "shortTerm": [
      {
        "employeeId": "emp_150",
        "employeeName": "Huda Rashid",
        "action": "Process Salary Increment: +8%",
        "priority": "medium",
        "dueDate": "2024-02-01"
      }
    ],
    "mediumTerm": [
      {
        "employeeId": "emp_080",
        "employeeName": "Zain Abdullah",
        "action": "Process Promotion",
        "priority": "high",
        "dueDate": "2024-03-01"
      }
    ],
    "longTerm": []
  }
}
```

---

### 8. **Bulk Apply Salary Increments**
Applies salary increments to all employees in an approved appraisal cycle.

**Endpoint:** `POST /api/hr-integration/apply-salary-increments/{cycleId}`

**Response Example:**
```json
{
  "message": "نجاح: تم معالجة 140 موظفاً",
  "results": {
    "successful": [
      {
        "employeeId": "emp_001",
        "employeeName": "Ahmed Hassan",
        "previousSalary": "10000",
        "newSalary": "10800",
        "increment": "800",
        "incrementPercentage": "8.00"
      }
    ],
    "failed": [],
    "summary": {
      "totalProcessed": 140,
      "totalIncrement": "125000.00",
      "averageIncrement": "892.86"
    }
  }
}
```

---

## Configuration

### Company Settings for HR Integration

Update company settings to customize HR integration behavior:

```json
{
  "settings": {
    "incrementRules": {
      "5-Exceptional": 0.10,
      "4-Exceeds": 0.08,
      "3-Meets": 0.05,
      "2-Below": 0.02,
      "1-Unsatisfactory": 0
    },
    "promotionTenureMonths": 12,
    "bonusRules": {
      "5-Exceptional": 1.0,
      "4-Exceeds": 0.75,
      "3-Meets": 0.50,
      "2-Below": 0.25,
      "1-Unsatisfactory": 0
    },
    "leavePolicy": {
      "annualLeave": 20,
      "bonusLeaves": {
        "5-Exceptional": 5,
        "4-Exceeds": 3,
        "3-Meets": 0,
        "2-Below": -2,
        "1-Unsatisfactory": -5
      }
    },
    "roleHierarchy": {
      "Specialist": "Senior Specialist",
      "Senior Specialist": "Team Lead",
      "Team Lead": "Senior Manager"
    },
    "allowanceRules": {
      "transportation": {
        "5-Exceptional": 0.10,
        "4-Exceeds": 0.08,
        "3-Meets": 0,
        "2-Below": -0.05,
        "1-Unsatisfactory": -0.10
      }
    }
  }
}
```

---

## Workflow Integration

### Complete Appraisal to Compensation Workflow

```
1. Appraisal Cycle Approved
   ↓
2. Generate Action Items
   ├─ Create PIPs for low performers
   ├─ Schedule promotion reviews
   └─ Identify training needs
   ↓
3. Calculate Compensation Adjustments
   ├─ Salary increments
   ├─ Bonus percentages
   └─ Allowance adjustments
   ↓
4. Apply Salary Increments
   └─ Update employee records
   ↓
5. Update Leave Allocation
   └─ Adjust annual leave
   ↓
6. Generate Reports
   ├─ Succession plan
   ├─ Training plan
   └─ HR action items
```

---

## Approval Workflow

### Required Approvals for HR Actions

1. **Salary Increments**
   - HR Approval
   - Finance Approval (if exceeds threshold)
   - CFO Approval (for large batches)

2. **Promotions**
   - Department Head Approval
   - HR Approval
   - CEO Approval (for certain levels)

3. **Training Programs**
   - Line Manager Approval
   - HR Approval
   - Budget Approval

---

## Security & Access Control

### Role-Based Access

| Action | Employee | Manager | HR | Admin |
|--------|----------|---------|-----|-------|
| View own appraisal insights | ✓ | - | - | - |
| View team leave allocation | - | ✓ | ✓ | ✓ |
| Calculate salary increments | - | - | ✓ | ✓ |
| Check promotion eligibility | - | - | ✓ | ✓ |
| Generate succession plan | - | - | ✓ | ✓ |
| Apply salary updates | - | - | - | ✓ |

---

## API Endpoints Summary

```
GET  /api/hr-integration/salary-increment/{appraisalId}
GET  /api/hr-integration/promotion-eligibility/{appraisalId}
GET  /api/hr-integration/leave-allocation/{appraisalId}
GET  /api/hr-integration/compensation-adjustment/{appraisalId}
GET  /api/hr-integration/succession-plan/{cycleId}
GET  /api/hr-integration/training-needs/{cycleId}
GET  /api/hr-integration/action-items/{cycleId}
POST /api/hr-integration/apply-salary-increments/{cycleId}
```

---

## Error Handling

All API endpoints follow standard error response format:

```json
{
  "error": "تم تحديد الخطأ بوضوح",
  "status": 400
}
```

**Common Errors:**
- `404`: Appraisal or cycle not found
- `403`: Insufficient permissions
- `400`: Invalid calculation parameters
- `500`: Server error during processing

---

## Performance Optimization

- Cache company settings to reduce database queries
- Batch process salary increments to handle large employee populations
- Use indexed queries on companyId, cylceId, appraisalId
- Generate succession plans asynchronously for large organizations

---

## Future Enhancements

- [ ] Approval workflow automation
- [ ] Email notifications for HR actions
- [ ] Bulk import/export salary scenarios
- [ ] Compensation benchmarking against industry data
- [ ] Machine learning-based promotion prediction
- [ ] Retention risk analysis
- [ ] Equity and pay gap analysis
- [ ] Integration with payroll processing

---

## Example Workflow: Year-End Compensation Review

```bash
# 1. Get all approved appraisals
GET /api/appraisal/cycles/{cycleId}/appraisals?status=approved

# 2. Generate HR action items
GET /api/hr-integration/action-items/{cycleId}

# 3. Review compensation adjustments for each employee
GET /api/hr-integration/compensation-adjustment/{appraisalId}

# 4. Generate succession plan
GET /api/hr-integration/succession-plan/{cycleId}

# 5. Identify training needs
GET /api/hr-integration/training-needs/{cycleId}

# 6. Apply approved salary increments
POST /api/hr-integration/apply-salary-increments/{cycleId}

# 7. Export results for payroll processing
GET /api/appraisal/cycles/{cycleId}/export/csv
```

---

## Support & Documentation

For integration questions:
1. Review API response examples
2. Check error messages for specific guidance
3. Verify company settings are configured
4. Ensure user has proper role/permissions
5. Contact development team for custom configurations

---

## License

© 2024 HR Integration System. All rights reserved.
