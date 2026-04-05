const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// --- اتصال قاعدة البيانات ---
const mongoURI = "mongodb://Sedawy:Shehapelsedawy%2366@ac-uso95cd-shard-00-00.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-01.a6bquen.mongodb.net:27017,ac-uso95cd-shard-00-02.a6bquen.mongodb.net:27017/payrollDB?ssl=true&replicaSet=atlas-129j51-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Egyptian-Payroll";

mongoose.connect(mongoURI)
    .then(() => console.log("Connected to MongoDB Atlas"))
    .catch(err => console.error("MongoDB Connection Error:", err));

// --- Models ---
const Employee = mongoose.model("Employee", new mongoose.Schema({
    name: String,
    nationalId: String,
    hiringDate: Date,
    insSalary: { type: Number, default: 0 }
}));

const Payroll = mongoose.model("Payroll", new mongoose.Schema({
    employeeId: mongoose.Schema.Types.ObjectId,
    month: String,
    days: Number,
    gross: Number,
    insurance: Number,
    monthlyTax: Number,
    martyrs: Number,
    net: Number
}));

// --- Tax Logic (The Core) ---
const R = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function calculateTax(monthlyTaxable) {
    // حسبة الضرائب المصرية 2024 (شرائح سنوية مقسمة على 12)
    // الإعفاء الشخصي 20,000 سنوياً
    let annualTaxable = (monthlyTaxable * 12) - 20000; 
    let tax = 0;

    const brackets = [
        { limit: 30000, rate: 0.00 },
        { limit: 15000, rate: 0.10 },
        { limit: 15000, rate: 0.15 },
        { limit: 140000, rate: 0.20 },
        { limit: 200000, rate: 0.225 },
        { limit: 200000, rate: 0.25 },
        { limit: Infinity, rate: 0.275 }
    ];

    let remainder = annualTaxable;
    for (let b of brackets) {
        if (remainder <= 0) break;
        let chunk = Math.min(remainder, b.limit);
        tax += chunk * b.rate;
        remainder -= chunk;
    }
    return R(tax / 12); // تحويل الضريبة لشهرية
}

// --- API Routes ---
app.get("/api/employees", async (req, res) => {
    res.json(await Employee.find().sort({ _id: -1 }));
});

app.post("/api/employees", async (req, res) => {
    const emp = new Employee(req.body);
    await emp.save();
    res.json(emp);
});

app.get("/api/employees/:id/details", async (req, res) => {
    const emp = await Employee.findById(req.params.id);
    const history = await Payroll.find({ employeeId: req.params.id }).sort({ month: -1 });
    res.json({ emp, history });
});

app.post("/api/payroll/calculate", async (req, res) => {
    try {
        const { empId, month, days, basicGross } = req.body;
        const emp = await Employee.findById(empId);
        
        const actualGross = R((basicGross / 30) * days);
        const insAmt = R((emp.insSalary || 0) * 0.11);
        const martyrs = R(actualGross * 0.0005);
        
        // الوعاء الضريبي = المرتب - التأمينات
        const taxableIncome = actualGross - insAmt;
        const monthlyTax = calculateTax(taxableIncome);
        const net = R(actualGross - insAmt - monthlyTax - martyrs);

        const record = new Payroll({
            employeeId: empId, month, days, gross: actualGross,
            insurance: insAmt, monthlyTax, martyrs, net
        });
        await record.save();
        res.json(record);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Frontend (Single Page UI) ---
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>Payroll System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap'); body { font-family: 'Cairo', sans-serif; }</style>
</head>
<body class="bg-gray-100 p-8">
    <div class="max-w-5xl mx-auto">
        <div class="flex justify-between items-center mb-8">
            <h1 class="text-2xl font-bold">نظام الرواتب v1.0</h1>
            <button onclick="showModal()" class="bg-blue-600 text-white px-4 py-2 rounded">إضافة موظف</button>
        </div>

        <div id="list" class="bg-white rounded shadow p-6">
            <table class="w-full text-right">
                <thead><tr class="border-b"><th class="p-3">الاسم</th><th class="p-3">الإجراء</th></tr></thead>
                <tbody id="empTable"></tbody>
            </table>
        </div>

        <div id="profile" class="hidden space-y-6">
            <button onclick="location.reload()" class="text-blue-600 underline">عودة</button>
            <div class="bg-white p-6 rounded shadow">
                <h2 id="p-name" class="text-xl font-bold mb-4"></h2>
                <div class="grid grid-cols-3 gap-4">
                    <input type="month" id="c-month" class="border p-2 rounded">
                    <input type="number" id="c-gross" placeholder="الراتب" class="border p-2 rounded">
                    <button onclick="calc()" class="bg-green-600 text-white p-2 rounded">حساب</button>
                </div>
            </div>
            <div class="bg-white p-6 rounded shadow">
                <table class="w-full text-center text-sm">
                    <thead><tr class="bg-gray-50 border-b"><th class="p-2">الشهر</th><th class="p-2">Gross</th><th class="p-2">تأمين</th><th class="p-2 text-red-600">ضريبة</th><th class="p-2 font-bold text-green-600">الصافي</th></tr></thead>
                    <tbody id="histBody"></tbody>
                </table>
            </div>
        </div>
    </div>

    <div id="modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center p-4">
        <div class="bg-white p-6 rounded w-full max-w-md">
            <h3 class="font-bold mb-4">موظف جديد</h3>
            <input id="n-name" placeholder="الاسم" class="w-full border p-2 mb-2 rounded">
            <input id="n-ins" type="number" placeholder="الراتب التأميني" class="w-full border p-2 mb-4 rounded">
            <button onclick="save()" class="w-full bg-blue-600 text-white p-2 rounded">حفظ</button>
        </div>
    </div>

    <script>
        async function load() {
            const res = await fetch('/api/employees');
            const data = await res.json();
            document.getElementById('empTable').innerHTML = data.map(e => \`
                <tr class="border-b">
                    <td class="p-3">\${e.name}</td>
                    <td class="p-3"><button onclick="view('\${e._id}')" class="text-blue-600 font-bold">إدارة</button></td>
                </tr>
            \`).join('');
        }
        function showModal() { document.getElementById('modal').classList.remove('hidden'); }
        async function save() {
            const body = { name: document.getElementById('n-name').value, insSalary: Number(document.getElementById('n-ins').value) };
            await fetch('/api/employees', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            location.reload();
        }
        async function view(id) {
            window.activeId = id;
            document.getElementById('list').classList.add('hidden');
            document.getElementById('profile').classList.remove('hidden');
            const res = await fetch(\`/api/employees/\${id}/details\`);
            const data = await res.json();
            document.getElementById('p-name').innerText = data.emp.name;
            document.getElementById('histBody').innerHTML = data.history.map(r => \`
                <tr class="border-b">
                    <td class="p-2">\${r.month}</td>
                    <td class="p-2">\${r.gross}</td>
                    <td class="p-2">\${r.insurance}</td>
                    <td class="p-2 text-red-600 font-bold">\${r.monthlyTax}</td>
                    <td class="p-2 font-bold text-green-600">\${r.net}</td>
                </tr>
            \`).join('');
        }
        async function calc() {
            const body = { empId: window.activeId, month: document.getElementById('c-month').value, days: 30, basicGross: Number(document.getElementById('c-gross').value) };
            await fetch('/api/payroll/calculate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            view(window.activeId);
        }
        load();
    </script>
</body>
</html>
    `);
});

app.listen(3000, () => console.log("Server Running"));
