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
    insSalary: Number, calcType: String, employmentType: String,
    hiringDate: Date, resignationDate: Date
}));

// دالة الحسابات الدقيقة
function calculateG2N(d) {
    const basicFull = Number(d.basic) || 0;
    const days = Number(d.days) || 30;
    const insSalary = Number(d.insSalary) || 0;
    const hDate = d.hiringDate ? new Date(d.hiringDate) : null;
    const rDate = d.resignationDate ? new Date(d.resignationDate) : null;
    const currentMonthDate = new Date(d.month + "-01");

    // 1. حساب التأمينات (Logic 1st day check)
    let insurance = 0;
    const isHiredAfterFirst = hDate && hDate.getDate() > 1 && hDate.getMonth() === currentMonthDate.getMonth();
    const isResignedSameMonth = rDate && rDate.getMonth() === currentMonthDate.getMonth();
    
    if (!(isHiredAfterFirst && !isResignedSameMonth)) {
        insurance = insSalary * 0.11; 
    }

    const actualBasic = (basicFull / 30) * days;
    const actualGross = actualBasic;
    const martyrs = actualGross * 0.0005;
    
    const currentTaxable = actualGross - insurance;
    const totalDays = days + (Number(d.prevDays) || 0);
    const totalTaxable = currentTaxable + (Number(d.prevTaxable) || 0);
    
    // 2. الوعاء السنوي (Floor 10) - أهم خطوة للضرائب
    const annualTaxable = Math.floor(((totalTaxable / totalDays) * 360) / 10) * 10;
    
    let annualTax = 0;
    let temp = Math.max(0, annualTaxable - 20000); // إعفاء شخصي

    // 3. الشرائح (بدون تقريب وسيط)
    if (annualTaxable <= 600000) {
        if (temp > 40000) { let x = Math.min(temp - 40000, 15000); annualTax += x * 0.10; }
        if (temp > 55000) { let x = Math.min(temp - 55000, 15000); annualTax += x * 0.15; }
        if (temp > 70000) { let x = Math.min(temp - 70000, 130000); annualTax += x * 0.20; }
        if (temp > 200000) { let x = Math.min(temp - 200000, 200000); annualTax += x * 0.225; }
        if (temp > 400000) { let x = Math.min(temp - 400000, 200000); annualTax += x * 0.25; }
        if (temp > 600000) { annualTax += (temp - 600000) * 0.275; }
    } else if (annualTaxable <= 900000) {
        if (temp > 0) { let x = Math.min(temp, 200000); annualTax += x * 0.20; }
        if (temp > 200000) { let x = Math.min(temp - 200000, 200000); annualTax += x * 0.225; }
        if (temp > 400000) { annualTax += (temp - 400000) * 0.25; }
    } else {
        if (temp > 0) { let x = Math.min(temp, 400000); annualTax += x * 0.225; }
        if (temp > 400000) { let x = Math.min(temp - 400000, 800000); annualTax += x * 0.25; }
        if (temp > 1200000) { annualTax += (temp - 1200000) * 0.275; }
    }

    const totalTaxDueUntilNow = (annualTax / 360) * totalDays;
    const monthlyTax = Math.max(0, totalTaxDueUntilNow - (Number(d.prevTaxes) || 0));
    
    // التقريب النهائي فقط
    return { 
        gross: Math.round(actualGross * 100) / 100, 
        insurance: Math.round(insurance * 100) / 100, 
        tax: Math.round(monthlyTax * 100) / 100, 
        martyrs: Math.round(martyrs * 100) / 100, 
        net: Math.round((actualGross - insurance - monthlyTax - martyrs) * 100) / 100,
        currentTaxable
    };
}

app.get("/api/check-employee/:nid", async (req, res) => {
    await connectDB();
    const history = await Payroll.find({ nationalId: req.params.nid }).sort({month: 1}).lean();
    if (history.length > 0) {
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        let savedMonths = history.map(h => h.month);
        history.forEach(r => { pDays += r.days; pTaxable += r.taxableIncome; pTaxes += r.monthlyTax; });
        const last = history[history.length - 1];
        res.json({ status: "old", name: last.employee_name, empType: last.employmentType, hDate: last.hiringDate, rDate: last.resignationDate, lastIns: last.insSalary, pDays, pTaxable, pTaxes, savedMonths });
    } else { res.json({ status: "new" }); }
});

