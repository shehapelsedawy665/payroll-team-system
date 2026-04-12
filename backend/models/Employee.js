// backend/models/Employee.js
const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nationalId: { type: String, required: true, unique: true },
    position: String,
    department: String,
    hiringDate: { type: Date, required: true },
    resignationDate: Date,
    insSalary: { type: Number, default: 0 }, // الراتب التأميني
    fullBasic: { type: Number, default: 0 }, // الراتب الأساسي الشامل
    fullTrans: { type: Number, default: 0 }, // بدل انتقال شامل
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    bankAccount: String,
    status: { type: String, default: 'active' }
}, { timestamps: true });

module.exports = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);
