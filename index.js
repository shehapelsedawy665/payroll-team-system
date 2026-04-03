const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

// تعديل الاتصال ليكون أسرع وأقوى
mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000 // يصبر 5 ثواني بس لو موصلش يدينا خبر
}).then(() => console.log("✅ Connected to DB"))
  .catch(err => console.log("❌ DB Error:", err));

const Payroll = mongoose.model("Payroll", new mongoose.Schema({
    employee_name: String, nationalId: String, month: String,
    gross: Number, taxableIncome: Number, monthlyTax: Number,
    days: Number, insurance: Number, martyrs: Number, net: Number
}));

const R = (n) => Math.round(n * 100) / 100;

app.get("/api/history/:id", async (req, res) => {
    try {
        const history = await Payroll.find({ nationalId: req.params.id }).maxTimeMS(2000);
        if (!history.length) return res.json({ found: false });
        let pD = 0, pTi = 0, pTx = 0;
        history.forEach(r => { pD += (r.days || 0); pTi += (r.taxableIncome || 0); pTx += (r.monthlyTax || 0); });
        res.json({ found: true, prevDays: pD, prevTaxable: pTi, prevTaxes: pTx, name: history[0].employee_name });
    } catch (e) { res.status(500).json({ error: "DB Timeout" }); }
});

app.post("/api/calculate", async (req, res) => {
    try {
        const d = req.body;
        const actualBasic = R((d.basic / 30) * d.days);
        const gross = actualBasic + (Number(d.transport) || 0) + (Number(d.comm) || 0);
        const insurance = R(Math.min(gross, 16700) * 0.11);
        const currentTaxable = R(gross - insurance - (20000 / 360 * d.days));
        const totalDays = Number(d.days) + (Number(d.prevDays) || 0);
        const totalTaxable = currentTaxable + (Number(d.prevTaxable) || 0);
        const annualTaxable = Math.floor(((totalTaxable / totalDays) * 360) / 10) * 10;
        
        let annualTax = 0;
        let temp = annualTaxable;
        if (temp <= 600000) {
            temp = Math.max(0, temp - 40000);
            if (temp > 0) { let x = Math.min(temp, 15000); annualTax += x * 0.1; temp -= x; }
            if (temp > 0) { let x = Math.min(temp, 15000); annualTax += x * 0.15; temp -= x; }
            if (temp > 0) { let x = Math.min(temp, 130000); annualTax += x * 0.2; temp -= x; }
        }
        const monthlyTax = R((annualTax / 360 * totalDays) - (Number(d.prevTaxes) || 0));
        const martyrs = R(gross * 0.0005);
        const net = R(gross - insurance - monthlyTax - martyrs);

        await new Payroll({ 
            employee_name: d.name, nationalId: d.nationalId, month: d.month, 
            gross, taxableIncome: currentTaxable, monthlyTax, days: d.days, insurance, martyrs, net 
        }).save();

        res.json({ gross, insurance, tax: monthlyTax, martyrs, net });
    } catch (e) { res.status(500).json({ error: "Save Error: " + e.message }); }
});

app.get("/", (req, res) => {
    res.send(`... كود الـ HTML اللي فات بالظبط بدون تغيير ...`);
});

module.exports = app;