app.post("/api/calculate", async (req, res) => {
    await connectDB();
    const d = req.body;
    const resObj = calculateG2N(d);
    await new Payroll({ ...d, ...resObj, taxableIncome: resObj.currentTaxable, monthlyTax: resObj.tax }).save();
    res.json(resObj);
});

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Payroll Pro | Sedawy</title>
    <style>
        :root { --primary: #1a73e8; --success: #27ae60; --dark: #2c3e50; }
        body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; padding: 20px; margin:0; }
        .container { max-width: 1000px; margin: 20px auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
        .card { border: 1px solid #eee; padding: 20px; border-radius: 10px; }
        label { display: block; margin-top: 10px; font-size: 12px; font-weight: bold; color: #666; }
        input, select { width: 100%; padding: 12px; margin-top: 5px; border: 1px solid #ccc; border-radius: 8px; box-sizing: border-box; font-size: 15px; }
        .btn { width: 100%; padding: 18px; background: var(--success); color: white; border: none; border-radius: 10px; font-size: 18px; font-weight: bold; cursor: pointer; margin-top: 25px; transition: 0.3s; }
        .btn:hover { background: #219150; }
        .res-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 30px; background: var(--dark); color: white; padding: 25px; border-radius: 12px; text-align: center; }
        .res-grid span { display: block; font-size: 22px; color: #f1c40f; margin-top: 5px; font-weight: bold; }
        .error { color: #d32f2f; font-size: 11px; margin-top: 5px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h2 style="text-align:center; color: var(--primary);">Payroll Precision System</h2>
        <div class="grid">
            <div class="card">
                <h3>| الموظف</h3>
                <label>الرقم القومي</label><input type="text" id="nid" onblur="checkEmp()">
                <label>الاسم</label><input type="text" id="name">
                <label>نوع العمل</label>
                <select id="empType" onchange="validateIns()">
                    <option value="Full Time">Full Time</option>
                    <option value="Part Time">Part Time</option>
                </select>
            </div>
            <div class="card">
                <h3>| التواريخ والأيام</h3>
                <label>تاريخ التعيين</label><input type="date" id="hiringDate" onchange="suggestDays()">
                <label>تاريخ الاستقالة</label><input type="date" id="resignationDate" onchange="suggestDays()">
                <label>أيام العمل (Editable)</label><input type="number" id="days" value="30">
                <label>شهر الاحتساب</label><select id="monthSelect"></select>
            </div>
            <div class="card">
                <h3>| المبالغ</h3>
                <label>الأجر التأميني</label><input type="number" id="insSalary" oninput="validateIns()">
                <div id="insErr" class="error" style="display:none;"></div>
                <label>Gross Salary</label><input type="number" id="basic">
            </div>
        </div>

        <input type="hidden" id="pDays" value="0"><input type="hidden" id="pTaxable" value="0"><input type="hidden" id="pTaxes" value="0">

        <button class="btn" onclick="saveRecord()">🚀 حفظ ومعالجة الراتب</button>

        <div class="res-grid">
            <div>Gross <span id="oG">0</span></div>
            <div>Insurance <span id="oI">0</span></div>
            <div>Tax <span id="oT">0</span></div>
            <div>Martyr <span id="oM">0</span></div>
            <div>NET <span id="oN">0</span></div>
        </div>
    </div>

    <script>
        // دالة تحديد الأيام أوتوماتيك (بحد أقصى 30 وأدنى 1)
        function suggestDays() {
            const h = document.getElementById('hiringDate').value;
            const r = document.getElementById('resignationDate').value;
            const m = document.getElementById('monthSelect').value;
            if(!m) return;

            let start = new Date(m + "-01");
            let end = new Date(new Date(m + "-01").setMonth(start.getMonth() + 1, 0)); // آخر يوم في الشهر
            
            if(h && new Date(h) > start) start = new Date(h);
            if(r && new Date(r) < end) end = new Date(r);
            
            let diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            document.getElementById('days').value = Math.max(1, Math.min(30, diff));
        }

        function fillMonths(saved = [], resignationDate = null) {
            const select = document.getElementById('monthSelect');
            select.innerHTML = "";
            const months = ["01","02","03","04","05","06","07","08","09","10","11","12"];
            
            // تحديد أول شهر متاح
            let lastSaved = saved.length > 0 ? saved[saved.length - 1] : null;
            let resDate = resignationDate ? new Date(resignationDate) : null;

            months.forEach(m => {
                const val = "2026-" + m;
                const opt = document.createElement('option');
                opt.value = val;
                opt.innerText = val;

                // المنطق: لو الشهر محفوظ قبل كدة يبقى Disabled
                if(saved.includes(val)) {
                    opt.disabled = true;
                } 
                // لو مش محفوظ، بس هو مش "الشهر اللي عليه الدور"، يبقى Disabled
                // إلا لو فيه استقالة في شهر سابق، بنفتح الشهور اللي بعدها
                else if (lastSaved && val < lastSaved) {
                    opt.disabled = true;
                }
                
                select.appendChild(opt);
            });
            // اختيار أول شهر مش Disabled
            for(let i=0; i<select.options.length; i++){
                if(!select.options[i].disabled) { select.selectedIndex = i; break; }
            }
        }
        fillMonths([]);

        function validateIns() {
            const type = document.getElementById('empType').value;
            const val = Number(document.getElementById('insSalary').value);
            const err = document.getElementById('insErr');
            const min = type === "Full Time" ? 5384.62 : 2720;
            if(val > 16700 || val < min) {
                err.style.display = "block";
                err.innerText = "Alert: Min " + min + " | Max 16700";
            } else { err.style.display = "none"; }
        }

        async function checkEmp() {
            const nid = document.getElementById('nid').value;
            if(!nid) return;
            const res = await fetch('/api/check-employee/' + nid);
            const d = await res.json();
            if(d.status === "old") {
                document.getElementById('name').value = d.name;
                document.getElementById('empType').value = d.empType;
                document.getElementById('hiringDate').value = d.hDate ? d.hDate.split('T')[0] : '';
                document.getElementById('resignationDate').value = d.rDate ? d.rDate.split('T')[0] : '';
                document.getElementById('insSalary').value = d.lastIns;
                document.getElementById('pDays').value = d.pDays;
                document.getElementById('pTaxable').value = d.pTaxable;
                document.getElementById('pTaxes').value = d.pTaxes;
                fillMonths(d.savedMonths, d.rDate);
                suggestDays();
            } else {
                fillMonths([]);
            }
        }

        async function saveRecord() {
            const data = {
                nationalId: document.getElementById('nid').value,
                name: document.getElementById('name').value,
                employmentType: document.getElementById('empType').value,
                hiringDate: document.getElementById('hiringDate').value,
                resignationDate: document.getElementById('resignationDate').value,
                month: document.getElementById('monthSelect').value,
                insSalary: document.getElementById('insSalary').value,
                basic: document.getElementById('basic').value,
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
            document.getElementById('oT').innerText = r.tax.toLocaleString(undefined, {minimumFractionDigits: 2});
            document.getElementById('oM').innerText = r.martyrs.toLocaleString();
            document.getElementById('oN').innerText = r.net.toLocaleString();

            // تحديث التراكمي فوراً
            document.getElementById('pDays').value = Number(data.prevDays) + Number(data.days);
            document.getElementById('pTaxable').value = Number(data.prevTaxable) + r.currentTaxable;
            document.getElementById('pTaxes').value = Number(data.prevTaxes) + r.tax;
            
            // تحديث قائمة الشهور لتعطيل الشهر الحالي واختيار القادم
            let currentOption = document.querySelector("#monthSelect option[value='"+data.month+"']");
            if(currentOption) currentOption.disabled = true;
            document.getElementById('monthSelect').selectedIndex += 1;

            alert("Month Saved Successfully!");
        }
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Precision System Running..."));
module.exports = app;
