// public/js/auth.js

// 1. التبديل بين شاشة الدخول وإنشاء الحساب
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach((t, i) => {
        t.classList.toggle('active', (i === 0) === (tab === 'login'));
    });
    document.getElementById('login-form').style.display = tab === 'login' ? '' : 'none';
    document.getElementById('signup-form').style.display = tab === 'signup' ? '' : 'none';
    document.getElementById('auth-error').style.display = 'none';
}

// 2. عملية تسجيل الدخول
async function doLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) return showAuthError('برجاء إدخال البريد الإلكتروني وكلمة المرور');

    showLoading();
    try {
        // بنبعت البيانات للسيرفر (api/auth.js اللي عملناه في الباك إند)
        const data = await api('POST', '/api/auth', { action: 'login', email, password });

        if (data.success) {
            // حفظ البيانات في المتصفح
            AUTH_TOKEN = 'dummy_token'; // ممكن تستخدم JWT مستقبلاً
            CURRENT_USER = data.user;
            
            localStorage.setItem('pp_token', AUTH_TOKEN);
            localStorage.setItem('pp_user', JSON.stringify(CURRENT_USER));

            toast('مرحباً بك مجدداً يا ' + (CURRENT_USER.email.split('@')[0]), 'success');
            bootApp(); // تشغيل التطبيق
        }
    } catch (e) {
        showAuthError(e.message);
    } finally {
        hideLoading();
    }
}

// 3. إنشاء حساب جديد (خاص بالأدمن/الشركة)
async function doSignup() {
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const companyName = document.getElementById('reg-company').value.trim();

    if (!email || !password || !companyName) return showAuthError('برجاء إكمال جميع البيانات');

    showLoading();
    try {
        await api('POST', '/api/auth', { 
            action: 'register', // السيرفر هيرفض ده لو أنت مفعّل حماية الـ Master Key
            email, 
            password, 
            companyName 
        });
        toast('تم إنشاء الحساب بنجاح! يمكنك الدخول الآن', 'success');
        switchAuthTab('login');
    } catch (e) {
        showAuthError(e.message);
    } finally {
        hideLoading();
    }
}

// 4. إظهار أخطاء الدخول
function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    el.textContent = msg;
    el.style.display = 'block';
}

// 5. تسجيل الخروج
function doLogout() {
    AUTH_TOKEN = '';
    CURRENT_USER = null;
    localStorage.clear();
    document.getElementById('app').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    toast('تم تسجيل الخروج بنجاح', 'info');
}

// 6. تشغيل التطبيق وتعبئة البيانات الأساسية
function bootApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    // تعبئة بيانات الشركة واليوزر في السايد بار
    if (CURRENT_USER) {
        document.getElementById('company-name-sidebar').textContent = CURRENT_USER.companyId?.name || 'شركة السداوي';
        document.getElementById('sidebar-user-email').textContent = CURRENT_USER.email.split('@')[0];
        document.getElementById('sidebar-user-role').textContent = CURRENT_USER.role === 'admin' ? 'مدير النظام' : 'HR';
    }

    // تعيين الشهر الحالي في كل الـ inputs اللي محتاجة تاريخ
    const now = new Date().toISOString().substring(0, 7);
    ['payroll-month', 'summary-month', 'att-month'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = now;
    });

    navigate('dashboard'); // ابدأ بصفحة لوحة التحكم
}
