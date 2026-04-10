// ============================================================
// Tax Portal Export Route — نموذج القطاع الخاص 2026
// Add to server.js: const taxExport = require('./tax_export_route');
//                   app.use('/api/export', authMiddleware, adminOnly, taxExport);
// ============================================================
const express  = require("express");
const router   = express.Router();
const { exec } = require("child_process");
const path     = require("path");
const fs       = require("fs");
const os       = require("os");

// Import your models
const { Employee, Payroll, Company } = require("./db");

// ─── Field mapping: MongoDB → Tax Portal column paths ───────
// Each entry: [fieldCode, mongoResolver(emp, payroll, company)]
function buildTaxRecord(emp, payroll, company, seq) {
    const p = payroll.payload || {};
    const additions = p.additions || [];
    const deductions = p.deductions || [];

    // Split additions by type
    const addBonus   = additions.filter(a => a.name.toLowerCase().includes("bonus") || a.name.includes("حافز")).reduce((s,a) => s + (a.amount||0), 0);
    const addExempt  = additions.filter(a => a.type === "exempted").reduce((s,a) => s + (a.amount||0), 0);
    const addTaxable = additions.filter(a => a.type === "non-exempted").reduce((s,a) => s + (a.amount||0), 0);

    const empIns = p.insuranceEmployee || 0;
    const empInsEmployer = Math.round((emp.insSalary || 0) * 0.19); // 19% employer share

    return [
        seq,                              // EI005 — مسلسل
        String(emp._id).slice(-8).toUpperCase(), // EI010 — كود الموظف
        emp.name,                          // EI015 — اسم الموظف
        emp.nationality || "مصري",         // EI020 — الجنسية
        emp.nationalId  || "",             // EI025 — الرقم القومي
        emp.passportNo  || "",             // EI026 — جواز سفر
        "",                               // EI027 — جواز جديد
        emp.phone       || "",             // EI030 — تليفون
        "",                               // EI035 — تصريح عمل أجانب
        "",                               // EI040 — رقم تصريح
        emp.position    || "",             // EI045 — الوظيفة
        company.name,                      // EI055 — اسم الجهة
        1,                                // EI060 — المعاملة الضريبية (1=عادية)
        company.taxRegNo || "",            // EI065 — رقم تسجيل ضريبي
        p.days          || 30,             // EI130 — مدة العمل
        1,                                // EI070 — الحالة التأمينية
        emp.insuranceNo || "",             // EI075 — الرقم التأميني
        emp.hiringDate  || "",             // EI080 — تاريخ التحاق
        0,                                // EI085 — قسط مدة سابقة
        emp.resignationDate || "",         // EI090 — تاريخ نهاية الخدمة
        emp.resignationDate || "",         // EI095 — تاريخ انتهاء التأمين
        p.gross         || 0,             // EI100 — الأجر الشامل
        0,                                // EI105 — بدلات غير خاضعة تأمينياً
        p.insBase       || 0,             // EI110 — الأجر التأميني
        1,                                // EI115 — التأمين الصحي
        0,                                // EI120 — الزوجات
        0,                                // EI125 — المعالين
        p.proratedBasic || 0,             // DTE160 — المرتب الأساسي
        addBonus,                         // DTE170 — مكافات/أجر إضافي
        addExempt,                        // DTE180 — علاوات معفاة
        addTaxable,                       // DTE175 — علاوات خاضعة
        0,0,0,0,0,0,0,0,0,               // DTE190→DTE255 zeros
        p.proratedTrans || 0,             // DTE265 — بدلات خاضعة أخرى
        0,0,0,0,0,                        // DTE270→DTE290 zeros
        0,0,0,0,0,0,                      // DTE200→DTE225 مزايا
        p.gross || 0,                     // DTE295 — اجمالى الاستحقاقات
        empIns,                           // DAE405 — حصة العامل التأمينات
        0,                                // DAE410 — تأمين صحي
        0,0,0,                            // DAE415→DAE425
        (p.days ? Math.round(20000/360*p.days*100)/100 : 0), // DAE430 — الإعفاء الشخصي
        0,0,0,0,0,0,0,0,0,               // DAE435→DAE470 zeros
        p.totalAllDeductions || 0,        // DAE475 — اجمالى الاستقطاعات
        p.currentTaxable    || 0,         // TC505 — وعاء الفترة
        p.annualProjected   || 0,         // TC510 — الوعاء السنوي
        p.monthlyTax        || 0,         // TC515 — الضريبة المستحقة
        0,                                // TC520 — نموذج 3
        0,                                // TC525 — نموذج 2
        p.monthlyTax        || 0,         // TC530 — اجمالى الضريبة
        p.monthlyTax        || 0,         // END705 — الضريبة المحتسبة
        p.prevTaxes         || 0,         // TC535 — ضريبة فترات سابقة
        p.monthlyTax        || 0,         // TC540
        0,0,0,0,0,0,                      // TC545→TC560 zeros
        p.net               || 0,         // TC565 — صافي الأجر
        p.martyrs           || 0,         // NAD610 — صندوق الشهداء
        0,                                // CLD825 — ذوي الهمم
        0,0,0,0,                          // NAD615→NAD630 إضافات
        0,0,0,0,0,0,                      // NAD635→NAD660 استقطاعات
        empInsEmployer,                   // CLD805 — حصة الشركة
        0,                                // CLD810 — تأمين صحي شركة
        p.martyrs || 0,                   // CLD815 — صندوق شهداء شركة
        0,                                // CLD820 — الدمغات
        p.net || 0                        // NAD665 — المبالغ المحولة
    ];
}

