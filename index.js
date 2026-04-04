const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// --- Configuration & Connection ---
const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ Database Engine Connected Successfully"))
    .catch(err => console.error("❌ Critical DB Error:", err));

// --- Schemas & Models ---
const EmployeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    nationalId: { type: String, required: true },
    hiringDate: { type: Date, required: true },
    resignationDate: { type: Date },
    insSalary: { type: Number, default: 0 },
    jobType: { type: String, default: "Full Time" }
});

const PayrollSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    month: String,
    days: Number,
    gross: Number,
    taxableIncome: Number,
    monthlyTax: Number,
    insurance: Number,
    martyrs: Number,
    net: Number,
    createdAt: { type: Date, default: Date.now }
});

const Employee = mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);
const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", PayrollSchema);

// --- Calculation Engine (The Heart) ---
const R = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

function calculateEgyptianTax(annualTaxable) {
    let tax = 0;
    let remainder = annualTaxable; // Already adjusted for exemption in the caller

    const brackets = [
        { limit: 10000, rate: 0.00 }, 
        { limit: 15000, rate: 0.10 }, 
        { limit: 15000, rate: 0.15 }, 
        { limit: 140000, rate: 0.20 },
        { limit: 200000, rate: 0.225 },
        { limit: 200000, rate: 0.25 },
        { limit: Infinity, rate: 0.275 }
    ];

    for (let b of brackets) {
        if (remainder <= 0) break;
        let chunk = Math.min(remainder, b.limit);
        tax += chunk * b.rate;
        remainder -= chunk;
    }
    return tax;
}

function processMonthlyPayroll(data, prev, emp) {
    const { basicFull, days, month } = data;
    
    // 1. Insurance Calculation
    const maxIns = 16700;
    const minIns = emp.jobType === "Full Time" ? R(7000 / 1.3) : 2720;
    let effectiveBase = Math.max(minIns, Math.min(maxIns, emp.insSalary));
    let insAmt = R(effectiveBase * 0.11);

    // 2. Gross & Martyrs
    const actualGross = R((basicFull / 30) * days);
    const martyrs = R(actualGross * 0.0005);

    // 3. Taxable Pool Logic (Exemption prorated by days)
    const personalExemption = R((20000 / 360) * days);
    const currentTaxablePool = Math.max(0, (actualGross - insAmt) - personalExemption);

    // 4. Cumulative Logic (YTD)
    const totalDays = days + (prev.pDays || 0);
    const totalTaxablePool = currentTaxablePool + (prev.pTaxable || 0);
    
    // Project to Annual
    const annualTaxableProjected = Math.floor(((totalTaxablePool / totalDays) * 360) / 10) * 10;
    
    const annualTax = calculateEgyptianTax(annualTaxableProjected);
    const monthlyTax = R(Math.max(0, ((annualTax / 360) * totalDays) - (prev.pTaxes || 0)));
    const net = R(actualGross - insAmt - monthlyTax - martyrs);

    return {
        gross: actualGross,
        insurance: insAmt,
        monthlyTax,
        martyrs,
        net,
        taxableIncome: currentTaxablePool
    };
}

