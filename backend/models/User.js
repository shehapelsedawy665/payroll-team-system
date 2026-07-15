const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    // بيانات الدخول
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // طبعاً هنعمله Hashing في الباك إند عشان محدش يقدر يقراه
    
    // نظام الصلاحيات (Role-Based Access Control)
    role: { 
        type: String, 
        enum: ['SuperAdmin', 'CompanyAdmin', 'Employee'], 
        default: 'Employee' 
    },
    
    // الربط بالشركة (أهم حتة في الـ Multi-tenant)
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company',
        // السوبر آدمن (أنت) مش محتاج تتربط بشركة معينة، بس الباقي لازم
        required: function() { return this.role !== 'SuperAdmin'; } 
    },
    
    // لو اليوزر ده موظف عادي، نربطه بملف الموظف بتاعه (هيفيدنا جداً في شاشة الموظف بعدين)
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: function() { return this.role === 'Employee'; }
    },

    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