// ─── Validation ──────────────────────────────────────────────
function validateBeforeExport(employees, payrolls) {
    const errors = [];
    payrolls.forEach((pr, i) => {
        const emp = employees.find(e => String(e._id) === String(pr.employeeId));
        if (!emp) { errors.push(`سجل راتب بدون موظف: ${pr._id}`); return; }
        if (!emp.nationalId) errors.push(`${emp.name}: الرقم القومي مطلوب`);
        if (!emp.nationalId || emp.nationalId.length !== 14) errors.push(`${emp.name}: الرقم القومي يجب أن يكون 14 رقم`);
        if (!pr.payload?.gross || pr.payload.gross <= 0) errors.push(`${emp.name}: الأجر الشامل صفر أو مفقود`);
        if (pr.payload?.net > pr.payload?.gross) errors.push(`${emp.name}: الصافي أكبر من الشامل`);
    });
    return errors;
}

// ─── Main export endpoint ────────────────────────────────────
router.get("/tax-portal", async (req, res) => {
    try {
        const { month } = req.query;
        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({ error: "month مطلوب بصيغة YYYY-MM" });
        }

        const companyId = req.user.companyId;
        const [company, payrolls] = await Promise.all([
            Company.findById(companyId),
            Payroll.find({ companyId, month }).lean()
        ]);

        if (!company) return res.status(404).json({ error: "الشركة غير موجودة" });
        if (!payrolls.length) return res.status(404).json({ error: `لا توجد رواتب لشهر ${month}` });

        const empIds = payrolls.map(p => p.employeeId);
        const employees = await Employee.find({ _id: { $in: empIds } }).lean();

        // Validate
        const validationErrors = validateBeforeExport(employees, payrolls);
        if (validationErrors.length > 0) {
            return res.status(422).json({
                error: "فشل التحقق من البيانات قبل التصدير",
                errors: validationErrors
            });
        }

        // Build data
        const records = payrolls.map((pr, idx) => {
            const emp = employees.find(e => String(e._id) === String(pr.employeeId));
            return buildTaxRecord(emp, pr, company, idx + 1);
        });

        // Write temp JSON for Python script
        const tmpJson = path.join(os.tmpdir(), `taxexport_${companyId}_${month}.json`);
        const tmpXlsx = path.join(os.tmpdir(), `taxexport_${companyId}_${month}.xlsx`);
        fs.writeFileSync(tmpJson, JSON.stringify({ records, month, company: company.name }));

        // Call Python script
        const scriptPath = path.join(__dirname, "generate_tax_export.py");
        exec(`python3 "${scriptPath}" "${tmpXlsx}" "${month}" "${tmpJson}"`, (err) => {
            if (err) {
                console.error("Export script error:", err);
                return res.status(500).json({ error: "فشل توليد الملف" });
            }
            const filename = `tax_portal_${company.name}_${month}.xlsx`.replace(/\s/g, "_");
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            const stream = fs.createReadStream(tmpXlsx);
            stream.on("close", () => { try { fs.unlinkSync(tmpJson); fs.unlinkSync(tmpXlsx); } catch {} });
            stream.pipe(res);
        });
    } catch (err) {
        console.error("Tax export error:", err);
        res.status(500).json({ error: "خطأ في التصدير: " + err.message });
    }
});

// ─── Preview endpoint (JSON, no file download) ───────────────
router.get("/tax-portal/preview", async (req, res) => {
    try {
        const { month } = req.query;
        if (!month) return res.status(400).json({ error: "month مطلوب" });
        const companyId = req.user.companyId;
        const payrolls = await Payroll.find({ companyId, month }).lean();
        const empIds = payrolls.map(p => p.employeeId);
        const employees = await Employee.find({ _id: { $in: empIds } }).lean();
        const company = await Company.findById(companyId).lean();
        const validationErrors = validateBeforeExport(employees, payrolls);
        const summary = {
            month, employeeCount: payrolls.length,
            totalGross: payrolls.reduce((s,p) => s + (p.payload?.gross||0), 0),
            totalNet:   payrolls.reduce((s,p) => s + (p.payload?.net||0), 0),
            totalTax:   payrolls.reduce((s,p) => s + (p.payload?.monthlyTax||0), 0),
            totalIns:   payrolls.reduce((s,p) => s + (p.payload?.insuranceEmployee||0), 0),
            validationErrors,
            readyToExport: validationErrors.length === 0
        };
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
