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
    insSalary: Number, calcType: String
}));

const R = (n) => Math.round(n * 100) / 100;

function calculateG2N(d) {
    const basicFull = Number(d.basic) || 0;
    const days = Number(d.days) || 30;
    const trans = Number(d.transport) || 0;
    const comm = Number(d.comm) || 0;
    const insSalary = Number(d.insSalary) || 0;
    
    const prevDays = Number(d.prevDays) || 0;
    const prevTaxable = Number(d.prevTaxable) || 0;
    const prevTaxes = Number(d.prevTaxes) || 0;

    const actualBasic = R((basicFull / 30) * days);
    const actualGross = actualBasic + trans + comm;
    const insurance = R(insSalary * 0.11);
    const martyrs = R(actualGross * 0.0005);
    
    // الوعاء الضريبي للشهر الحالي
    const currentTaxable = R(actualGross - insurance - (20000 / 360 * days));
    
    // الحسبة التراكمية
    const totalDays = days + prevDays;
    const totalTaxable = currentTaxable + prevTaxable;
    
    // تحويل الوعاء السنوي (تقريب لأقرب 10 جنيه أقل)
    const annualTaxable = Math.floor(((totalTaxable / totalDays) * 360) / 10) * 10;
    
    let annualTax = 0;
    let temp = annualTaxable;

    // قانون الضرائب المصري (شامل المبالغ الكبيرة)
    temp = Math.max(0, temp - 40000); // الإعفاء الشخصي
    if (temp > 0) { let x = Math.min(temp, 15000); annualTax += x * 0.10; temp -= x; }
    if (temp > 0) { let x = Math.min(temp, 15000); annualTax += x * 0.15; temp -= x; }
    if (temp > 0) { let x = Math.min(temp, 130000); annualTax += x * 0.20; temp -= x; }
    if (temp > 0) { let x = Math.min(temp, 200000); annualTax += x * 0.225; temp -= x; }
    if (temp > 0) { annualTax += temp * 0.25; } // ما زاد عن ذلك

    // الضريبة المستحقة حتى تاريخه ناقص اللي اتدفع قبل كدة
    const totalTaxDueUntilNow = (annualTax / 360) * totalDays;
    const monthlyTax = R(Math.max(0, totalTaxDueUntilNow - prevTaxes));
    
    const net = R(actualGross - insurance - monthlyTax - martyrs);
    
    return { gross: actualGross, insurance, tax: monthlyTax, martyrs, net, currentTaxable };
}

function calculateN2G(d) {
    let targetNet = Number(d.netInput);
    let low = targetNet;
    let high = targetNet * 3; 
    let result = {};
    for (let i = 0; i < 30; i++) {
        let mid = (low + high) / 2;
        d.basic = mid; d.transport = 0; d.comm = 0;
        result = calculateG2N(d);
        if (result.net < targetNet) low = mid;
        else high = mid;
    }
    return result;
}

app.get("/api/history/:id", async (req, res) => {
    await connectDB();
    const h = await Payroll.find({ nationalId: req.params.id }).sort({_id: 1}).lean();
    if (!h.length) return res.json({ found: false });
    let pD = 0, pTi = 0, pTx = 0;
    h.forEach(r => { 
        pD += (r.days || 0); 
        pTi += (r.taxableIncome || 0); 
        pTx += (r.monthlyTax || 0); 
    });
    res.json({ found: true, prevDays: pD, prevTaxable: pTi, prevTaxes: pTx, name: h[0].employee_name, lastIns: h[h.length-1].insSalary });
});

