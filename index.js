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
    } catch (err) { console.log("DB Connected"); }
};

const Payroll = mongoose.model("Payroll", new mongoose.Schema({
    employee_name: String, nationalId: String, month: String,
    gross: Number, taxableIncome: Number, monthlyTax: Number,
    days: Number, insurance: Number, martyrs: Number, net: Number,
    insSalary: Number, calcType: String, employmentType: String,
    hiringDate: Date, resignationDate: Date
}));

const R = (n) => Math.round(n * 100) / 100;

function calculateG2N(d) {
    const basicFull = Number(d.basic) || 0;
    const days = Number(d.days) || 30;
    const insSalary = Number(d.insSalary) || 0;
    const hDate = d.hiringDate ? new Date(d.hiringDate) : null;
    const rDate = d.resignationDate ? new Date(d.resignationDate) : null;
    const currentMonthDate = new Date(d.month + "-01");

    let insurance = 0;
    const isHiredAfterFirst = hDate && hDate.getDate() > 1 && hDate.getMonth() === currentMonthDate.getMonth();
    const isResignedSameMonth = rDate && rDate.getMonth() === currentMonthDate.getMonth();
    
    if (!(isHiredAfterFirst && !isResignedSameMonth)) {
        insurance = insSalary * 0.11;
    }

    const actualBasic = (basicFull / 30) * days;
    const martyrs = actualBasic * 0.0005;
    const currentTaxable = actualBasic - insurance;
    
    const totalDays = days + (Number(d.prevDays) || 0);
    const totalTaxable = currentTaxable + (Number(d.prevTaxable) || 0);
    
    const annualTaxable = Math.floor(((totalTaxable / totalDays) * 360) / 10) * 10;
    
    let annualTax = 0;
    let temp = Math.max(0, annualTaxable - 20000);

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
    
    return { 
        gross: R(actualBasic), insurance: R(insurance), 
        tax: R(monthlyTax), martyrs: R(martyrs), 
        net: R(actualBasic - insurance - monthlyTax - martyrs),
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
    <title>Payroll Precision v5</title>
    <style>
        :root { --primary: #1a73e8; --success: #27ae60; --error: #d32f2f; --dark: #2c3e50; }
        body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; padding: 20px; }
        .container { max-width: 1000px; margin: auto; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; }
        .card { border: 1px solid #eee; padding: 15px; border-radius: 8px; }
        label { display: block; margin-top: 10px; font-size: 12px; font-weight: bold; color: #555; }
        input, select { width: 100%; padding: 10px; margin-top: 5px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; }
        .btn { width: 100%; padding: 15px; background: var(--success); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 20px; }
        .res-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 25px; background: var(--dark); color: white; padding: 20px; border-radius: 10px; text-align: center; }
        .res-grid span { display: block; font-size: 18px; color: #f1c40f; font-weight: bold; }
        .error-msg { color: var(--error); font-size: 11px; font-weight: bold; display: none; margin-top: 4px; }
        option:disabled { color: #ccc; background: #f9f9f9; }
    </style>
</head>
<body>
    <div class="container">
        <h2 style="text-align:center; color: var(--primary);">Sequential Payroll System</h2>
        <div class="grid">
            <div class="card">
                <h3>| الموظف</h3>
                <label>الرقم القومي</label><input type="text" id="nid" onblur="checkEmp()">
                <label>الاسم</label><input type="text" id="name">
                <label>نوع العمل</label>
                <select id="empType" onchange="validateIns()"><option value="Full Time">Full Time</option><option value="Part Time">Part Time</option></select>
            </div>
            <div class="card">
                <h3>| التواريخ</h3>
                <label>تاريخ التعيين</label><input type="date" id="hiringDate" onchange="suggestDays()">
                <label>تاريخ الاستقالة</label><input type="date" id="resignationDate" onchange="suggestDays()">
                <label>شهر الاحتساب (Sequential)</label><select id="monthSelect" onchange="suggestDays()"></select>
                <label>أيام العمل</label><input type="number" id="days" value="30">
            </div>
            <div class="card">
                <h3>| المبالغ</h3>
                <label>الأجر التأميني</label><input type="number" id="insSalary" oninput="validateIns()"><div id="insErr" class="error-msg"></div>
                <label>Gross Salary</label><input type="number" id="basic">
            </div>
        </div>
        <input type="hidden" id="pDays" value="0"><input type="hidden" id="pTaxable" value="0"><input type="hidden" id="pTaxes" value="0">
        <button class="btn" id="saveBtn" onclick="saveRecord()">💾 حفظ وحساب الراتب</button>
        <div class="res-grid">
            <div>Gross <span id="oG">0</span></div>
            <div>Insurance <span id="oI">0</span></div>
            <div>Tax <span id="oT">0</span></div>
            <div>Martyr <span id="oM">0</span></div>
            <div>NET <span id="oN">0</span></div>
        </div>
    </div>

    <script>
        let globalStatus = "new";

        function suggestDays() {
            const hStr = document.getElementById('hiringDate').value;
            const rStr = document.getElementById('resignationDate').value;
            const mStr = document.getElementById('monthSelect').value;
            if(!mStr) return;

            let hDate = hStr ? new Date(hStr) : null;
            let rDate = rStr ? new Date(rStr) : null;
            let currentMonth = new Date(mStr + "-01");
            
            let days = 30;

            if(hDate && rDate && hDate.getMonth() === currentMonth.getMonth() && rDate.getMonth() === currentMonth.getMonth()) {
                days = rDate.getDate() - hDate.getDate() + 1;
            }
            else if(hDate && hDate.getMonth() === currentMonth.getMonth() && hDate.getFullYear() === currentMonth.getFullYear()) {
                days = 30 - hDate.getDate() + 1;
            }
            else if(rDate && rDate.getMonth() === currentMonth.getMonth() && rDate.getFullYear() === currentMonth.getFullYear()) {
                days = Math.min(rDate.getDate(), 30);
            }
            else if(globalStatus === "old") {
                days = 30;
            }
            document.getElementById('days').value = Math.max(1, days);
        }

        function fillMonths(saved = [], resDateStr = null) {
            const select = document.getElementById('monthSelect');
            select.innerHTML = "";
            const allMonths = ["01","02","03","04","05","06","07","08","09","10","11","12"].map(m => "2026-" + m);
            
            let lastSavedIndex = -1;
            saved.forEach(m => { lastSavedIndex = Math.max(lastSavedIndex, allMonths.indexOf(m)); });

            allMonths.forEach((m, index) => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.innerText = m;
                
                // 1. لو الشهر محفوظ فعلاً -> Disable
                if(saved.includes(m)) {
                    opt.disabled = true;
                } 
                // 2. لو مش محفوظ، بنطبق قاعدة "الشهر التالي فقط"
                else {
                    // لو فيه تاريخ استقالة قديم، بنسمح بفتح الشهور اللي *بعد* شهر الاستقالة فقط
                    if(resDateStr) {
                        let rDate = new Date(resDateStr);
                        let rMonthStr = rDate.getFullYear() + "-" + String(rDate.getMonth()+1).padStart(2,'0');
                        
                        // لو الشهر الحالي (m) أصغر من أو يساوي شهر الاستقالة -> Disable
                        if(m <= rMonthStr) {
                            opt.disabled = true;
                        } 
                        // لو الشهر هو أول شهر متاح بعد الاستقالة، نسيبه مفتوح
                        // أو لو هو الشهر اللي عليه الدور بعد آخر حفظ (في حالة رجع اشتغل وحفظنا شهور جديدة)
                        else if (lastSavedIndex !== -1 && index !== lastSavedIndex + 1) {
                            opt.disabled = true;
                        }
                    } 
                    // لو مفيش استقالة، لازم يلتزم بالترتيب (Next Month Only)
                    else if (lastSavedIndex !== -1 && index !== lastSavedIndex + 1) {
                        opt.disabled = true;
                    }
                }
                select.appendChild(opt);
            });

            // اختيار أول شهر متاح (مش disabled)
            for(let i=0; i<select.options.length; i++) {
                if(!select.options[i].disabled) { select.selectedIndex = i; break; }
            }
        }

        function validateIns() {
            const type = document.getElementById('empType').value;
            const val = Number(document.getElementById('insSalary').value);
            const err = document.getElementById('insErr');
            const saveBtn = document.getElementById('saveBtn');
            const max = 16700;
            const min = type === "Full Time" ? 5384.62 : 2720;

            if(val > max || (val < min && val > 0)) {
                err.style.display = "block";
                err.innerText = "خطأ: الحد الأدنى " + min + " والحد الأقصى " + max;
                saveBtn.disabled = true;
                saveBtn.style.opacity = "0.5";
            } else {
                err.style.display = "none";
                saveBtn.disabled = false;
                saveBtn.style.opacity = "1";
            }
        }

        async function checkEmp() {
            const nid = document.getElementById('nid').value;
            if(!nid) return;
            const res = await fetch('/api/check-employee/' + nid);
            const d = await res.json();
            globalStatus = d.status;
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
            } else {
                fillMonths([]);
            }
            suggestDays();
            validateIns();
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
            alert("تم الحفظ بنجاح لشهر " + data.month);
            checkEmp(); 
        }
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Final Precision System Running..."));
module.exports = app;
