const express = require("express");
const cors    = require("cors");
const path    = require("path");
const { connectDB } = require('./backend/config/db');

const app = express();
app.use(cors());
app.use(express.json());

// ربط كل الملفات المتقسمة
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/employees',  require('./routes/employees'));
app.use('/api/payroll',    require('./routes/payroll'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leaves',     require('./routes/leaves'));
app.use('/api/hr',         require('./routes/hr'));
app.use('/api/settings',   require('./routes/settings'));

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));
app.get("*", (req, res) => res.sendFile(path.join(publicPath, "index.html")));

const PORT = process.env.PORT || 3000;
const startApp = async () => {
    try {
        await connectDB();
        console.log("Database Ready ✅");
        app.listen(PORT, () => console.log(`Server LIVE on ${PORT} 🚀`));
    } catch (err) { console.error("DB Error", err); }
};
startApp();
