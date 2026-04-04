const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

// --- Connection ---
let cachedDb = null;
async function connectToDatabase() {
    if (cachedDb && mongoose.connection.readyState === 1) return cachedDb;
    mongoose.set('strictQuery', false);
    cachedDb = await mongoose.connect(mongoURI);
    return cachedDb;
}

// --- Models ---
const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({
    name: String,
    nationalId: { type: String, unique: true },
    hiringDate: Date,
    resignationDate: Date,
    insSalary: Number,
    jobType: { type: String, default: "Full Time" } 
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

// --- Business Logic Engine ---
const R = (n) => Math.round(n * 100) / 100;

function calculatePayroll(data, prevData, emp) {
    const { basicFull, days, month } = data;
    const { prevDays = 0, prevTaxable = 0, prevTaxes = 0 } = prevData;

    // 1. Insurance Caps & Logic
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    let effectiveInsSalary = Math.max(minIns, Math.min(maxIns, emp.insSalary));

    let insuranceAmount = 0;
    const hDate = new Date(emp.hiringDate);
    const rDate = emp.resignationDate ? new Date(emp.resignationDate) : null;
    const [year, monthNum] = month.split('-').map(Number);

    const isHiringMonth = hDate.getFullYear() === year && (hDate.getMonth() + 1) === monthNum;
    const isResignMonth = rDate && rDate.getFullYear() === year && (rDate.getMonth() + 1) === monthNum;

    // القواعد اللي طلبتها بالحرف:
    if (isHiringMonth && isResignMonth) {
        insuranceAmount = effectiveInsSalary * 0.11;
    } else if (isHiringMonth && hDate.getDate() > 1) {
        insuranceAmount = 0;
    } else {
        insuranceAmount = effectiveInsSalary * 0.11;
    }

    // 2. Financial Calculations
    const actualGross = (basicFull / 30) * days;
    const martyrs = R(actualGross * 0.0005); 
    const currentTaxable = actualGross - insuranceAmount;

    // 3. Tax Sequential Logic
    const totalDays = days + prevDays;
    const totalTaxable = currentTaxable + prevTaxable;
    const annualTaxable = Math.floor(((totalTaxable / totalDays) * 360) / 10) * 10;

    let annualTax = 0;
    let temp = Math.max(0, annualTaxable - 20000);
    if (annualTaxable <= 600000) {
        if (temp > 40000) annualTax += Math.min(temp - 40000, 15000) * 0.10;
        if (temp > 55000) annualTax += Math.min(temp - 55000, 15000) * 0.15;
        if (temp > 70000) annualTax += Math.min(temp - 70000, 130000) * 0.20;
        if (temp > 200000) annualTax += Math.min(temp - 200000, 200000) * 0.225;
        if (temp > 400000) annualTax += Math.min(temp - 400000, 200000) * 0.25;
        if (temp > 600000) annualTax += (temp - 600000) * 0.275;
    } else {
        if (temp > 0) annualTax += Math.min(temp, 400000) * 0.225;
        if (temp > 400000) annualTax += Math.min(temp - 400000, 800000) * 0.25;
        if (temp > 1200000) annualTax += (temp - 1200000) * 0.275;
    }

    const totalTaxDue = (annualTax / 360) * totalDays;
    const monthlyTax = Math.max(0, totalTaxDue - prevTaxes);

    return {
        gross: R(actualGross),
        insurance: R(insuranceAmount),
        tax: R(monthlyTax),
        martyrs: martyrs,
        net: R(actualGross - insuranceAmount - monthlyTax - martyrs),
        currentTaxable: R(currentTaxable)
    };
}

// --- Routes ---
app.use(async (req, res, next) => {
    await connectToDatabase();
    next();
});

app.get("/api/employees", async (req, res) => {
    const data = await Employee.find().sort({ name: 1 });
    res.json(data);
});

app.post("/api/employees", async (req, res) => {
    try {
        const emp = new Employee(req.body);
        await emp.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "Data Error" }); }
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
    const result = calculatePayroll({ basicFull: basicGross, days, month }, prevData, emp);
    const record = new Payroll({ employeeId: empId, month, days, ...result });
    await record.save();
    res.json(record);
});

// --- UI Odoo Style ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Odoo Payroll Pro</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        .active-link { background: #1e293b; border-right: 4px solid #6366f1; }
    </style>
