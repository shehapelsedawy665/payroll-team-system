const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const connectDB = require("./db");
const { runPayrollLogic } = require("./calculations");

const app = express();
app.use(cors());
app.use(express.json());

// 1. الاتصال بالقاعدة
connectDB();

// 2. تعريف الـ Schemas
const employeeSchema = new mongoose.Schema({
    name: String, 
    nationalId: String, 
    hiringDate: String, 
    insSalary: Number, 
    jobType: String
});
const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

const payrollSchema = new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId, 
    month: String, 
    payload: Object 
});
const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", payrollSchema);

// --- [APIs] ---

// جلب كل الموظفين
app.get("/api/employees", async (req, res) => {
    try {
        const employees = await Employee.find().sort({_id: -1});
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: "خطأ في جلب البيانات" });
    }
});

// إضافة موظف جديد
app.post("/api/employees", async (req, res) => {
    const newEmp = new Employee(req.body);
    res.json(await newEmp.save());
});

// جلب تفاصيل الموظف وسجلاته المالية (YTD)
app.get("/api/employees/:id/details", async (req, res) => {
    try {
        const emp = await Employee.findById(req.params.id);
        const history = await Payroll.find({ employeeId: req.params.id }).sort({ month: 1 });
        
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        history.forEach(r => { 
            pDays += (Number(r.payload.days) || 0); 
            pTaxable += (Number(r.payload.currentTaxable) || 0); 
            pTaxes += (Number(r.payload.monthlyTax) || 0); 
        });
        
        res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
    } catch (err) {
        res.status(404).json({ error: "الموظف غير موجود" });
    }
});

// الحسبة الأساسية وحفظ السجل
app.post("/api/payroll/calculate", async (req, res) => {
    try {
        const { 
            empId, month, days, fullBasic, fullTrans, 
            additions, deductions, prevData,
            hiringDate, resignationDate 
        } = req.body;

        const emp = await Employee.findById(empId);
        
        const result = runPayrollLogic({ 
            fullBasic, 
            fullTrans, 
            days, 
            additions, 
            deductions,
            month,
            hiringDate,
            resignationDate
        }, prevData, emp);

        const record = await new Payroll({ 
            employeeId: empId, 
            month, 
            payload: result 
        }).save();

        res.json(record);
    } catch (err) {
        res.status(500).json({ error: "حدث خطأ أثناء معالجة الحسابات" });
    }
});

/**
 * [MODIFIED] Net to Gross API
 * التعديل: حساب التأمينات بناءً على الراتب الشامل المتوقع تلقائياً
 */
app.post("/api/payroll/net-to-gross", async (req, res) => {
    try {
        const { targetNet } = req.body;
        let estimateGross = Number(targetNet);
        let finalResult = {};
        
        for (let i = 0; i < 100; i++) {
            // بنفترض إن التأمينات = الشامل في كل لفة عشان الدقة
            finalResult = runPayrollLogic({
                fullBasic: estimateGross,
                fullTrans: 0,
                days: 30,
                additions: [],
                deductions: [],
                month: new Date().toISOString().substring(0, 7),
                hiringDate: null,
                resignationDate: null
            }, { pDays: 0, pTaxable: 0, pTaxes: 0 }, { insSalary: estimateGross });

            let diff = Number(targetNet) - finalResult.net;
            if (Math.abs(diff) < 0.01) break;
            estimateGross += diff; 
        }

        res.json({
            gross: Math.round(estimateGross),
            insSalary: Math.round(estimateGross),
            insEmployee: finalResult.insuranceEmployee,
            taxes: finalResult.monthlyTax,
            net: finalResult.net
        });
    } catch (err) {
        res.status(500).json({ error: "فشل حساب الـ Net to Gross" });
    }
});

// حذف الموظف
app.delete("/api/employees/:id", async (req, res) => {
    await Employee.findByIdAndDelete(req.params.id);
    await Payroll.deleteMany({ employeeId: req.params.id });
    res.json({ success: true });
});

// تصفية السجل (Resign)
app.post("/api/employees/:id/resign", async (req, res) => {
    await Payroll.deleteMany({ employeeId: req.params.id });
    res.json({ success: true });
});

// --- [Static Files Logic] ---
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
app.get("*", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Payroll Server is LIVE on port ${PORT} 🚀`));
