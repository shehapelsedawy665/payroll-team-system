const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

// إدارة الاتصال بقاعدة البيانات لمنع الـ Timeout
let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    try {
        await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        isConnected = true;
        console.log("✅ Database Connected");
    } catch (err) {
        console.log("❌ Database Connection Error:", err);
    }
};

const Payroll = mongoose.model("Payroll", new mongoose.Schema({
    employee_name: String, nationalId: String, month: String,
    gross: Number, taxableIncome: Number, monthlyTax: Number,
    days: Number, insurance: Number, martyrs: Number, net: Number
}));

const R = (n) => Math.round(n * 100) / 100;

// API لخدمة البيانات التاريخية
app.get("/api/history/:id", async (req, res) => {
    await connectDB();
    try {
        const history = await Payroll.find({ nationalId: req.params.id }).lean();
        if (!history.length) return res.json({ found: false });
        let pD = 0, pTi = 0, pTx = 0;
        history.forEach(r => { 
            pD += (r.days || 0); 
            pTi += (r.taxableIncome || 0); 
            pTx += (r.monthlyTax || 0); 
        });
        res.json({ found: true, prevDays: pD, prevTaxable: pTi, prevTaxes: pTx, name: history[0].employee_name });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// API الحساب والاعتماد
app.post("/api/calculate", async (req, res) => {
    await connectDB();
    try {
        const d = req.body;
        const basic = Number(d.basic) || 0;
        const days = Number(d.days) || 0;
        const trans = Number(d.transport) || 0;
        const comm = Number(d.comm) || 0;
        
        const actualBasic = R((basic / 30) * days);
        const gross = actualBasic + trans + comm;
        const insurance = R(Math.min(gross, 16700) * 0.11);
        const currentTaxable = R(gross - insurance - (20000 / 360 * days));
        
        const totalDays = days + (Number(d.prevDays) || 0);
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

        const newRecord = new Payroll({ 
            employee_name: d.name, nationalId: d.nationalId, month: d.month, 
            gross, taxableIncome: currentTaxable, monthlyTax, days, insurance, martyrs, net 
        });
        await newRecord.save();

        res.json({ gross, insurance, tax: monthlyTax, martyrs, net });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// واجهة المستخدم (HTML)
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Payroll System | Payroll Team</title>
    <style>
        :root { --primary: #1a73e8; --success: #27ae60; --dark: #2c3e50; --warning: #f1c40f; }
        body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; margin: 0; padding: 20px; }
        .container { max-width: 1050px; margin: auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
        h1 { text-align: center; color: var(--dark); margin-bottom: 30px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 20px; }
        .card { border: 1px solid #e1e4e8; padding: 20px; border-radius: 12px; }
        .card h3 { color: var(--primary); margin-top: 0; border-right: 4px solid var(--primary); padding-right: 10px; text-align: right; }
        input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; text-align: center; font-size: 16px; }
        .btn { width: 100%; padding: 18px; background: var(--success); color: white; border: none; border-radius: 10px; font-size: 18px; font-weight: bold; cursor: pointer; margin-top: 20px; }
        .results { margin-top: 30px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; background: var(--dark); color: white; padding: 25px; border-radius: 12px; text-align: center; }
        .res-item span { display: block; font-size: 24px; color: var(--warning); font-weight: bold; margin-top: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 نظام إدارة الرواتب المتكامل</h1>
        <div class="grid">
            <div class="card">
                <h3>| البيانات الأساسية</h3>
                <input type="text" id="nid" placeholder="الرقم القومي" onblur="check()">
                <input type="text" id="name" placeholder="اسم الموظف">
                <input type="month" id="month">
            </div>
            <div class="card">
                <h3>| الماليات</h3>
                <input type="number" id="basic" value="10000" placeholder="الأساسي">
                <input type="number" id="trans" value="0" placeholder="بدلات">
                <input type="number" id="comm" value="0" placeholder="عمولات">
            </div>
            <div class="card">
                <h3>| التراكمي</h3>
                <input type="number" id="days" value="30" placeholder="أيام العمل">
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
            try {
                const res = await fetch('/api/history/' + id);
                const d = await res.json();
                if(d.found) {
                    document.getElementById('name').value = d.name;
                    document.getElementById('pDays').value = d.prevDays;
                    document.getElementById('pTaxable').value = d.prevTaxable;
                    document.getElementById('pTaxes').value = d.prevTaxes;
                }
            } catch(e) { console.log("History check failed"); }
        }
        async function calc() {
            const data = {
                nationalId: document.getElementById('nid').value,
                name: document.getElementById('name').value,
                month: document.getElementById('month').value,
                basic: document.getElementById('basic').value,
                transport: document.getElementById('trans').value,
                comm: document.getElementById('comm').value,
                days: document.getElementById('days').value,
                prevDays: document.getElementById('pDays').value,
                prevTaxable: document.getElementById('pTaxable').value,
                prevTaxes: document.getElementById('pTaxes').value
            };
            try {
                const res = await fetch('/api/calculate', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
                const r = await res.json();
                if(r.error) throw new Error(r.error);
                document.getElementById('oG').innerText = r.gross.toLocaleString();
                document.getElementById('oI').innerText = r.insurance.toLocaleString();
                document.getElementById('oT').innerText = r.tax.toLocaleString();
                document.getElementById('oM').innerText = r.martyrs.toLocaleString();
                document.getElementById('oN').innerText = r.net.toLocaleString();
                alert("✅ تم الحساب والحفظ بنجاح!");
            } catch(e) { alert("❌ خطأ: " + e.message); }
        }
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server up on port " + PORT));

module.exports = app;