</head>
<body class="bg-gray-100 flex min-h-screen font-sans">
    <aside class="w-64 bg-slate-900 text-white shadow-xl">
        <div class="p-6 text-xl font-black text-indigo-400">ODOO PAYROLL</div>
        <nav class="mt-4 px-2 space-y-1">
            <div onclick="location.reload()" class="p-3 rounded-lg cursor-pointer active-link"><i class="fas fa-users ml-2"></i> الموظفين</div>
        </nav>
    </aside>
    
    <main class="flex-1 p-8">
        <div id="view-list">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">دليل الموظفين</h2>
                <button onclick="document.getElementById('modal').classList.remove('hidden')" class="bg-indigo-600 text-white px-6 py-2 rounded-xl">+ إضافة موظف</button>
            </div>
            <div class="bg-white rounded-2xl shadow overflow-hidden">
                <table class="w-full text-right">
                    <thead class="bg-gray-50 border-b">
                        <tr><th class="p-4">الاسم</th><th class="p-4 text-center">نوع الوظيفة</th><th class="p-4">إجراء</th></tr>
                    </thead>
                    <tbody id="empTable"></tbody>
                </table>
            </div>
        </div>

        <div id="view-profile" class="hidden">
            <button onclick="location.reload()" class="mb-4 text-indigo-600 font-bold"><i class="fas fa-arrow-right"></i> عودة</button>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="bg-white p-6 rounded-2xl shadow">
                    <h3 id="p-name" class="text-xl font-bold mb-4">--</h3>
                    <p class="text-sm text-gray-500 mb-4" id="p-type">--</p>
                    <div class="border-t pt-4 space-y-2 text-sm">
                        <p>تأمين: <span id="p-ins" class="font-bold">--</span></p>
                        <p>تعيين: <span id="p-hdate">--</span></p>
                    </div>
                </div>
                <div class="lg:col-span-2 bg-white p-6 rounded-2xl shadow">
                    <div class="grid grid-cols-2 gap-4 mb-4">
                        <input type="month" id="c-month" class="p-2 border rounded-lg">
                        <input type="number" id="c-gross" placeholder="Gross Salary" class="p-2 border rounded-lg">
                    </div>
                    <button onclick="runCalc()" class="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">حساب واعتماد</button>
                </div>
                <div class="lg:col-span-3 bg-slate-800 text-white p-6 rounded-2xl shadow overflow-x-auto">
                    <table class="w-full text-center text-xs">
                        <thead>
                            <tr class="text-gray-400 border-b border-gray-700">
                                <th class="p-3">الشهر</th><th class="p-3">Gross</th><th class="p-3">تأمين</th>
                                <th class="p-3">شهداء</th><th class="p-3">ضريبة</th><th class="p-3 text-emerald-400">الصافي</th>
                            </tr>
                        </thead>
                        <tbody id="histBody"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </main>

    <div id="modal" class="hidden fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="bg-white rounded-3xl p-8 w-full max-w-md">
            <h3 class="text-xl font-bold mb-4">إضافة موظف</h3>
            <div class="space-y-3">
                <input type="text" id="n-name" placeholder="الاسم" class="w-full p-3 border rounded-xl">
                <input type="text" id="n-nid" placeholder="الرقم القومي" class="w-full p-3 border rounded-xl">
                <input type="date" id="n-hdate" class="w-full p-3 border rounded-xl">
                <input type="number" id="n-ins" placeholder="الأجر التأميني" class="w-full p-3 border rounded-xl">
                <select id="n-type" class="w-full p-3 border rounded-xl">
                    <option value="Full Time">Full Time</option>
                    <option value="Part Time">Part Time</option>
                </select>
            </div>
            <div class="flex gap-2 mt-6">
                <button onclick="saveEmp()" class="flex-1 bg-indigo-600 text-white py-3 rounded-xl">حفظ</button>
                <button onclick="document.getElementById('modal').classList.add('hidden')" class="flex-1 bg-gray-100 py-3 rounded-xl">إلغاء</button>
            </div>
        </div>
    </div>

    <input type="hidden" id="currId"><input type="hidden" id="pD"><input type="hidden" id="pTxbl"><input type="hidden" id="pTx">

    <script>
        async function load() {
            const res = await fetch('/api/employees');
            const data = await res.json();
            document.getElementById('empTable').innerHTML = data.map(e => \`
                <tr class="border-b hover:bg-gray-50 cursor-pointer" onclick="openProfile('\${e._id}')">
                    <td class="p-4 font-bold">\${e.name}</td>
                    <td class="p-4 text-center text-sm text-gray-500">\${e.jobType}</td>
                    <td class="p-4 text-indigo-600 font-bold">فتح</td>
                </tr>
            \`).join('');
        }

        async function saveEmp() {
            const body = { name: document.getElementById('n-name').value, nationalId: document.getElementById('n-nid').value, hiringDate: document.getElementById('n-hdate').value, insSalary: Number(document.getElementById('n-ins').value), jobType: document.getElementById('n-type').value };
            await fetch('/api/employees', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            location.reload();
        }

        async function openProfile(id) {
            document.getElementById('currId').value = id;
            document.getElementById('view-list').classList.add('hidden');
            document.getElementById('view-profile').classList.remove('hidden');
            const res = await fetch(\`/api/employees/\${id}/details\`);
            const data = await res.json();
            
            document.getElementById('p-name').innerText = data.emp.name;
            document.getElementById('p-type').innerText = data.emp.jobType;
            document.getElementById('p-ins').innerText = data.emp.insSalary.toLocaleString();
            document.getElementById('p-hdate').innerText = data.emp.hiringDate.split('T')[0];
            
            document.getElementById('pD').value = data.prevData.pDays;
            document.getElementById('pTxbl').value = data.prevData.pTaxable;
            document.getElementById('pTx').value = data.prevData.pTaxes;

            document.getElementById('histBody').innerHTML = data.history.map(r => \`
                <tr class="border-b border-gray-700">
                    <td class="p-3">\${r.month}</td>
                    <td class="p-3">\${r.gross.toLocaleString()}</td>
                    <td class="p-3">\${r.insurance.toLocaleString()}</td>
                    <td class="p-3 text-orange-300">\${r.martyrs.toLocaleString()}</td>
                    <td class="p-3">\${r.monthlyTax.toLocaleString()}</td>
                    <td class="p-3 font-bold text-emerald-400">\${r.net.toLocaleString()}</td>
                </tr>
            \`).join('');
        }

        async function runCalc() {
            const body = {
                empId: document.getElementById('currId').value, month: document.getElementById('c-month').value,
                days: 30, basicGross: Number(document.getElementById('c-gross').value),
                prevData: { prevDays: Number(document.getElementById('pD').value), prevTaxable: Number(document.getElementById('pTxbl').value), prevTaxes: Number(document.getElementById('pTx').value) }
            };
            await fetch('/api/payroll/calculate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            openProfile(body.empId);
        }
        window.onload = load;
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("System Online"));