// --- API Implementation ---
app.get("/api/employees", async (req, res) => {
    try {
        const emps = await Employee.find().sort({ hiringDate: -1 });
        res.json(emps);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/employees", async (req, res) => {
    try {
        const emp = new Employee(req.body);
        await emp.save();
        res.json(emp);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/employees/:id/details", async (req, res) => {
    try {
        const emp = await Employee.findById(req.params.id);
        const history = await Payroll.find({ employeeId: req.params.id }).sort({ month: 1 });
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        history.forEach(r => {
            pDays += r.days;
            pTaxable += r.taxableIncome;
            pTaxes += r.monthlyTax;
        });
        res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/payroll/calculate", async (req, res) => {
    try {
        const { empId, month, days, basicGross, prevData } = req.body;
        const emp = await Employee.findById(empId);
        if (!emp) return res.status(404).send("Employee not found");

        const result = processMonthlyPayroll({ basicFull: basicGross, days, month }, prevData, emp);
        const record = new Payroll({ employeeId: empId, month, days, ...result });
        await record.save();
        res.json(record);
    } catch (e) { res.status(500).json({ error: e.message }); }
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

// --- User Interface (Frontend) ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enterprise Payroll System v7.5</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; background-color: #f1f5f9; }
        .custom-shadow { box-shadow: 0 10px 40px -10px rgba(0,0,0,0.05); }
    </style>
</head>
<body class="flex min-h-screen">
    <aside class="w-72 bg-slate-900 text-white flex flex-col h-screen sticky top-0 shadow-2xl">
        <div class="p-10 text-3xl font-black border-b border-slate-800 text-center tracking-tighter">
            <i class="fas fa-file-invoice-dollar text-indigo-500 mb-2 block"></i>
            ERP <span class="text-indigo-400">PAYROLL</span>
        </div>
        <nav class="p-6 space-y-4">
            <div onclick="location.reload()" class="flex items-center p-4 rounded-2xl bg-indigo-600 text-white font-bold cursor-pointer shadow-lg shadow-indigo-600/20">
                <i class="fas fa-users-cog ml-4 text-xl"></i> قائمة الموظفين
            </div>
        </nav>
        <div class="mt-auto p-6 text-[10px] text-center text-slate-500 uppercase font-bold tracking-widest border-t border-slate-800">
            Internal Production System v7.5
        </div>
    </aside>

    <main class="flex-1 p-12 overflow-y-auto">
        <div id="view-list">
            <div class="flex justify-between items-end mb-12">
                <div>
                    <h1 class="text-4xl font-black text-slate-800 mb-2">إدارة الموارد البشرية</h1>
                    <p class="text-slate-500">متابعة رواتب الموظفين والضرائب والتأمينات</p>
                </div>
                <button onclick="document.getElementById('modal').classList.remove('hidden')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-indigo-200 transition-all active:scale-95">
                    <i class="fas fa-plus ml-2"></i> إضافة موظف
                </button>
            </div>

            <div class="bg-white rounded-[2.5rem] overflow-hidden custom-shadow border border-slate-100">
                <table class="w-full text-right border-collapse">
                    <thead>
                        <tr class="bg-slate-50/50 text-slate-400 text-sm uppercase">
                            <th class="p-8 font-bold">اسم الموظف</th>
                            <th class="p-8 text-center font-bold">تاريخ التعيين</th>
                            <th class="p-8 text-center font-bold">الحالة</th>
                            <th class="p-8 text-center font-bold">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="empTable" class="divide-y divide-slate-50"></tbody>
                </table>
            </div>
        </div>

        <div id="view-profile" class="hidden animate-in fade-in duration-500">
            <button onclick="location.reload()" class="mb-10 text-indigo-600 font-black flex items-center hover:-translate-x-2 transition-transform">
                <i class="fas fa-arrow-right ml-3"></i> العودة للقائمة الرئيسية
            </button>

            <div class="grid grid-cols-1 lg:grid-cols-4 gap-10">
                <div class="space-y-6">
                    <div class="bg-white p-10 rounded-[2.5rem] custom-shadow text-center border-t-8 border-indigo-500">
                        <div class="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl text-indigo-500">
                            <i class="fas fa-user"></i>
                        </div>
                        <h3 id="p-name" class="text-2xl font-black text-slate-800">--</h3>
                        <p id="p-nid" class="text-slate-400 text-sm mt-2 font-mono">--</p>
                        <div class="mt-8 pt-8 border-t border-slate-50 flex flex-col gap-3">
                            <button onclick="resign()" class="w-full py-4 bg-orange-50 text-orange-600 rounded-2xl font-bold hover:bg-orange-100 transition">إنهاء الخدمة</button>
                            <button onclick="del()" class="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition">حذف السجل</button>
                        </div>
                    </div>
                </div>

                <div class="lg:col-span-3 space-y-10">
                    <div id="calc-container" class="bg-slate-900 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                        <div class="absolute top-0 right-0 p-10 opacity-10 text-9xl"><i class="fas fa-calculator"></i></div>
                        <h4 class="text-2xl font-black mb-10 flex items-center">
                            <span class="w-3 h-10 bg-indigo-500 rounded-full ml-4"></span>
                            معالجة الراتب الشهري
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div class="space-y-2">
                                <label class="text-[11px] text-slate-500 font-bold uppercase tracking-widest">فترة الاستحقاق</label>
                                <input type="month" id="c-month" class="w-full bg-slate-800/50 border-2 border-slate-700 p-5 rounded-2xl text-white outline-none font-bold" readonly>
                            </div>
                            <div class="space-y-2">
                                <label class="text-[11px] text-slate-500 font-bold uppercase tracking-widest">إجمالي الراتب (Gross)</label>
                                <input type="number" id="c-gross" placeholder="0.00" class="w-full bg-slate-800 border-2 border-slate-700 p-5 rounded-2xl text-white outline-none focus:border-indigo-500 transition font-bold">
                            </div>
                            <div class="flex items-end">
                                <button onclick="runCalc()" class="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-lg hover:bg-indigo-500 transition-all active:scale-95">
                                    حساب واعتماد الشهر
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-[2.5rem] overflow-hidden custom-shadow border border-slate-100">
                        <div class="p-8 border-b bg-slate-50/50 flex justify-between items-center">
                            <h5 class="font-black text-slate-800 text-lg">سجل المدفوعات التاريخي</h5>
                            <span class="text-xs text-slate-400">جميع المبالغ بالجنيه المصري</span>
                        </div>
                        <table class="w-full text-center text-xs">
                            <thead class="bg-slate-50 text-slate-400">
                                <tr>
                                    <th class="p-6">الشهر</th>
                                    <th class="p-6">Gross</th>
                                    <th class="p-6">تأمين (11%)</th>
                                    <th class="p-6">شهداء</th>
                                    <th class="p-6 text-red-500">الضريبة</th>
                                    <th class="p-6 bg-emerald-50 text-emerald-700 font-black">الصافي (Net)</th>
                                </tr>
                            </thead>
                            <tbody id="histBody" class="divide-y divide-slate-100"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <div id="modal" class="hidden fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-[100]">
        <div class="bg-white rounded-[3rem] p-12 w-full max-w-xl shadow-2xl animate-in zoom-in duration-300">
            <h3 class="text-3xl font-black mb-8 text-slate-800">تسجيل موظف جديد</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="md:col-span-2">
                    <label class="text-xs font-bold text-slate-400 mb-2 block uppercase">الاسم الكامل</label>
                    <input type="text" id="n-name" class="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 mb-2 block uppercase">الرقم القومي</label>
                    <input type="text" id="n-nid" class="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 mb-2 block uppercase">تاريخ التعيين</label>
                    <input type="date" id="n-hdate" class="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 mb-2 block uppercase">الراتب التأميني</label>
                    <input type="number" id="n-ins" class="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none">
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400 mb-2 block uppercase">نوع العقد</label>
                    <select id="n-type" class="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none font-bold text-indigo-600">
                        <option>Full Time</option>
                        <option>Part Time</option>
                    </select>
                </div>
            </div>
            <div class="flex gap-4 mt-12">
                <button onclick="saveEmp()" class="flex-1 bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition">إتمام التسجيل</button>
                <button onclick="document.getElementById('modal').classList.add('hidden')" class="flex-1 bg-slate-100 text-slate-500 py-5 rounded-2xl font-bold hover:bg-slate-200 transition">إلغاء</button>
            </div>
        </div>
    </div>

    <input type="hidden" id="currId"><input type="hidden" id="pD"><input type="hidden" id="pTxbl"><input type="hidden" id="pTx">

    <script>
        async function load() {
            try {
                const res = await fetch('/api/employees');
                const data = await res.json();
                document.getElementById('empTable').innerHTML = data.map(e => \`
                    <tr class="hover:bg-slate-50/80 transition cursor-pointer group" onclick="openProfile('\${e._id}')">
                        <td class="p-8 font-black text-slate-700">
                            <div class="flex items-center">
                                <div class="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center ml-4 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition">
                                    <i class="fas fa-user-check"></i>
                                </div>
                                \${e.name}
                            </div>
                        </td>
                        <td class="p-8 text-center text-slate-500 font-bold">\${new Date(e.hiringDate).toLocaleDateString('en-GB')}</td>
                        <td class="p-8 text-center">
                            <span class="px-4 py-2 \${e.resignationDate ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'} rounded-xl text-[10px] font-black uppercase tracking-wider">
                                \${e.resignationDate ? 'مستقيل' : 'نشط'}
                            </span>
                        </td>
                        <td class="p-8 text-center">
                            <button class="text-indigo-600 font-black hover:underline underline-offset-8">إدارة الراتب <i class="fas fa-chevron-left mr-2 text-[10px]"></i></button>
                        </td>
                    </tr>
                \`).join('');
            } catch(e) { console.error(e); }
        }

        async function openProfile(id) {
            document.getElementById('currId').value = id;
            document.getElementById('view-list').classList.add('hidden');
            document.getElementById('view-profile').classList.remove('hidden');
            
            const res = await fetch(\`/api/employees/\${id}/details\`);
            const data = await res.json();
            
            document.getElementById('p-name').innerText = data.emp.name;
            document.getElementById('p-nid').innerText = data.emp.nationalId;
            
            let lastMonth = data.history.length > 0 ? data.history[data.history.length - 1].month : data.emp.hiringDate.substring(0, 7);
            if (data.history.length > 0) {
                let [y, m] = lastMonth.split('-').map(Number);
                m++; if(m > 12) { m = 1; y++; }
                lastMonth = \`\${y}-\${m.toString().padStart(2, '0')}\`;
            }
            document.getElementById('c-month').value = lastMonth;

            if (data.emp.resignationDate && lastMonth > data.emp.resignationDate.substring(0, 7)) {
                document.getElementById('calc-container').classList.add('hidden');
            }

            document.getElementById('pD').value = data.prevData.pDays;
            document.getElementById('pTxbl').value = data.prevData.pTaxable;
            document.getElementById('pTx').value = data.prevData.pTaxes;

            document.getElementById('histBody').innerHTML = data.history.map(r => \`
                <tr class="hover:bg-slate-50 transition border-b border-slate-50">
                    <td class="p-6 font-black text-slate-600">\${r.month}</td>
                    <td class="p-6 font-bold">\${r.gross.toLocaleString()}</td>
                    <td class="p-6">\${r.insurance.toLocaleString()}</td>
                    <td class="p-6 text-orange-500 font-bold">\${r.martyrs.toLocaleString()}</td>
                    <td class="p-6 text-red-500 font-black">\${r.monthlyTax.toLocaleString()}</td>
                    <td class="p-6 font-black text-emerald-700 bg-emerald-50/30 shadow-inner">\${r.net.toLocaleString()}</td>
                </tr>
            \`).join('');
        }

        async function saveEmp() {
            const body = {
                name: document.getElementById('n-name').value,
                nationalId: document.getElementById('n-nid').value,
                hiringDate: document.getElementById('n-hdate').value,
                insSalary: Number(document.getElementById('n-ins').value),
                jobType: document.getElementById('n-type').value
            };
            if(!body.name || !body.nationalId) return alert("برجاء ملء البيانات");
            await fetch('/api/employees', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            location.reload();
        }

        async function runCalc() {
            const body = {
                empId: document.getElementById('currId').value,
                month: document.getElementById('c-month').value,
                days: 30,
                basicGross: Number(document.getElementById('c-gross').value),
                prevData: {
                    pDays: Number(document.getElementById('pD').value),
                    pTaxable: Number(document.getElementById('pTxbl').value),
                    pTaxes: Number(document.getElementById('pTx').value)
                }
            };
            if(!body.basicGross) return alert("أدخل الراتب المستحق أولاً");
            const res = await fetch('/api/payroll/calculate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            if (res.ok) {
                openProfile(body.empId);
                document.getElementById('c-gross').value = '';
            }
        }

        async function del() { if(confirm("حذف ملف الموظف نهائياً؟")) { await fetch(\`/api/employees/\${document.getElementById('currId').value}\`, {method:'DELETE'}); location.reload(); } }
        async function resign() { const d = prompt("تاريخ الاستقالة (YYYY-MM-DD):"); if(d) { await fetch(\`/api/employees/\${document.getElementById('currId').value}/resign\`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({date:d})}); openProfile(document.getElementById('currId').value); } }

        window.onload = load;
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`✅ System Operational on Port \${PORT}\`));
