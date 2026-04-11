// public/js/pdf-gen.js

// الدالة الرئيسية لتوليد الـ PDF
function createPayslipPDF(name, nationalId, dept, position, p, month, company) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // --- التصميم الخارجي ---
    doc.setFillColor(10, 14, 23); // خلفية غامقة للهيدر
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(0, 212, 170); // لون بريماري
    doc.setFontSize(22);
    doc.text('PAYROLL PRO', 105, 15, { align: 'center' });
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text(company, 105, 25, { align: 'center' });
    doc.text(`Pay Slip: ${month}`, 105, 32, { align: 'center' });

    // --- بيانات الموظف ---
    doc.setTextColor(10, 14, 23);
    doc.setFontSize(10);
    let y = 55;
    doc.setDrawColor(200, 200, 200);
    doc.line(10, y, 200, y);
    
    y += 10;
    doc.text(`Employee: ${name}`, 15, y);
    doc.text(`National ID: ${nationalId}`, 110, y);
    y += 7;
    doc.text(`Department: ${dept || '-'}`, 15, y);
    doc.text(`Position: ${position || '-'}`, 110, y);
    
    y += 10;
    doc.line(10, y, 200, y);

    // --- جدول المستحقات والاستقطاعات ---
    y += 15;
    doc.setFontSize(12);
    doc.text('EARNINGS', 15, y);
    doc.text('DEDUCTIONS', 110, y);
    
    doc.setFontSize(9);
    y += 10;
    // استحقاقات
    doc.text(`Basic Salary: ${fmt(p.proratedBasic)}`, 15, y);
    doc.text(`Transportation: ${fmt(p.proratedTrans)}`, 15, y + 7);
    
    // استقطاعات
    doc.text(`Insurance (11%): ${fmt(p.insuranceEmployee)}`, 110, y);
    doc.text(`Income Tax: ${fmt(p.monthlyTax)}`, 110, y + 7);
    doc.text(`Martyrs Fund: ${fmt(p.martyrs || 0)}`, 110, y + 14);

    // --- الصافي النهائي (المستطيل الأخضر) ---
    y += 40;
    doc.setFillColor(0, 212, 170);
    doc.roundedRect(10, y, 190, 20, 3, 3, 'F');
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text('NET SALARY (صافي المرتب)', 20, y + 12);
    doc.setFontSize(18);
    doc.text(`${fmt(p.net)} EGP`, 190, y + 13, { align: 'right' });

    // --- الفوتر ---
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text('This is a computer-generated document by Payroll Pro System.', 105, 285, { align: 'center' });

    doc.save(`Payslip-${name}-${month}.pdf`);
    toast('تم تحميل الـ PDF بنجاح ✅');
}

// دالة مساعدة لربط الزرار بالداتا
function generatePayslipPDF() {
    if (!PAYROLL_RESULT) return toast('احسب الراتب أولاً يا رياسة', 'error');
    const empId = document.getElementById('payroll-emp-select').value;
    const emp = EMPLOYEES.find(e => e._id === empId);
    const month = document.getElementById('payroll-month').value;
    
    createPayslipPDF(
        emp?.name || 'Moussa', 
        emp?.nationalId || '000', 
        emp?.department || '', 
        emp?.position || '', 
        PAYROLL_RESULT, 
        month, 
        CURRENT_USER.companyId?.name || 'Sedawy Co.'
    );
}
