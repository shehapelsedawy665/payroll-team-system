const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * دالة لتوليد مفردات المرتب (Payslip) كملف PDF
 * بتاخد بيانات الموظف، وسجل المرتب بتاع الشهر ده، ومسار الحفظ
 */
const generatePayslipPDF = async (employee, payrollRecord, company, outputPath) => {
    return new Promise((resolve, reject) => {
        try {
            // إنشاء ملف PDF جديد
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            
            // التأكد إن المسار موجود، ولو مش موجود نكريته
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            // --- 1. هيدر الشركة ---
            doc.fontSize(20).text(company.name, { align: 'center' });
            doc.moveDown();
            doc.fontSize(14).text(`Payslip for ${payrollRecord.month} / ${payrollRecord.year}`, { align: 'center' });
            doc.moveDown(2);

            // --- 2. بيانات الموظف ---
            doc.fontSize(12);
            doc.text(`Employee Name: ${employee.name}`);
            doc.text(`Job ID: ${employee.jobId}`);
            doc.text(`Department: ${employee.department}`);
            doc.text(`National ID: ${employee.nationalId}`);
            
            // فاصل
            doc.moveDown().moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown();

            // --- 3. تفاصيل الاستحقاقات (Additions) ---
            doc.fontSize(14).text('Earnings', { underline: true });
            doc.fontSize(12);
            doc.text(`Basic Salary: ${payrollRecord.baseDataSnapshot.basicSalary.toFixed(2)} EGP`);
            doc.text(`Variable Salary: ${payrollRecord.baseDataSnapshot.variableSalary.toFixed(2)} EGP`);
            if (payrollRecord.financials.additions > 0) {
                doc.text(`Overtime & Allowances: ${payrollRecord.financials.additions.toFixed(2)} EGP`);
            }
            doc.moveDown();
            doc.text(`Gross Earnings: ${payrollRecord.financials.grossSalary.toFixed(2)} EGP`, { stroke: true });
            
            // فاصل
            doc.moveDown().moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown();

            // --- 4. تفاصيل الاستقطاعات (Deductions) ---
            doc.fontSize(14).text('Deductions', { underline: true });
            doc.fontSize(12);
            if (payrollRecord.financials.deductions > 0) {
                doc.text(`Absence & Late Penalties: ${payrollRecord.financials.deductions.toFixed(2)} EGP`);
            }
            doc.text(`Social Insurance: ${payrollRecord.financials.socialInsurance.toFixed(2)} EGP`);
            doc.text(`Income Tax: ${payrollRecord.financials.tax.toFixed(2)} EGP`);
            
            const totalDeductions = payrollRecord.financials.deductions + payrollRecord.financials.socialInsurance + payrollRecord.financials.tax;
            doc.moveDown();
            doc.text(`Total Deductions: ${totalDeductions.toFixed(2)} EGP`, { stroke: true });

            // فاصل
            doc.moveDown().moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(2);

            // --- 5. الصافي (Net Salary) ---
            doc.fontSize(16).text(`Net Salary: ${payrollRecord.financials.netSalary.toFixed(2)} EGP`, { align: 'right' });

            // تذييل الصفحة
            doc.moveDown(3);
            doc.fontSize(10).text('This is a system generated document and does not require a signature.', { align: 'center', color: 'grey' });

            // إنهاء الملف
            doc.end();

            stream.on('finish', () => {
                resolve(outputPath);
            });

        } catch (error) {
            reject(error);
        }
    });
};

module.exports = {
    generatePayslipPDF
};
