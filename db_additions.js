// ============================================================
// ADDITIONS TO db.js — Schema upgrades
// ============================================================

// 1. In payrollSchema, add:
//    isLocked: { type: Boolean, default: false },
//    lockedAt: { type: Date },
//    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }

// 2. In employeeSchema, add:
//    nationality:  { type: String, default: "مصري" },
//    insuranceNo:  { type: String, default: "" },
//    passportNo:   { type: String, default: "" },
//    department:   { type: String, default: "" },   // already added in v2
//    position:     { type: String, default: "" },   // already added in v2
//    phone:        { type: String, default: "" },   // already added in v2

// 3. In companySchema.settings, add:
//    taxRegNo:     { type: String, default: "" },
//    employerInsPercent: { type: Number, default: 19 },

// 4. NEW: Department Schema
const departmentSchema = new mongoose.Schema({
    name:        { type: String, required: true },
    code:        { type: String, default: "" },
    companyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    managerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    parentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    headcount:   { type: Number, default: 0 },
    createdAt:   { type: Date, default: Date.now }
});
departmentSchema.index({ companyId: 1 });

// 5. NEW: Recruitment Schema
const recruitmentSchema = new mongoose.Schema({
    companyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    position:    { type: String, required: true },
    department:  { type: String, default: "" },
    status:      { type: String, enum: ['open','screening','interview','offer','hired','closed'], default: 'open' },
    headcount:   { type: Number, default: 1 },
    openDate:    { type: Date, default: Date.now },
    closeDate:   { type: Date },
    candidates:  [{
        name: String, email: String, phone: String,
        cvUrl: String, stage: { type: String, enum: ['applied','screening','interview1','interview2','offer','rejected','hired'], default: 'applied' },
        notes: String, addedAt: { type: Date, default: Date.now }
    }],
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt:   { type: Date, default: Date.now }
});

// 6. NEW: Performance Review Schema
const performanceSchema = new mongoose.Schema({
    employeeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    companyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    period:       { type: String, required: true }, // "2026-Q1", "2026-H1", "2026"
    type:         { type: String, enum: ['quarterly','semiannual','annual'], default: 'annual' },
    kpis: [{
        title: String, target: Number, actual: Number,
        weight: Number,  // percentage 0-100
        score:  Number   // 0-100
    }],
    overallScore:   { type: Number, default: 0 },
    rating:         { type: String, enum: ['excellent','veryGood','good','acceptable','poor'], default: 'good' },
    salaryImpact:   { type: Number, default: 0 },  // % raise
    reviewedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status:         { type: String, enum: ['draft','submitted','approved'], default: 'draft' },
    comments:       { type: String, default: "" },
    createdAt:      { type: Date, default: Date.now }
});
performanceSchema.index({ employeeId: 1, period: 1 });

// Export additions:
// const Department  = mongoose.models.Department  || mongoose.model("Department",  departmentSchema);
// const Recruitment = mongoose.models.Recruitment || mongoose.model("Recruitment", recruitmentSchema);
// const Performance = mongoose.models.Performance || mongoose.model("Performance", performanceSchema);
