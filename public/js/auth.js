document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');

    // تفعيل حالة التحميل (Loading state)
    btnText.textContent = 'جاري تسجيل الدخول...';
    btnLoader.classList.remove('d-none');
    errorMessage.classList.add('d-none');

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // تخزين الـ Token عشان السيستم يعرف مين اللي داخل
            localStorage.setItem('token', data.token);
            localStorage.setItem('userRole', data.data.role);
            
            // التحويل للوحة التحكم (هعملك شاشة الـ Dashboard الجاية)
            window.location.href = '/dashboard.html'; 
        } else {
            // إظهار رسالة الخطأ لو البيانات غلط
            errorMessage.textContent = data.message;
            errorMessage.classList.remove('d-none');
        }
    } catch (error) {
        errorMessage.textContent = 'حدث خطأ في الاتصال بالسيرفر، جرب تاني.';
        errorMessage.classList.remove('d-none');
    } finally {
        btnText.textContent = 'تسجيل الدخول';
        btnLoader.classList.add('d-none');
    }
});
