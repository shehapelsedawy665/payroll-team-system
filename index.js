const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// 1. الربط بقاعدة البيانات
const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));

const Payroll = mongoose.model("Payroll", new mongoose.Schema({
    employee_name: String, nationalId: String, month: String,
    gross: Number, taxableIncome: Number, monthlyTax: Number,
    days: Number, insurance: Number, martyrs: Number, net: Number
}));

const R = (n) => Math.round(n * 100) / 100;

// 2. الـ API Routes
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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

        const newEntry = new Payroll({ 
            employee_name: d.name, nationalId: d.nationalId, month: d.month, 
            gross, taxableIncome: currentTaxable, monthlyTax, days: d.days, 
            insurance, martyrs, net 
        });
        await newEntry.save();

        res.json({ gross, insurance, tax: monthlyTax, martyrs, net });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. الواجهة (HTML)
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Payroll System</title>
    <style>
        body { font-family: sans-serif; background: #f4f7f6; padding: 20px; text-align: center; }
        .box { max-width: 900px; margin: auto; background: white; padding: 25px; border-radius: 12px; shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 20px; }
        input { width: 90%; padding: 10px; margin: 5px; border: 1px solid #ddd; border-radius: 5px; text-align: center; }
        button { width: 100%; padding: 15px; background: #27ae60; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 18px; margin-top: 20px; }
        .res { margin-top: 25px; display: grid; grid-template-columns: repeat(5, 1fr); background: #2c3e50; color: white; padding: 15px; border-radius: 10px; }
        .res div span { display: block; color: #f1c40f; font-weight: bold; font-size: 20px; }
    </style>
</head>
<body>
    <div class="box">
        <h1>Payroll Team System</h1>
        <div class="grid">
            <div><input type="text" id="nid" placeholder="الرقم القومي" onblur="check()"></div>
            <div><input type="text" id="name" placeholder="الاسم"></div>
            <div><input type="month" id="month"></div>
            <div><input type="number" id="basic" value="10000"></div>
            <div><input type="number" id="trans" value="0" placeholder="بدلات"></div>
            <div><input type="number" id="comm" value="0" placeholder="عمولات"></div>
            <div><input type="number" id="days" value="30"></div>
            <div><input type="number" id="pDays" value="0" readonly></div>
            <div><input type="number" id="pTaxable" value="0" readonly><input type="hidden" id="pTaxes" value="0"></div>
        </div>
        <button onclick="doCalc()">حساب وحفظ</button>
        <div class="res">
            <div>Gross<span id="rG">0</span></div>
            <div>Ins<span id="rI">0</span></div>
            <div>Tax<span id="rT">0</span></div>
            <div>Martyr<span id="rM">0</span></div>
            <div>NET<span id="rN">0</span></div>
        </div>
    </div>
    <script>
        async function check() {
            const id = document.getElementById('nid').value;
            if(id.length < 14) return;
            try {
                const res = await fetch('/history/' + id);
                const data = await res.json();
                if(data.found) {
                    document.getElementById('name').value = data.name;
                    document.getElementById('pDays').value = data.prevDays;
                    document.getElementById('pTaxable').value = data.prevTaxable;
                    document.getElementById('pTaxes').value = data.prevTaxes;
                }
            } catch(e) { console.error("Check Error:", e); }
        }

        async function doCalc() {
            const bodyData = {
                nationalId: document.getElementById('nid').value,
                name: document.getElementById('name').value,
                month: document.getElementById('month').value,
                basic: Number(document.getElementById('basic').value),
                transport: Number(document.getElementById('trans').value),
                comm: Number(document.getElementById('comm').value),
                days: Number(document.getElementById('days').value),
                prevDays: Number(document.getElementById('pDays').value),
                prevTaxable: Number(document.getElementById('pTaxable').value),
                prevTaxes: Number(document.getElementById('pTaxes').value)
            };

            try {
                const res = await fetch('/calculate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(bodyData)
                });
                
                if(!res.ok) throw new Error("السيرفر رجع خطأ");
                
                const r = await res.json();
                document.getElementById('rG').innerText = r.gross;
                document.getElementById('rI').innerText = r.insurance;
                document.getElementById('rT').innerText = r.tax;
                document.getElementById('rM').innerText = r.martyrs;
                document.getElementById('rN').innerText = r.net;
                alert("تم الحساب والحفظ!");
            } catch(e) {
                alert("مشكلة في الحساب: " + e.message);
                console.error(e);
            }
        }
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running..."));
module.exports = app;
