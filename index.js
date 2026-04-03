const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// الربط بقاعدة البيانات (تأكد إن البيانات دي صحيحة)
const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";
mongoose.connect(mongoURI).then(() => console.log("✅ Database Connected"));

const Payroll = mongoose.model("Payroll", new mongoose.Schema({
    employee_name: String, nationalId: String, month: String,
    gross: Number, taxableIncome: Number, monthlyTax: Number,
    days: Number, insurance: Number, martyrs: Number, net: Number
}));

const R = (n) => Math.round(n * 100) / 100;

// --- API جلب البيانات القديمة ---
app.get("/history/:id", async (req, res) => {
    try {
        const history = await Payroll.find({ nationalId: req.params.id });
        let prevDays = 0, prevTaxable = 0, prevTaxes = 0;
        history.forEach(r => { 
            prevDays += (r.days || 0); 
            prevTaxable += (r.taxableIncome || 0); 
            prevTaxes += (r.monthlyTax || 0); 
        });
        res.json({ found: history.length > 0, prevDays, prevTaxable, prevTaxes, name: history.length > 0 ? history[0].employee_name : "" });
    } catch (err) { res.status(500).json(err); }
});

// --- API الحساب الرئيسي (ده اللي بيخلي الخانات تحسب) ---
app.post("/calculate", async (req, res) => {
    try {
        const d = req.body;
        const actualBasic = R((d.basic / 30) * d.days);
        const gross = actualBasic + d.transport + d.comm;
        const insurance = R(Math.min((d.basic + d.transport + d.comm), 16700) * 0.11);
        const currentTaxable = R(gross - insurance - (20000 / 360 * d.days));
        const totalDays = d.days + d.prevDays;
        const totalTaxable = currentTaxable + d.prevTaxable;
        const annualTaxable = Math.floor(((totalTaxable / totalDays) * 360) / 10) * 10;
        
        let annualTax = 0;
        let temp = annualTaxable;
        if (temp <= 600000) {
            temp = Math.max(0, temp - 40000);
            if (temp > 0) { let x = Math.min(temp, 15000); annualTax += x * 0.1; temp -= x; }
            if (temp > 0) { let x = Math.min(temp, 15000); annualTax += x * 0.15; temp -= x; }
            if (temp > 0) { let x = Math.min(temp, 130000); annualTax += x * 0.2; temp -= x; }
        }
        
        const taxDueToDate = R(annualTax / 360 * totalDays);
        const monthlyTax = R(taxDueToDate - d.prevTaxes);
        const martyrs = R(gross * 0.0005);
        const net = R(gross - insurance - monthlyTax - martyrs);

        // الحفظ في قاعدة البيانات
        await new Payroll({ 
            employee_name: d.name, nationalId: d.nationalId, month: d.month, 
            gross, taxableIncome: currentTaxable, monthlyTax, days: d.days, 
            insurance, martyrs, net 
        }).save();

        // إرسال النتائج للمتصفح عشان تظهر في الخانات
        res.json({ gross, insurance, tax: monthlyTax, martyrs, net });
    } catch (err) { res.status(500).json(err); }
});

// --- كود الـ HTML اللي بيعرض الصفحة (نفس شكلك الحالي) ---
app.get("/", (req, res) => {
    res.send(`... (حط هنا كود الـ HTML اللي معاك اللي فيه التصميم الشيك) ...`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server Running"));
module.exports = app;
