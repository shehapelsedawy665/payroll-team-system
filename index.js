const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

let isConnected = false;
const connectDB = async () => {
    if (isConnected) return;
    try {
        await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 10000 });
        isConnected = true;
    } catch (err) { console.log("DB Error"); }
};

const Payroll = mongoose.model("Payroll", new mongoose.Schema({
    employee_name: String, nationalId: String, month: String,
    gross: Number, taxableIncome: Number, monthlyTax: Number,
    days: Number, insurance: Number, martyrs: Number, net: Number,
    calcType: String
}));

const R = (n) => Math.round(n * 100) / 100;

// دالة الحساب الأساسية (Gross to Net)
function calculateG2N(d) {
    const basicFull = Number(d.basic) || 0;
    const days = Number(d.days) || 30;
    const trans = Number(d.transport) || 0;
    const comm = Number(d.comm) || 0;

    const actualBasic = R((basicFull / 30) * days);
    const actualGross = actualBasic + trans + comm;
    const insurance = R(Math.min((basicFull + trans + comm), 16700) * 0.11);
    const martyrs = R(actualGross * 0.0005);
    const currentTaxable = R(actualGross - insurance - (20000 / 360 * days));
    
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
    const net = R(actualGross - insurance - monthlyTax - martyrs);
    
    return { gross: actualGross, insurance, tax: monthlyTax, martyrs, net };
}

// دالة العكس (Net to Gross) - Iterative Logic
function calculateN2G(d) {
    let targetNet = Number(d.netInput);
    let low = targetNet;
    let high = targetNet * 2; // افتراض أولي
    let result = {};

    for (let i = 0; i < 20; i++) { // 20 محاولة للوصول لدقة متناهية
        let mid = (low + high) / 2;
        d.basic = mid; d.transport = 0; d.comm = 0; // لتبسيط العكس بنرمي كله في الـ Basic
        result = calculateG2N(d);
        if (result.net < targetNet) low = mid;
        else high = mid;
    }
    return result;
}

app.get("/api/history/:id", async (req, res) => {
    await connectDB();
    const h = await Payroll.find({ nationalId: req.params.id }).lean();
    if (!h.length) return res.json({ found: false });
    let pD = 0, pTi = 0, pTx = 0;
    h.forEach(r => { pD += (r.days || 0); pTi += (r.taxableIncome || 0); pTx += (r.monthlyTax || 0); });
    res.json({ found: true, prevDays: pD, prevTaxable: pTi, prevTaxes: pTx, name: h[0].employee_name });
});

