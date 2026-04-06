const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./db");
const auth = require("./middleware/auth");

// استيراد الموديلات
const Company = require("./models/company");
const Employee = require("./models/employee");

// استيراد المحرك المالي
// تأكد أن ملف calculations.js يصدر الدوال بهذه الأسماء
const calculations = require("./calculations"); 

const app = express();

// 1. الإعدادات الأساسية (Middleware)
// تم ضبط CORS ليقبل الطلبات من أي مكان في بيئة الـ Development والـ Production
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. ربط الـ Routes المنفصلة
app.use("/api/auth", require("./routes/auth"));
app.use("/api/employees", require("./routes/employees"));
// تم التأكد من وجود هذه الملفات في فولدر routes حسب صور GitHub
app.use("/api/departments", require("./routes/department")); // تأكد من اسم الملف department.js أو departments.js
app.use("/api/payroll", require("./routes/payroll"));

/**
 * جلب إعدادات الشركة
 */
app.get("/api/company/settings", auth, async (req, res) => {
    try {
        await connectDB();
        const company = await Company.findById(req.user.companyId);
        if (!company) return res.status(404).json({ error: "الشركة غير موجودة" });
        
        res.json(company.settings || { 
            personalExemption: 20000, 
            maxInsSalary: 16700, 
            insEmployeePercent: 0.11,
            medicalExemptionLimit: 10000 
        });
    } catch (err) { 
        res.status(500).json({ error: "فشل جلب الإعدادات" }); 
    }
});

/**
 * تحديث إعدادات الشركة
 */
app.post("/api/company/settings", auth, async (req, res) => {
    try {
        await connectDB();
        const { personalExemption, maxInsSalary, insEmployeePercent, medicalExemptionLimit } = req.body;
        
        const updatedCompany = await Company.findByIdAndUpdate(
            req.user.companyId,
            {
                $set: {
                    "settings.personalExemption": Number(personalExemption),
                    "settings.maxInsSalary": Number(maxInsSalary),
                    "settings.insEmployeePercent": Number(insEmployeePercent),
                    "settings.medicalExemptionLimit": Number(medicalExemptionLimit || 10000),
                    "lastSettingsUpdate": Date.now()
                }
            },
            { new: true, upsert: true }
        );
        res.json({ success: true, settings: updatedCompany.settings });
    } catch (err) { 
        res.status(500).json({ error: "فشل تحديث الإعدادات" }); 
    }
});

/**
 * حساب المرتب المتقدم (API مباشر)
 */
app.post("/api/payroll/calculate", auth, async (req, res) => {
    try {
        await connectDB();
        const { empId, month, days, fullBasic, fullTrans, additions, deductions } = req.body;
        
        const [emp, company] = await Promise.all([
            Employee.findOne({ _id: empId, companyId: req.user.companyId }),
            Company.findById(req.user.companyId)
        ]);

        if (!emp || !company) return res.status(404).json({ error: "بيانات ناقصة" });

        const settings = company.settings || { 
            personalExemption: 20000, 
            maxInsSalary: 16700, 
            insEmployeePercent: 0.11,
            medicalExemptionLimit: 10000 
        };
        
        // استخدام الدالة من ملف calculations
        const result = calculations(emp.toObject(), settings);

        res.json({ success: true, result });
    } catch (err) { 
        console.error("Payroll Calculation Error:", err);
        res.status(500).json({ error: "خطأ في حساب المرتب" }); 
    }
});

// 4. التعامل مع الملفات الثابتة (Public Folder)
// مهم جداً لـ Vercel لخدمة واجهة المستخدم
app.use(express.static(path.join(__dirname, "public")));

// أي مسار لا يبدأ بـ /api يتم توجيهه لـ index.html
app.get("*", (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, "public", "index.html"));
    }
});

// 5. التشغيل
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server LIVE on port ${PORT} 🚀`));
}

// تصدير التطبيق ليكون متاحاً لـ Vercel Serverless
module.exports = app;
