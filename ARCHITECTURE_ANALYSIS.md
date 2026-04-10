# Payroll Pro — Deep System Analysis & Upgrade Roadmap
*Based on actual codebase review — April 2026*

---

## TASK 1 — Deep System Analysis

### ✅ Current Strengths
1. **Egyptian calculations are correct** — إزالة العقدة الأكبر. calculations.js يحسب الضرائب والتأمينات بدقة.
2. **JWT + bcrypt in v2** — authentication سليم بعد v2.
3. **companyId isolation** — multi-tenancy موجود في كل query.
4. **Vercel-compatible caching** — `cachedConnection` يمنع connection flood.
5. **Serverless-ready** — لا يوجد state في الـ server.

### ❌ Critical Issues (Production Blockers)

| Issue | Severity | Fix |
|-------|----------|-----|
| JWT_SECRET hardcoded fallback في الكود | 🔴 HIGH | Remove fallback, force env vars |
| MongoDB URI hardcoded في db.js | 🔴 HIGH | Throw error if MONGODB_URI missing |
| No request body size limit | 🟡 MED | `app.use(express.json({limit:'1mb'}))` |
| No rate limiting on auth endpoints | 🟡 MED | express-rate-limit |
| Payroll can be recalculated (no month lock) | 🟡 MED | Add `isLocked` field to Payroll |
| `adminOnly` but no `hrOnly` role | 🟡 MED | Add `hr` role middleware |
| No indexes on Attendance.date + Employee.companyId | 🟢 LOW | Add compound indexes |
| calculations.js has no unit tests | 🟢 LOW | Critical for tax compliance |

### Architecture Pattern Assessment

```
Current:        Monolith SPA + REST API + MongoDB
Recommended:    Same (Vercel-compatible) + Module separation
```

**الكود الحالي صح لـ Vercel Serverless** — لا تغيّر الـ architecture الأساسية.
المشكلة في التفاصيل وليس في البنية.

---

## TASK 2 — Tax Portal Export

### Column Mapping Strategy (98 عمود)

المجموعات الرئيسية:
- **EI005–EI125**: بيانات الموظف والتأمينات (Employee schema)
- **DTE160–DTE295**: استحقاقات الراتب (Payroll.payload)
- **DAE405–DAE475**: استقطاعات ضريبية (Payroll.payload)
- **TC505–TC565**: الضريبة والوعاء (Payroll.payload)
- **NAD610–NAD665**: استقطاعات وإضافات أخرى + حصة الشركة

### Employee Schema Additions Needed
```javascript
// أضف للـ employeeSchema في db.js:
nationality:    { type: String, default: "مصري" },
insuranceNo:    { type: String, default: "" },
passportNo:     { type: String, default: "" },
taxRegNo:       { type: String, default: "" },  // للموظف الأجنبي
```

### Company Schema Additions Needed
```javascript
// أضف للـ companySchema:
taxRegNo:       { type: String, default: "" },
```

### API Endpoints Added
```
GET /api/export/tax-portal?month=YYYY-MM     → Download .xlsx
GET /api/export/tax-portal/preview?month=YYYY-MM → Validation + summary JSON
```

---

## TASK 3 — Architecture Upgrade Roadmap

### Phase 1 — Production Hardening (أسبوع 1)
```javascript
// server.js — أضف هذا أعلى الملف:
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI env var required");
if (!process.env.JWT_SECRET)  throw new Error("JWT_SECRET env var required");

// Rate limiting
const rateLimit = require('express-rate-limit');
app.use('/api/auth/', rateLimit({ windowMs: 15*60*1000, max: 20 }));

// Body limit
app.use(express.json({ limit: '1mb' }));
```

### Phase 2 — Month Lock System (أسبوع 1)
```javascript
// في payrollSchema أضف:
isLocked: { type: Boolean, default: false },
lockedAt: { type: Date },
lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }

// Endpoint:
app.post("/api/payroll/lock/:month", authMiddleware, adminOnly, async (req, res) => {
    await Payroll.updateMany(
        { companyId: req.user.companyId, month: req.params.month },
        { isLocked: true, lockedAt: new Date(), lockedBy: req.user.id }
    );
    res.json({ success: true, message: `شهر ${req.params.month} مقفول` });
});

// في /api/payroll/calculate — أضف قبل الحساب:
const existing = await Payroll.findOne({ employeeId: empId, month });
if (existing?.isLocked) return res.status(423).json({ error: "الشهر مقفول ولا يمكن إعادة الحساب" });
```

