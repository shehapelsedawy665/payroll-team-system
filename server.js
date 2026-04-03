const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// لينك قاعدة البيانات (تأكد من فتح الـ IP Access لـ 0.0.0.0/0 في MongoDB Atlas)
const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

mongoose.connect(mongoURI).then(() => console.log("✅ Payroll System Backend Live"));

const Payroll = mongoose.model("Payroll", new mongoose.Schema({
    employee_name: String,
    nationalId: String,
    month: String,
    gross: Number,
    taxableIncome: Number,
    monthlyTax: Number,
    days: Number,
    net: Number,
    created_at: { type: Date, default: Date.now }
}));

const R = (n) => Math.round(n * 100) / 100;

// API لجلب البيانات التاريخية للموظف بالرقم القومي
app.get("/history/:id", async (req, res) => {
    try {
        const history = await Payroll.find({ nationalId: req.params.id });
        let prevDays = 0, prevTaxable = 0, prevTaxes = 0;
        history.forEach(r => {
            prevDays += (r.days || 0);
            prevTaxable += (r.taxableIncome || 0);
            prevTaxes += (r.monthlyTax || 0);
        });
        res.json({ 
            found: history.length > 0, 
            prevDays, 
            prevTaxable, 
            prevTaxes, 
            name: history.length > 0 ? history[0].employee_name : "" 
        });
    } catch (err) { res.status(500).json(err); }
});

// API حساب الراتب وحفظه
app.post("/calculate", async (req, res) => {
    try {
        const d = req.body;
        
        // 1. حساب الراتب النسبي (Prorated)
        const proratedBasic = R((d.basic / 30) * d.days);
        const actualGross = proratedBasic + d.transport + d.special + d.comm;
        
        // 2. حساب التأمينات على "أصل المرتب" (Contracted Salary)
        const fullGrossForInsurance = d.basic + d.transport + d.special + d.comm;
        const insurance = R(Math.min(fullGrossForInsurance, 16700) * 0.11);
        
        // 3. حساب الوعاء الضريبي التراكمي
        const exemption = (d.taxCode == 4) ? 30000 : 20000;
        const currentTaxable = R(actualGross - insurance - (exemption / 360 * d.days));
        
        const totalDays = d.days + d.prevDays;
        const totalTaxable = currentTaxable + d.prevTaxable;
        
        // تحويل الوعاء السنوي لأقرب 10 جنيهات أقل (حسب القانون)
        const annualTaxable = Math.floor(((totalTaxable / totalDays) * 360) / 10) * 10;
        
        // 4. حساب شرائح الضريبة السنوية
        let annualTaxTotal = 0;
        let temp = annualTaxable;
        if (annualTaxable <= 600000) {
            temp = Math.max(0, temp - 40000); // الشريحة الصفرية
            if (temp > 0) { let x = Math.min(temp, 15000); annualTaxTotal += x * 0.1; temp -= x; }
            if (temp > 0) { let x = Math.min(temp, 15000); annualTaxTotal += x * 0.15; temp -= x; }
            if (temp > 0) { let x = Math.min(temp, 130000); annualTaxTotal += x * 0.2; temp -= x; }
        }

        // 5. استخراج ضريبة الشهر (طرح المسدد سابقاً)
        const taxDueUntilNow = R(annualTaxTotal / 360 * totalDays);
        let monthlyTax = R(taxDueUntilNow - d.prevTaxes);
        
        // لو العمالة غير منتظمة (10% مقطوعة)
        if (d.taxCode == 2) monthlyTax = R(currentTaxable * 0.1);

        const martyrs = R(actualGross * 0.0005);
        const net = R(actualGross - insurance - monthlyTax - martyrs);

        // حفظ السجل في MongoDB
        const record = new Payroll({
            employee_name: d.name,
            nationalId: d.nationalId,
            month: d.month,
            gross: actualGross,
            taxableIncome: currentTaxable,
            monthlyTax,
            days: d.days,
            net
        });
        await record.save();

        res.json({ gross: actualGross, insurance, tax: monthlyTax, martyrs, net });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));