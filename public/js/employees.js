document.addEventListener('DOMContentLoaded', () => {
    // 1. حماية الشاشة: التأكد إن المستخدم مسجل دخول
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    // فك شفرة التوكن عشان نجيب الـ companyId بتاع الـ HR اللي فاتح
    const payload = JSON.parse(atob(token.split('.')[1]));
    const companyId = payload.companyId;

    // 2. تفعيل زرار تسجيل الخروج
    const logout = (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = '/index.html';
    };
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutBtnMobile = document.getElementById('logoutBtnMobile');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (logoutBtnMobile) logoutBtnMobile.addEventListener('click', logout);

    // 3. دالة لجلب الموظفين وعرضهم في الجدول
    const fetchEmployees = async () => {
        try {
            // لو مفيش companyId (مثلاً لو SuperAdmin)، هنحط كود افتراضي للتجربة
            const fetchId = companyId || 'DUMMY_COMPANY_ID'; 
            const response = await fetch(`/api/employees/company/${fetchId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();
            
            const tbody = document.getElementById('employeesTableBody');
            tbody.innerHTML = '';

            if (result.success && result.data.length > 0) {
                result.data.forEach(emp => {
                    tbody.innerHTML += `
                        <tr>
                            <td class="fw-bold">${emp.name}</td>
                            <td>${emp.jobId}</td>
                            <td><span class="badge bg-secondary">${emp.department}</span></td>
                            <td>${emp.financials.basicSalary.toLocaleString()} ج.م</td>
                            <td>${emp.legalDetails.insSalary.toLocaleString()} ج.م</td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary"><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-outline-danger"><i class="bi bi-trash"></i></button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">لا يوجد موظفين مسجلين حالياً.</td></tr>';
            }
        } catch (error) {
            console.error('خطأ في جلب الموظفين:', error);
            document.getElementById('employeesTableBody').innerHTML = '<tr><td colspan="6" class="text-center text-danger py-3">حدث خطأ في الاتصال بالسيرفر.</td></tr>';
        }
    };

    // تشغيل الدالة أول ما الشاشة تفتح
    fetchEmployees();

    // 4. إضافة موظف جديد
    const addEmployeeForm = document.getElementById('addEmployeeForm');
    addEmployeeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const saveBtnText = document.getElementById('saveBtnText');
        const saveBtnLoader = document.getElementById('saveBtnLoader');
        const saveEmpBtn = document.getElementById('saveEmpBtn');

        // تجهيز شكل الداتا زي ما الداتابيز (Employee Model) طالبها
        const employeeData = {
            companyId: companyId || 'DUMMY_COMPANY_ID',
            name: document.getElementById('empName').value,
            jobId: document.getElementById('empJobId').value,
            nationalId: document.getElementById('empNationalId').value,
            department: document.getElementById('empDepartment').value,
            hiringDate: document.getElementById('empHiringDate').value, // 🟢 تم إضافة تاريخ التعيين هنا 🟢
            financials: {
                basicSalary: Number(document.getElementById('empBasic').value),
                variableSalary: Number(document.getElementById('empVariable').value),
                allowances: { transportation: 0, other: 0 }
            },
            legalDetails: {
                insSalary: Number(document.getElementById('empInsSalary').value),
                insuranceNumber: '',
                isTaxExempted: false
            }
        };

        // تفعيل حالة التحميل
        saveBtnText.textContent = 'جاري الحفظ...';
        saveBtnLoader.classList.remove('d-none');
        saveEmpBtn.disabled = true;

        try {
            const response = await fetch('/api/employees', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(employeeData)
            });

            const result = await response.json();

            if (result.success) {
                alert('تم تسجيل الموظف بنجاح!');
                addEmployeeForm.reset();
                
                // قفل الـ Modal بتاع البوتستراب
                const modal = bootstrap.Modal.getInstance(document.getElementById('addEmployeeModal'));
                modal.hide();
                
                // تحديث الجدول
                fetchEmployees();
            } else {
                alert(result.message || 'حدث خطأ أثناء التسجيل.');
            }
        } catch (error) {
            console.error('Error adding employee:', error);
            alert('حدث خطأ في الاتصال بالسيرفر.');
        } finally {
            saveBtnText.textContent = 'حفظ الموظف';
            saveBtnLoader.classList.add('d-none');
            saveEmpBtn.disabled = false;
        }
    });
});
