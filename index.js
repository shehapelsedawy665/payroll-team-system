const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// رابط الداتابيز
const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

// اتصال مستقر بالداتابيز لمنع الـ Crash في Vercel
let cachedDb = null;
async function connectToDatabase() {
    if (cachedDb) return cachedDb;
    const db = await mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
    });
    cachedDb = db;
    return db;
}

// تعريف الجداول (Models)
const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({
    name: String,
    nationalId: { type: String, unique: true },
    hiringDate: Date,
    resignationDate: Date,
    insSalary: Number
}));

const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId,
    month: String,
    days: Number,
    gross: Number,
    taxableIncome: Number,
    monthlyTax: Number,
    insurance: Number,
    martyrs: Number,
    net: Number
}));

// --- محرك الحسابات الضريبية ---
const R = (n) => Math.round(n * 100) / 100;
function calculateSequential(data, prevData) {
    const { basicFull, days, insSalary } = data;
    const { prevDays = 0, prevTaxable = 0, prevTaxes = 0 } = prevData;

    let insurance = insSalary * 0.11; // التأمينات كاملة
    const actualBasic = (basicFull / 30) * days;
    const martyrs = actualBasic * 0.0005;
    const currentTaxable = actualBasic - insurance;

    const totalDays = days + prevDays;
    const totalTaxable = currentTaxable + prevTaxable;
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
    } else {
        if (temp > 0) { let x = Math.min(temp, 400000); annualTax += x * 0.225; }
        if (temp > 400000) { let x = Math.min(temp - 400000, 800000); annualTax += x * 0.25; }
        if (temp > 1200000) { annualTax += (temp - 1200000) * 0.275; }
    }

    const totalTaxDueUntilNow = (annualTax / 360) * totalDays;
    const monthlyTax = Math.max(0, totalTaxDueUntilNow - prevTaxes);

    return { gross: R(actualBasic), insurance: R(insurance), tax: R(monthlyTax), martyrs: R(martyrs), net: R(actualBasic - insurance - monthlyTax - martyrs), currentTaxable: R(currentTaxable) };
}

// --- APIs ---
app.use(async (req, res, next) => { await connectToDatabase(); next(); });

app.get("/api/employees", async (req, res) => {
    const data = await Employee.find().sort({ name: 1 });
    res.json(data);
});

app.post("/api/employees", async (req, res) => {
    try {
        const emp = new Employee(req.body);
        await emp.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "الرقم القومي موجود مسبقاً" }); }
});

app.delete("/api/employees/:id", async (req, res) => {
    await Employee.findByIdAndDelete(req.params.id);
    await Payroll.deleteMany({ employeeId: req.params.id });
    res.json({ success: true });
});

app.post("/api/employees/:id/resign", async (req, res) => {
    await Employee.findByIdAndUpdate(req.params.id, { resignationDate: req.body.date });
    res.json({ success: true });
});

app.get("/api/employees/:id/details", async (req, res) => {
    const emp = await Employee.findById(req.params.id);
    const history = await Payroll.find({ employeeId: req.params.id }).sort({ month: 1 });
    let pDays = 0, pTaxable = 0, pTaxes = 0;
    history.forEach(r => { pDays += r.days; pTaxable += r.taxableIncome; pTaxes += r.monthlyTax; });
    res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
});

app.post("/api/payroll/calculate", async (req, res) => {
    const { empId, month, days, basicGross, prevData } = req.body;
    const emp = await Employee.findById(empId);
    const result = calculateSequential({ basicFull: basicGross, days, insSalary: emp.insSalary }, prevData);
    const record = new Payroll({ employeeId: empId, month, days, gross: result.gross, taxableIncome: result.currentTaxable, monthlyTax: result.tax, insurance: result.insurance, martyrs: result.martyrs, net: result.net });
    await record.save();
    res.json(record);
});