app.post("/api/calculate", async (req, res) => {
    await connectDB();
    const d = req.body;
    const resObj = d.type === 'N2G' ? calculateN2G(d) : calculateG2N(d);
    
    await new Payroll({ ...d, ...resObj, calcType: d.type }).save();
    res.json(resObj);
});

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Payroll System Expert</title>
    <style>
        :root { --primary: #1a73e8; --success: #27ae60; --dark: #2c3e50; --warning: #f1c40f; }
        body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; margin: 0; padding: 20px; }
        .container { max-width: 1000px; margin: auto; background: white; padding: 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .tabs { display: flex; gap: 10px; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 15px; }
        .tab { padding: 12px 25px; cursor: pointer; border-radius: 8px; font-weight: bold; background: #eee; transition: 0.3s; }
        .tab.active { background: var(--primary); color: white; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { border: 1px solid #ddd; padding: 20px; border-radius: 12px; }
        input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ccc; border-radius: 8px; text-align: center; font-size: 16px; }
        .btn { width: 100%; padding: 18px; background: var(--success); color: white; border: none; border-radius: 10px; font-size: 18px; font-weight: bold; cursor: pointer; margin-top: 20px; }
        .results { margin-top: 30px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; background: var(--dark); color: white; padding: 25px; border-radius: 12px; text-align: center; }
        .res-item span { display: block; font-size: 22px; color: var(--warning); font-weight: bold; }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="tabs">
            <div id="t1" class="tab active" onclick="switchTab('G2N')">Gross to Net (من الإجمالي للصفي)</div>
            <div id="t2" class="tab" onclick="switchTab('N2G')">Net to Gross (من الصافي للإجمالي)</div>
        </div>

        <div class="grid">
            <div class="card">
                <h3>| البيانات الأساسية</h3>
                <input type="text" id="nid" placeholder="الرقم القومي" onblur="check()">
                <input type="text" id="name" placeholder="الاسم">
                <input type="month" id="month">
            </div>

            <div class="card" id="inputCard">
                <h3 id="inputTitle">| المبالغ (Gross)</h3>
                <div id="g2n_inputs">
                    <input type="number" id="basic" placeholder="الأساسي" value="10000">
                    <input type="number" id="trans" placeholder="بدلات" value="0">
                    <input type="number" id="comm" placeholder="عمولات" value="0">
                </div>
                <div id="n2g_inputs" class="hidden">
                    <label>الصافي المطلوب تحويله:</label>
                    <input type="number" id="netInput" placeholder="أدخل الصافي هنا">
                </div>
            </div>

            <div class="card">
                <h3>| التراكمي</h3>
                <input type="number" id="days" value="30">
                <input type="number" id="pDays" id="pDays" value="0" readonly>
                <input type="number" id="pTaxable" value="0" readonly>
                <input type="hidden" id="pTaxes" value="0">
            </div>
        </div>

        <button class="btn" onclick="calc()">💾 احسب واحفظ البيانات</button>

        <div class="results">
            <div class="res-item">Gross<span id="oG">0</span></div>
            <div class="res-item">Insurance<span id="oI">0</span></div>
            <div class="res-item">Tax<span id="oT">0</span></div>
            <div class="res-item">Martyr<span id="oM">0</span></div>
            <div class="res-item">NET<span id="oN">0</span></div>
        </div>
    </div>

    <script>
        let currentMode = 'G2N';

        function switchTab(mode) {
            currentMode = mode;
            document.getElementById('t1').classList.toggle('active', mode === 'G2N');
            document.getElementById('t2').classList.toggle('active', mode === 'N2G');
            document.getElementById('g2n_inputs').classList.toggle('hidden', mode === 'N2G');
            document.getElementById('n2g_inputs').classList.toggle('hidden', mode === 'G2N');
            document.getElementById('inputTitle').innerText = mode === 'G2N' ? '| المبالغ (Gross)' : '| المبالغ (Net)';
        }

        async function check() {
            const id = document.getElementById('nid').value;
            if(id.length < 14) return;
            const res = await fetch('/api/history/' + id);
            const d = await res.json();
            if(d.found) {
                document.getElementById('name').value = d.name;
                document.getElementById('pDays').value = d.prevDays;
                document.getElementById('pTaxable').value = d.prevTaxable;
                document.getElementById('pTaxes').value = d.prevTaxes;
            }
        }

        async function calc() {
            const data = {
                type: currentMode,
                nationalId: document.getElementById('nid').value,
                name: document.getElementById('name').value,
                month: document.getElementById('month').value,
                basic: document.getElementById('basic').value,
                transport: document.getElementById('trans').value,
                comm: document.getElementById('comm').value,
                netInput: document.getElementById('netInput').value,
                days: document.getElementById('days').value,
                prevDays: document.getElementById('pDays').value,
                prevTaxable: document.getElementById('pTaxable').value,
                prevTaxes: document.getElementById('pTaxes').value
            };

            const res = await fetch('/api/calculate', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            const r = await res.json();
            document.getElementById('oG').innerText = r.gross.toLocaleString();
            document.getElementById('oI').innerText = r.insurance.toLocaleString();
            document.getElementById('oT').innerText = r.tax.toLocaleString();
            document.getElementById('oM').innerText = r.martyrs.toLocaleString();
            document.getElementById('oN').innerText = r.net.toLocaleString();
            alert("✅ تم الحساب بنجاح!");
        }
    </script>
</body>
</html>
    `);
});

app.listen(3000);
module.exports = app;
