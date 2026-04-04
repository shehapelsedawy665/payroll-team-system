const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

// --- Database Connection ---
async function connectDB() {
    if (mongoose.connection.readyState === 1) return;
    await mongoose.connect(mongoURI);
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

// --- Calculations Engine ---
const R = (n) => Math.round(n * 100) / 100;

function calculatePayroll(data, prevData, emp) {
    const { basicFull, days, month } = data;
    const { prevDays = 0, prevTaxable = 0, prevTaxes = 0 } = prevData;

    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    let effectiveInsSalary = Math.max(minIns, Math.min(maxIns, emp.insSalary));

    let insAmt = 0;
    const hDate = new Date(emp.hiringDate);
    const rDate = emp.resignationDate ? new Date(emp.resignationDate) : null;
    const [year, monthNum] = month.split('-').map(Number);
    const isHiringMonth = hDate.getFullYear() === year && (hDate.getMonth() + 1) === monthNum;
    const isResignMonth = rDate && rDate.getFullYear() === year && (rDate.getMonth() + 1) === monthNum;

    if (isHiringMonth && isResignMonth) insAmt = effectiveInsSalary * 0.11;
    else if (isHiringMonth && hDate.getDate() > 1) insAmt = 0;
    else insAmt = effectiveInsSalary * 0.11;

    const actualGross = (basicFull / 30) * days;
    const martyrs = R(actualGross * 0.0005);
    const currentTaxable = actualGross - insAmt;

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

    const monthlyTax = Math.max(0, ((annualTax / 360) * totalDays) - prevTaxes);

    return { gross: R(actualGross), insurance: R(insAmt), tax: R(monthlyTax), martyrs, net: R(actualGross - insAmt - monthlyTax - martyrs), currentTaxable: R(currentTaxable) };
}

// --- API Routes ---
app.use(async (req, res, next) => { await connectDB(); next(); });

app.get("/api/employees", async (req, res) => res.json(await Employee.find().sort({ name: 1 })));

app.post("/api/employees", async (req, res) => {
    try { await new Employee(req.body).save(); res.json({ success: true }); }
    catch (e) { res.status(400).json({ error: "Duplicate ID" }); }
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
    const result = calculatePayroll({ basicFull: basicGross, days, month }, prevData, emp);
    const record = await new Payroll({ employeeId: empId, month, days, ...result }).save();
    res.json(record);
});

// --- Enterprise UI ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Enterprise Payroll System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; }
        .sidebar-link:hover { background: rgba(99, 102, 241, 0.1); color: #818cf8; }
        .glass-card { background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); }
        .stat-card { transition: transform 0.3s ease; }
        .stat-card:hover { transform: translateY(-5px); }
    </style>
</head>
<body class="bg-slate-50 flex min-h-screen">

    <aside class="w-72 bg-slate-900 text-white flex flex-col sticky top-0 h-screen shadow-2xl">
        <div class="p-8 text-center border-b border-slate-800">
            <div class="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/20">
                <i class="fas fa-chart-pie"></i>
            </div>
            <h1 class="text-xl font-black tracking-widest text-indigo-400">CORE PAYROLL</h1>
            <p class="text-[10px] text-slate-500 uppercase mt-1">Enterprise Solution</p>
        </div>
        <nav class="flex-1 mt-6 px-4 space-y-2">
            <a href="#" onclick="location.reload()" class="flex items-center p-4 rounded-xl sidebar-link text-indigo-400 bg-slate-800/50 font-bold transition">
                <i class="fas fa-users-cog ml-3 text-xl"></i> الموظفين
            </a>
            <a href="#" class="flex items-center p-4 rounded-xl sidebar-link text-slate-400 transition">
                <i class="fas fa-calendar-alt ml-3 text-xl"></i> التقارير المالية
            </a>
        </nav>
        <div class="p-6 border-t border-slate-800">
            <p class="text-xs text-slate-500 text-center">Version 4.0.1 (Odoo Style)</p>
        </div>
    </aside>

    <main class="flex-1 p-10">
        
        <div id="view-list" class="space-y-8 animate-fade-in">
            <div class="flex justify-between items-end">
                <div>
                    <h2 class="text-4xl font-black text-slate-800">لوحة الموظفين</h2>
                    <p class="text-slate-500 mt-2">إدارة الحسابات والضرائب والتأمينات الاجتماعية</p>
                </div>
                <button onclick="document.getElementById('modal').classList.remove('hidden')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-200 transition-all">
                    <i class="fas fa-plus-circle ml-2"></i> إضافة موظف جديد
                </button>
            </div>

            <div class="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-100">
                <table class="w-full text-right">
                    <thead class="bg-slate-50/50 border-b border-slate-100 text-slate-500 text-sm uppercase">
                        <tr>
                            <th class="p-6">الموظف</th>
                            <th class="p-6 text-center">النوع</th>
                            <th class="p-6 text-center">الحالة</th>
                            <th class="p-6 text-center">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="empTable" class="divide-y divide-slate-50"></tbody>
                </table>
            </div>
        </div>

        <div id="view-profile" class="hidden animate-fade-in space-y-8">
            <div class="flex items-center gap-4">
                <button onclick="location.reload()" class="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition">
                    <i class="fas fa-arrow-right"></i>
                </button>
                <h2 class="text-3xl font-black text-slate-800" id="p-name-header">بروفايل الموظف</h2>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div class="lg:col-span-1 space-y-6">
                    <div class="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-[4rem] -z-0"></div>
                        <h3 id="p-name" class="text-2xl font-bold relative z-10">--</h3>
                        <p id="p-type" class="text-indigo-500 text-sm font-bold mt-1">--</p>
                        <div class="mt-8 space-y-4 text-sm relative z-10">
                            <div class="flex justify-between"><span class="text-slate-400">الرقم القومي:</span><span id="p-nid" class="font-bold uppercase">--</span></div>
                            <div class="flex justify-between"><span class="text-slate-400">تاريخ التعيين:</span><span id="p-hdate" class="font-bold">--</span></div>
                            <div class="flex justify-between text-indigo-600"><span class="text-slate-400">الأجر التأميني:</span><span id="p-ins" class="font-black text-lg">--</span></div>
                        </div>
                        <div class="mt-8 pt-8 border-t space-y-3">
                            <button onclick="resign()" class="w-full py-3 rounded-xl bg-orange-50 text-orange-600 font-bold hover:bg-orange-100 transition"><i class="fas fa-user-clock ml-2"></i> استقالة</button>
                            <button onclick="del()" class="w-full py-3 rounded-xl bg-red-50 text-red-600 font-bold hover:bg-red-100 transition"><i class="fas fa-trash-alt ml-2"></i> حذف نهائي</button>
                        </div>
                    </div>
                </div>

                <div class="lg:col-span-3 space-y-6">
                    <div class="bg-indigo-900 p-8 rounded-[2rem] shadow-2xl text-white relative overflow-hidden">
                         <div class="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-800 rounded-full blur-3xl opacity-50"></div>
                         <h4 class="text-xl font-bold mb-6 flex items-center"><i class="fas fa-calculator ml-3"></i> معالجة الراتب الشهري</h4>
                         <div class="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                            <div><label class="text-[10px] text-indigo-300 block mb-2 uppercase">الشهر</label><input type="month" id="c-month" class="w-full bg-indigo-800/50 border border-indigo-700 p-4 rounded-2xl text-white"></div>
                            <div><label class="text-[10px] text-indigo-300 block mb-2 uppercase">أيام العمل</label><input type="number" id="c-days" value="30" class="w-full bg-indigo-800/50 border border-indigo-700 p-4 rounded-2xl text-white"></div>
                            <div><label class="text-[10px] text-indigo-300 block mb-2 uppercase">إجمالي الراتب Gross</label><input type="number" id="c-gross" placeholder="0.00" class="w-full bg-indigo-800/50 border border-indigo-700 p-4 rounded-2xl text-white"></div>
                         </div>
                         <button onclick="runCalc()" class="w-full mt-8 bg-emerald-500 hover:bg-emerald-400 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-emerald-900/20 transition-all italic tracking-widest">حساب وتأكيد الاعتماد <i class="fas fa-check-double mr-2"></i></button>
                    </div>

                    <div class="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
                        <div class="p-6 border-b bg-slate-50 flex justify-between items-center">
                            <span class="font-bold text-slate-800">تاريخ المسيرات</span>
                            <span class="text-xs text-slate-400">عرض أحدث 12 شهر</span>
                        </div>
                        <table class="w-full text-center">
                            <thead class="text-[10px] text-slate-400 uppercase border-b bg-slate-50/50">
                                <tr>
                                    <th class="p-4">الشهر</th>
                                    <th class="p-4">إجمالي Gross</th>
                                    <th class="p-4">تأمينات</th>
                                    <th class="p-4">شهداء</th>
                                    <th class="p-4">ضرائب</th>
                                    <th class="p-4 text-emerald-600 font-bold bg-emerald-50">صافي Net</th>
                                </tr>
                            </thead>
                            <tbody id="histBody" class="text-sm divide-y"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <div id="modal" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
        <div class="bg-white rounded-[2.5rem] p-10 w-full max-w-xl shadow-2xl animate-scale-up">
            <h3 class="text-3xl font-black text-slate-800 mb-8">إضافة عضو جديد</h3>
            <div class="grid grid-cols-2 gap-6">
                <div class="col-span-2"><label class="text-xs font-bold text-slate-400 block mb-2">اسم الموظف</label><input type="text" id="n-name" placeholder="الاسم الرباعي" class="w-full p-4 bg-slate-50 border rounded-2xl focus:ring-2 ring-indigo-500 transition"></div>
                <div><label class="text-xs font-bold text-slate-400 block mb-2">الرقم القومي</label><input type="text" id="n-nid" class="w-full p-4 bg-slate-50 border rounded-2xl"></div>
                <div><label class="text-xs font-bold text-slate-400 block mb-2">تاريخ التعيين</label><input type="date" id="n-hdate" class="w-full p-4 bg-slate-50 border rounded-2xl"></div>
                <div><label class="text-xs font-bold text-slate-400 block mb-2">الأجر التأميني</label><input type="number" id="n-ins" class="w-full p-4 bg-slate-50 border rounded-2xl"></div>
                <div><label class="text-xs font-bold text-slate-400 block mb-2">نوع الوظيفة</label><select id="n-type" class="w-full p-4 bg-slate-50 border rounded-2xl font-bold"><option>Full Time</option><option>Part Time</option></select></div>
            </div>
            <div class="flex gap-4 mt-10">
                <button onclick="saveEmp()" class="flex-1 bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-lg">حفظ الموظف</button>
                <button onclick="document.getElementById('modal').classList.add('hidden')" class="flex-1 bg-slate-100 text-slate-600 py-5 rounded-2xl font-bold">إلغاء</button>
            </div>
        </div>
    </div>

    <input type="hidden" id="currId"><input type="hidden" id="pD"><input type="hidden" id="pTxbl"><input type="hidden" id="pTx">

    <script>
        async function load() {
            const res = await fetch('/api/employees');
            const data = await res.json();
            document.getElementById('empTable').innerHTML = data.map(e => \`
                <tr class="hover:bg-indigo-50/30 transition cursor-pointer group" onclick="openProfile('\${e._id}')">
                    <td class="p-6">
                        <div class="flex items-center">
                            <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold ml-4 group-hover:scale-110 transition">\${e.name[0]}</div>
                            <span class="font-bold text-slate-700">\${e.name}</span>
                        </div>
                    </td>
                    <td class="p-6 text-center"><span class="text-[10px] bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-500">\${e.jobType}</span></td>
                    <td class="p-6 text-center"><span class="text-[10px] font-black px-3 py-1 rounded-full \${e.resignationDate ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}">\${e.resignationDate ? 'مستقيل' : 'نشط'}</span></td>
                    <td class="p-6 text-center text-indigo-400"><i class="fas fa-chevron-left"></i></td>
                </tr>
            \`).join('');
        }

        async function saveEmp() {
            const body = { name: document.getElementById('n-name').value, nationalId: document.getElementById('n-nid').value, hiringDate: document.getElementById('n-hdate').value, insSalary: Number(document.getElementById('n-ins').value), jobType: document.getElementById('n-type').value };
            if(!body.name || !body.nationalId) return alert("املا البيانات!");
            const res = await fetch('/api/employees', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            if(res.ok) location.reload(); else alert("الرقم القومي مكرر!");
        }

        async function openProfile(id) {
            document.getElementById('currId').value = id;
            document.getElementById('view-list').classList.add('hidden');
            document.getElementById('view-profile').classList.remove('hidden');
            const res = await fetch(\`/api/employees/\${id}/details\`);
            const data = await res.json();
            
            document.getElementById('p-name').innerText = data.emp.name;
            document.getElementById('p-type').innerText = data.emp.jobType;
            document.getElementById('p-ins').innerText = data.emp.insSalary.toLocaleString('en-EG', {minimumFractionDigits: 2});
            document.getElementById('p-nid').innerText = data.emp.nationalId;
            document.getElementById('p-hdate').innerText = data.emp.hiringDate.split('T')[0];
            
            document.getElementById('pD').value = data.prevData.pDays;
            document.getElementById('pTxbl').value = data.prevData.pTaxable;
            document.getElementById('pTx').value = data.prevData.pTaxes;

            document.getElementById('histBody').innerHTML = data.history.map(r => \`
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-4 font-bold text-slate-600">\${r.month}</td>
                    <td class="p-4">\${r.gross.toLocaleString()}</td>
                    <td class="p-4 text-slate-400">\${r.insurance.toLocaleString()}</td>
                    <td class="p-4 text-orange-400">\${r.martyrs.toLocaleString()}</td>
                    <td class="p-4 text-red-400">\${r.monthlyTax.toLocaleString()}</td>
                    <td class="p-4 font-black text-emerald-600 bg-emerald-50/30">\${r.net.toLocaleString()}</td>
                </tr>
            \`).join('');
        }

        async function runCalc() {
            const body = {
