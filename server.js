const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const connectDB = require("./db");
const { runPayrollLogic } = require("./calculations");

const app = express();
app.use(cors());
app.use(express.json());

// 1. الاتصال بقاعدة البيانات
connectDB();

// 2. التعريفات (Schemas)
const employeeSchema = new mongoose.Schema({
    name: String, 
    nationalId: String, 
    hiringDate: String, 
    resignationDate: String, // حقل تاريخ الاستقالة
    insSalary: Number, 
    jobType: String
});
const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

const payrollSchema = new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId, 
    month: String, 
    payload: Object // هنا بيتحفظ الـ additions والـ deductions كاملين بأساميهم
});
const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", payrollSchema);

// --- [APIs] ---

app.get("/api/employees", async (req, res) => {
    try {
        const employees = await Employee.find().sort({_id: -1});
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: "Error fetching employees" });
    }
});

app.post("/api/employees", async (req, res) => {
    const newEmp = new Employee(req.body);
    res.json(await newEmp.save());
});

app.get("/api/employees/:id/details", async (req, res) => {
    try {
        const emp = await Employee.findById(req.params.id);
        const history = await Payroll.find({ employeeId: req.params.id }).sort({ month: 1 });
        
        // حساب البيانات التراكمية (YTD) بدقة
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        history.forEach(r => { 
            pDays += (Number(r.payload.days) || 0); 
            pTaxable += (Number(r.payload.currentTaxable) || 0); 
            pTaxes += (Number(r.payload.monthlyTax) || 0); 
        });
        
        res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
    } catch (err) {
        res.status(404).json({ error: "Employee not found" });
    }
});

app.post("/api/payroll/calculate", async (req, res) => {
    try {
        const { empId, month, days, fullBasic, fullTrans, additions, deductions, prevData, hiringDate, resignationDate } = req.body;
        const emp = await Employee.findById(empId);

        // 1. تطبيق حدود التأمينات القانونية (Min/Max) لعام 2024/2025/2026
        const MAX_INS = 16700;
        const MIN_INS = 5384.62;
        let effectiveInsSalary = Math.min(MAX_INS, Math.max(MIN_INS, emp.insSalary || 0));
        
        // كائن موظف مؤقت للحسبة
        const empForCalc = { ...emp.toObject(), insSalary: effectiveInsSalary };

        // 2. تحديث تاريخ الاستقالة في قاعدة البيانات إذا وجد
        if (resignationDate) {
            await Employee.findByIdAndUpdate(empId, { resignationDate: resignationDate });
        }

        // 3. تنفيذ الحسبة - نمرر الـ additions والـ deductions كما هي ليتم معالجتها في calculations.js
        const result = runPayrollLogic(
            { fullBasic, fullTrans, days, additions, deductions, month, hiringDate, resignationDate }, 
            prevData, 
            empForCalc
        );

        // 4. التحقق من وجود سجل لنفس الشهر للموظف (اختياري: تحديث بدل إضافة جديد)
        // هنا الكود الحالي يضيف سجلاً جديداً دائماً بناءً على طلبك
        const record = await new Payroll({ 
            employeeId: empId, 
            month, 
            payload: result // يحتوي على تفاصيل الإضافات والخصومات للعرض الديناميكي
        }).save();
        
        res.json(record);
    } catch (err) {
        console.error("Calculation Error:", err);
        res.status(500).json({ error: "Calculation error occurred" });
    }
});

// [FIXED] Net to Gross - حساب الشامل من الصافي بمعادلات تكرارية
app.post("/api/payroll/net-to-gross", async (req, res) => {
    try {
        const { targetNet } = req.body;
        let estimateGross = Number(targetNet);
        let finalResult = {};
        
        const MAX_INS = 16700; 
        const MIN_INS = 5384.62;

        // Loop تكراري للوصول لأدق رقم (Iterative Calculation)
        for (let i = 0; i < 100; i++) {
            let cappedIns = Math.min(MAX_INS, Math.max(MIN_INS, estimateGross));

            finalResult = runPayrollLogic({
                fullBasic: estimateGross,
                fullTrans: 0,
                days: 30,
                additions: [],
                deductions: [],
                month: new Date().toISOString().substring(0, 7),
                hiringDate: null,
                resignationDate: null
            }, { pDays: 0, pTaxable: 0, pTaxes: 0 }, { insSalary: cappedIns });

            let diff = Number(targetNet) - finalResult.net;
            if (Math.abs(diff) < 0.01) break; // توقف عند دقة 1 قرش
            estimateGross += diff; 
        }

        res.json({
            gross: Math.round(estimateGross * 100) / 100,
            insSalary: Math.min(MAX_INS, Math.max(MIN_INS, estimateGross)),
            insEmployee: finalResult.insuranceEmployee,
            taxes: finalResult.monthlyTax,
            net: finalResult.net
        });
    } catch (err) {
        console.error("NetToGross Error:", err);
        res.status(500).json({ error: "Net to Gross conversion failed" });
    }
});

app.delete("/api/employees/:id", async (req, res) => {
    try {
        await Employee.findByIdAndDelete(req.params.id);
        await Payroll.deleteMany({ employeeId: req.params.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// إعداد ملفات الـ Static والـ Routing للـ Frontend
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
app.get("*", (req, res) => { 
    res.sendFile(path.join(publicPath, "index.html")); 
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server LIVE on ${PORT} 🚀`));
