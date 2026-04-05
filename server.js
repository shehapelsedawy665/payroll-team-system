const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./db");
const { runPayrollLogic } = require("./calculations");

const app = express();
app.use(cors());
app.use(express.json());

// الاتصال بالقاعدة
connectDB();

// تعريف الـ Schemas
const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({
    name: String, 
    nationalId: String, 
    hiringDate: String, 
    insSalary: Number, 
    jobType: String
}));

const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId, 
    month: String, 
    payload: Object 
}));

// --- [APIs] ---

// جلب كل الموظفين
app.get("/api/employees", async (req, res) => res.json(await Employee.find().sort({_id: -1})));

// إضافة موظف جديد
app.post("/api/employees", async (req, res) => res.json(await new Employee(req.body).save()));

// جلب تفاصيل الموظف وسجلاته المالية (الحساب التراكمي للضرائب YTD)
app.get("/api/employees/:id/details", async (req, res) => {
    const emp = await Employee.findById(req.params.id);
    // ترتيب السجلات حسب الشهر لضمان دقة التسلسل
    const history = await Payroll.find({ employeeId: req.params.id }).sort({ month: 1 });
    
    let pDays = 0, pTaxable = 0, pTaxes = 0;
    history.forEach(r => { 
        pDays += (Number(r.payload.days) || 0); 
        pTaxable += (Number(r.payload.currentTaxable) || 0); 
        pTaxes += (Number(r.payload.monthlyTax) || 0); 
    });
    
    res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
});

// الحسبة الأساسية وحفظ السجل المالي الجديد
app.post("/api/payroll/calculate", async (req, res) => {
    try {
        const { 
            empId, month, days, fullBasic, fullTrans, 
            additions, deductions, prevData,
            hiringDate, resignationDate 
        } = req.body;

        const emp = await Employee.findById(empId);
        
        // استدعاء دالة الحسابات وإرسال كل المتغيرات المطلوبة للـ Logic الجديد
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

        // حفظ النتيجة في الداتابيز كشهر جديد
        const record = await new Payroll({ 
            employeeId: empId, 
            month, 
            payload: result 
        }).save();

        res.json(record);
    } catch (err) {
        console.error("Calculation Error:", err);
        res.status(500).json({ error: "حدث خطأ أثناء معالجة الحسابات" });
    }
});

// حذف الموظف نهائياً وسجلاته
app.delete("/api/employees/:id", async (req, res) => {
    await Employee.findByIdAndDelete(req.params.id);
    await Payroll.deleteMany({ employeeId: req.params.id });
    res.json({ success: true });
});

// تصفية السجل المالي (الاستقالة) - بنصفر الداتا عشان لو حصل Rehire يبدأ من جديد
app.post("/api/employees/:id/resign", async (req, res) => {
    await Payroll.deleteMany({ employeeId: req.params.id });
    res.json({ success: true });
});

// تشغيل الملفات الاستاتيكية من فولدر public
app.use(express.static("public"));
app.get("/", (req, res) => res.sendFile(__dirname + "/public/index.html"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Payroll Server is LIVE on port ${PORT}`));
