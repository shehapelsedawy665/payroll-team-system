const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

mongoose.connect(mongoURI).catch(err => console.log("Conn Error:", err));

const Payroll = mongoose.model("Payroll", new mongoose.Schema({
    employee_name: String, nationalId: String, month: String,
    gross: Number, taxableIncome: Number, monthlyTax: Number,
    days: Number, insurance: Number, martyrs: Number, net: Number
}));

const R = (n) => Math.round(n * 100) / 100;

// API History
app.get("/api/history/:id", async (req, res) => {
    try {
        const history = await Payroll.find({ nationalId: req.params.id });
        if (!history.length) return res.json({ found: false });
        let pD = 0, pTi = 0, pTx = 0;
        history.forEach(r => { pD += (r.days || 0); pTi += (r.taxableIncome || 0); pTx += (r.monthlyTax || 0); });
        res.json({ found: true, prevDays: pD, prevTaxable: pTi, prevTaxes: pTx, name: history[0].employee_name });
    } catch (e) { res.status(500).send(e.message); }
});

// API Calculate
app.post("/api/calculate", async (req, res) => {
    try {
        const d = req.body;
        const actualBasic = R((d.basic / 30) * d.days);
        const gross = actualBasic + (Number(d.transport) || 0) + (Number(d.comm) || 0);
        const insurance = R(Math.min(gross, 16700) * 0.11);
        const currentTaxable = R(gross - insurance - (20000 / 360 * d.days));
        
        const totalDays = d.days + (Number(d.prevDays) || 0);
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
        const taxDueToDate = R(annualTax / 360 * totalDays);
        const monthlyTax = R(taxDueToDate - (Number(d.prevTaxes) || 0));
        const martyrs = R(gross * 0.0005);
        const net = R(gross - insurance - monthlyTax - martyrs);

        await new Payroll({ 
            employee_name: d.name, nationalId: d.nationalId, month: d.month, 
            gross, taxableIncome: currentTaxable, monthlyTax, days: d.days, insurance, martyrs, net 
        }).save();

        res.json({ gross, insurance, tax: monthlyTax, martyrs, net });
    } catch (e) { res.status(500).send(e.message); }
});

// HTML View
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Payroll System</title>
    <style>
        :root { --primary: #1a73e8; --success: #27ae60; --dark: #2c3e50; --warning: #f1c40f; }
        body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; margin: 0; padding: 20px; text-align:center; }
        .container { max-width: 1050px; margin: auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom:20px; }
        .card { border: 1px solid #e1e4e8; padding: 20px; border-radius: 12px; }
        input { width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; text-align: center; font-size:16px; }
        .btn { width: 100%; padding: 18px; background: var(--success); color: white; border: none; border-radius: 10px; font-size: 18px; font-weight: bold; cursor: pointer; }
        .results { margin-top: 30px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; background: var(--dark); color: white; padding: 25px; border-radius: 12px; }
        .res-item span { display: block; font-size: 24px; color: var(--warning); font-weight: bold; margin-top: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 نظام إدارة الرواتب المتكامل</h1>
        <div class="grid">
            <div class="card">
                <h3>البيانات الأساسية</h3>
                <input type="text" id="nid" placeholder="الرقم القومي" onblur="check()">
                <input type="text" id="name" placeholder="الاسم">
                <input type="month" id="month">
            </div>
            <div class="card">
                <h3>الماليات</h3>
                <input type="number" id="basic" value="10000">
                <input type="number" id="trans" value="0" placeholder="بدلات">
                <input type="number" id="comm" value="0" placeholder="عمولات">
            </div>
            <div class="card">
                <h3>التراكمي</h3>
                <input type="number" id="days" value="30">
                <input type="number" id="pDays" value="0" readonly>
                <input type="number" id="pTaxable" value="0" readonly>
                <input type="hidden" id="pTaxes" value="0">
            </div>
        </div>
        <button class="btn" onclick="calc()">💾 اعتماد وحفظ الراتب</button>
        <div class="results">
            <div class="res-item">Gross<span id="oG">0</span></div>
            <div class="res-item">Ins<span id="oI">0</span></div>
            <div class="res-item">Tax<span id="oT">0</span></div>
            <div class="res-item">Martyr<span id="oM">0</span></div>
            <div class="res-item">NET<span id="oN">0</span></div>
        </div>
    </div>
    <script>
        async function check() {
            const id = document.getElementById('nid').value;
            if(id.length < 14) return;
            const r = await fetch('/api/history/' + id);
            const d = await r.json();
            if(d.found) {
                document.getElementById('name').value = d.name;
                document.getElementById('pDays').value = d.prevDays;
                document.getElementById('pTaxable').value = d.prevTaxable;
                document.getElementById('pTaxes').value = d.prevTaxes;
            }
        }
        async function calc() {
            const btn = document.querySelector('.btn');
            btn.disabled = true;
            const data = {
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
                const res = await fetch('/api/calculate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
                if(!res.ok) throw new Error(await res.text());
                const r = await res.json();
                document.getElementById('oG').innerText = r.gross.toLocaleString();
                document.getElementById('oI').innerText = r.insurance.toLocaleString();
                document.getElementById('oT').innerText = r.tax.toLocaleString();
                document.getElementById('oM').innerText = r.martyrs.toLocaleString();
                document.getElementById('oN').innerText = r.net.toLocaleString();
                alert("✅ تم الحساب والحفظ!");
            } catch(e) {
                alert("❌ خطأ: " + e.message);
            } finally { btn.disabled = false; }
        }
    </script>
</body>
</html>
    `);
});

module.exports = app;
