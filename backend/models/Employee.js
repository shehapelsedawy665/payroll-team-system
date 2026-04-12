// backend/models/Employee.js
const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nationalId: { type: String, required: true, unique: true },
    jobId: { type: String, sparse: true }, // الرقم الوظيفي (used as username for auto-account)
    position: String,
    department: String,
    jobType: { type: String, enum: ['Full Time', 'Part Time', 'Contract'], default: 'Full Time' },
    hiringDate: { type: Date, required: true },
    resignationDate: Date,
    insSalary: { type: Number, default: 0 }, // الراتب التأميني
    basicSalary: { type: Number, default: 0 },
    variableSalary: { type: Number, default: 0 },
    fullBasic: { type: Number, default: 0 }, // الراتب الأساسي الشامل
    fullTrans: { type: Number, default: 0 }, // بدل انتقال شامل
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', sparse: true }, // Link to auto-generated user account
    bankAccount: String,
    status: { type: String, enum: ['active', 'onleave', 'resigned'], default: 'active' },
    isTaxExempted: { type: Boolean, default: false }
}, { timestamps: true });

EmployeeSchema.index({ nationalId: 1 });
EmployeeSchema.index({ jobId: 1 });
EmployeeSchema.index({ companyId: 1 });

module.exports = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);
