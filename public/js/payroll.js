// public/js/payroll.js

let PAYROLL_RESULT = null;

// 1. التبديل بين "احسب راتب" و "كشف الرواتب"
function switchPayrollTab(tab) {
    document.querySelectorAll('#page-payroll .tab').forEach((t, i) => {
        t.classList.toggle('active', ['calculate', 'summary'][i] === tab);
    });
    document.getElementById('payroll-tab-calculate').style.display = tab === 'calculate' ? '' : 'none';
    document.getElementById('payroll-tab-summary').style.display = tab === 'summary' ? '' : 'none';
    
    if (tab === 'summary') loadPayrollSummary();
}

// 2. إضافة بند جديد (إضافات أو خصومات)
function addPayrollItem(type) {
    const list = document.getElementById(`${type}-list`);
    const div = document.createElement('div');
    div.className = 'item-row';
    
    // خيارات الإعفاء الضريبي للبند
    const exemptOptions = type === 'additions' 
        ? '<option value="non-exempted">خاضع للضريبة</option><option value="exempted">معفى</option>'
        : '<option value="non-exempted">لا يخفض الوعاء</option><option value="exempted">يخفض الوعاء</option>';

    div.innerHTML = `
        <input type="text" placeholder="اسم البند (مثلاً حافز)" class="item-name"/>
        <input type="number" placeholder="المبلغ" class="item-amount" step="0.01"/>
        <select class="item-type">${exemptOptions}</select>
        <button class="remove-btn" onclick="this.parentElement.remove()">✕</button>
    `;
    list.appendChild(div);
}

// 3. تجميع البيانات وحساب الراتب (بكلم السيرفر)
async function calculatePayroll() {
    const empId = document.getElementById('payroll-emp-select').value;
    const month = document.getElementById('payroll-month').value;
    const basic = Number(document.getElementById('payroll-basic').value) || 0;
    const trans = Number(document.getElementById('payroll-trans').value) || 0;
    const days = Number(document.getElementById('payroll-days').value) || 30;

    if (!empId || !month || !basic) {
        return toast('برجاء اختيار الموظف والشهر وإدخال الراتب الأساسي', 'error');
    }

    // تجميع الإضافات والخصومات من الفورم
    const additions = [...document.querySelectorAll('#additions-list .item-row')].map(row => ({
        name: row.querySelector('.item-name').value || 'إضافة',
        amount: Number(row.querySelector('.item-amount').value) || 0,
        type: row.querySelector('.item-type').value
    }));

    const deductions = [...document.querySelectorAll('#deductions-list .item-row')].map(row => ({
        name: row.querySelector('.item-name').value || 'خصم',
        amount: Number(row.querySelector('.item-amount').value) || 0,
        type: row.querySelector('.item-type').value
    }));

    showLoading();
    try {
        // بنبعت الطلب للـ API اللي عملناه في الباك إند
        const response = await api('POST', '/api/payroll', {
            employeeId: empId,
            month,
            fullBasic: basic,
            fullTrans: trans,
            days,
            additions,
            deductions
        });

        PAYROLL_RESULT = response.data.payload;
        renderPayrollResult(PAYROLL_RESULT);
        toast('تم حساب الراتب بنجاح ✅');
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        hideLoading();
    }
}

// 4. عرض النتيجة في الـ UI
function renderPayrollResult(p) {
    const panel = document.getElementById('payroll-result-panel');
    const content = document.getElementById('payroll-result-content');
    panel.style.display = 'block';

    content.innerHTML = `
        <div class="result-row"><span class="label">إجمالي الاستحقاقات</span><span class="value">${fmt(p.gross)} ج</span></div>
        <div class="result-row deduct"><span class="label">تأمينات الموظف (11%)</span><span class="value">${fmt(p.insuranceEmployee)} ج</span></div>
        <div class="result-row deduct"><span class="label">ضريبة الدخل</span><span class="value">${fmt(p.monthlyTax)} ج</span></div>
        <div class="result-row deduct"><span class="label">صندوق الشهداء</span><span class="value">${fmt(p.martyrs || 0)} ج</span></div>
        <div class="result-row total" style="border-top: 2px solid var(--border); margin-top: 10px; padding-top: 10px;">
            <span class="label">صافي المرتب</span>
            <span class="value">${fmt(p.net)} ج</span>
        </div>
    `;
}

// 5. تحميل ملخص رواتب الشهر (Summary)
async function loadPayrollSummary() {
    const month = document.getElementById('summary-month').value;
    showLoading();
    try {
        // هنا هتحتاج API في الباك إند يجيب سجلات الشهر ده (ممكن نكمله لاحقاً)
        toast('تحميل كشف شهر ' + month, 'info');
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        hideLoading();
    }
}
