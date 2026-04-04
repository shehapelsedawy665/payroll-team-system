const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// الاتصال بـ MongoDB مع إعدادات حماية من الـ Crash
const mongoURI = process.env.MONGO_URI || "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

mongoose.connect(mongoURI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000 
}).catch(err => console.error("MongoDB Connection Error:", err));

// --- Models ---
const Employee = mongoose.models.Employee || mongoose.model("Employee", new mongoose.Schema({
    name: String,
    nationalId: { type: String, unique: true },
    employmentType: { type: String, default: "Full Time" },
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

// --- Payroll Engine ---
const R = (n) => Math.round(n * 100) / 100;

function calculateSequential(data, prevData) {
    const { basicFull, days, insSalary } = data;
    const { prevDays, prevTaxable, prevTaxes } = prevData;

    let insurance = insSalary * 0.11; // التأمينات كاملة
    const actualBasic = (basicFull / 30) * days;
    const martyrs = actualBasic * 0.0005;
    const currentTaxable = actualBasic - insurance;

    const totalDays = days + (prevDays || 0);
    const totalTaxable = currentTaxable + (prevTaxable || 0);
    
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
    const monthlyTax = Math.max(0, totalTaxDueUntilNow - (prevTaxes || 0));

    return {
        gross: R(actualBasic),
        insurance: R(insurance),
        tax: R(monthlyTax),
        martyrs: R(martyrs),
        net: R(actualBasic - insurance - monthlyTax - martyrs),
        currentTaxable: R(currentTaxable)
    };
}

// --- API Routes ---
app.get("/api/employees", async (req, res) => {
    try {
        const emps = await Employee.find().sort({ name: 1 }).lean();
        res.json(emps);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/employees", async (req, res) => {
    try {
        const emp = new Employee(req.body);
        await emp.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "Duplicate National ID" }); }
});

app.delete("/api/employees/:id", async (req, res) => {
    try {
        await Employee.findByIdAndDelete(req.params.id);
        await Payroll.deleteMany({ employeeId: req.params.id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/employees/:id/resign", async (req, res) => {
    try {
        const { date } = req.body;
        await Employee.findByIdAndUpdate(req.params.id, { resignationDate: date });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/employees/:id/payroll-details", async (req, res) => {
    try {
        const emp = await Employee.findById(req.params.id).lean();
        const history = await Payroll.find({ employeeId: req.params.id }).sort({ month: 1 }).lean();
        let pDays = 0, pTaxable = 0, pTaxes = 0;
        history.forEach(r => { pDays += r.days; pTaxable += r.taxableIncome; pTaxes += r.monthlyTax; });
        res.json({ emp, history, prevData: { pDays, pTaxable, pTaxes } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/payroll/calculate", async (req, res) => {
    try {
        const { empId, month, days, basicGross, prevData } = req.body;
        const emp = await Employee.findById(empId);
        const result = calculateSequential({ basicFull: basicGross, days, insSalary: emp.insSalary }, prevData);
        const record = new Payroll({
            employeeId: empId, month, days,
            gross: result.gross, taxableIncome: result.currentTaxable,
            monthlyTax: result.tax, insurance: result.insurance,
            martyrs: result.martyrs, net: result.net
        });
        await record.save();
        res.json(record);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Frontend (UI) ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ERP Payroll System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body class="bg-gray-100 min-h-screen flex">
    <div class="w-64 bg-slate-900 text-white fixed h-full p-6">
        <h1 class="text-xl font-bold border-b border-slate-700 pb-4 mb-6 text-indigo-400">Payroll System</h1>
        <button onclick="showSection('employees')" class="w-full text-right p-3 rounded bg-slate-800"><i class="fas fa-users ml-2"></i> الموظفين</button>
    </div>

    <div class="mr-64 w-full p-8">
        <div id="sec-employees">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">قائمة الموظفين</h2>
                <button onclick="document.getElementById('modal').classList.remove('hidden')" class="bg-indigo-600 text-white px-4 py-2 rounded-lg">+ إضافة موظف</button>
            </div>
            <div class="bg-white rounded-xl shadow overflow-hidden">
                <table class="w-full text-right">
                    <thead class="bg-gray-50 border-b">
                        <tr><th class="p-4">الاسم</th><th class="p-4">الرقم القومي</th><th class="p-4">الحالة</th><th class="p-4">إجراءات</th></tr>
                    </thead>
                    <tbody id="empTable"></tbody>
                </table>
            </div>
        </div>

        <div id="sec-profile" class="hidden">
            <div class="flex justify-between mb-6">
                <button onclick="showSection('employees')" class="text-indigo-600 font-bold"><i class="fas fa-arrow-right"></i> عودة</button>
                <div>
                    <button onclick="resignEmp()" class="bg-orange-500 text-white px-4 py-2 rounded-lg ml-2">إنهاء خدمة</button>
                    <button onclick="deleteEmp()" class="bg-red-500 text-white px-4 py-2 rounded-lg">حذف نهائي</button>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-6 mb-6">
                <div class="bg-white p-6 rounded-xl shadow border-t-4 border-indigo-500">
                    <h3 id="p-name" class="text-lg font-bold mb-4">--</h3>
                    <p class="text-sm text-gray-600">التعيين: <span id="p-hdate">--</span></p>
                    <p class="text-sm text-gray-600">التأمينات: <span id="p-ins" class="text-green-600 font-bold">--</span></p>
                    <p id="p-r-area" class="text-sm text-red-600 font-bold hidden">استقالة: <span id="p-rdate">--</span></p>
                </div>
                <div class="col-span-2 bg-white p-6 rounded-xl shadow">
                    <div class="grid grid-cols-3 gap-4 mb-4">
                        <select id="c-month" class="p-2 border rounded bg-gray-50"></select>
                        <input type="number" id="c-days" value="30" class="p-2 border rounded" placeholder="الأيام">
                        <input type="number" id="c-gross" class="p-2 border rounded" placeholder="الراتب (Gross)">
                    </div>
                    <button id="calcBtn" onclick="runPayroll()" class="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold">احسب واحفظ الراتب</button>
                </div>
            </div>
            <div class="bg-slate-800 text-white rounded-xl p-4 overflow-hidden shadow-lg">
                <table class="w-full text-center text-sm">
                    <thead><tr class="text-gray-400 border-b border-slate-700"><th class="p-2">الشهر</th><th class="p-2">الصافي</th><th class="p-2">الضريبة</th><th class="p-2">تأمين</th></tr></thead>
                    <tbody id="historyTable"></tbody>
                </table>
            </div>
        </div>
    </div>

    <div id="modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4">
        <div class="bg-white p-6 rounded-xl w-96">
            <h3 class="text-lg font-bold mb-4">موظف جديد</h3>
            <input type="text" id="n-name" placeholder="الاسم" class="w-full p-2 border rounded mb-3">
            <input type="text" id="n-nid" placeholder="الرقم القومي" class="w-full p-2 border rounded mb-3">
            <input type="date" id="n-hdate" class="w-full p-2 border rounded mb-3">
            <input type="number" id="n-ins" placeholder="الأجر التأميني" class="w-full p-2 border rounded mb-4">
            <div class="flex gap-2">
                <button onclick="saveEmp()" class="flex-1 bg-indigo-600 text-white py-2 rounded">حفظ</button>
                <button onclick="document.getElementById('modal').classList.add('hidden')" class="flex-1 bg-gray-200 py-2 rounded">إلغاء</button>
            </div>
        </div>
    </div>

    <input type="hidden" id="currId">
    <input type="hidden" id="pDays"><input type="hidden" id="pTaxable"><input type="hidden" id="pTaxes">

    <script>
        function showSection(id) {
            document.getElementById('sec-employees').classList.add('hidden');
            document.getElementById('sec-profile').classList.add('hidden');
            document.getElementById('sec-' + id).classList.remove('hidden');
            if(id === 'employees') loadEmps();
        }

        async function loadEmps() {
            const res = await fetch('/api/employees');
            const data = await res.json();
            document.getElementById('empTable').innerHTML = data.map(e => \`
                <tr class="border-b">
                    <td class="p-4 font-bold">\${e.name}</td>
                    <td class="p-4 text-gray-500">\${e.nationalId}</td>
                    <td class="p-4 \${e.resignationDate ? 'text-red-500' : 'text-green-500'}">\${e.resignationDate ? 'مستقيل' : 'نشط'}</td>
                    <td class="p-4"><button onclick="openProfile('\${e._id}')" class="text-indigo-600 font-bold">فتح الملف</button></td>
                </tr>
            \`).join('');
        }

        async function openProfile(id) {
            document.getElementById('currId').value = id;
            showSection('profile');
            const res = await fetch('/api/employees/' + id + '/payroll-details');
            const data = await res.json();
            
            document.getElementById('p-name').innerText = data.emp.name;
            document.getElementById('p-ins').innerText = data.emp.insSalary;
            document.getElementById('p-hdate').innerText = data.emp.hiringDate?.split('T')[0];
            if(data.emp.resignationDate) {
                document.getElementById('p-r-area').classList.remove('hidden');
                document.getElementById('p-rdate').innerText = data.emp.resignationDate.split('T')[0];
            } else { document.getElementById('p-r-area').classList.add('hidden'); }

            document.getElementById('pDays').value = data.prevData.pDays;
            document.getElementById('pTaxable').value = data.prevData.pTaxable;
            document.getElementById('pTaxes').value = data.prevData.pTaxes;

            // Logic Lock Months
            const select = document.getElementById('c-month');
            select.innerHTML = "";
            const hDate = new Date(data.emp.hiringDate);
            const calculated = data.history.map(r => r.month);
            
            let nextMonth = "";
            if(calculated.length > 0) {
                let d = new Date(calculated[calculated.length-1] + "-01");
                d.setMonth(d.getMonth() + 1);
                nextMonth = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2, '0');
            } else {
                nextMonth = hDate.getFullYear() + "-" + String(hDate.getMonth()+1).padStart(2, '0');
            }

            for(let m=1; m<=12; m++) {
                let val = hDate.getFullYear() + "-" + String(m).padStart(2, '0');
                let opt = document.createElement('option');
                opt.value = val; opt.text = val + (calculated.includes(val) ? " (محسوب)" : "");
                opt.disabled = val !== nextMonth || data.emp.resignationDate;
                if(val === nextMonth) opt.selected = true;
                select.appendChild(opt);
            }
            document.getElementById('calcBtn').disabled = data.emp.resignationDate;
            
            document.getElementById('historyTable').innerHTML = data.history.map(r => \`
                <tr class="border-b border-slate-700"><td class="p-2">\${r.month}</td><td class="p-2 text-emerald-400 font-bold">\${r.net}</td><td class="p-2">\${r.monthlyTax}</td><td class="p-2">\${r.insurance}</td></tr>
            \`).join('');
        }

        async function saveEmp() {
            await fetch('/api/employees', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    name: document.getElementById('n-name').value,
                    nationalId: document.getElementById('n-nid').value,
                    hiringDate: document.getElementById('n-hdate').value,
                    insSalary: document.getElementById('n-ins').value
                })
            });
            document.getElementById('modal').classList.add('hidden'); loadEmps();
        }

        async function deleteEmp() {
            if(!confirm("حذف نهائي؟")) return;
            await fetch('/api/employees/' + document.getElementById('currId').value, { method: 'DELETE' });
            showSection('employees');
        }

        async function resignEmp() {
            const d = prompt("تاريخ الاستقالة YYYY-MM-DD:");
            if(!d) return;
            await fetch('/api/employees/' + document.getElementById('currId').value + '/resign', {
                method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({date: d})
            });
            openProfile(document.getElementById('currId').value);
        }

        async function runPayroll() {
            const res = await fetch('/api/payroll/calculate', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    empId: document.getElementById('currId').value,
                    month: document.getElementById('c-month').value,
                    days: Number(document.getElementById('c-days').value),
                    basicGross: Number(document.getElementById('c-gross').value),
                    prevData: {
                        prevDays: Number(document.getElementById('pDays').value),
                        prevTaxable: Number(document.getElementById('pTaxable').value),
                        prevTaxes: Number(document.getElementById('pTaxes').value)
                    }
                })
            });
            if(res.ok) { document.getElementById('c-gross').value = ""; openProfile(document.getElementById('currId').value); }
        }

        window.onload = loadEmps;
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server ready"));
        
