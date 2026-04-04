const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// الاتصال بـ MongoDB Atlas
const mongoURI = process.env.MONGO_URI || "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

mongoose.connect(mongoURI)
    .then(() => console.log("ERP Database Connected Successfully"))
    .catch(err => console.error("Database Connection Error:", err));

// --- Database Models ---
const Employee = mongoose.model("Employee", new mongoose.Schema({
    name: String,
    nationalId: { type: String, unique: true },
    insSalary: Number,
    hiringDate: { type: Date, default: Date.now },
    status: { type: String, default: 'active' }
}));

const PayrollRecord = mongoose.model("PayrollRecord", new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId,
    employeeName: String,
    month: String,
    days: Number,
    gross: Number,
    insurance: Number,
    tax: Number,
    martyrs: Number,
    net: Number,
    createdAt: { type: Date, default: Date.now }
}));

// --- Payroll Calculation Logic ---
const R = (n) => Math.round(n * 100) / 100;

function calculateTax(taxableIncome, days) {
    // تحويل لسنوي (360 يوم) وتقريب لأقرب 10 جنيه أقل حسب القانون
    const annualTaxable = Math.floor(((taxableIncome / days) * 360) / 10) * 10;
    let annualTax = 0;
    let temp = Math.max(0, annualTaxable - 20000); // إعفاء شخصي 20,000

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
    return (annualTax / 360) * days;
}

// --- API Routes ---

// 1. جلب الموظفين
app.get("/api/employees", async (req, res) => {
    const data = await Employee.find().sort({ name: 1 });
    res.json(data);
});

// 2. إضافة موظف جديد
app.post("/api/employees", async (req, res) => {
    try {
        const emp = new Employee(req.body);
        await emp.save();
        res.json({ success: true });
    } catch (err) { res.status(400).json({ error: "الرقم القومي مسجل مسبقاً" }); }
});

// 3. حساب وحفظ الراتب
app.post("/api/payroll/run", async (req, res) => {
    const { empId, month, days, basicGross, bonus, deductions } = req.body;
    const emp = await Employee.findById(empId);

    const actualGross = (basicGross / 30) * days;
    const insurance = emp.insSalary * 0.11; 
    const martyrs = (actualGross + bonus) * 0.0005;
    const taxableIncome = (actualGross + bonus) - insurance - deductions;
    
    const monthlyTax = calculateTax(taxableIncome, days);
    const net = (actualGross + bonus) - insurance - monthlyTax - martyrs - deductions;

    const record = new PayrollRecord({
        employeeId: emp._id,
        employeeName: emp.name,
        month, days,
        gross: R(actualGross + bonus),
        insurance: R(insurance),
        tax: R(monthlyTax),
        martyrs: R(martyrs),
        net: R(net)
    });

    await record.save();
    res.json(record);
});

// 4. صفحة الـ UI الرئيسية (Dashboard)
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Enterprise Payroll System v1</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body class="bg-slate-50 flex min-h-screen">
    <div class="w-72 bg-indigo-900 text-white fixed h-full p-6 shadow-2xl">
        <h1 class="text-2xl font-black mb-10 text-indigo-300 tracking-tighter"><i class="fas fa-layer-group ml-2"></i> ERP PAYROLL</h1>
        <nav class="space-y-2">
            <button class="w-full text-right p-4 rounded-xl bg-indigo-800 font-bold"><i class="fas fa-users ml-3"></i> إدارة الموظفين</button>
            <button class="w-full text-right p-4 rounded-xl hover:bg-indigo-800 transition"><i class="fas fa-coins ml-3"></i> سجل الرواتب</button>
        </nav>
    </div>

    <div class="mr-72 w-full p-10">
        <div class="flex justify-between items-center mb-12">
            <div>
                <h2 class="text-3xl font-extrabold text-slate-800">شؤون العاملين</h2>
                <p class="text-slate-500 mt-1">إدارة بيانات الموظفين واحتساب الرواتب الشهرية</p>
            </div>
            <button onclick="openModal()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95">+ إضافة موظف جديد</button>
        </div>

        <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <table class="w-full text-right">
                <thead class="bg-slate-50 border-b border-slate-100">
                    <tr>
                        <th class="p-6 text-slate-600 font-bold">اسم الموظف</th>
                        <th class="p-6 text-slate-600 font-bold">الرقم القومي</th>
                        <th class="p-6 text-slate-600 font-bold">الأجر التأميني</th>
                        <th class="p-6 text-slate-600 font-bold">الإجراءات</th>
                    </tr>
                </thead>
                <tbody id="empTable" class="divide-y divide-slate-50">
                    </tbody>
            </table>
        </div>
    </div>

    <div id="modal" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h3 class="text-2xl font-bold mb-6 text-slate-800">بيانات الموظف</h3>
            <div class="space-y-4">
                <input type="text" id="name" placeholder="اسم الموظف" class="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 ring-indigo-500 outline-none">
                <input type="text" id="nid" placeholder="الرقم القومي" class="w-full p-4 bg-slate-50 border-none rounded-2xl">
                <input type="number" id="insSal" placeholder="الأجر التأميني" class="w-full p-4 bg-slate-50 border-none rounded-2xl">
                <div class="flex gap-3 mt-8">
                    <button onclick="saveEmp()" class="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold">حفظ البيانات</button>
                    <button onclick="closeModal()" class="flex-1 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold">إلغاء</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const openModal = () => document.getElementById('modal').classList.remove('hidden');
        const closeModal = () => document.getElementById('modal').classList.add('hidden');

        async function loadEmployees() {
            const res = await fetch('/api/employees');
            const data = await res.json();
            const table = document.getElementById('empTable');
            table.innerHTML = data.map(e => \`
                <tr class="hover:bg-slate-50 transition">
                    <td class="p-6 font-bold text-slate-800">\${e.name}</td>
                    <td class="p-6 text-slate-500 font-mono">\${e.nationalId}</td>
                    <td class="p-6 font-bold text-indigo-600">\${e.insSalary.toLocaleString()} ج.م</td>
                    <td class="p-6">
                        <button onclick="runPayroll('\${e._id}')" class="bg-emerald-50 text-emerald-700 px-5 py-2 rounded-xl font-bold hover:bg-emerald-100 transition">
                            <i class="fas fa-bolt ml-2"></i> صرف الراتب
                        </button>
                    </td>
                </tr>
            \`).join('');
        }

        async function saveEmp() {
            const payload = {
                name: document.getElementById('name').value,
                nationalId: document.getElementById('nid').value,
                insSalary: document.getElementById('insSal').value
            };
            const res = await fetch('/api/employees', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            if(res.ok) { closeModal(); loadEmployees(); }
            else alert("خطأ في الحفظ!");
        }

        async function runPayroll(id) {
            const gross = prompt("أدخل الراتب الإجمالي المستحق (Gross):", "10000");
            if(!gross) return;
            const res = await fetch('/api/payroll/run', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    empId: id,
                    month: "2026-04",
                    days: 30,
                    basicGross: Number(gross),
                    bonus: 0,
                    deductions: 0
                })
            });
            const data = await res.json();
            alert(\`تم الحساب بنجاح!\\nالصافي: \${data.net} ج.م\\nالضريبة: \${data.tax} ج.م\`);
        }

        window.onload = loadEmployees;
    </script>
</body>
</html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("ERP Online on port " + PORT));
                                             
