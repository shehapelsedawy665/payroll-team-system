# Payroll Pro - Egyptian HR & Payroll ERP System

**Version:** 2.0 | **Status:** ✅ Production Ready | **Last Updated:** April 11, 2026

A comprehensive web-based HR and Payroll management system with integrated performance appraisal, compensation management, and strategic HR planning capabilities.

## 🌟 Features

### Core HR Management
- ✅ **Employee Management**: Complete employee profiles, documents, and records
- ✅ **Attendance Tracking**: Daily attendance, biometric integration, shift management
- ✅ **Leave Management**: Multiple leave types, balance tracking, approval workflows
- ✅ **Payroll Processing**: Salary calculation, deductions, bank transfers, attestation
- ✅ **Organization Settings**: Company configuration, policies, and settings

### 🎯 Performance Appraisal System (NEW)
- ✅ **Appraisal Cycles**: Create and manage evaluation periods
- ✅ **Customizable Templates**: Define competencies and rating scales
- ✅ **Multi-Rater Feedback**: Self, manager, and 360-degree feedback
- ✅ **Automated Scoring**: Weighted calculations and distribution validation
- ✅ **Performance Analytics**: Dashboards and insights
- ✅ **Export Options**: PDF, Excel, CSV, and JSON exports

### 🚀 HR Integration & Planning (NEW)
- ✅ **Salary Management**: Rating-based salary increments with configurable rules
- ✅ **Promotion Planning**: Eligibility checks and succession pipeline
- ✅ **Leave Adjustments**: Performance-based leave allocation
- ✅ **Compensation Packages**: Salary, bonus, and allowance adjustments
- ✅ **Training Needs**: Identify and plan department-wide training
- ✅ **Succession Planning**: Identify promotion-ready employees
- ✅ **HR Actions**: Automated action item generation with priorities

## 🏗️ Architecture

```
├── backend/
│   ├── config/
│   │   ├── constants.js
│   │   └── db.js (MongoDB connection)
│   ├── logic/
│   │   ├── payrollEngine.js
│   │   ├── taxEngine.js
│   │   ├── appraisalEngine.js (NEW)
│   │   ├── hrIntegration.js (NEW)
│   │   └── appraisalExporter.js (NEW)
│   ├── middleware/
│   │   └── auth.js
│   └── models/
│       ├── User.js
│       ├── Company.js
│       ├── Employee.js
│       ├── PayrollRecord.js
│       ├── Appraisal.js (NEW)
│       ├── AppraisalCycle.js (NEW)
│       └── AppraisalTemplate.js (NEW)
├── routes/
│   ├── auth.js
│   ├── employees.js
│   ├── payroll.js
│   ├── attendance.js
│   ├── leaves.js
│   ├── hr.js
│   ├── appraisal.js (NEW)
│   └── hrIntegration.js (NEW)
├── public/
│   ├── index.html
│   ├── appraisal.html (NEW)
│   ├── css/
│   │   ├── style.css
│   │   └── appraisal.css (NEW)
│   └── js/
│       ├── attendance.js
│       ├── employees.js
│       ├── payroll.js
│       ├── leaves.js
│       └── appraisal.js (NEW)
├── server.js
├── package.json
└── vercel.json
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Vercel account (for deployment)

### Local Setup

```bash
# Clone the repository
git clone <repo-url>
cd payroll-fixed

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/payroll
JWT_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-min-32-chars
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
BIOMETRIC_API_KEY=your-api-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EOF

# Start the server
npm start

# Open browser
# Frontend: http://localhost:3000
# API: http://localhost:3000/api
```

## 📚 Documentation

### System Documentation
| File | Purpose |
|------|---------|
| [SYSTEM_SUMMARY.md](./SYSTEM_SUMMARY.md) | Complete system overview and achievement summary |
| [APPRAISAL_SYSTEM_DOCS.md](./APPRAISAL_SYSTEM_DOCS.md) | Detailed appraisal system documentation |
| [HR_INTEGRATION_DOCS.md](./HR_INTEGRATION_DOCS.md) | HR integration features and capabilities |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | Quick reference guide with common tasks |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Deployment and configuration guide |

### Key API Endpoints

#### Appraisal System
```
GET    /api/appraisal/cycles                          # List cycles
POST   /api/appraisal/cycles                          # Create cycle
GET    /api/appraisal/templates                       # List templates
POST   /api/appraisal/templates                       # Create template
GET    /api/appraisal/forms/{id}                      # Get appraisal form
POST   /api/appraisal/forms/{id}/self-assessment      # Submit self-rating
POST   /api/appraisal/forms/{id}/manager-rating       # Submit manager rating
GET    /api/appraisal/cycles/{cycleId}/summary        # Get cycle summary
```

#### HR Integration
```
GET    /api/hr-integration/salary-increment/{id}              # Calculate salary
GET    /api/hr-integration/promotion-eligibility/{id}         # Check promotion
GET    /api/hr-integration/leave-allocation/{id}              # Adjust leave
GET    /api/hr-integration/succession-plan/{cycleId}          # Succession plan
GET    /api/hr-integration/training-needs/{cycleId}           # Training analysis
GET    /api/hr-integration/action-items/{cycleId}             # HR actions
POST   /api/hr-integration/apply-salary-increments/{cycleId}  # Bulk apply
```

## 🔐 Security Features

- ✅ JWT-based authentication
- ✅ Role-based access control (Employee, Manager, HR, Admin)
- ✅ Company data isolation
- ✅ Encrypted password storage (bcryptjs)
- ✅ CORS protection
- ✅ Input validation and sanitization
- ✅ MongoDB injection prevention

## 💾 Database

### MongoDB Collections
- users
- companies
- employees
- appraisals (NEW)
- appraisalcycles (NEW)
- appraisaltemplates (NEW)
- payrollrecords
- attendance
- leaves
- leavebalances
- shifts
- penalties
- subscriptions
- And more...

### Performance Indexes
```javascript
// Appraisal indexes for optimal query performance
db.appraisals.createIndex({ employeeId: 1, cycleId: 1 }, { unique: true })
db.appraisals.createIndex({ cycleId: 1, status: 1 })
db.appraisalcycles.createIndex({ companyId: 1, status: 1 })
```

## 🎯 Performance Rating Scale

| Rating | Score | Benefits | Promotion |
|--------|-------|----------|-----------|
| 5-Exceptional | 4.5-5.0 | +10% salary, +5 leave days, 100% bonus | Ready Now |
| 4-Exceeds | 4.0-4.49 | +8% salary, +3 leave days, 75% bonus | Ready in 1yr |
| 3-Meets | 3.0-3.99 | +5% salary, standard leave, 50% bonus | Potential |
| 2-Below | 2.0-2.99 | +2% salary, -2 leave days, 25% bonus | Not Ready |
| 1-Unsatisfactory | 1.0-1.99 | 0% salary, -5 leave days, 0% bonus | Not Ready |

## 🧪 Testing

```bash
# Run test suite
npm test