### Phase 3 — New MongoDB Schemas (أسبوع 2)

#### Department Schema
```javascript
{
    name: String, code: String,
    companyId: ObjectId, managerId: ObjectId,
    parentDeptId: ObjectId, // للهيكل الهرمي
    headcount: Number
}
```

#### Recruitment (ATS)
```javascript
{
    companyId: ObjectId,
    position: String, department: String,
    status: enum['open','interview','offer','closed'],
    candidates: [{ name, email, phone, cvUrl, stage, notes }],
    openDate: Date, closeDate: Date
}
```

#### Performance Review
```javascript
{
    employeeId: ObjectId, companyId: ObjectId,
    period: String,  // "2026-Q1"
    kpis: [{ title, target, actual, weight, score }],
    overallScore: Number,  // 0-100
    salaryImpact: Number,  // % increase linked to score
    reviewedBy: ObjectId, status: enum['draft','submitted','approved']
}
```

### Phase 4 — API Structure Expansion

```
Current APIs:
/api/auth/*
/api/employees/*
/api/payroll/*
/api/attendance/*
/api/leaves/*
/api/settings
/api/subscription/*
/api/analytics/*

New APIs to Add:
/api/export/tax-portal         ← هذا الـ task
/api/departments/*
/api/recruitment/*
/api/performance/*
/api/payroll/:month/lock
/api/payroll/:month/bulk       ← حساب كل الموظفين بطلب واحد
/api/reports/payroll-sheet     ← PDF كشف رواتب كامل
```

---

## TASK 4 — Frontend UX Strategy

### Current Frontend Audit

| Aspect | Current Status | Priority |
|--------|---------------|----------|
| Technology | Vanilla JS SPA (index.html) | 🟡 Keep for now |
| Mobile | ✅ Responsive (bottom nav) | ✅ Good |
| RTL | ✅ Full Arabic RTL | ✅ Good |
| Views | Dashboard, HR, Attendance, Leaves, Analytics, Settings, Sub | ✅ Complete |
| UX Flows | Single-page, fast | ✅ Good |
| Data loading | Inline fetch, no state management | 🟡 Manageable |
| Error handling | Basic alerts | 🔴 Needs improvement |

### Recommendation: **Don't rewrite — Enhance**

إعادة بناء الـ frontend في React/Vue الآن = تأخير 2-3 أشهر بدون قيمة فعلية.
الـ Vanilla JS SPA يعمل، والسوق المصري يحتاج product يشتغل الآن.

**الأولوية: تحسين الـ UX بدون إعادة البناء**

### UX Quick Wins (أسبوع واحد)

#### 1. Bulk Payroll Calculation
```javascript
// زر "احسب رواتب الشهر كله دفعة واحدة"
// Backend: POST /api/payroll/bulk-calculate { month, employeeIds[] }
```

#### 2. Tax Export Button في الـ Analytics View
```html
<button onclick="exportTaxPortal()">
  تصدير نموذج الضرائب ⬇
</button>
```

#### 3. Month Lock Visual Indicator
```html
<!-- في جدول الرواتب -->
<span class="bg-red-100 text-red-600 px-2 py-1 rounded text-xs">🔒 مقفول</span>
```

#### 4. Validation Toasts بدل alerts
```javascript
// استبدل كل alert() بـ showToast()
// موجود بالفعل في الكود — طبّقه بشكل consistent
```

#### 5. Employee Quick Stats
```html
<!-- في صفحة الموظف -->
<div>YTD Gross: 45,000 | YTD Tax: 3,200 | YTD Net: 38,000</div>
```

---

## Execution Roadmap

```
Week 1  ██████████  Security hardening + Month Lock + Tax Export
Week 2  ██████████  Bulk payroll + Department schema + National ID validation  
Week 3  ██████████  Recruitment module (ATS)
Week 4  ██████████  Performance reviews + Salary linkage
Month 2 ██████████  Self-service employee portal
Month 3 ██████████  React migration (optional, if team grows)
```

## How to Compete with SAP

| SAP Pain | Your Advantage |
|----------|----------------|
| 6-month implementation | يشتغل في يوم |
| SAP consultant = 50k ج/شهر | موظف HR عادي يستخدمه |
| Arabic localization = extra cost | مصري أصلي بدون إضافات |
| Monthly subscription = $300+ | 299 ج/شهر |
| Complex UX = training needed | Zero training |
| Tax portal = manual Excel | تصدير تلقائي بضغطة |

