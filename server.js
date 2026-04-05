const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const connectDB = require("./db");
const { runPayrollLogic } = require("./calculations");
const auth = require("./middleware/auth"); // استدعاء حرس الحدود
const Company = require("./models/Company"); // استدعاء موديل الشركات

const app = express();
app.use(cors());
app.use(express.json());

// 1. الاتصال بقاعدة البيانات
connectDB();

// 2. التعريفات (Schemas) - تم إضافة companyId لربط البيانات
const employeeSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: String, 
    nationalId: String, 
    hiringDate: String, 
    resignationDate: String, 
    insSalary: Number, 
    jobType: String
});
const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

const payrollSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    employeeId: mongoose.Schema.Types.ObjectId, 
    month: String, 
    payload: Object 
});
const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", payrollSchema);

// --- [APIs] ---

// الحصول على موظفين الشركة الخاصة بالمستخدم المسجل فقط
app.get("/api/employees", auth, async (req, res) => {
    try {
        const employees = await Employee.find({ companyId: req.user.companyId }).sort({_id: -1});
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: "Error fetching employees" });
    }
});

app.post("/api/employees", auth, async (req, res) => {
    try {
        const data = { ...req.body, companyId: req.user.companyId };
        const newEmp = new Employee(data);
        res.json(await newEmp.save());
    } catch (err) {
        res.status(500).json({ error: "Save failed" });
    }
});

app.get("/api/employees/:id/details", auth, async (req, res) => {
    try {
        // التأكد أن الموظف يتبع نفس شركة المستخدم
        const emp = await Employee.findOne({ _id: req.params.id, companyId: req.user.companyId });
        if (!emp) return res.status(404).json({ error: "Employee not found in your company" });

        const history = await Payroll.find({ employeeId: req.params.id, companyId: req.user.companyId }).sort({ month: 1 });
        
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        history.forEach(r => { 
            pDays += (Number(r.payload.days) || 0); 
            pTaxable += (Number(r.payload.currentTaxable) || 0); 
            pTaxes += (Number(r.payload.monthlyTax) || 0); 
        });
        
        res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
    } catch (err) {
        res.status(404).json({ error: "Process failed" });
    }
});

app.post("/api/payroll/calculate", auth, async (req, res) => {
    try {
        const { empId, month, days, fullBasic, fullTrans, additions, deductions, prevData, hiringDate, resignationDate } = req.body;
        
        // 1. جلب بيانات الموظف وإعدادات الشركة في وقت واحد
        const [emp, company] = await Promise.all([
            Employee.findOne({ _id: empId, companyId: req.user.companyId }),
            Company.findById(req.user.companyId)
        ]);

        if (!emp || !company) return res.status(404).json({ error: "Data missing" });

        // 2. تحديث تاريخ الاستقالة إذا وجد
        if (resignationDate) {
            await Employee.findByIdAndUpdate(empId, { resignationDate: resignationDate });
        }

        // 3. تنفيذ الحسبة باستخدام إعدادات الشركة الديناميكية
        const result = runPayrollLogic(
            { fullBasic, fullTrans, days, additions, deductions, month, hiringDate, resignationDate }, 
            prevData, 
            emp.toObject(),
            company.settings // تمرير الإعدادات الديناميكية هنا
        );

        // 4. حفظ السجل
        const record = await new Payroll({ 
            companyId: req.user.companyId,
            employeeId: empId, 
            month, 
            payload: result 
        }).save();
        
        res.json(record);
    } catch (err) {
        console.error("Calculation Error:", err);
        res.status(500).json({ error: "Calculation error occurred" });
    }
});

// Net to Gross - تم تحديثه ليكون ديناميكياً حسب إعدادات الشركة
app.post("/api/payroll/net-to-gross", auth, async (req, res) => {
    try {
        const { targetNet } = req.body;
        const company = await Company.findById(req.user.companyId);
        const settings = company.settings;

        let estimateGross = Number(targetNet);
        let finalResult = {};
        
        for (let i = 0; i < 100; i++) {
            finalResult = runPayrollLogic({
                fullBasic: estimateGross,
                fullTrans: 0,
                days: 30,
                additions: [],
                deductions: [],
                month: new Date().toISOString().substring(0, 7),
                hiringDate: null,
                resignationDate: null
            }, { pDays: 0, pTaxable: 0, pTaxes: 0 }, { insSalary: estimateGross }, settings);

            let diff = Number(targetNet) - finalResult.net;
            if (Math.abs(diff) < 0.01) break; 
            estimateGross += diff; 
        }

        res.json({
            gross: Math.round(estimateGross * 100) / 100,
            insSalary: finalResult.insBase,
            insEmployee: finalResult.insuranceEmployee,
            taxes: finalResult.monthlyTax,
            net: finalResult.net
        });
    } catch (err) {
        res.status(500).json({ error: "Net to Gross conversion failed" });
    }
});

app.delete("/api/employees/:id", auth, async (req, res) => {
    try {
        const deleted = await Employee.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
        if (deleted) {
            await Payroll.deleteMany({ employeeId: req.params.id, companyId: req.user.companyId });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Delete failed" });
    }
});

// --- [Static Files & Start] ---
const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
app.get("*", (req, res) => { 
    res.sendFile(path.join(publicPath, "index.html")); 
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server LIVE on ${PORT} 🚀`));
