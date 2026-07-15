const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
    // 1. بيانات الشركة الأساسية
    companyCode: { type: String, required: true, unique: true, index: true }, // كود فريد لكل شركة
    name: { type: String, required: true },
    subscriptionPlan: { type: String, default: 'Standard', enum: ['Standard', 'Premium', 'Enterprise'] },
    isActive: { type: Boolean, default: true }, // عشان لو اشتراكهم خلص توقف السيستم
    maxEmployees: { type: Number, default: 50 },

    // 2. إعدادات الشركة (متقسمة بشكل منظم جداً)
    settings: {
        // إعدادات عامة
        general: {
            currency: { type: String, default: 'EGP' },
            workDaysPerWeek: { type: Number, default: 5 },
            dailyWorkHours: { type: Number, default: 8 },
        },
        
        // إعدادات المرتبات
        payrollRules: {
            monthCalcType: { type: String, enum: ["30", "ActualDays"], default: "30" },
            absentDayRate: { type: Number, default: 1 },
            overtimeRate: { type: Number, default: 1.5 },
            overtimeHolRate: { type: Number, default: 2.0 },
        },

        // إعدادات الضرائب المصرية
        taxRules: {
            taxYear: { type: Number, default: 2026 },
            taxExemptionLimit: { type: Number, default: 40000 },
            personalExemption: { type: Number, default: 20000 },
            medicalLimit: { type: Number, default: 10000 },
        },

        // إعدادات التأمينات الاجتماعية (جديدة ومهمة جداً)
        socialInsuranceRules: {
            minInsurableSalary: { type: Number, default: 2000 },
            maxInsurableSalary: { type: Number, default: 12600 },
            employeeShare: { type: Number, default: 11 }, // نسبة الموظف 11%
            companyShare: { type: Number, default: 18.75 } // حصة الشركة 18.75%
        },

        // إعدادات الحضور والانصراف
        attendanceRules: {
            lateThreshold: { type: Number, default: 120 }, // بالدقايق
        },

        // إعدادات الذكاء الاصطناعي (عشان الميزة اللي اتفقنا عليها)
        aiSettings: {
            isAiConfigured: { type: Boolean, default: false },
            hrPolicyDocumentUrl: { type: String, default: "" }
        }
    }
}, { timestamps: true });

module.exports = mongoose.models.Company || mongoose.model('Company', CompanySchema);