app.post("/api/calculate", async (req, res) => {
    await connectDB();
    const d = req.body;
    const resObj = d.type === 'N2G' ? calculateN2G(d) : calculateG2N(d);
    await new Payroll({ 
        ...d, 
        gross: resObj.gross, 
        taxableIncome: resObj.currentTaxable, 
        monthlyTax: resObj.tax, 
        insurance: resObj.insurance, 
        martyrs: resObj.martyrs, 
        net: resObj.net, 
        calcType: d.type 
    }).save();
    res.json(resObj);
});

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Payroll Pro | شهاب السيداوي</title>
    <style>
        :root { --primary: #1a73e8; --success: #27ae60; --dark: #2c3e50; --warning: #f1c40f; }
        body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; margin: 0; padding: 20px; }
        .container { max-width: 1100px; margin: auto; background: white; padding: 30px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .tabs { display: flex; gap: 10px; margin-bottom: 30px; background: #eee; padding: 10px; border-radius: 12px; }
        .tab { flex: 1; text-align: center; padding: 12px; cursor: pointer; border-radius: 8px; font-weight: bold; transition: 0.3s; }
        .tab.active { background: var(--primary); color: white; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; }
        .card { border: 1px solid #ddd; padding: 20px; border-radius: 12px; }
        .card h3 { color: var(--primary); margin-top: 0; font-size: 1.1em; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; }
        label { display: block; font-size: 12px; color: #666; margin-top: 10px; font-weight: bold; }
        input { width: 100%; padding: 12px; margin: 5px 0; border: 1px solid #ccc; border-radius: 8px; text-align: center; font-size: 16px; box-sizing: border-box; }
        .btn { width: 100%; padding: 20px; background: var(--success); color: white; border: none; border-radius: 12px; font-size: 18px; font-weight: bold; cursor: pointer; margin-top: 25px; }
        .results { margin-top: 30px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; background: var(--dark); color: white; padding: 25px; border-radius: 15px; text-align: center; }
        .res-item span { display: block; font-size: 22px; color: var(--warning); font-weight: bold; }
        .hidden { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="tabs">
            <div id="t1" class="tab active" onclick="switchTab('G2N')">Gross to Net</div>
            <div id="t2" class="tab" onclick="switchTab('N2G')">Net to Gross</div>
        </div>
        <div class="grid">
            <div class="card">
                <h3>| البيانات الأساسية</h3>
                <label>الرقم القومي</label><input type="text" id="nid" onblur="check()">
                <label>الاسم</label><input type="text" id="name">
                <label>الشهر</label><input type="month" id="month">
            </div>
            <div class="card">
                <h3>| التأمينات</h3>
                <label>الأجر التأميني</label><input type="number" id="insSalary" value="0">
            </div>
            <div class="card">
                <h3 id="inputTitle">| المبالغ</h3>
                <div id="g2n_inputs">
                    <label>الأساسي</label><input type="number" id="basic" value="10000">
                    <label>بدلات</label><input type="number" id="trans" value="0">
                    <label>عمولات</label><input type="number" id="comm" value="0">
                </div>
                <div id="n2g_inputs" class="hidden">
                    <label>الصافي المستهدف</label><input type="number" id="netInput" placeholder="أدخل الصافي">
                </div>
            </div>
            <div class="card">
                <h3>| التراكمي</h3>
                <label>أيام الشهر</label><input type="number" id="days" value="30">
                <label>أيام سابقة</label><input type="number" id="pDays" value="0" readonly>
                <label>وعاء سابق</label><input type="number" id="pTaxable" value="0" readonly>
                <input type="hidden" id="pTaxes" value="0">
            </div>
        </div>
        <button class="btn" onclick="calc()">💾 حفظ وحساب الراتب</button>
        <div class="results">
            <div class="res-item"><p>Gross</p><span id="oG">0</span></div>
            <div class="res-item"><p>Insurance</p><span id="oI">0</span></div>
            <div class="res-item"><p>Tax</p><span id="oT">0</span></div>
            <div class="res-item"><p>Martyr</p><span id="oM">0</span></div>
            <div class="res-item"><p>NET</p><span id="oN">0</span></div>
        </div>
    </div>
    <script>
        let currentMode = 'G2N';
        function switchTab(m) {
            currentMode = m;
            document.getElementById('t1').className = m === 'G2N' ? 'tab active' : 'tab';
            document.getElementById('t2').className = m === 'N2G' ? 'tab active' : 'tab';
            document.getElementById('g2n_inputs').classList.toggle('hidden', m === 'N2G');
            document.getElementById('n2g_inputs').classList.toggle('hidden', m === 'G2N');
        }
        async function check() {
            const id = document.getElementById('nid').value;
            if(id.length < 14) return;
            const r = await fetch('/api/history/' + id);
            const d = await r.json();
            if(d.found) {
                document.getElementById('name').value = d.name;
                document.getElementById('pDays').value = d.prevDays || 0;
                document.getElementById('pTaxable').value = d.prevTaxable || 0;
                document.getElementById('pTaxes').value = d.prevTaxes || 0;
                document.getElementById('insSalary').value = d.lastIns || 0;
            }
        }
        async function calc() {
            const data = {
                type: currentMode,
                nationalId: document.getElementById('nid').value,
                name: document.getElementById('name').value,
                month: document.getElementById('month').value,
                insSalary: document.getElementById('insSalary').value,
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
            alert("تم الحساب والحفظ!");
        }
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running..."));
module.exports = app;
