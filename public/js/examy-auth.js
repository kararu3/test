(function () {
    'use strict';

    let rememberedCredentials = null;
    let busy = false;

    const byId = id => document.getElementById(id);
    const setMessage = (message, kind = 'error') => {
        const node = byId('accountLoginFeedback');
        if (!node) return;
        node.textContent = message || '';
        node.dataset.kind = kind;
    };

    async function clearRemembered() {
        try {
            if (window.examy?.clearRememberedLogin) await window.examy.clearRememberedLogin();
        } catch (error) {
            console.warn('تعذر مسح بيانات الحساب المحفوظة:', error);
        }
        rememberedCredentials = null;
    }

    async function authenticate(username, password, hardwareId) {
        if (!window.AppAPI || typeof AppAPI.loginRemote !== 'function') {
            return { success: false, message: 'خدمة تسجيل الدخول غير مهيأة.' };
        }
        return AppAPI.loginRemote(username, password, hardwareId);
    }

    async function restore(hardwareId) {
        try {
            if (!window.examy?.getRememberedLogin) return false;
            const credentials = await window.examy.getRememberedLogin();
            if (!credentials?.username || !credentials?.password) return false;

            const result = await authenticate(credentials.username, credentials.password, hardwareId);
            if (result.success) {
                rememberedCredentials = credentials;
                window.examyUserAuthenticated = true;
                return true;
            }

            // لا نمسح بيانات التذكر عند انقطاع الإنترنت؛ نمسحها فقط عند رفض الحساب أو تعطيله.
            if (!result.networkError && [401, 403, 404].includes(result.status)) {
                await clearRemembered();
            }
            return false;
        } catch (error) {
            console.error('فشل استعادة جلسة Examy:', error);
            return false;
        }
    }

    function show() {
        const modal = byId('accountLoginModal');
        if (modal) modal.classList.add('active');
        byId('accountUsername')?.focus();
    }

    function hide() {
        byId('accountLoginModal')?.classList.remove('active');
    }

    async function submit() {
        if (busy) return;
        const username = String(byId('accountUsername')?.value || '').trim();
        const password = String(byId('accountPassword')?.value || '');
        const remember = !!byId('rememberAccount')?.checked;
        const hwid = typeof getStableMachineHWID === 'function' ? getStableMachineHWID() : '';

        if (!username || !password) {
            setMessage('يرجى إدخال اسم المستخدم وكلمة المرور.');
            return;
        }

        busy = true;
        const button = byId('accountLoginButton');
        if (button) {
            button.disabled = true;
            button.textContent = 'جارٍ التحقق من الحساب...';
        }
        setMessage('يتم التحقق من الحساب وحالته على خادم الإدارة...', 'info');

        try {
            const result = await authenticate(username, password, hwid);
            if (!result.success) {
                setMessage(result.message || 'تعذر تسجيل الدخول. تحقق من بياناتك وحالة الحساب.');
                return;
            }

            rememberedCredentials = { username, password };
            window.examyUserAuthenticated = true;
            window.examyLicenseValid = true;

            if (remember) {
                if (window.examy?.saveRememberedLogin) {
                    const saved = await window.examy.saveRememberedLogin(rememberedCredentials);
                    if (!saved?.success) setMessage('تم تسجيل الدخول، لكن تعذر حفظ خيار تذكرني على هذا الجهاز.', 'info');
                } else {
                    setMessage('تم تسجيل الدخول لهذه الجلسة فقط؛ التخزين الآمن متاح في نسخة سطح المكتب.', 'info');
                }
            } else {
                await clearRemembered();
            }

            hide();
            if (window.examyLicenseValid === false) {
                byId('licenseModal')?.classList.add('active');
            } else if (!localStorage.getItem('exambuilder_lang')) {
                byId('languageModal')?.classList.add('active');
            }
        } catch (error) {
            console.error('Login error:', error);
            setMessage('حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.');
        } finally {
            busy = false;
            if (button) {
                button.disabled = false;
                button.textContent = 'تسجيل الدخول';
            }
        }
    }

    window.ExamyAuth = Object.freeze({ restore, show, hide, submit });
    window.examyUserAuthenticated = false;

    document.addEventListener('DOMContentLoaded', () => {
        byId('accountLoginForm')?.addEventListener('submit', event => {
            event.preventDefault();
            submit();
        });
        byId('accountPassword')?.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                submit();
            }
        });
    });
})();