const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./db");
const auth = require("./middleware/auth");

// استيراد الموديلات
const Company = require("./models/company");
const Employee = require("./models/employee");

// استيراد المحرك المالي (تأكد أن calculations.js يصدر function مباشرة)
const calculatePayroll = require("./calculations"); 

const app = express();

// 1. الإعدادات الأساسية (Middleware)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. ربط الـ Routes المنفصلة (تأكد من مطابقة أسماء الملفات في فولدر routes)
app.use("/api/auth", require("./routes/auth"));
app.use("/api/employees", require("./routes/employees"));
// تم التعديل ليطابق اسم الملف في الصورة: department.js وليس departments.js
app.use("/api/departments", require("./routes/department")); 
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
        const { empId, month } = req.body;
        
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
        
        // تشغيل المحرك المالي
        const result = calculatePayroll(emp.toObject(), settings);

        res.json({ success: true, result });
    } catch (err) { 
        console.error("Payroll Calculation Error:", err);
        res.status(500).json({ error: "خطأ في حساب المرتب" }); 
    }
});

// 4. التعامل مع الملفات الثابتة (Public Folder)
app.use(express.static(path.join(__dirname, "public")));

// 5. حماية الـ API من الـ HTML Fallback
// أي طلب يبدأ بـ /api وغير موجود يرجع 404 JSON مش صفحة HTML
app.use("/api/*", (req, res) => {
    res.status(404).json({ error: "الرابط المطلوب غير موجود في الـ API" });
});

// أي مسار آخر يخدم صفحة الـ index.html
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 6. التشغيل (Local Only)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server LIVE on port ${PORT} 🚀`));
}

// تصدير التطبيق لـ Vercel
module.exports = app;