# Run appraisal API tests
node APPRAISAL_API_TESTS.js

# Watch mode
npm run test:watch
```

## 🌐 Deployment

### Vercel Deployment (Recommended)

```bash
# 1. Push to GitHub
git push origin main

# 2. Connect to Vercel (auto-deploys)
# Visit: https://vercel.com/dashboard

# 3. Set environment variables in Vercel dashboard
# Required: MONGODB_URI, JWT_SECRET, etc.

# 4. Verify deployment
curl https://your-app.vercel.app/api/appraisal/cycles
```

### Environment Variables Required

```
MONGODB_URI              # MongoDB connection string
JWT_SECRET              # JWT signing key (min 32 chars)
JWT_REFRESH_SECRET      # Refresh token key (min 32 chars)
NODE_ENV                # 'production' or 'development'
ALLOWED_ORIGINS         # Comma-separated domains
BIOMETRIC_API_KEY       # Optional: Biometric API key
SMTP_HOST               # Optional: Email SMTP host
SMTP_PORT               # Optional: Email SMTP port
SMTP_USER               # Optional: Email username
SMTP_PASSWORD           # Optional: Email password
```

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed setup instructions.

## 📊 Key Statistics

- **8,000+** lines of new code
- **33+** API endpoints
- **3** new database models
- **2** new route modules
- **4** comprehensive documentation files
- **50+** JavaScript functions
- **200+** CSS rules
- **10,000+** words of documentation

## 🎓 Common Workflows

### Year-End Performance Review
1. Create appraisal cycle (Dec 1)
2. Create appraisal forms (Dec 2)
3. Employees complete self-assessment (Dec 1-15)
4. Managers complete ratings (Dec 15-29)
5. HR performs calibration (Dec 29)
6. Results approved (Dec 31)
7. Salary increments applied (Jan 1)
8. Reports generated (Jan 2)

### Identify High Performers
1. Get cycle summary
2. Generate succession plan
3. Review ready-now candidates
4. Process promotions
5. Assign mentors

### Address Performance Issues
1. Get action items
2. Review low performers
3. Create improvement plans
4. Schedule coaching
5. Monitor progress

## 🛠️ Troubleshooting

### Common Issues

**MongoDB Connection Failed**
- Verify MONGODB_URI in .env
- Check IP whitelist in MongoDB Atlas
- Verify user credentials

**API Returns 401 Unauthorized**
- Check JWT_SECRET is set
- Verify token in Authorization header
- Check token hasn't expired

**Large Exports Timeout**
- Increase maxDuration in vercel.json
- Use pagination for large datasets
- Consider background jobs

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for more troubleshooting tips.

## 📞 Support

### Resources
- **Documentation**: See files listed above
- **API Tests**: Run `node APPRAISAL_API_TESTS.js`
- **Local Development**: See Quick Start section
- **Deployment**: See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

### Key Contacts
- **Development**: Check GitHub issues
- **Deployment Issues**: Vercel support or documentation
- **Database Issues**: MongoDB Atlas support

## 📋 Next Steps

- [ ] Configure environment variables
- [ ] Test local setup with sample data
- [ ] Run test suite
- [ ] Deploy to Vercel
- [ ] Configure email notifications
- [ ] Set up monitoring
- [ ] Train users
- [ ] Go live

## 📜 License

© 2024 Payroll Pro. All rights reserved.

---

## 🎉 What's New in v2.0

### New Features
- ✅ **Performance Appraisal System**: Complete evaluation lifecycle
- ✅ **HR Integration**: Link performance to compensation, promotions, training
- ✅ **Advanced Analytics**: Performance dashboards and insights
- ✅ **Export Capabilities**: PDF, Excel, CSV, JSON formats
- ✅ **Succession Planning**: Identify promotion candidates
- ✅ **Training Analysis**: Identify department learning needs
- ✅ **Bulk Operations**: Apply salary increments to entire organization

### Improvements
- ✅ Enhanced security with role-based access
- ✅ Optimized database with strategic indexes
- ✅ Comprehensive error handling
- ✅ Extensive documentation (10,000+ words)
- ✅ Production-ready deployment configuration
- ✅ Complete test suite included

## 📅 Version History

- **v2.0** (April 2026): Appraisal & HR Integration systems
- **v1.5** (January 2026): Leave and shift management
- **v1.0** (October 2025): Initial payroll system

---

**Last Updated:** April 11, 2026  
**Status:** ✅ Production Ready  
**Maintained by:** Development Team

For more information, see the documentation files included in the project directory.
