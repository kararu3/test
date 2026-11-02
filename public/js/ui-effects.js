/**
 * ExamBuilder Pro - نظام الإشعارات العائمة التفاعلية والتأثيرات الحركية
 */

const UIEffects = (() => {
    let container = null;

    function getContainer() {
        if (!container) {
            container = document.getElementById('toastContainer');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toastContainer';
                document.body.appendChild(container);
            }
        }
        return container;
    }

    return {
        showToast(message, type = 'success', duration = 2500) {
            const host = getContainer();

            const icons = {
                success: '✅',
                error: '❌',
                info: 'ℹ️',
                warning: '⚠️'
            };

            const toast = document.createElement('div');
            toast.className = `toast-item ${type}`;

            toast.innerHTML = `
                <div class="toast-body">
                    <span class="toast-icon">${icons[type] || '✨'}</span>
                    <span class="toast-text">${message}</span>
                </div>
                <div class="toast-progress-bar">
                    <div class="toast-progress-fill" style="animation-duration: ${duration}ms;"></div>
                </div>
            `;

            host.appendChild(toast);

            const timer = setTimeout(() => {
                toast.classList.add('hide');
                setTimeout(() => toast.remove(), 300);
            }, duration);

            toast.onclick = () => {
                clearTimeout(timer);
                toast.classList.add('hide');
                setTimeout(() => toast.remove(), 250);
            };
        },

        initButtonRipples() {
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('.tool-btn, .b-btn, .p-act-btn, .btn-action-primary, .btn-confirm-print, .btn-close-preview');
                if (!btn) return;

                const circle = document.createElement('span');
                const diameter = Math.max(btn.clientWidth, btn.clientHeight);
                const radius = diameter / 2;

                const rect = btn.getBoundingClientRect();
                circle.style.width = circle.style.height = `${diameter}px`;
                circle.style.left = `${e.clientX - rect.left - radius}px`;
                circle.style.top = `${e.clientY - rect.top - radius}px`;
                circle.classList.add('button-ripple');

                const ripple = btn.getElementsByClassName('button-ripple')[0];
                if (ripple) ripple.remove();

                btn.appendChild(circle);
            });
        }
    };
})();

window.addEventListener('DOMContentLoaded', () => {
    UIEffects.initButtonRipples();
});