// --- واجهة المستخدم (HTML) ---
app.get("/", (req, res) => {
    res.send(\`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>ERP Payroll Professional</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body class="bg-gray-100 min-h-screen font-sans">
    <div class="bg-indigo-900 text-white p-4 shadow-xl mb-6">
        <div class="container mx-auto flex justify-between items-center">
            <h1 class="text-xl font-bold tracking-tighter italic">PAYROLL<span class="text-indigo-400">CORE</span></h1>
            <button onclick="location.reload()" class="bg-indigo-800 px-4 py-1 rounded text-sm hover:bg-indigo-700">تحديث</button>
        </div>
    </div>

    <div class="container mx-auto px-4">
        <div id="view-list">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-black text-slate-800">سجل الموظفين</h2>
                <button onclick="document.getElementById('modal').classList.remove('hidden')" class="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg">+ إضافة موظف</button>
            </div>
            <div class="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <table class="w-full text-right">
                    <thead class="bg-gray-50 border-b">
                        <tr><th class="p-4">الاسم</th><th class="p-4">الرقم القومي</th><th class="p-4">الحالة</th><th class="p-4">إجراءات</th></tr>
                    </thead>
                    <tbody id="table-body"></tbody>
                </table>
            </div>
        </div>

        <div id="view-profile" class="hidden">
            <button onclick="location.reload()" class="mb-4 text-indigo-600 font-bold"><i class="fas fa-arrow-right ml-2"></i> رجوع</button>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 id="p-name" class="text-xl font-black mb-2">--</h3>
                    <p class="text-sm text-slate-500 mb-1">تعيين: <span id="p-hdate">--</span></p>
                    <p class="text-sm text-slate-500 mb-4">تأمين: <span id="p-ins" class="text-indigo-600 font-bold">--</span></p>
                    <p id="p-res-area" class="text-sm text-red-600 font-bold hidden mb-4 italic">تمت الاستقالة بتاريخ: <span id="p-rdate">--</span></p>
                    <div class="flex gap-2">
                        <button onclick="resign()" class="flex-1 bg-orange-100 text-orange-700 py-2 rounded-lg text-xs font-bold">إنهاء خدمة</button>
                        <button onclick="del()" class="flex-1 bg-red-100 text-red-700 py-2 rounded-lg text-xs font-bold">حذف نهائي</button>
                    </div>
                </div>
                <div class="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-indigo-200">
                    <h4 class="font-bold mb-4">احتساب شهر جديد</h4>
                    <div class="grid grid-cols-3 gap-4 mb-4">
                        <div><label class="text-[10px] text-gray-400">شهر الاحتساب</label><select id="c-month" class="w-full p-2 border rounded-lg bg-gray-50"></select></div>
                        <div><label class="text-[10px] text-gray-400">أيام العمل</label><input type="number" id="c-days" value="30" class="w-full p-2 border rounded-lg"></div>
                        <div><label class="text-[10px] text-gray-400">الراتب Gross</label><input type="number" id="c-gross" class="w-full p-2 border rounded-lg" placeholder="0.00"></div>
                    </div>
                    <button id="calcBtn" onclick="runCalc()" class="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-md">حفظ الشهر</button>
                </div>
                <div class="lg:col-span-3 bg-slate-900 rounded-2xl p-4 text-white shadow-xl">
                    <table class="w-full text-center text-xs">
                        <thead class="text-slate-400 border-b border-slate-700"><tr><th class="p-2">الشهر</th><th class="p-2">الصافي Net</th><th class="p-2">الضريبة</th><th class="p-2">التأمين</th></tr></thead>
                        <tbody id="hist-body"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <div id="modal" class="hidden fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-3xl p-8 w-full max-w-md">
            <h3 class="text-xl font-bold mb-6">إضافة موظف</h3>
            <input type="text" id="n-name" placeholder="اسم الموظف" class="w-full p-3 border rounded-xl mb-4">
            <input type="text" id="n-nid" placeholder="الرقم القومي" class="w-full p-3 border rounded-xl mb-4">
            <label class="text-xs text-gray-400">تاريخ التعيين</label>
            <input type="date" id="n-hdate" class="w-full p-3 border rounded-xl mb-4">
            <input type="number" id="n-ins" placeholder="الأجر التأميني" class="w-full p-3 border rounded-xl mb-6">
            <div class="flex gap-3">
                <button onclick="saveEmp()" class="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold">حفظ</button>
                <button onclick="document.getElementById('modal').classList.add('hidden')" class="flex-1 bg-gray-100 py-3 rounded-xl">إلغاء</button>
            </div>
        </div>
    </div>

    <input type="hidden" id="currId"><input type="hidden" id="pD"><input type="hidden" id="pTxbl"><input type="hidden" id="pTx">

    <script>
        async function load() {
            const res = await fetch('/api/employees');
            const data = await res.json();
            document.getElementById('table-body').innerHTML = data.map(e => \`
                <tr class="border-b hover:bg-gray-50 cursor-pointer" onclick="openProfile('\${e._id}')">
                    <td class="p-4 font-bold">\${e.name}</td>
                    <td class="p-4 text-slate-500 font-mono">\${e.nationalId}</td>
                    <td class="p-4"><span class="text-[10px] px-2 py-0.5 rounded-full font-bold \${e.resignationDate ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}">\${e.resignationDate ? 'مستقيل' : 'نشط'}</span></td>
                    <td class="p-4 text-indigo-600 font-bold">فتح الملف</td>
                </tr>
            \`).join('');
        }

        async function saveEmp() {
            const body = { name: document.getElementById('n-name').value, nationalId: document.getElementById('n-nid').value, hiringDate: document.getElementById('n-hdate').value, insSalary: document.getElementById('n-ins').value };
            await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            location.reload();
        }

        async function openProfile(id) {
            document.getElementById('currId').value = id;
            document.getElementById('view-list').classList.add('hidden');
            document.getElementById('view-profile').classList.remove('hidden');
            const res = await fetch(\`/api/employees/\${id}/details\`);
            const data = await res.json();
            document.getElementById('p-name').innerText = data.emp.name;
            document.getElementById('p-hdate').innerText = data.emp.hiringDate?.split('T')[0];
            document.getElementById('p-ins').innerText = data.emp.insSalary.toLocaleString() + ' ج.م';
            if(data.emp.resignationDate) { document.getElementById('p-res-area').classList.remove('hidden'); document.getElementById('p-rdate').innerText = data.emp.resignationDate.split('T')[0]; }
            
            document.getElementById('pD').value = data.prevData.pDays;
            document.getElementById('pTxbl').value = data.prevData.pTaxable;
            document.getElementById('pTx').value = data.prevData.pTaxes;

            const select = document.getElementById('c-month');
            select.innerHTML = "";
            const hDate = new Date(data.emp.hiringDate);
            const calculated = data.history.map(r => r.month);
            let nextMonth = "";
            if(calculated.length > 0) {
                let d = new Date(calculated[calculated.length-1] + "-01");
                d.setMonth(d.getMonth() + 1);
                nextMonth = \`\${d.getFullYear()}-\${String(d.getMonth()+1).padStart(2,'0')}\`;
            } else { nextMonth = \`\${hDate.getFullYear()}-\${String(hDate.getMonth()+1).padStart(2,'0')}\`; }

            for(let i=0; i<12; i++) {
                let d = new Date(hDate.getFullYear(), hDate.getMonth()+i, 1);
                let val = \`\${d.getFullYear()}-\${String(d.getMonth()+1).padStart(2,'0')}\`;
                let opt = document.createElement('option');
                opt.value = val; opt.text = val + (calculated.includes(val) ? " (تم)" : "");
                opt.disabled = val !== nextMonth || !!data.emp.resignationDate;
                if(val === nextMonth) opt.selected = true;
                select.appendChild(opt);
            }
            document.getElementById('calcBtn').disabled = !!data.emp.resignationDate;

            document.getElementById('hist-body').innerHTML = data.history.map(r => \`
                <tr class="border-b border-slate-800"><td class="p-3">\${r.month}</td><td class="p-3 text-emerald-400 font-bold">\${r.net.toLocaleString()}</td><td class="p-3">\${r.monthlyTax.toLocaleString()}</td><td class="p-3">\${r.insurance.toLocaleString()}</td></tr>
            \`).join('');
        }

        async function runCalc() {
            const body = {
                empId: document.getElementById('currId').value, month: document.getElementById('c-month').value,
                days: Number(document.getElementById('c-days').value), basicGross: Number(document.getElementById('c-gross').value),
                prevData: { prevDays: Number(document.getElementById('pD').value), prevTaxable: Number(document.getElementById('pTxbl').value), prevTaxes: Number(document.getElementById('pTx').value) }
            };
            if(!body.basicGross) return alert("أدخل الراتب");
            await fetch('/api/payroll/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            openProfile(body.empId);
        }

        async function del() { if(confirm("حذف نهائي؟")) { await fetch(\`/api/employees/\${document.getElementById('currId').value}\`, { method: 'DELETE' }); location.reload(); } }
        async function resign() { const d = prompt("تاريخ الاستقالة YYYY-MM-DD:"); if(d) { await fetch(\`/api/employees/\${document.getElementById('currId').value}/resign\`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: d }) }); openProfile(document.getElementById('currId').value); } }

        window.onload = load;
    </script>
</body>
</html>
    \`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("ERP SYSTEM READY"));
        
