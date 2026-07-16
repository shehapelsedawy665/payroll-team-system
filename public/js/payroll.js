document.addEventListener('DOMContentLoaded', () => {
    // 1. حماية الشاشة والتأكد من تسجيل الدخول
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    const companyId = payload.companyId;

    // 2. تفعيل زرار الخروج
    const logout = (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = '/index.html';
    };
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('logoutBtnMobile')?.addEventListener('click', logout);

    // 3. جلب الموظفين لوضعهم في القائمة المنسدلة عشان نختار مين اللي هنحسبله المرتب
    const loadEmployeesDropdown = async () => {
        try {
            const fetchId = companyId || 'DUMMY_COMPANY_ID';
            const response = await fetch(`/api/employees/company/${fetchId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            
            const select = document.getElementById('payEmployeeId');
            select.innerHTML = '<option value="">اختر الموظف...</option>';
            
            if (result.success) {
                result.data.forEach(emp => {
                    select.innerHTML += `<option value="${emp._id}">${emp.name} (${emp.jobId})</option>`;
                });
            }
        } catch (error) {
            console.error('خطأ في جلب الموظفين:', error);
        }
    };
    loadEmployeesDropdown();

    // 4. تشغيل محرك المرتبات (Run Payroll)
    document.getElementById('runPayrollForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const empId = document.getElementById('payEmployeeId').value;
        const month = document.getElementById('payMonth').value;
        const year = document.getElementById('payYear').value;

        const runBtnText = document.getElementById('runBtnText');
        const runBtnLoader = document.getElementById('runBtnLoader');
        const runPayBtn = document.getElementById('runPayBtn');

        // تفعيل حالة التحميل عشان اليوزر يعرف إن السيستم بيحسب
        runBtnText.textContent = 'جاري الحساب...';
        runBtnLoader.classList.remove('d-none');
        runPayBtn.disabled = true;

        try {
            // نكلم الباك إند عشان يشغل الحسبة
            const response = await fetch('/api/payroll/calculate', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    employeeId: empId,
                    companyId: companyId || 'DUMMY_COMPANY_ID',
                    month: Number(month),
                    year: Number(year)
                })
            });

            const result = await response.json();

            if (result.success) {
                alert('تم حساب المرتب بنجاح!');
                
                // قفل الـ Modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('runPayrollModal'));
                modal.hide();

                // عرض النتيجة في الجدول فوراً
                const record = result.data;
                const tbody = document.getElementById('payrollTableBody');
                
                // نمسح رسالة "جاري التحميل" لو دي أول مرة نحسب
                if (tbody.innerHTML.includes('اختر موظف')) {
                    tbody.innerHTML = '';
                }

                // حساب إجمالي الاستقطاعات
                const totalDeductions = record.financials.deductions + record.financials.socialInsurance + record.financials.tax;

                // إضافة الراتب المحسوب للجدول ومعاه رابط تحميل الـ PDF
                tbody.innerHTML += `
                    <tr>
                        <td class="fw-bold">كود الموظف تم حسابه</td>
                        <td>${record.month} / ${record.year}</td>
                        <td class="text-success">${record.financials.grossSalary.toFixed(2)} ج.م</td>
                        <td class="text-danger">${totalDeductions.toFixed(2)} ج.م</td>
                        <td class="fw-bold text-primary fs-5">${record.financials.netSalary.toFixed(2)} ج.م</td>
                        <td>
                            <a href="/api/payroll/payslip/${record._id}" target="_blank" class="btn btn-sm btn-danger shadow-sm">
                                <i class="bi bi-file-earmark-pdf"></i> تحميل Payslip
                            </a>
                        </td>
                    </tr>
                `;
            } else {
                alert(result.message || 'حدث خطأ أثناء حساب المرتب.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('حدث خطأ في الاتصال بالسيرفر.');
        } finally {
            // إرجاع الزرار لحالته الأصلية
            runBtnText.textContent = 'تشغيل الحساب (Run Payroll)';
            runBtnLoader.classList.add('d-none');
            runPayBtn.disabled = false;
        }
    });

    // وضع رسالة مبدئية في الجدول لحد ما اليوزر يحسب أول مرتب
    document.getElementById('payrollTableBody').innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4"><i class="bi bi-info-circle fs-4 d-block mb-2"></i>اختر موظف وقم بتشغيل محرك المرتبات لتظهر النتائج هنا.</td></tr>';
});
