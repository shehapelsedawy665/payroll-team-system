const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Connection ---
const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

// اتصال مستقر لمرة واحدة
if (mongoose.connection.readyState === 0) {
    mongoose.connect(mongoURI).catch(err => console.error("DB Connection Error:", err));
}

// --- Models (Fixed to prevent crashing on Vercel) ---
const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({
    name: { type: String, required: true },
    nationalId: { type: String, required: true },
    hiringDate: { type: Date, required: true },
    resignationDate: { type: Date },
    insSalary: { type: Number, default: 0 },
    jobType: { type: String, default: "Full Time" }
}));

const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", new mongoose.Schema({
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
}));

// --- Pure Logic (Verified Calculations) ---
const R = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

function calculateEgyptianTax(annualTaxable) {
    let tax = 0;
    let remainder = annualTaxable; 
    const brackets = [
        { limit: 30000, rate: 0.00 }, { limit: 15000, rate: 0.10 }, 
        { limit: 15000, rate: 0.15 }, { limit: 140000, rate: 0.20 },
        { limit: 200000, rate: 0.225 }, { limit: 200000, rate: 0.25 },
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

// --- API Endpoints ---
app.get("/api/employees", async (req, res) => {
    try { res.json(await Employee.find().sort({ hiringDate: -1 })); } 
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/employees", async (req, res) => {
    try { res.json(await new Employee(req.body).save()); } 
    catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/employees/:id/details", async (req, res) => {
    try {
        const emp = await Employee.findById(req.params.id);
        const history = await Payroll.find({ employeeId: req.params.id }).sort({ month: 1 });
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        history.forEach(r => { pDays += r.days; pTaxable += r.taxableIncome; pTaxes += r.monthlyTax; });
        res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/payroll/calculate", async (req, res) => {
    try {
        const { empId, month, days, basicGross, prevData } = req.body;
        const emp = await Employee.findById(empId);
        
        // Calculation Block
        const insBase = Math.max(emp.jobType === "Full Time" ? R(7000/1.3) : 2720, Math.min(16700, emp.insSalary));
        const insAmt = R(insBase * 0.11);
        const actualGross = R((basicGross / 30) * days);
        const martyrs = R(actualGross * 0.0005);
        const personalExemption = R((20000 / 360) * days);
        const currentTaxablePool = Math.max(0, (actualGross - insAmt) - personalExemption);
        
        const totalDays = days + (prevData.pDays || 0);
        const totalTaxablePool = currentTaxablePool + (prevData.pTaxable || 0);
        const annualTaxableProjected = Math.floor(((totalTaxablePool / totalDays) * 360) / 10) * 10;
        
        const annualTax = calculateEgyptianTax(annualTaxableProjected);
        const monthlyTax = R(Math.max(0, ((annualTax / 360) * totalDays) - (prevData.pTaxes || 0)));
        const net = R(actualGross - insAmt - monthlyTax - martyrs);

        const record = await new Payroll({ employeeId: empId, month, days, gross: actualGross, insurance: insAmt, monthlyTax, martyrs, net, taxableIncome: currentTaxablePool }).save();
        res.json(record);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/employees/:id", async (req, res) => {
    await Employee.findByIdAndDelete(req.params.id);
    await Payroll.deleteMany({ employeeId: req.params.id });
    res.json({ success: true });
});

// --- UI (Same Professional Design) ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Enterprise Payroll v10.0</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style> @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap'); body { font-family: 'Cairo', sans-serif; background: #f8fafc; } </style>
</head>
<body class="flex min-h-screen">
    <aside class="w-80 bg-slate-900 text-white flex flex-col h-screen sticky top-0 shadow-2xl">
        <div class="p-12 text-3xl font-black border-b border-slate-800 text-center text-indigo-500 italic">ODOO</div>
        <nav class="p-8 space-y-6"><div onclick="location.reload()" class="flex items-center p-5 rounded-[2rem] bg-indigo-600 font-bold cursor-pointer"><i class="fas fa-users ml-4"></i> الموظفين</div></nav>
    </aside>
    <main class="flex-1 p-16 overflow-y-auto">
        <div id="view-list">
            <div class="flex justify-between items-center mb-10">
                <h1 class="text-4xl font-black text-slate-800">إدارة الرواتب</h1>
                <button onclick="document.getElementById('modal').classList.remove('hidden')" class="bg-indigo-600 text-white px-10 py-4 rounded-[2rem] font-black">إضافة موظف +</button>
            </div>
            <div class="bg-white rounded-[3rem] shadow-sm border overflow-hidden"><table class="w-full text-right"><thead class="bg-slate-50 border-b"><tr><th class="p-8">الموظف</th><th class="p-8 text-center">التعيين</th><th class="p-8 text-center">إدارة</th></tr></thead><tbody id="empTable"></tbody></table></div>
        </div>
        <div id="view-profile" class="hidden">
            <button onclick="location.reload()" class="mb-10 text-indigo-600 font-black">← العودة للقائمة</button>
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-10">
                <div class="bg-white p-10 rounded-[3rem] shadow-sm border-t-8 border-indigo-500 text-center">
                    <h3 id="p-name" class="text-2xl font-black mb-2"></h3>
                    <p id="p-nid" class="text-slate-400 font-mono"></p>
                    <button onclick="del()" class="mt-8 text-red-500 font-bold underline">حذف السجل</button>
                </div>
                <div class="lg:col-span-3 space-y-10">
                    <div class="bg-slate-900 p-12 rounded-[3rem] text-white shadow-xl flex gap-6 items-end">
                        <div class="flex-1"><label class="text-[10px] block mb-2 opacity-50 uppercase tracking-widest">الشهر</label><input type="month" id="c-month" class="w-full bg-slate-800 p-4 rounded-2xl outline-none" readonly></div>
                        <div class="flex-1"><label class="text-[10px] block mb-2 opacity-50 uppercase tracking-widest">Gross</label><input type="number" id="c-gross" class="w-full bg-slate-800 p-4 rounded-2xl outline-none font-black text-xl"></div>
                        <button onclick="runCalc()" class="bg-indigo-600 px-10 py-4 rounded-2xl font-black">تأكيد الحساب</button>
                    </div>
                    <div class="bg-white rounded-[3rem] border overflow-hidden"><table class="w-full text-center"><thead class="bg-slate-50"><tr><th class="p-6">الشهر</th><th class="p-6">Gross</th><th class="p-6">تأمين</th><th class="p-6 text-red-500">ضريبة</th><th class="p-6 font-black text-emerald-600">صافي Net</th></tr></thead><tbody id="histBody"></tbody></table></div>
                </div>
            </div>
        </div>
    </main>

    <div id="modal" class="hidden fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-8 z-[100]">
        <div class="bg-white p-12 rounded-[3rem] w-full max-w-xl shadow-2xl">
            <h3 class="text-3xl font-black mb-8 text-slate-800">موظف جديد</h3>
            <div class="space-y-6">
                <input type="text" id="n-name" placeholder="الاسم" class="w-full p-5 bg-slate-50 border rounded-2xl outline-none font-bold">
                <input type="text" id="n-nid" placeholder="الرقم القومي" class="w-full p-5 bg-slate-50 border rounded-2xl outline-none font-bold">
                <input type="date" id="n-hdate" class="w-full p-5 bg-slate-50 border rounded-2xl outline-none font-bold">
                <input type="number" id="n-ins" placeholder="الراتب التأميني" class="w-full p-5 bg-slate-50 border rounded-2xl outline-none font-bold">
                <select id="n-type" class="w-full p-5 bg-slate-50 border rounded-2xl font-black text-indigo-600"><option>Full Time</option><option>Part Time</option></select>
            </div>
            <div class="flex gap-4 mt-10"><button onclick="saveEmp()" class="flex-1 bg-indigo-600 text-white py-5 rounded-2xl font-black">حفظ</button><button onclick="document.getElementById('modal').classList.add('hidden')" class="flex-1 bg-slate-100 py-5 rounded-2xl font-black text-slate-400">إلغاء</button></div>
        </div>
    </div>

    <input type="hidden" id="currId"><input type="hidden" id="pD"><input type="hidden" id="pTxbl"><input type="hidden" id="pTx">

    <script>
        async function load() {
            const res = await fetch('/api/employees');
            const data = await res.json();
            document.getElementById('empTable').innerHTML = data.map(e => \`
                <tr class="hover:bg-slate-50 cursor-pointer" onclick="openProfile('\${e._id}')">
                    <td class="p-8 font-black text-slate-700 text-xl">\${e.name}</td>
                    <td class="p-8 text-center text-slate-400 font-bold">\${new Date(e.hiringDate).toLocaleDateString('en-GB')}</td>
                    <td class="p-8 text-center text-indigo-600 font-black">إدارة الحسابات</td>
                </tr>
            \`).join('');
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
            if (data.history.length > 0) { let [y, m] = lastMonth.split('-').map(Number); m++; if(m > 12) { m = 1; y++; } lastMonth = \`\${y}-\${m.toString().padStart(2, '0')}\`; }
            document.getElementById('c-month').value = lastMonth;
            document.getElementById('pD').value = data.prevData.pDays;
            document.getElementById('pTxbl').value = data.prevData.pTaxable;
            document.getElementById('pTx').value = data.prevData.pTaxes;
            document.getElementById('histBody').innerHTML = data.history.map(r => \`
                <tr class="border-b"><td class="p-6 font-bold">\${r.month}</td><td class="p-6">\${r.gross.toLocaleString()}</td><td class="p-6 text-slate-400">\${r.insurance.toLocaleString()}</td><td class="p-6 text-red-500 font-bold">\${r.monthlyTax.toLocaleString()}</td><td class="p-6 font-black text-emerald-600 text-lg">\${r.net.toLocaleString()}</td></tr>
            \`).join('');
        }
        async function saveEmp() {
            const body = { name: document.getElementById('n-name').value, nationalId: document.getElementById('n-nid').value, hiringDate: document.getElementById('n-hdate').value, insSalary: Number(document.getElementById('n-ins').value), jobType: document.getElementById('n-type').value };
            await fetch('/api/employees', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            location.reload();
        }
        async function runCalc() {
            const body = { empId: document.getElementById('currId').value, month: document.getElementById('c-month').value, days: 30, basicGross: Number(document.getElementById('c-gross').value), prevData: { pDays: Number(document.getElementById('pD').value), pTaxable: Number(document.getElementById('pTxbl').value), pTaxes: Number(document.getElementById('pTx').value) } };
            await fetch('/api/payroll/calculate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            openProfile(body.empId);
        }
        async function del() { if(confirm("حذف الموظف نهائياً؟")) { await fetch(\`/api/employees/\${document.getElementById('currId').value}\`, {method:'DELETE'}); location.reload(); } }
        window.onload = load;
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`✅ System Operational on Port \${PORT}\`));
