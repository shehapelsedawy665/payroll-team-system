const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./db");
const auth = require("./middleware/auth"); 

// استيراد الموديلات
const Company = require("./models/company"); 
const Employee = require("./models/employee");
const Department = require("./models/department");

// استيراد المحرك المالي المطور
const { runPayrollLogic, calculateNetToGross } = require("./calculations"); 

const app = express();

// 1. الإعدادات الأساسية (Middleware)
app.use(cors());
app.use(express.json());

// 2. ربط الـ Routes المنفصلة
app.use("/api/auth", require("./routes/auth"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/payroll", require("./routes/payroll"));

// جلب إعدادات الشركة
app.get("/api/company/settings", auth, async (req, res) => {
    try {
        await connectDB(); // ضمان الاتصال في بيئة Serverless
        const company = await Company.findById(req.user.companyId).select('settings');
        if (!company) return res.status(404).json({ error: "الشركة غير موجودة" });
        
        // إرجاع الإعدادات مع دعم الـ Medical Limit الجديد
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

// تحديث إعدادات الشركة
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

// حساب المرتب المتقدم (يدعم الأعمدة الديناميكية والـ Medical Logic)
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
        
        // تشغيل المحرك المالي (يدعم الآن Exempted/Non-Exempted و Medical Rule)
        const result = runPayrollLogic(
            { fullBasic, fullTrans, days, additions, deductions, month },
            { pDays: 0, pTaxable: 0, pTaxes: 0 }, 
            emp.toObject(),
            settings
        );

        res.json({ success: true, result });
    } catch (err) { 
        console.error("Payroll Calculation Error:", err);
        res.status(500).json({ error: "خطأ في حساب المرتب" }); 
    }
});

// التحويل العكسي (Net to Gross)
app.post("/api/payroll/net-to-gross", auth, async (req, res) => {
    try {
        await connectDB();
        const { targetNet } = req.body;
        const company = await Company.findById(req.user.companyId);
        const settings = company?.settings || { 
            insEmployeePercent: 0.11, 
            maxInsSalary: 16700, 
            personalExemption: 20000,
            medicalExemptionLimit: 10000
        };
        
        const calculationResults = calculateNetToGross(
            targetNet, 
            { month: new Date().toISOString().substring(0, 7) }, 
            { pDays: 0, pTaxable: 0, pTaxes: 0 }, 
            { insSalary: 0 }, 
            settings
        );

        res.json({ success: true, ...calculationResults });
    } catch (err) { 
        res.status(500).json({ error: "فشل التحويل العكسي" }); 
    }
});

// 4. التعامل مع الملفات الثابتة (Public Folder)
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
// أي مسار غير معروف يتم توجيهه لـ index.html لدعم تطبيقات الـ SPA (React/Vue/PlainJS)
app.get("*", (req, res) => { 
    res.sendFile(path.join(publicPath, "index.html"), (err) => {
        if (err) res.status(404).send("File not found");
    }); 
});

// 5. التشغيل (تعديل ليتناسب مع Vercel و Local)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server LIVE on http://localhost:${PORT} 🚀`));
}

// تصدير التطبيق لـ Vercel
module.exports = app;
