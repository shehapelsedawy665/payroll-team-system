// backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'hr', 'employee'], default: 'employee' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // ربط اليوزر بملف الموظف
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    status: { type: String, default: 'active' }
}, { timestamps: true });

// التعديل الذكي لمنع التكرار
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
