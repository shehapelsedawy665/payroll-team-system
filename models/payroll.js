const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    month: { type: String, required: true }, // صيغة YYYY-MM
    payload: { type: Object, required: true }, // بيشيل كل تفاصيل الحسبة (gross, net, taxes...)
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Payroll", payrollSchema);
