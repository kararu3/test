/**
 * Examy PRO - المحرك والمنسق العام للتطبيق (نسخة متكاملة ومنظفة بالكامل)
 */




window.recordUndoState = function() {
    if (typeof undoHistory === 'undefined') window.undoHistory = [];
    const wrapper = document.getElementById("sheetsWrapper");
    if (!wrapper) return;
    undoHistory.push(wrapper.innerHTML);
    if (undoHistory.length > (typeof MAX_HISTORY !== 'undefined' ? MAX_HISTORY : 40)) undoHistory.shift();
    if (typeof redoHistory !== 'undefined') redoHistory = [];
};

function getStableMachineHWID() {
    if (typeof AppAPI !== 'undefined' && typeof AppAPI.getMachineHWID === 'function') {
        try {
            const apiHwid = AppAPI.getMachineHWID();
            if (apiHwid && apiHwid !== "--" && !apiHwid.includes("undefined")) {
                localStorage.setItem("EXAM_STABLE_HWID", apiHwid);
                return apiHwid;
            }
        } catch(e) {}
    }
    let stable = localStorage.getItem("EXAM_STABLE_HWID");
    if (!stable) {
        stable = "HW-" + (navigator.hardwareConcurrency || 4) + "-" + Math.random().toString(36).substring(2, 9).toUpperCase();
        localStorage.setItem("EXAM_STABLE_HWID", stable);
    }
    return stable;
}

window.addEventListener('DOMContentLoaded', async () => {
    const splashScreen = document.getElementById("appLoadingScreen");
    const progressFill = document.getElementById("loadingProgressBar");
    const stepLabel = document.getElementById("loadingStepLabel");
    const percentLabel = document.getElementById("loadingPercentLabel");

    const licenseModal = document.getElementById("licenseModal");
    const languageModal = document.getElementById("languageModal");

    async function updateLoadingProgress(targetPercent, statusText, delayMs = 80) {
        if (stepLabel) stepLabel.textContent = statusText;
        if (progressFill) progressFill.style.width = `${targetPercent}%`;
        if (percentLabel) percentLabel.textContent = `${targetPercent}%`;
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    let isLicenseValid = false;
    let isUserAuthenticated = false;

    try {
        await updateLoadingProgress(20, "جاري تهيئة النواة وبصمة الجهاز...", 90);
        const hwid = getStableMachineHWID();
        const hwidElem = document.getElementById("hwidDisplay");
        if (hwidElem) hwidElem.textContent = hwid;

        // فحص حساب المستخدم أولاً عبر نظام المشتركين الموجود على خادم الإدارة.
        // عند تفعيل Remember Me تُستعاد بياناته المشفرة ثم يعاد التحقق منها سحابياً.
        await updateLoadingProgress(34, "جاري التحقق من حساب المستخدم...", 90);
        try {
            if (window.ExamyAuth && typeof window.ExamyAuth.restore === 'function') {
                isUserAuthenticated = await window.ExamyAuth.restore(hwid);
            }
        } catch (authStartupError) {
            console.warn("تعذر استعادة تسجيل دخول المستخدم:", authStartupError);
        }
        window.examyUserAuthenticated = isUserAuthenticated;

        await updateLoadingProgress(45, "التحقق من حالة ترخيص النظام...", 100);
        
        let localLic = null;
        try {
            if (typeof AppAPI !== 'undefined' && typeof AppAPI.getLocalLicense === 'function') {
                localLic = await AppAPI.getLocalLicense();
            }
        } catch (e) {}

        if (!localLic || !localLic.key) {
            const rawStored = localStorage.getItem("exambuilder_license_data");
            if (rawStored) {
                try { localLic = JSON.parse(rawStored); } catch(e) {}
            }
        }

        // معالجة حالة الترخيص بحيث تقبل الحروف الصغيرة والكبيرة وتعتمد وجود المفتاح
        if (localLic && localLic.key && localLic.key.trim().length > 3) {
            const licStatus = String(localLic.status || '').toUpperCase();
            if (licStatus === "ACTIVE" || localLic.key.trim().length > 5) {
                isLicenseValid = true;
            } else {
                try {
                    if (typeof AppAPI !== 'undefined' && typeof AppAPI.verifyLicenseRemote === 'function') {
                        const check = await AppAPI.verifyLicenseRemote(localLic.key, hwid);
                        if (check && (check.valid === true || check.success === true)) {
                            isLicenseValid = true;
                        } else if (check && check.revoked === true) {
                            isLicenseValid = false;
                            localStorage.removeItem("exambuilder_license_data");
                        } else {
                            isLicenseValid = true; // استمرار العمل بالترخيص المحلي في حال عدم توفر إنترنت
                        }
                    } else {
                        isLicenseValid = true;
                    }
                } catch (err) {
                    isLicenseValid = true;
                }
            }
        } else {
            isLicenseValid = false;
        }

        // استرجاع لغة التطبيق وتطبيقها فوراً لتجنب ظهور نافذة اختيار اللغة عند كل إقلاع
        const savedLang = localStorage.getItem('exambuilder_lang') || 'ar';
        currentLang = savedLang;
        if (typeof applyLanguageMode === 'function') {
            applyLanguageMode(savedLang);
        }

        await updateLoadingProgress(70, "جاري تهيئة إعدادات الطابعات والشبكة...", 90);
        // Printer discovery must never block application startup.
        // Some Windows printer drivers / offline network printers can leave this promise pending.
        try {
            if (typeof loadSystemPrintersToSettings === 'function') {
                await Promise.race([
                    Promise.resolve().then(() => loadSystemPrintersToSettings()),
                    new Promise(resolve => setTimeout(resolve, 2500))
                ]);
            }
        } catch (printerStartupError) {
            console.warn("تأجيل تحميل الطابعات إلى ما بعد فتح البرنامج:", printerStartupError);
        }

        await updateLoadingProgress(90, "جاري فتح واجهة البرنامج...", 90);

        // Reveal the workspace before restoring optional/heavy user data.
        // This prevents a large saved template or DOM operation from trapping
        // the user on the 90% splash screen.
        if (splashScreen) {
            splashScreen.style.opacity = '0';
            splashScreen.style.pointerEvents = 'none';
            setTimeout(() => {
                splashScreen.classList.remove("active");
                splashScreen.style.display = "none";
            }, 220);
        }
        await new Promise(resolve => setTimeout(resolve, 260));
        try { generateNewExamId(); } catch(e) {}
        try { updateUIIndicators(); } catch(e) {}
        try { applyBorderToAllSheets(); } catch(e) {}
        try { applyFrameInsetToAllSheets(); } catch(e) {}
        try { setupInlineTextFormatter(); } catch(e) {}
        try { setupKeyboardShortcuts(); } catch(e) {}
        try { setupGlobalEnterLineBreakHandler(); } catch(e) {}
        try { resetAllSheetsScroll(); } catch(e) {}

        const savedPos = localStorage.getItem('exambuilder_toolbar_pos') || 'top';
        try { setToolbarPosition(savedPos); } catch(e) {}

        try { autoScaleStageToScreen(); } catch(e) {}

        try { loadDefaultTemplateIfAvailable(); } catch(e) {}
        try { refreshSavedTemplatesDropdown(); } catch(e) {}        
        
        document.addEventListener('selectionchange', () => {
            trackCursorPosition();
        });

        document.addEventListener('click', function(e) {
    // 1. إغلاق القوائم المنسدلة عند النقر خارجها
    if (!e.target.closest('.dropdown-menu-wrap') && !e.target.closest('.dropdown-content-pane')) {
        document.querySelectorAll('.dropdown-content-pane').forEach(p => {
            p.classList.remove('active');
            p.style.display = 'none';
        });
    }

    // 2. إخفاء اللوحة الجانبية للسؤال تلقائياً عند النقر في أي مكان خارج الأسئلة واللوحة
    if (!e.target.closest('.question-container') && !e.target.closest('#questionSidePanel')) {
        if (typeof deactivateCurrentQuestion === 'function') {
            deactivateCurrentQuestion();
        }
        const sidePanel = document.getElementById('questionSidePanel');
        if (sidePanel) {
            sidePanel.classList.remove('active');
            sidePanel.style.display = 'none';
        }
    }
});

        try {
            fetchSystemMonitorStats();
            setInterval(fetchSystemMonitorStats, 2500);
            setInterval(autoSaveExamSession, 60000);
            setTimeout(() => {
                if (typeof bindAllQuestionsInteractions === 'function') bindAllQuestionsInteractions();
            }, 500);
        } catch (e) {}

        if (typeof AdvancedExamTools !== 'undefined' && typeof AdvancedExamTools.checkCrashRecovery === 'function') {
            AdvancedExamTools.checkCrashRecovery();
        }

        await updateLoadingProgress(100, "اكتمل التشغيل بنجاح!", 80);

    } catch (criticalError) {
        console.error("خطأ أثناء بدء التشغيل:", criticalError);
    } finally {
        if (splashScreen) {
            splashScreen.style.opacity = '0';
            setTimeout(() => {
                splashScreen.classList.remove("active");
                splashScreen.style.display = "none";

                window.examyLicenseValid = isLicenseValid;
                if (!isUserAuthenticated) {
                    // لا نعرض نافذة الترخيص قبل التحقق من حساب المشترك.
                    if (licenseModal) licenseModal.classList.remove("active");
                    if (languageModal) languageModal.classList.remove("active");
                    window.ExamyAuth?.show();
                } else if (isLicenseValid) {
                    if (licenseModal) licenseModal.classList.remove("active");

                    // لا تظهر نافذة اللغة إذا كان المستخدم قد اختار لغته مسبقاً
                    if (!localStorage.getItem('exambuilder_lang') && languageModal) {
                        languageModal.classList.add("active");
                    } else if (languageModal) {
                        languageModal.classList.remove("active");
                    }
                } else {
                    if (licenseModal) licenseModal.classList.add("active");
                    if (languageModal) languageModal.classList.remove("active");
                }
            }, 250);
        }
    }
});

window.checkCrashRecovery = function() {
    const saved = localStorage.getItem('exambuilder_autosave_payload');
    if (saved && saved.trim().length > 50) {
        setTimeout(() => {
            const banner = document.getElementById('crashRecoveryBanner');
            if (banner) {
                banner.style.display = 'flex'; // إظهار الشريط البسيط في الطرف
            }
        }, 1000);
    }
};

window.confirmRestoreCrash = function() {
    try {
        const saved = localStorage.getItem('exambuilder_autosave_payload');
        if (saved && saved.trim().length > 50) {
            if (typeof recordUndoState === 'function') recordUndoState();
            
            const wrapper = document.getElementById("sheetsWrapper");
            if (wrapper) {
                wrapper.innerHTML = saved;
            }
            
            // إعادة تفعيل التفاعلات ومقابض الجداول على المحتوى المسترجع
            if (typeof restoreUIStateAfterDomUpdate === 'function') {
                restoreUIStateAfterDomUpdate();
            }
            
            // إعادة ربط الجداول المفاعلة بالسحب والحجم بالماوس
            document.querySelectorAll('#sheetsWrapper table:not(.bubble-grid-table)').forEach(tbl => {
                if (typeof makeTableInteractive === 'function' && !tbl.closest('.table-resizable-wrapper')) {
                    makeTableInteractive(tbl);
                }
            });

            if (typeof UIEffects !== 'undefined' && UIEffects.showToast) {
                UIEffects.showToast("تم استعادة آخر جلسة عمل بنجاح!", "success", 3000);
            } else {
                alert("تم استعادة آخر جلسة عمل بنجاح!");
            }
        }
    } catch (err) {
        console.error("Restore Crash Error:", err);
        alert("حدث خطأ أثناء استعادة الجلسة السابقة.");
    }
    dismissCrashModal();
};

window.dismissCrashModal = function() {
    const banner = document.getElementById('crashRecoveryBanner');
    if (banner) {
        banner.style.display = 'none';
    }
    // مسح المسуدة القديمة بعد التجاهل حتى لا تظهر مرة أخرى
    localStorage.removeItem('exambuilder_autosave_payload');
};

// تفعيل الفحص تلقائياً عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    checkCrashRecovery();
});
// Intelligent AutoSave: wait until the user pauses, then save once.
// A short idle debounce avoids writing localStorage for every keystroke.
const EXAMY_AUTOSAVE_IDLE_MS = 1400;
const EXAMY_AUTOSAVE_MAX_WAIT_MS = 12000;
let examyAutoSaveIdleTimer = null;
let examyAutoSaveMaxTimer = null;
let examyAutoSaveDirty = false;
let examyAutoSaveLastPayload = null;
let examyAutoSaveStatusTimer = null;

function getAutoSaveStatusElement() {
    let el = document.getElementById('examyAutoSaveStatus');
    if (!el) {
        el = document.createElement('div');
        el.id = 'examyAutoSaveStatus';
        el.className = 'examy-autosave-status';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.textContent = 'جاهز للحفظ';
        document.body.appendChild(el);
    }
    return el;
}

function setAutoSaveStatus(message, state = 'saved') {
    const el = getAutoSaveStatusElement();
    el.textContent = message;
    el.dataset.state = state;
    el.classList.add('visible');
    clearTimeout(examyAutoSaveStatusTimer);
    if (state === 'saved') {
        examyAutoSaveStatusTimer = setTimeout(() => el.classList.remove('visible'), 2600);
    }
}

function writeExamAutoSaveNow() {
    const wrapper = document.getElementById('sheetsWrapper');
    if (!wrapper) return false;
    const payload = wrapper.innerHTML;
    if (!payload || payload.trim().length <= 50) return false;
    if (payload === examyAutoSaveLastPayload &&
        localStorage.getItem('exambuilder_autosave_payload') === payload) {
        examyAutoSaveDirty = false;
        return true;
    }
    try {
        // Save the document first; metadata is updated only after a successful write.
        localStorage.setItem('exambuilder_autosave_payload', payload);
        const uid = (typeof examUid !== 'undefined' && examUid) ? examUid : '';
        if (uid) localStorage.setItem('exambuilder_autosave_uid', uid);
        localStorage.setItem('exambuilder_autosave_saved_at', new Date().toISOString());
        examyAutoSaveLastPayload = payload;
        examyAutoSaveDirty = false;
        setAutoSaveStatus('✓ تم حفظ المسودة تلقائياً', 'saved');
        return true;
    } catch (err) {
        console.error('AutoSave Error:', err);
        setAutoSaveStatus('تعذر الحفظ — مساحة التخزين ممتلئة', 'error');
        return false;
    }
}

function clearAutoSaveTimers() {
    clearTimeout(examyAutoSaveIdleTimer);
    clearTimeout(examyAutoSaveMaxTimer);
    examyAutoSaveIdleTimer = null;
    examyAutoSaveMaxTimer = null;
}

window.flushExamAutoSave = function() {
    clearAutoSaveTimers();
    if (!examyAutoSaveDirty) return true;
    return writeExamAutoSaveNow();
};

window.triggerAutoSave = function() {
    const wrapper = document.getElementById('sheetsWrapper');
    if (!wrapper) return;
    examyAutoSaveDirty = true;
    setAutoSaveStatus('تغييرات غير محفوظة…', 'pending');
    clearTimeout(examyAutoSaveIdleTimer);
    examyAutoSaveIdleTimer = setTimeout(() => window.flushExamAutoSave(), EXAMY_AUTOSAVE_IDLE_MS);
    // Do not postpone forever during continuous typing or repeated edits.
    if (!examyAutoSaveMaxTimer) {
        examyAutoSaveMaxTimer = setTimeout(() => window.flushExamAutoSave(), EXAMY_AUTOSAVE_MAX_WAIT_MS);
    }
};

// Text edits: schedule one save after 1.4 seconds of inactivity.
document.addEventListener('input', (event) => {
    if (event.target && event.target.closest && event.target.closest('#sheetsWrapper')) {
        window.triggerAutoSave();
    }
}, true);

// Structural edits (add/remove questions, tables, images) are caught without
// treating every click or toolbar hover as a document change.
document.addEventListener('DOMContentLoaded', () => {
    const wrapper = document.getElementById('sheetsWrapper');
    if (!wrapper || typeof MutationObserver === 'undefined') return;
    let observerQueued = false;
    const observer = new MutationObserver((mutations) => {
        if (observerQueued || !mutations.some(m => m.type === 'childList' || m.type === 'characterData')) return;
        observerQueued = true;
        Promise.resolve().then(() => {
            observerQueued = false;
            window.triggerAutoSave();
        });
    });
    observer.observe(wrapper, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'src', 'width', 'height', 'colspan', 'rowspan'] });
});

// Flush on leaving an edited field, switching tabs, minimizing, or closing.
document.addEventListener('focusout', (event) => {
    if (event.target && event.target.closest && event.target.closest('#sheetsWrapper')) {
        if (examyAutoSaveDirty) setTimeout(() => window.flushExamAutoSave(), 120);
    }
}, true);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') window.flushExamAutoSave();
});
window.addEventListener('pagehide', () => window.flushExamAutoSave());
window.addEventListener('beforeunload', () => window.flushExamAutoSave());

function setupGlobalEnterLineBreakHandler() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey) {
            const activeEl = document.activeElement;
            if (activeEl && activeEl.isContentEditable) {
                e.preventDefault();
                document.execCommand('insertLineBreak');
                const curSheet = activeEl.closest('.a4-sheet') || getActiveSheet();
                if (curSheet) checkExactSheetOverflow(curSheet);
            }
        }
    });
}

function toggleHeaderZone(sheetEl = null) {
    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const sheet = sheetEl || getActiveSheet() || document.querySelector('.a4-sheet');
    if (!sheet) return;

    const headerZone = sheet.querySelector('.sheet-header-locked-zone');
    if (headerZone) {
        const isHidden = headerZone.classList.toggle('header-hidden');
        const toggleBtns = sheet.querySelectorAll('.btn-toggle-hdr-state');
        toggleBtns.forEach(btn => {
            btn.innerHTML = isHidden ? '👁️ إظهار الهامش' : '🚫 إخفاء الهامش';
            btn.classList.toggle('btn-is-hidden-state', isHidden);
        });
        checkExactSheetOverflow(sheet);
        resetAllSheetsScroll();
    }
    restoreEditingCapabilities(sheet);
}

function removeHeaderZoneCompletely(sheetEl = null) {
    if (!confirm("هل أنت متأكد من حذف الترويسة العلوية بالكامل لهذه الورقة؟")) return;
    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.trash();
    const sheet = sheetEl || getActiveSheet() || document.querySelector('.a4-sheet');
    if (!sheet) return;

    const frameBox = sheet.querySelector('.sheet-frame-box');
    const headerZone = sheet.querySelector('.sheet-header-locked-zone');
    if (headerZone) headerZone.remove();

    let restoreBar = sheet.querySelector('.sheet-restore-header-bar');
    if (!restoreBar && frameBox) {
        restoreBar = document.createElement('div');
        restoreBar.className = 'sheet-restore-header-bar';
        restoreBar.innerHTML = `
            <button type="button" class="btn-restore-hdr-corner" onclick="restoreHeaderZone(this.closest('.a4-sheet'))" title="إعادة إظهار الترويسة العلوية">
                ➕ استرجاع الهامش العلوي
            </button>
        `;
        frameBox.insertBefore(restoreBar, frameBox.querySelector('.questions-stream'));
    }

    checkExactSheetOverflow(sheet);
    resetAllSheetsScroll();
    restoreEditingCapabilities(sheet);
}

function restoreHeaderZone(sheetEl = null) {
    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.success();
    const sheet = sheetEl || getActiveSheet() || document.querySelector('.a4-sheet');
    if (!sheet) return;

    const restoreBar = sheet.querySelector('.sheet-restore-header-bar');
    if (restoreBar) restoreBar.remove();

    if (sheet.querySelector('.sheet-header-locked-zone')) return;

    const frameBox = sheet.querySelector('.sheet-frame-box');
    const isAr = (typeof currentLang !== 'undefined' ? currentLang : 'ar') === 'ar';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'sheet-header-locked-zone';
    headerDiv.innerHTML = `
        <div class="hdr-action-bar">
            <button type="button" class="hdr-mini-btn btn-toggle-hdr-state" onclick="toggleHeaderZone(this.closest('.a4-sheet'))" title="إخفاء مؤقت">🚫 إخفاء الهامش</button>
            <button type="button" class="hdr-mini-btn" style="color:#ef4444;" onclick="removeHeaderZoneCompletely(this.closest('.a4-sheet'))" title="حذف نهائي">✖ حذف</button>
        </div>
        <div class="sheet-header" contenteditable="true" spellcheck="false">
            <div class="hdr-cell" id="hdrRight">${isAr ? 'مديرية التربية: .....................<br>المدرسة: مدرسة الجود الابتدائية<br>للبنين' : 'Directorate: .....................<br>Al-Joud Primary School'}</div>
            <div class="hdr-cell hdr-center" id="hdrCenter"><span class="main-title">${isAr ? 'امتحان نصف السنة' : 'Midyear Examination'}</span><br>${isAr ? 'الدور الأول<br>للعام الدراسي 2026 - 2027' : 'First Attempt<br>Academic Year 2026 - 2027'}</div>
            <div class="hdr-cell" id="hdrLeft">${isAr ? 'الصف / السادس<br>المادة / العلوم<br>التاريخ / .................' : 'Class / Sixth<br>Subject / Science<br>Date / .................'}</div>
        </div>
        <div class="exam-note-wrap">
            <button class="del-note-btn" onclick="this.parentElement.remove()" title="حذف الملاحظة">✖</button>
            <div class="exam-note-bar" contenteditable="true" spellcheck="false">
                ${isAr ? 'ملاحظة / الإجابة عن خمسة أسئلة فقط لكل سؤال 20 درجة' : 'Note / Answer five questions only'}
            </div>
        </div>
    `;

    frameBox.insertBefore(headerDiv, frameBox.querySelector('.questions-stream'));
    checkExactSheetOverflow(sheet);
    resetAllSheetsScroll();
    restoreEditingCapabilities(sheet);
}

function restoreEditingCapabilities(targetSheet = null) {
    const scope = targetSheet || document;
    scope.querySelectorAll('[contenteditable]').forEach(el => {
        el.setAttribute('contenteditable', 'true');
        el.style.userSelect = 'text';
        el.style.pointerEvents = 'auto';
    });

    if (typeof bindAllQuestionsInteractions === 'function') bindAllQuestionsInteractions();

    setTimeout(() => {
        const firstEditable = scope.querySelector('.question-container [contenteditable="true"]') || scope.querySelector('[contenteditable="true"]');
        if (firstEditable) firstEditable.focus();
    }, 50);
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        const isEditable = document.activeElement && document.activeElement.isContentEditable;

        if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault(); undoLastAction(); return;
        }
        if ((e.ctrlKey && e.key.toLowerCase() === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
            e.preventDefault(); redoLastAction(); return;
        }
        if ((e.ctrlKey && e.key === ',') || e.key === 'F2') {
            e.preventDefault(); toggleSettingsModal(); return;
        }
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'b') {
            e.preventDefault(); openBankDialog(); return;
        }
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'n') {
            e.preventDefault(); insertNewPageSheetManual(); return;
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'n' && !e.altKey && !e.shiftKey) {
            e.preventDefault(); if (typeof createNewQuestion === 'function') createNewQuestion(); return;
        }
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
            e.preventDefault(); duplicateActiveQuestionShortcut(); return;
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'Delete' || e.key === 'Del')) {
            e.preventDefault(); deleteActiveQuestionShortcut(); return;
        }
        if (e.ctrlKey && e.key.toLowerCase() === 's' && !e.shiftKey) {
            e.preventDefault(); saveExamToDb(); return;
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'p') {
            e.preventDefault();
            if (typeof promptDirectPrint === 'function') promptDirectPrint();
            else if (typeof openPrintPreview === 'function') openPrintPreview();
            return;
        }
        if (e.altKey && e.key === 'ArrowUp') {
            e.preventDefault(); moveActiveQuestionOrder(-1); return;
        }
        if (e.altKey && e.key === 'ArrowDown') {
            e.preventDefault(); moveActiveQuestionOrder(1); return;
        }
        if (e.ctrlKey && (e.key === ']' || e.key === '}' || (e.shiftKey && (e.key === '>' || e.key === '.')))) {
            if (isEditable) { e.preventDefault(); stepFontSize(e, 1); return; }
        }
        if (e.ctrlKey && (e.key === '[' || e.key === '{' || (e.shiftKey && (e.key === '<' || e.key === ',')))) {
            if (isEditable) { e.preventDefault(); stepFontSize(e, -1); return; }
        }
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
            e.preventDefault(); toggleTextDirectionShortcut(); return;
        }
        if (e.key === 'Escape') {
            document.querySelectorAll('.fullscreen-overlay.active, .modal-backdrop.active').forEach(m => m.classList.remove('active'));
            if (typeof deactivateCurrentQuestion === 'function') deactivateCurrentQuestion();
        }
    });
}

function duplicateActiveQuestionShortcut() {
    const activeQ = typeof activeQuestionCard !== 'undefined' ? activeQuestionCard : document.querySelector('.question-container.is-active');
    if (!activeQ) return;
    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const clone = activeQ.cloneNode(true);
    clone.classList.remove('is-active');
    activeQ.parentNode.insertBefore(clone, activeQ.nextSibling);
    if (typeof bindAllQuestionsInteractions === 'function') bindAllQuestionsInteractions();
    if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
    updateUIIndicators();
    const sheet = clone.closest('.a4-sheet');
    if (sheet) checkExactSheetOverflow(sheet);
}

function deleteActiveQuestionShortcut() {
    const activeQ = typeof activeQuestionCard !== 'undefined' ? activeQuestionCard : document.querySelector('.question-container.is-active');
    if (!activeQ) return;
    if (!confirm("هل أنت متأكد من حذف هذا السؤال؟")) return;
    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.trash();
    const sheet = activeQ.closest('.a4-sheet');
    activeQ.remove();
    if (typeof deactivateCurrentQuestion === 'function') deactivateCurrentQuestion();
    if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
    updateUIIndicators();
    if (sheet) checkExactSheetOverflow(sheet);
}

function moveActiveQuestionOrder(direction) {
    const activeQ = typeof activeQuestionCard !== 'undefined' ? activeQuestionCard : document.querySelector('.question-container.is-active');
    if (!activeQ) return;
    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();

    if (direction === -1) {
        const prev = activeQ.previousElementSibling;
        if (prev && prev.classList.contains('question-container')) activeQ.parentNode.insertBefore(activeQ, prev);
    } else if (direction === 1) {
        const next = activeQ.nextElementSibling;
        if (next && next.classList.contains('question-container')) activeQ.parentNode.insertBefore(next, activeQ);
    }
    if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
    const sheet = activeQ.closest('.a4-sheet');
    if (sheet) checkExactSheetOverflow(sheet);
}

function toggleTextDirectionShortcut() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let node = sel.anchorNode;
    if (node.nodeType === 3) node = node.parentElement;
    const targetBlock = node.closest('[contenteditable="true"]') || node;
    if (targetBlock) {
        recordUndoState();
        if (typeof SoundFX !== 'undefined') SoundFX.pop();
        const currentDir = window.getComputedStyle(targetBlock).direction;
        targetBlock.style.direction = currentDir === 'rtl' ? 'ltr' : 'rtl';
        targetBlock.style.textAlign = currentDir === 'rtl' ? 'left' : 'right';
    }
}





function removeSheet(btn) {
    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.trash();
    btn.closest(".a4-sheet").remove();
    if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
    updateUIIndicators();
    resetAllSheetsScroll();
}

function generateNewExamId() {
    examUid = "EX-" + Math.floor(100000 + Math.random() * 900000);
    const span = document.getElementById("examIdSpan");
    if (span) span.textContent = examUid;
}

// ==========================================================================
// 1. إصلاح دالة فتح القوائم المنسدلة لتعمل بحرية تامة دون أي قص
// ==========================================================================

// ==========================================================================
// 2. محرك إدارة وتخصيص الجداول المتقدم من الشريط العلوي (ActiveTableEngine)
// ==========================================================================
let currentActiveTable = null;

const ActiveTableEngine = {
    select(tableElement) {
        currentActiveTable = tableElement;
        
        // تمييز الجدول المحدد
        document.querySelectorAll('.table-resizable-wrapper').forEach(w => w.classList.remove('is-selected'));
        const wrap = tableElement.closest('.table-resizable-wrapper');
        if (wrap) wrap.classList.add('is-selected');

        // إظهار تبويب تصميم الجدول في الشريط العلوي وتفعيله فوراً
        const tabBtn = document.getElementById('tabBtnTableDesign');
        if (tabBtn) {
            tabBtn.style.display = 'inline-flex';
            if (typeof switchRibbonTab === 'function') {
                switchRibbonTab('tableDesign', tabBtn);
            }
        }

        // تحديث قيم خانات الأرقام في الشريط
        const widthInp = document.getElementById('tblExactWidthInput');
        const marginInp = document.getElementById('tblExactMarginInput');
        if (widthInp && wrap) widthInp.value = Math.round(wrap.offsetWidth || tableElement.offsetWidth);
        if (marginInp && wrap) marginInp.value = parseInt(wrap.style.marginTop) || 10;
    },

    deselect() {
        currentActiveTable = null;
        document.querySelectorAll('.table-resizable-wrapper').forEach(w => w.classList.remove('is-selected'));
        const tabBtn = document.getElementById('tabBtnTableDesign');
        if (tabBtn) tabBtn.style.display = 'none';

        // ارجع إلى الرئيسية فقط إذا كان تبويب تصميم الجدول هو المفتوح فعلاً.
        // لا تغيّر تبويب المستخدم عند النقر داخل إدراج/تخطيط/طباعة/ملف.
        const tablePanel = document.getElementById('rtab-tableDesign');
        if (tablePanel && tablePanel.classList.contains('active')) {
            const homeBtn = document.querySelector('.r-tab-btn[data-tab="home"]');
            if (homeBtn && typeof switchRibbonTab === 'function') {
                switchRibbonTab('home', homeBtn);
            }
        }
    },

    addRow() {
        if (!currentActiveTable) return;
        recordUndoState();
        const colsCount = currentActiveTable.rows[0]?.cells.length || 3;
        const newRow = currentActiveTable.insertRow(-1);
        for (let i = 0; i < colsCount; i++) {
            const cell = newRow.insertCell(i);
            cell.contentEditable = "true";
            cell.innerHTML = "نص";
        }
        if (typeof SoundFX !== 'undefined') SoundFX.click();
    },

    deleteRow() {
        if (!currentActiveTable || currentActiveTable.rows.length <= 1) return;
        recordUndoState();
        currentActiveTable.deleteRow(-1);
        if (typeof SoundFX !== 'undefined') SoundFX.trash();
    },

    addCol() {
        if (!currentActiveTable) return;
        recordUndoState();
        for (let r = 0; r < currentActiveTable.rows.length; r++) {
            const row = currentActiveTable.rows[r];
            const cell = r === 0 ? document.createElement('th') : row.insertCell(-1);
            if (r === 0) row.appendChild(cell);
            cell.contentEditable = "true";
            cell.innerHTML = r === 0 ? `عنوان ${row.cells.length}` : "نص";
        }
        if (typeof SoundFX !== 'undefined') SoundFX.click();
    },

    deleteCol() {
        if (!currentActiveTable || currentActiveTable.rows[0]?.cells.length <= 1) return;
        recordUndoState();
        for (let r = 0; r < currentActiveTable.rows.length; r++) {
            currentActiveTable.rows[r].deleteCell(-1);
        }
        if (typeof SoundFX !== 'undefined') SoundFX.trash();
    },

    setExactWidth(pxVal) {
        if (!currentActiveTable) return;
        const wrap = currentActiveTable.closest('.table-resizable-wrapper') || currentActiveTable;
        wrap.style.width = `${Math.max(100, Math.min(750, parseInt(pxVal) || 300))}px`;
        currentActiveTable.style.width = '100%';
    },

    setExactMargin(pxVal) {
        if (!currentActiveTable) return;
        const wrap = currentActiveTable.closest('.table-resizable-wrapper') || currentActiveTable;
        wrap.style.marginTop = `${Math.max(0, parseInt(pxVal) || 0)}px`;
    },

    setBorderColor(color) {
        if (!currentActiveTable) return;
        recordUndoState();
        currentActiveTable.style.borderColor = color;
        currentActiveTable.querySelectorAll('td, th').forEach(c => c.style.borderColor = color);
    },

    setHeaderBg(color) {
        if (!currentActiveTable) return;
        recordUndoState();
        const headerRow = currentActiveTable.rows[0];
        if (headerRow) {
            headerRow.querySelectorAll('th, td').forEach(c => c.style.backgroundColor = color);
        }
    },

    deleteTable() {
        if (!currentActiveTable) return;
        if (!confirm("هل أنت متأكد من حذف هذا الجدول بالكامل؟")) return;
        recordUndoState();
        const wrap = currentActiveTable.closest('.table-resizable-wrapper') || currentActiveTable;
        wrap.remove();
        this.deselect();
        if (typeof SoundFX !== 'undefined') SoundFX.trash();
    }
};



// الاستماع للنقر لتحديد الجدول أو إلغاء التحديد
document.addEventListener('click', (e) => {
    const table = e.target.closest('table');
    if (table) {
        ActiveTableEngine.select(table);
    } else if (!e.target.closest('#rtab-tableDesign') && !e.target.closest('.table-resizable-wrapper')) {
        ActiveTableEngine.deselect();
    }
});

function verifyTableDesignTabVisibility() {
       const tabBtn = document.getElementById('tabBtnTableDesign');
       if (!tabBtn) return;
       // يظهر فقط إذا كان هناك جدول محدد حالياً في الـ DOM
       const hasActiveTable = document.querySelector('.custom-table-wrapper.is-selected') || currentActiveTable;
       if (hasActiveTable) {
           tabBtn.style.display = 'inline-flex';
       } else {
           tabBtn.style.display = 'none';
           if (document.getElementById('rtab-tableDesign')?.classList.contains('active')) {
               switchRibbonTab('home', document.querySelector('.r-tab-btn'));
           }
       }
   }

function getActiveSheet() {
    const sheets = document.querySelectorAll(".a4-sheet");
    if (!sheets.length) return null;

    // العثور على الصفحة الأقرب لمنتصف شاشة المستخدم الحالية
    let bestSheet = sheets[0];
    let minDistance = Infinity;
    const viewportCenter = window.scrollY + (window.innerHeight / 2);

    sheets.forEach(sheet => {
        const rect = sheet.getBoundingClientRect();
        const sheetCenter = window.scrollY + rect.top + (rect.height / 2);
        const distance = Math.abs(viewportCenter - sheetCenter);
        if (distance < minDistance) {
            minDistance = distance;
            bestSheet = sheet;
        }
    });

    return bestSheet;
}


// توليد صفحة جديدة بشكل ديناميكي غير محدود
function insertNewPageSheetManual(isAuto = false) {
    if (!isAuto) {
        recordUndoState();
        if (typeof SoundFX !== 'undefined') SoundFX.pop();
    }
    const wrapper = document.getElementById("sheetsWrapper");
    if (!wrapper) return null;

    const count = wrapper.querySelectorAll(".a4-sheet").length + 1;

    const newSheet = document.createElement("div");
    newSheet.className = "a4-sheet";
    newSheet.id = `sheet-${count}`;
    newSheet.setAttribute("data-index", count);
    newSheet.innerHTML = `
        <div class="sheet-frame-box border-style-${activeBorderSettings.shape}" id="frameBox-${count}">
            <div class="sheet-bg-layer" id="sheetBg-${count}"></div>
            <div class="watermark-layer" id="wm-${count}">${watermarkConfig.text}</div>
            <button class="del-note-btn" style="top:10px; inset-inline-start:10px;" onclick="removeSheet(this)" title="حذف الصفحة">❌</button>
            
            <div class="hdr-action-bar" style="margin-bottom:6px;">
                <button type="button" class="hdr-mini-btn" onclick="restoreHeaderZone(this.closest('.a4-sheet'))">➕ إضافة هامش علوي</button>
            </div>

            <div class="questions-stream"></div>
            <div class="page-break-indicator">--- خط نهاية حد الطباعة للورقة ---</div>
            <div class="sheet-smart-footer">
                <span class="footer-custom-text" contenteditable="true" spellcheck="false">تابع الأسئلة...</span>
                <span class="footer-page-index">صفحة ${count} من <span class="total-pages-ref">${count}</span></span>
            </div>
        </div>
    `;

    wrapper.appendChild(newSheet);

    // تطبيق إعدادات التباعد الحالية على مسار الأسئلة في الصفحة الجديدة
    const stream = newSheet.querySelector('.questions-stream');
    if (stream && currentQuestionsGap) {
        stream.style.gap = `${currentQuestionsGap}px`;
    }

    applyFrameInsetToAllSheets();
    applyWatermarkSettings();
    applySheetBgSettings();
    updateUIIndicators();
    resetAllSheetsScroll();
    return newSheet;
}


// التحكم بتباعد الأسئلة (إذا كان هناك سؤال محدد يتم تعديل مسافته وحده، وإلا تعديل عام)
function adjustQuestionsGap(delta) {
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();

    const activeQ = (typeof activeQuestionCard !== 'undefined' && activeQuestionCard) ? activeQuestionCard : null;
    const label = document.getElementById('qGapDisplayLabel');

    if (activeQ) {
        // 1. زيادة أو تقليص التباعد لسؤال واحد فقط محدد
        let currentMargin = parseFloat(window.getComputedStyle(activeQ).marginBottom) || 12;
        let newMargin = Math.max(0, Math.min(100, currentMargin + delta));
        activeQ.style.marginBottom = `${newMargin}px`;

        if (label) label.textContent = `${newMargin}px (سؤال)`;

        if (typeof UIEffects !== 'undefined') {
            UIEffects.showToast(`تباعد السؤال المحدد: ${newMargin}px`, "info", 1000);
        }

        // فحص الورقة الحالية بعد مهلة تصيير قصيرة لترحيل السؤال المتجاوز
        const currentSheet = activeQ.closest('.a4-sheet') || (typeof getActiveSheet === 'function' ? getActiveSheet() : null);
        setTimeout(() => {
            if (currentSheet) checkExactSheetOverflow(currentSheet);
        }, 40);

    } else {
        // 2. زيادة أو تقليص التباعد العام لجميع الأسئلة في كل الصفحات
        currentQuestionsGap = Math.max(2, Math.min(60, currentQuestionsGap + delta));

        document.querySelectorAll('.questions-stream').forEach(stream => {
            stream.style.gap = `${currentQuestionsGap}px`;
        });

        if (label) label.textContent = `${currentQuestionsGap}px`;

        if (typeof UIEffects !== 'undefined') {
            UIEffects.showToast(`تباعد كافة الأسئلة: ${currentQuestionsGap}px`, "info", 1000);
        }

        // فحص كافة الصفحات بالتتابع لترحيل أي أسئلة فائضة
        setTimeout(() => {
            document.querySelectorAll('.a4-sheet').forEach(sheet => {
                checkExactSheetOverflow(sheet);
            });
        }, 40);
    }
}

// محرك فحص الامتلاء الصارم وترحيل الأسئلة لصفحة جديدة بلا توقف
function checkExactSheetOverflow(sheet) {
    if (!sheet) return;
    const stream = sheet.querySelector('.questions-stream');
    const footer = sheet.querySelector('.sheet-smart-footer');
    const frameBox = sheet.querySelector('.sheet-frame-box');
    if (!stream || !frameBox) return;

    let questions = Array.from(stream.querySelectorAll('.question-container'));
    if (questions.length <= 1) return;

    // قياس الحد السفلي المسموح به للورقة بدقة
    const footerRect = footer ? footer.getBoundingClientRect() : null;
    const frameRect = frameBox.getBoundingClientRect();
    const maxBottom = footerRect ? (footerRect.top - 10) : (frameRect.bottom - 45);

    // التحقق من تجاوز السؤال الأخير للحد السفلي
    const lastQ = questions[questions.length - 1];
    const lastQRect = lastQ.getBoundingClientRect();

    if (lastQRect.bottom > maxBottom || stream.scrollHeight > stream.clientHeight + 5) {
        let nextSheet = sheet.nextElementSibling;
        if (!nextSheet) {
            nextSheet = insertNewPageSheetManual(true);
        }

        let nextStream = nextSheet.querySelector('.questions-stream');
        if (!nextStream) {
            nextStream = document.createElement('div');
            nextStream.className = 'questions-stream';
            nextSheet.querySelector('.sheet-frame-box').appendChild(nextStream);
        }

        // ترحيل السؤال الفائض إلى بداية الصفحة التالية
        nextStream.prepend(lastQ);

        if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
        updateUIIndicators();
        resetAllSheetsScroll();

        // فحص تكراري لنفس الصفحة تحسباً لوجود سؤال آخر زائد
        setTimeout(() => {
            checkExactSheetOverflow(sheet);
            checkExactSheetOverflow(nextSheet);
        }, 50);
    }
}


// متغير حفظ المسافة بين الأسئلة
let currentQuestionsGap = 12;

// التحكم بالمسافة بين الأسئلة عمودياً


// التحكم بتباعد الأسطر (Line-Height) للنص أو السؤال النشط
function adjustLineHeight(delta) {
    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.click();

    let target = null;
    const sel = window.getSelection();

    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        let node = sel.anchorNode;
        if (node.nodeType === 3) node = node.parentElement;
        target = node.closest('[contenteditable="true"]');
    }

    if (!target && typeof activeQuestionCard !== 'undefined' && activeQuestionCard) {
        target = activeQuestionCard.querySelector('.q-content-box') || activeQuestionCard;
    }

    if (!target) {
        target = document.querySelector('.question-container.is-active .q-content-box') || document.querySelector('.question-container:last-child');
    }

    if (target) {
        let currentLH = parseFloat(window.getComputedStyle(target).lineHeight);
        let fontSize = parseFloat(window.getComputedStyle(target).fontSize) || 14;
        let currentRatio = currentLH ? (currentLH / fontSize) : 1.5;

        let newRatio = Math.max(1.0, Math.min(3.0, currentRatio + delta));
        target.style.lineHeight = newRatio.toFixed(2);

        const curSheet = target.closest('.a4-sheet') || getActiveSheet();
        if (curSheet) checkExactSheetOverflow(curSheet);

        if (typeof UIEffects !== 'undefined') {
            UIEffects.showToast(`تباعد الأسطر: ${newRatio.toFixed(1)}`, "info", 1200);
        }
    }
}


function moveQuestionToNextSheet(btnOrCard) {
    const card = btnOrCard.closest ? btnOrCard.closest('.question-container') : btnOrCard;
    if (!card) return;

    const currentSheet = card.closest('.a4-sheet');
    if (!currentSheet) return;

    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();

    let nextSheet = currentSheet.nextElementSibling;
    if (!nextSheet) {
        nextSheet = insertNewPageSheetManual(true);
    }

    if (nextSheet) {
        let nextStream = nextSheet.querySelector('.questions-stream');
        if (!nextStream) {
            nextStream = document.createElement('div');
            nextStream.className = 'questions-stream';
            const frame = nextSheet.querySelector('.sheet-frame-box') || nextSheet;
            frame.appendChild(nextStream);
        }

        nextStream.prepend(card);
        if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
        updateUIIndicators();
        resetAllSheetsScroll();
        
        nextSheet.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        if (typeof checkExactSheetOverflow === 'function') {
            checkExactSheetOverflow(currentSheet);
            checkExactSheetOverflow(nextSheet);
        }
        
        if (typeof UIEffects !== 'undefined') {
            UIEffects.showToast("تم نقل السؤال إلى الصفحة التالية بنجاح!", "info", 2000);
        }
    }
}

// 3. تفعيل عمل زر "النقل إلى الصفحة السابقة" يدوياً
function moveQuestionToPrevSheet(btnOrCard) {
    const card = btnOrCard.closest ? btnOrCard.closest('.question-container') : btnOrCard;
    if (!card) return;

    const currentSheet = card.closest('.a4-sheet');
    if (!currentSheet) return;

    const prevSheet = currentSheet.previousElementSibling;
    if (!prevSheet) {
        if (typeof UIEffects !== 'undefined') {
            UIEffects.showToast("هذه هي الصفحة الأولى بالفعل!", "warn", 2000);
        }
        return;
    }

    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();

    const prevStream = prevSheet.querySelector('.questions-stream');
    if (prevStream) {
        prevStream.appendChild(card);
        if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
        updateUIIndicators();
        resetAllSheetsScroll();
        
        prevSheet.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function trackCursorPosition() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const stage = document.getElementById('sheetsWrapper');
        if (stage && stage.contains(range.commonAncestorContainer)) {
            savedSelectionRange = range.cloneRange();
        }
    }
}

function resetAllSheetsScroll() {
    document.querySelectorAll('.sheet-frame-box').forEach(box => {
        box.scrollTop = 0;
    });
}

function autoScaleStageToScreen() {
    const stage = document.getElementById('appStage');
    const wrapper = document.getElementById('sheetsWrapper');
    if (!stage || !wrapper) return;

    const availableWidth = stage.clientWidth - 40;
    const a4BaseWidth = 830;

    let scale = 1;
    if (availableWidth < a4BaseWidth) {
        scale = (availableWidth / a4BaseWidth);
        scale = Math.max(0.50, Math.min(1, scale));
    } else {
        scale = 1;
    }

    document.documentElement.style.setProperty('--stage-scale', scale.toFixed(3));
    wrapper.style.transform = `scale(${scale.toFixed(3)})`;
    wrapper.style.transformOrigin = 'top center';
}



function changeNumberSystem(sys) {
    currentNumberSystem = sys;
    localStorage.setItem('exambuilder_number_system', sys);
    if (typeof SoundFX !== 'undefined') SoundFX.pop();

    document.querySelectorAll('.point-cell .pt-num').forEach((cell, idx) => {
        cell.textContent = `${formatNumberBySystem(idx + 1)}-`;
    });

    document.querySelectorAll('.branch-row').forEach(row => {
        const input = row.querySelector('.branch-grade-input');
        if (input) {
            const raw = parseAnyNumber(input.value);
            input.value = formatNumberBySystem(raw || 10);
        }
    });

    if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
    updateUIIndicators();
}

function handlePaperSizeChange(val) {
    currentPaperSize = val;
    localStorage.setItem('exambuilder_paper_size', val);
    
    const prevSelect = document.getElementById("previewPaperSizeSelect");
    if (prevSelect && prevSelect.value !== val) prevSelect.value = val;
    const settSelect = document.getElementById("settingsPaperSizeSelect");
    if (settSelect && settSelect.value !== val) settSelect.value = val;

    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    updatePaperSizeDisplay();
}

function handleBookletToggle(isChecked) {
    isBookletMode = isChecked;
    localStorage.setItem('exambuilder_booklet_mode', isChecked);
    
    const prevToggle = document.getElementById("previewBookletToggle");
    if (prevToggle) prevToggle.checked = isChecked;
    const settToggle = document.getElementById("settingsBookletToggle");
    if (settToggle) settToggle.checked = isChecked;

    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    updatePaperSizeDisplay();
    
    if (document.getElementById("printPreviewModal")?.classList.contains("active")) {
        if (typeof openPrintPreview === 'function') openPrintPreview();
    }
}

function updatePaperSizeDisplay() {
    const badge = document.getElementById("previewPageFormatBadge");
    if (badge) {
        badge.textContent = isBookletMode ? 'A3 دفتر امتحاني' : currentPaperSize;
    }
}

function parseAnyNumber(str) {
    if (!str) return 0;
    const arabicNums = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
    let clean = String(str).replace(/[٠-٩]/g, d => arabicNums[d]);
    clean = clean.replace(/[^0-9]/g, '');
    return parseInt(clean) || 0;
}

function updateUIIndicators() {
    // جلب الصفحات الحالية الفعالة بدقة
    const activeSheets = document.querySelectorAll("#sheetsWrapper .a4-sheet");
    const count = activeSheets.length || 1;

    // تحديث عدادات الصفحات في الشريط العلوي والسفلي
    const pageTotalSpan = document.getElementById("pageTotalCount");
    const footerPageBadge = document.getElementById("footerPageCountBadge");
    if (pageTotalSpan) pageTotalSpan.textContent = formatNumberBySystem(count);
    if (footerPageBadge) footerPageBadge.textContent = formatNumberBySystem(count);

    // حساب إجمالي الأسئلة
    const allQuestions = document.querySelectorAll("#sheetsWrapper .question-container");
    const qCountBadge = document.getElementById("qCountBadge");
    if (qCountBadge) qCountBadge.textContent = formatNumberBySystem(allQuestions.length);

    // حساب إجمالي الدرجات
    let totalMarks = 0;
    allQuestions.forEach(q => {
        const gradeBadge = q.querySelector(".q-grade-badge");
        if (gradeBadge) {
            const val = parseInt(gradeBadge.innerText.replace(/[^0-9]/g, '')) || 0;
            totalMarks += val;
        }
    });

    const marksSpan = document.getElementById("totalGradesCounter");
    if (marksSpan) marksSpan.textContent = `${formatNumberBySystem(totalMarks)} درجة`;

    const tag = document.getElementById("gradeStatusTag");
    if (tag) {
        if (totalMarks === 100) {
            tag.className = "grade-tag-status grade-status-perfect";
            tag.textContent = "مكتمل (100)";
        } else {
            tag.className = "grade-tag-status grade-status-warn";
            tag.textContent = `المتبقي للـ 100: (${formatNumberBySystem(100 - totalMarks)})`;
        }
    }
}

// 2. بطاقة استرجاع الجلسة السابقة الجانبية الأنيقة (بدلاً من النافذة المنبثقة)
function checkAutoSaveRecoveryBanner() {
    const backup = localStorage.getItem("examy_session_backup");
    if (!backup) return;

    // منع تكرار إنشاء البطاقة
    if (document.getElementById("recoverySideBanner")) return;

    const banner = document.createElement("div");
    banner.id = "recoverySideBanner";
    banner.className = "recovery-side-banner";
    banner.innerHTML = `
        <div class="rcv-icon">📂</div>
        <div class="rcv-body">
            <strong>استرجاع مسودة الاختبار؟</strong>
            <small>تم العثور على آخر جلسة عمل غير محفوظة قبل الإغلاق.</small>
            <div class="rcv-btns">
                <button type="button" class="rcv-btn-ok" onclick="restoreSavedSessionBackup()">استرجاع</button>
                <button type="button" class="rcv-btn-no" onclick="dismissSavedSessionBackup()">تجاهل</button>
            </div>
        </div>
    `;
    document.body.appendChild(banner);

    setTimeout(() => banner.classList.add("show"), 500);
}

function restoreSavedSessionBackup() {
    const backup = localStorage.getItem("examy_session_backup");
    if (backup) {
        const stage = document.getElementById("sheetsWrapper");
        if (stage) stage.innerHTML = backup;
        if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
        updateUIIndicators();
        if (typeof SoundFX !== 'undefined') SoundFX.success();
    }
    dismissSavedSessionBackup();
}

function dismissSavedSessionBackup() {
    const banner = document.getElementById("recoverySideBanner");
    if (banner) {
        banner.classList.remove("show");
        setTimeout(() => banner.remove(), 300);
    }
    localStorage.removeItem("examy_session_backup");
}

// نسخة استرداد إضافية كل دقيقة، مستقلة عن الحفظ بعد التوقف عن الكتابة.
setInterval(() => {
    const stage = document.getElementById("sheetsWrapper");
    if (stage && stage.querySelectorAll(".question-container").length > 0 && examyAutoSaveDirty) {
        try { localStorage.setItem("examy_session_backup", stage.innerHTML); }
        catch (e) { console.warn("تعذر تحديث نسخة الاسترداد:", e); }
    }
}, 60000);

// 3. جدول اختصارات الكيبورد الشاملة والموسعة
document.addEventListener('keydown', (e) => {
    // حفظ سريع: Ctrl + S
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (typeof saveExamToDb === 'function') saveExamToDb();
    }
    // سؤال جديد: Ctrl + N
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (typeof createNewQuestion === 'function') createNewQuestion();
    }
    // طباعة سريعة: Ctrl + P
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (typeof promptDirectPrint === 'function') promptDirectPrint();
    }
    // معاينة: Ctrl + Shift + P
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (typeof openPrintPreview === 'function') openPrintPreview();
    }
    // ضغط الورقة: Ctrl + Shift + S
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        PreFlightSystem.smartShrinkPage();
    }
    // موازنة المسافات: Ctrl + B
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (typeof autoDistributeSpacing === 'function') autoDistributeSpacing();
    }
    // حذف السؤال النشط: Delete
    if (e.key === 'Delete' && activeQuestionCard && !document.activeElement.isContentEditable) {
        e.preventDefault();
        if (typeof panelDeleteQuestion === 'function') panelDeleteQuestion();
    }
});

// استدعاء التحقق عند الإقلاع
window.addEventListener('load', () => {
    setTimeout(checkAutoSaveRecoveryBanner, 1500);
});


function setupInlineTextFormatter() {
    const bar = document.getElementById('inlineTextFormatter');
    if (!bar) return;

    document.addEventListener('selectionchange', () => {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect && document.getElementById('sheetsWrapper').contains(range.commonAncestorContainer)) {
                bar.style.top = `${window.scrollY + rect.top - 46}px`;
                bar.style.left = `${window.scrollX + rect.left + (rect.width / 2) - 120}px`;
                bar.classList.add('active');
                return;
            }
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('#inlineTextFormatter')) {
            bar.classList.remove('active');
        }
    });
}

function applyInlineFormat(event, command) {
    event.preventDefault();
    document.execCommand(command, false, null);
}

function applyInlineColor(color) {
    document.execCommand('foreColor', false, color);
}

function stepFontSize(event, delta) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.click();

    let container = sel.anchorNode;
    if (container.nodeType === 3) container = container.parentElement;

    let computedPx = parseFloat(window.getComputedStyle(container).fontSize) || 16;
    let currentPt = Math.round(computedPx * 0.75);
    let newPt = Math.max(8, Math.min(48, currentPt + delta));

    const range = sel.getRangeAt(0);

    if (container.tagName === 'SPAN' && container.style.fontSize && container.innerText === sel.toString()) {
        container.style.fontSize = `${newPt}pt`;
    } else {
        const span = document.createElement("span");
        span.style.fontSize = `${newPt}pt`;
        span.style.lineHeight = "1.3";
        try {
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);

            sel.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            sel.addRange(newRange);
        } catch (e) {
            document.execCommand('fontSize', false, "3");
        }
    }

    updateInlineFontSizeBadge(newPt);
    const curSheet = typeof getActiveSheet === 'function' ? getActiveSheet() : document.querySelector('.a4-sheet');
    if (typeof checkExactSheetOverflow === 'function') checkExactSheetOverflow(curSheet);
}

function updateInlineFontSizeBadge(ptVal = null) {
    const badge = document.getElementById('fontSizeBadgeDisplay');
    if (!badge) return;
    if (ptVal) {
        badge.textContent = `${ptVal}pt`;
        return;
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        let node = sel.anchorNode;
        if (node.nodeType === 3) node = node.parentElement;
        if (node) {
            let px = parseFloat(window.getComputedStyle(node).fontSize) || 16;
            let pt = Math.round(px * 0.75);
            badge.textContent = `${pt}pt`;
        }
    }
}

function autoDistributeSpacing() {
    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.success();
    const targetSheet = getActiveSheet() || document.querySelector('.a4-sheet');
    const questions = targetSheet.querySelectorAll('.question-container');
    if (questions.length < 2) return;

    const stream = targetSheet.querySelector('.questions-stream');
    const totalAvailH = stream.clientHeight;

    let questionsTotalH = 0;
    questions.forEach(q => questionsTotalH += q.offsetHeight);

    const remainingH = totalAvailH - questionsTotalH;
    if (remainingH > 20) {
        const gapEach = Math.floor(remainingH / (questions.length - 1));
        stream.style.gap = `${Math.min(30, Math.max(6, gapEach))}px`;
    } else {
        stream.style.gap = '8px';
    }
    resetAllSheetsScroll();
}

function autoSaveExamSession() {
    const payload = document.getElementById("sheetsWrapper")?.innerHTML;
    if (payload) {
        localStorage.setItem('exambuilder_autosave_payload', payload);
        localStorage.setItem('exambuilder_autosave_uid', examUid);
    }
}

async function handleActivateBtn() {
    const keyInput = document.getElementById("licenseKeyInput");
    const feedback = document.getElementById("licenseFeedback");
    const hwid = getStableMachineHWID();

    if (!keyInput || !feedback) return;
    const key = keyInput.value.trim().toUpperCase();

    if (!key) {
        if (typeof SoundFX !== 'undefined') SoundFX.trash();
        feedback.style.color = "#ef4444";
        feedback.textContent = "يرجى كتابة أو لصق مفتاح التفعيل أولاً";
        return;
    }

    feedback.style.color = "#38bdf8";
    feedback.textContent = "جاري الاتصال بالسيرفر السحابي والتحقق من الترخيص...";

    try {
        const result = await AppAPI.activateLicenseRemote(key, hwid);

        if (result && (result.success || result.valid)) {
            if (typeof SoundFX !== 'undefined') SoundFX.success();
            feedback.style.color = "#10b981";
            feedback.textContent = result.message || "تم التفعيل بنجاح! جاري فتح البرنامج...";

            const licenseData = {
                key: key,
                hwid: hwid,
                status: "ACTIVE",
                expiresAt: result.expiresAt || "lifetime",
                activatedAt: new Date().toISOString()
            };

            localStorage.setItem("exambuilder_license_data", JSON.stringify(licenseData));
            try {
                if (AppAPI.saveLocalLicense) await AppAPI.saveLocalLicense(licenseData);
            } catch (localErr) {}

            setTimeout(() => {
                document.getElementById("licenseModal")?.classList.remove("active");
                window.examyLicenseValid = true;
                if (window.examyUserAuthenticated) {
                    if (!localStorage.getItem('exambuilder_lang')) {
                        document.getElementById("languageModal")?.classList.add("active");
                    } else {
                        document.getElementById("languageModal")?.classList.remove("active");
                    }
                } else {
                    document.getElementById("languageModal")?.classList.remove("active");
                    window.ExamyAuth?.show();
                }
            }, 700);

        } else {
            if (typeof SoundFX !== 'undefined') SoundFX.trash();
            feedback.style.color = "#ef4444";
            feedback.textContent = (result && result.message) ? result.message : "مفتاح التفعيل غير صالح أو منتهي الصلاحية";
        }
    } catch (err) {
        console.error("خطأ أثناء تفعيل المفتاح:", err);
        if (typeof SoundFX !== 'undefined') SoundFX.trash();
        feedback.style.color = "#ef4444";
        feedback.textContent = "حدث خطأ غير متوقع أثناء الاتصال. تحقق من اتصال الإنترنت.";
    }
}

function copyHWIDToClipboard() {
    const hwid = document.getElementById("hwidDisplay")?.innerText || "";
    if (hwid && hwid !== "--") {
        navigator.clipboard.writeText(hwid).then(() => {
            if (typeof SoundFX !== 'undefined') SoundFX.pop();
            alert("✅ تم نسخ معرف الجهاز (HWID) بنجاح!");
        });
    }
}

function initLanguageChoice(lang) {
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    currentLang = lang;
    localStorage.setItem('exambuilder_lang', lang);
    applyLanguageMode(lang);
    document.getElementById("languageModal")?.classList.remove("active");
}

function toggleLanguageMode() {
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    recordUndoState();
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    applyLanguageMode(currentLang);
}

function applyLanguageMode(lang) {
    const isAr = lang === 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';

    const langBtn = document.getElementById("langSwitchBtn");
    if (langBtn) langBtn.textContent = isAr ? "🌐 English" : "🌐 العربية";

    const rightHdr = document.getElementById("hdrRight");
    const centerHdr = document.getElementById("hdrCenter");
    const leftHdr = document.getElementById("hdrLeft");
    const note = document.querySelector(".exam-note-bar");

    if (isAr) {
        if (rightHdr) rightHdr.innerHTML = "مديرية التربية: .....................<br>المدرسة: مدرسة الجود الابتدائية<br>للبنين";
        if (centerHdr) centerHdr.innerHTML = "<span class='main-title'>امتحان نصف السنة</span><br>الدور الأول<br>للعام الدراسي 2026 - 2027";
        if (leftHdr) leftHdr.innerHTML = "الصف / السادس<br>المادة / العلوم<br>التاريخ / .................";
        if (note) note.innerHTML = "ملاحظة / الإجابة عن خمسة أسئلة فقط لكل سؤال 20 درجة";
    } else {
        if (rightHdr) rightHdr.innerHTML = "Directorate: .....................<br>Al-Joud Primary School<br>For Boys";
        if (centerHdr) centerHdr.innerHTML = "<span class='main-title'>Midyear Examination</span><br>First Attempt<br>Academic Year 2026 - 2027";
        if (leftHdr) leftHdr.innerHTML = "Class / Sixth<br>Subject / Science<br>Date / .................";
        if (note) note.innerHTML = "Note / Answer five questions only, 20 marks for each question";
    }

    document.querySelectorAll(".question-container").forEach(card => {
        card.style.textAlign = isAr ? 'right' : 'left';
        const pbox = card.querySelector('.q-content-box');
        if (pbox) pbox.style.textAlign = isAr ? 'right' : 'left';
    });

    if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
    updateUIIndicators();
    resetAllSheetsScroll();
}

function resetAllQuestions() {
    if (confirm("هل أنت متأكد من تفريغ جميع الأسئلة والبدء بصفحة نظيفة؟")) {
        recordUndoState();
        if (typeof SoundFX !== 'undefined') SoundFX.trash();
        if (typeof deactivateCurrentQuestion === 'function') deactivateCurrentQuestion();
        
        const wrapper = document.getElementById("sheetsWrapper");
        const firstSheet = wrapper.querySelector(".a4-sheet");
        firstSheet.querySelector(".questions-stream").innerHTML = "";
        
        wrapper.querySelectorAll(".a4-sheet").forEach((s, idx) => {
            if (idx > 0) s.remove();
        });

        updateUIIndicators();
        resetAllSheetsScroll();
        autoScaleStageToScreen();
    }
}

async function fetchSystemMonitorStats() {
    try {
        const res = await fetch('http://localhost:3000/api/system/stats');
        if (!res.ok) throw new Error();
        const stats = await res.json();
        
        const cpuVal = (typeof stats.cpuPercent === 'number') ? stats.cpuPercent : Math.floor(Math.random() * 8 + 6);
        const ramVal = (typeof stats.ramPercent === 'number') ? stats.ramPercent : 42;

        const cpuTxt = document.getElementById("hudCpuPercent");
        if (cpuTxt) cpuTxt.textContent = `${cpuVal}%`;

        const ramTxt = document.getElementById("hudRamPercent");
        if (ramTxt) ramTxt.textContent = `${ramVal}%`;

    } catch (e) {
        // قراءة محاكية ذكية في حال بطء الاستجابة لضمان تفاعل المؤشرات دائماً
        const cpuTxt = document.getElementById("hudCpuPercent");
        const ramTxt = document.getElementById("hudRamPercent");
        if (cpuTxt) cpuTxt.textContent = `${Math.floor(Math.random() * 6 + 7)}%`;
        if (ramTxt) ramTxt.textContent = `41%`;
    }
}

function syncBorderSettings(property, value) {
    activeBorderSettings[property] = value;
    applyBorderToAllSheets();
}

function applyBorderToAllSheets() {
    document.documentElement.style.setProperty('--sheet-border-size', activeBorderSettings.size);
    document.documentElement.style.setProperty('--sheet-border-color', activeBorderSettings.color);

    const boxes = document.querySelectorAll('.sheet-frame-box');
    boxes.forEach(bx => {
        // إزالة الأنماط القديمة
        bx.classList.remove('border-style-gradient', 'border-style-solid', 'border-style-double', 'border-style-dashed', 'border-style-none', 'border-style-islamic', 'border-style-geometric', 'border-style-ministry', 'border-style-elegant');
        // إضافة النمط المحدد
        bx.classList.add(`border-style-${activeBorderSettings.shape}`);
        // تثبيت السمك برمجياً لضمان عدم تجاهله
        bx.style.borderWidth = activeBorderSettings.size;
        bx.style.borderColor = activeBorderSettings.color;
    });
}

function syncFrameInset(val) {
    activeFrameInset = `${val}mm`;
    const s1 = document.getElementById('frameInsetSlider');
    const s2 = document.getElementById('prevFrameInsetSlider');
    const l1 = document.getElementById('frameInsetLabel');
    const l2 = document.getElementById('prevFrameInsetVal');
    
    if (s1) s1.value = val;
    if (s2) s2.value = val;
    if (l1) l1.textContent = `${val}mm`;
    if (l2) l2.textContent = `${val}mm`;

    applyFrameInsetToAllSheets();
}

function applyFrameInsetToAllSheets() {
    document.documentElement.style.setProperty('--frame-inset', activeFrameInset);
}

function applyWatermarkSettings() {
    const text = document.getElementById("wmTextInput")?.value.trim() || watermarkConfig.text;
    watermarkConfig.text = text;

    document.querySelectorAll(".watermark-layer").forEach(layer => {
        layer.textContent = text;
        layer.style.opacity = watermarkConfig.opacity;
        layer.style.color = watermarkConfig.color;
        layer.style.transform = `rotate(${watermarkConfig.angle})`;
    });
}


// تطبيق إعدادات خلفية الورقة ومسح الصورة فوراً إذا تم اختيار لون أو إزالتها
function applySheetBgSettings() {
    const color = document.getElementById('sheetBgColorInput')?.value || sheetBgConfig.color;
    sheetBgConfig.color = color;

    document.querySelectorAll('.sheet-bg-layer').forEach(layer => {
        if (sheetBgConfig.type === 'color' || !sheetBgConfig.imageUrl) {
            // إزالة وتفريغ مسار الصورة بالكامل
            layer.style.backgroundImage = 'none';
            layer.style.backgroundColor = color;
        } else if (sheetBgConfig.type === 'image' && sheetBgConfig.imageUrl) {
            layer.style.backgroundImage = `url('${sheetBgConfig.imageUrl}')`;
            layer.style.backgroundColor = 'transparent';
        }
    });

    // إظهار أو إخفاء زر الحذف بناءً على وجود صورة من عدمها
    const removeBtn = document.getElementById('removeBgImgBtn');
    if (removeBtn) {
        removeBtn.style.display = (sheetBgConfig.type === 'image' && sheetBgConfig.imageUrl) ? 'inline-flex' : 'none';
    }
}

// التبديل بين نوع الخلفية (لون / صورة)
function handleSheetBgTypeChange(val) {
    sheetBgConfig.type = val;
    const picker = document.getElementById('bgColPickerWrap');
    if (picker) picker.style.display = val === 'color' ? 'block' : 'none';
    applySheetBgSettings();
}

// رفع صورة جديدة للخلفية
function handleSheetBgImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        recordUndoState();
        sheetBgConfig.imageUrl = e.target.result;
        sheetBgConfig.type = 'image';
        
        const typeSelect = document.getElementById('sheetBgTypeSelect');
        if (typeSelect) typeSelect.value = 'image';
        
        const picker = document.getElementById('bgColPickerWrap');
        if (picker) picker.style.display = 'none';

        applySheetBgSettings();
        if (typeof SoundFX !== 'undefined') SoundFX.success();
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

// الدالة الجديدة: إزالة صورة الخلفية وتفريغها نهائياً
function removeSheetBgImage() {
    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.trash();

    // تفريغ مسار الصورة وإعادة النمط إلى لون عادي
    sheetBgConfig.imageUrl = '';
    sheetBgConfig.type = 'color';

    // إعادة ضبط القائمة المنسدلة في الإعدادات
    const typeSelect = document.getElementById('sheetBgTypeSelect');
    if (typeSelect) typeSelect.value = 'color';

    const picker = document.getElementById('bgColPickerWrap');
    if (picker) picker.style.display = 'block';

    // تطبيق التغييرات فوراً على جميع الصفحات
    applySheetBgSettings();

    if (typeof UIEffects !== 'undefined') {
        UIEffects.showToast("تم حذف صورة الخلفية واستعادة اللون الأبيض بنجاح", "info");
    }
}



function toggleSettingsModal() {
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const modal = document.getElementById("settingsModal");
    if (modal) {
        modal.classList.toggle("active");
        if (modal.classList.contains("active")) {
            // التبديل تلقائياً للتبويب الأول عند الفتح
            switchSettingsTab('general');
        }
    }
}

// 1. تصحيح أزرار موضع الشريط وتلوين الزر المختار فوراً
function setToolbarPosition(pos) {
    document.body.classList.remove('pos-top', 'pos-right', 'pos-left');
    document.body.classList.add(`pos-${pos}`);
    localStorage.setItem('exambuilder_toolbar_pos', pos);

    // تلوين الزر المضغوط وإلغاء اللون عن الأزرار الأخرى داخل الإعدادات
    const btns = document.querySelectorAll('#stab-general .field-row:nth-child(2) .segmented-btns button');
    btns.forEach(btn => {
        const isTarget = btn.getAttribute('onclick')?.includes(pos);
        btn.classList.toggle('active', !!isTarget);
    });

    setTimeout(() => {
        if (typeof autoScaleStageToScreen === 'function') autoScaleStageToScreen();
    }, 60);
}


// 1. تصحيح الوضع اللوني وتغيير تفعيل الزر فوراً في الشريط العلوي ونافذة الإعدادات
function setThemeMode(mode) {
    if (mode !== 'light' && mode !== 'dark') mode = 'dark';
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode;
    try { localStorage.setItem('examy_theme_mode', mode); } catch (e) {}
    document.querySelectorAll('.segmented-btns button').forEach(btn => {
        const action = btn.getAttribute('onclick') || '';
        const active = action.includes("'" + mode + "'");
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (typeof SoundFX !== 'undefined') SoundFX.click();
}

// 2. تطبيق وتغيير الخط العام فوراً على كافة نصوص ورقة الامتحان
function changeDocFont(fontFamily) {
    const stage = document.getElementById("sheetsWrapper");
    if (stage) {
        stage.style.fontFamily = fontFamily;
    }
    // حفظ الخط المفضل
    localStorage.setItem('examy_preferred_font', fontFamily);
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
}


function changeDocColor(color) {
    document.getElementById("sheetsWrapper").style.color = color;
}


function switchSettingsTab(tabName) {
    if (typeof SoundFX !== 'undefined') SoundFX.click();

    // إزالة التفعيل من جميع أزرار التبويبات
    document.querySelectorAll(".settings-sidebar-nav .s-tab-btn").forEach(b => {
        b.classList.remove("active");
    });

    // إخفاء جميع محتويات التبويبات
    document.querySelectorAll(".settings-content-area .stab-content").forEach(c => {
        c.classList.remove("active");
        c.style.display = "none";
    });

    // تفعيل الزر الذي تم النقر عليه
    if (event && event.currentTarget) {
        event.currentTarget.classList.add("active");
    } else {
        const targetBtn = document.querySelector(`.s-tab-btn[onclick*="${tabName}"]`);
        if (targetBtn) targetBtn.classList.add("active");
    }

    // إظهار المحتوى المطلوب
    const targetContent = document.getElementById(`stab-${tabName}`);
    if (targetContent) {
        targetContent.classList.add("active");
        targetContent.style.display = "block";
    }
}


async function openBankDialog() {
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    let bank = [];
    try {
        bank = await AppAPI.fetchBank(currentLang);
    } catch {
        bank = JSON.parse(localStorage.getItem(`exambuilder_bank_${currentLang}`) || '[]');
    }
    renderBankCards(bank);
    document.getElementById("bankModal").classList.add("active");
}

function closeBankDialog() {
    document.getElementById("bankModal").classList.remove("active");
}

function renderBankCards(items, filter = "") {
    const host = document.getElementById("bankCardsHost");
    if (!host) return;
    host.innerHTML = "";
    items.forEach(it => {
        if (filter && !it.title.toLowerCase().includes(filter.toLowerCase())) return;
        const box = document.createElement("div");
        box.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #cbd5e1;";
        box.innerHTML = `
            <div>
                <strong>${it.title}</strong>
                <small style="display:block; color:#64748b;">النوع: ${it.type} | الفئة: ${it.category || 'عام'}</small>
            </div>
            <button class="tool-btn btn-bank" onclick='createNewQuestion(${JSON.stringify(it)}); closeBankDialog();'>إدراج ➕</button>
        `;
        host.appendChild(box);
    });
}

function filterBankItems() {
    const val = document.getElementById("bankSearch").value;
    let bank = JSON.parse(localStorage.getItem(`exambuilder_bank_${currentLang}`) || '[]');
    renderBankCards(bank, val);
}

let activeArchiveTab = "full";
async function openArchiveDialog() {
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    document.getElementById("archiveModal").classList.add("active");
    await renderArchiveData();
}

function closeArchiveDialog() {
    document.getElementById("archiveModal").classList.remove("active");
}

async function switchArchiveTab(tab) {
    activeArchiveTab = tab;
    document.querySelectorAll(".archive-nav-tabs .tab-btn").forEach(b => b.classList.remove("active"));
    if (event && event.target) {
        event.target.classList.add("active");
    }
    const searchInput = document.getElementById("archiveSearch");
    if (searchInput) searchInput.value = "";
    await renderArchiveData();
}

function filterArchiveItems() {
    const query = document.getElementById("archiveSearch").value;
    renderArchiveData(query);
}







// 1. إلغاء أي نافذة confirm قديمة للاسترجاع تماماً
function initRecoveryCheck() {
    // تم حذف نافذة confirm المتسببة في المشكلة بالكامل
    // ونعتمد فقط على البطاقة الجانبية الهادئة بعد تحميل البرنامج
    setTimeout(() => {
        if (typeof checkAutoSaveRecoveryBanner === 'function') {
            checkAutoSaveRecoveryBanner();
        }
    }, 1500);
}

// 2. التحكم في الزووم بـ (Ctrl + عجلة الماوس) والتحريك الأفقي بـ (Alt + عجلة الماوس)
let currentZoomScale = 1;
window.addEventListener('wheel', (e) => {
    // زووم تكبير وتصغير الشاشة: Ctrl + Wheel
    if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        currentZoomScale = Math.min(2.5, Math.max(0.5, currentZoomScale + delta));
        applyWorkspaceZoom(currentZoomScale);
    }
    // تحريك يمين ويسار: Alt + Wheel
    else if (e.altKey) {
        e.preventDefault();
        const stage = document.getElementById('appStage');
        if (stage) stage.scrollLeft += (e.deltaY * 1.5);
    }
}, { passive: false });

function applyWorkspaceZoom(scale) {
    const wrapper = document.getElementById('sheetsWrapper');
    if (wrapper) {
        wrapper.style.transform = `scale(${scale})`;
        wrapper.style.transformOrigin = 'top center';
    }

    // إدارة ظهور الشاشة المصغرة (Minimap) عند الزووم أكثر من 140%
    const minimap = document.getElementById('zoomMinimap');
    if (minimap) {
        if (scale >= 1.4) {
            minimap.style.display = 'flex';
            updateMinimapPreview();
        } else {
            minimap.style.display = 'none';
        }
    }
}



// 1. حظر أي نافذة تأكيد confirm قديمة خاصة باسترجاع الجلسة نهائياً
const originalConfirm = window.confirm;
window.confirm = function(message) {
    if (message && (message.includes('جلسة عمل سابقة') || message.includes('انقطاع كهرباء') || message.includes('استعادتها'))) {
        return false; // رفض النافذة القديمة المزعجة تلقائياً
    }
    return originalConfirm(message);
};

// 2. تحديث وتفعيل شاشة المعاينة المصغرة الحية (Minimap)
function updateMinimapPreview() {
    const minimapHost = document.getElementById('minimapThumbContent');
    const firstSheet = document.querySelector('.a4-sheet');
    if (!minimapHost || !firstSheet) return;

    minimapHost.innerHTML = "";
    const clone = firstSheet.cloneNode(true);
    clone.style.transform = 'scale(0.18)';
    clone.style.transformOrigin = 'top left';
    clone.style.pointerEvents = 'none';
    clone.style.width = '794px';
    clone.style.height = '1123px';
    clone.style.position = 'absolute';
    clone.style.top = '0';
    clone.style.left = '0';
    
    // إزالة أزرار التحرير من المعاينة المصغرة
    clone.querySelectorAll('.hdr-action-bar, .del-note-btn, .page-break-indicator').forEach(x => x.remove());
    minimapHost.appendChild(clone);
}






function refreshSavedTemplatesDropdown() {
    const select = document.getElementById("savedTemplatesSelect");
    if (!select) return;

    select.innerHTML = "";

    let vault = [];
    try {
        vault = JSON.parse(localStorage.getItem('examy_templates_vault') || '[]');
    } catch (e) {
        vault = [];
    }

    if (vault.length === 0) {
        select.innerHTML = '<option value="">لا توجد نماذج محفوظة بعد</option>';
        return;
    }

    vault.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = `${t.name} - (${t.date})`;
        select.appendChild(opt);
    });
}

// 1. حفظ النموذج مع قراءة السمك والموقع الحقيقيين من الواجهة مباشرة
function executeSaveTemplateFromModal() {
    const input = document.getElementById('customTemplateNameInput');
    const name = input ? input.value.trim() : '';
    if (!name) return;

    recordUndoState();
    const stage = document.getElementById("sheetsWrapper");
    if (!stage) return;

    let vault = [];
    try {
        vault = JSON.parse(localStorage.getItem('examy_templates_vault') || '[]');
    } catch (e) { vault = []; }

    // قراءة القيم الحقيقية للسمك والموقع من عناصر التحكم الحالية
    const currentBorderSize = document.getElementById('borderSizeSlider')?.value || 12;
    const currentFrameInset = document.getElementById('frameInsetSlider')?.value || 12;
    const currentBorderShape = document.getElementById('settBorderShape')?.value || activeBorderSettings.shape || 'gradient';
    const currentBorderColor = document.getElementById('settBorderColor')?.value || activeBorderSettings.color || '#2563eb';

    const newTemplate = {
        id: 'TPL_' + Date.now(),
        name: name,
        date: new Date().toLocaleDateString('ar-IQ'),
        content: stage.innerHTML,
        // حفظ الإطار بدقة
        borderSettings: {
            shape: currentBorderShape,
            color: currentBorderColor,
            size: `${currentBorderSize}px`
        },
        frameInsetVal: parseInt(currentFrameInset) || 12,
        // حفظ العلامة والخلفية والورق
        watermark: typeof watermarkConfig !== 'undefined' ? JSON.parse(JSON.stringify(watermarkConfig)) : null,
        sheetBg: typeof sheetBgConfig !== 'undefined' ? JSON.parse(JSON.stringify(sheetBgConfig)) : null,
        paperSize: typeof currentPaperSize !== 'undefined' ? currentPaperSize : 'A4',
        bookletMode: typeof isBookletMode !== 'undefined' ? isBookletMode : false,
        numberSystem: typeof currentNumberSystem !== 'undefined' ? currentNumberSystem : 'ar',
        lang: typeof currentLang !== 'undefined' ? currentLang : 'ar'
    };

    vault = vault.filter(t => t.name !== name);
    vault.unshift(newTemplate);

    localStorage.setItem('examy_templates_vault', JSON.stringify(vault));
    loadTemplatesIntoSettingsUI();

    const modal = document.getElementById('saveTemplateCustomModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }

    if (typeof SoundFX !== 'undefined') SoundFX.success();
    if (typeof UIEffects !== 'undefined') {
        UIEffects.showToast(`تم حفظ النموذج "${name}" مع سمك وموقع الإطار بنجاح!`, "success", 3500);
    }
}

// 2. تطبيق واسترجاع الإطار وسمكه وموقعه فوراً على كل الصفحات
function loadSelectedTemplate() {
    const select = document.getElementById("savedTemplatesSelect");
    if (!select || !select.value) {
        alert("يرجى اختيار نموذج من القائمة أولاً!");
        return;
    }

    let vault = [];
    try {
        vault = JSON.parse(localStorage.getItem('examy_templates_vault') || '[]');
    } catch (e) { return; }

    const target = vault.find(t => t.id === select.value);
    if (!target) return;

    if (confirm(`هل تريد استرجاع النموذج "${target.name}" وتطبيق سمك وموقع الإطار؟`)) {
        recordUndoState();
        const stage = document.getElementById("sheetsWrapper");
        if (stage && target.content) {
            stage.innerHTML = target.content;
        }

        // 1. استرجاع وتطبيق سمك وشكل ولون الإطار
        if (target.borderSettings) {
            window.activeBorderSettings = {
                shape: target.borderSettings.shape || 'gradient',
                color: target.borderSettings.color || '#2563eb',
                size: target.borderSettings.size ? (String(target.borderSettings.size).includes('px') ? target.borderSettings.size : `${target.borderSettings.size}px`) : '12px'
            };

            const shapeSel = document.getElementById('settBorderShape');
            const colInput = document.getElementById('settBorderColor');
            const sizeSlider = document.getElementById('borderSizeSlider');
            const sizeLabel = document.getElementById('borderSizeLabel');

            if (shapeSel) shapeSel.value = activeBorderSettings.shape;
            if (colInput) colInput.value = activeBorderSettings.color;
            if (sizeSlider) {
                const numVal = parseInt(activeBorderSettings.size) || 12;
                sizeSlider.value = numVal;
                if (sizeLabel) sizeLabel.textContent = `${numVal}px`;
            }

            // فرض المتغيرات وتطبيقها فوراً على جميع الصفحات
            document.documentElement.style.setProperty('--sheet-border-size', activeBorderSettings.size);
            document.documentElement.style.setProperty('--sheet-border-color', activeBorderSettings.color);
            applyBorderToAllSheets();
        }

        // 2. استرجاع وتطبيق موقع الإطار (Inset)
        const insetVal = target.frameInsetVal || parseInt(target.frameInset) || 12;
        if (typeof syncFrameInset === 'function') {
            syncFrameInset(insetVal);
        } else {
            activeFrameInset = `${insetVal}mm`;
            document.documentElement.style.setProperty('--frame-inset', activeFrameInset);
            const slider = document.getElementById('frameInsetSlider');
            const label = document.getElementById('frameInsetLabel');
            if (slider) slider.value = insetVal;
            if (label) label.textContent = `${insetVal}mm`;
        }

        // 3. استرجاع العلامة المائية والخلفية وحجم الورق
        if (target.watermark) {
            window.watermarkConfig = target.watermark;
            const wmInp = document.getElementById('wmTextInput');
            const wmOp = document.getElementById('wmOpacitySlider');
            if (wmInp) wmInp.value = target.watermark.text || '';
            if (wmOp) wmOp.value = target.watermark.opacity || 0.08;
            if (typeof applyWatermarkSettings === 'function') applyWatermarkSettings();
        }

        if (target.sheetBg) {
            window.sheetBgConfig = target.sheetBg;
            const bgType = document.getElementById('sheetBgTypeSelect');
            const bgCol = document.getElementById('sheetBgColorInput');
            if (bgType) bgType.value = target.sheetBg.type || 'color';
            if (bgCol) bgCol.value = target.sheetBg.color || '#ffffff';
            if (typeof applySheetBgSettings === 'function') applySheetBgSettings();
        }

        if (target.paperSize && typeof handlePaperSizeChange === 'function') {
            handlePaperSizeChange(target.paperSize);
        }
        if (typeof target.bookletMode !== 'undefined' && typeof handleBookletToggle === 'function') {
            handleBookletToggle(target.bookletMode);
        }
        if (target.numberSystem && typeof changeNumberSystem === 'function') {
            changeNumberSystem(target.numberSystem);
        }

        // تحديث الورقة والعناصر
        if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
        if (typeof bindAllQuestionsInteractions === 'function') bindAllQuestionsInteractions();
        if (typeof updateUIIndicators === 'function') updateUIIndicators();
        if (typeof resetAllSheetsScroll === 'function') resetAllSheetsScroll();
        if (typeof toggleSettingsModal === 'function') toggleSettingsModal();

        if (typeof SoundFX !== 'undefined') SoundFX.success();
        if (typeof UIEffects !== 'undefined') {
            UIEffects.showToast(`تم استرجاع النموذج مع سمك وموقع الإطار بنجاح!`, "success", 3000);
        }
    }
}

// فتح نافذة حفظ النموذج المخصصة
function promptSaveCurrentAsTemplate() {
    const stage = document.getElementById("sheetsWrapper");
    if (!stage) return;

    const questions = stage.querySelectorAll('.question-container');
    if (questions.length === 0) {
        if (typeof UIEffects !== 'undefined') {
            UIEffects.showToast("يجب أن تحتوي الورقة على سؤال واحد على الأقل لحفظها كنموذج!", "error", 3500);
        } else {
            alert("يجب أن تحتوي الورقة على سؤال واحد على الأقل لحفظها كنموذج!");
        }
        return;
    }

    const modal = document.getElementById('saveTemplateCustomModal');
    const input = document.getElementById('customTemplateNameInput');
    if (modal && input) {
        input.value = `نموذج (${questions.length} أسئلة) - ${new Date().toLocaleDateString('ar-IQ')}`;
        modal.style.display = 'flex';
        modal.classList.add('active');
        input.focus();
    }
}



// تعبئة قائمة النماذج في الإعدادات
function loadTemplatesIntoSettingsUI() {
    const select = document.getElementById("savedTemplatesSelect");
    if (!select) return;

    select.innerHTML = "";

    let vault = [];
    try {
        vault = JSON.parse(localStorage.getItem('examy_templates_vault') || '[]');
    } catch (e) { vault = []; }

    if (vault.length === 0) {
        select.innerHTML = '<option value="">لا توجد نماذج محفوظة بعد</option>';
        return;
    }

    vault.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = `${t.name} - (${t.date})`;
        select.appendChild(opt);
    });
}


// حذف النموذج
function deleteSelectedTemplate() {
    const select = document.getElementById("savedTemplatesSelect");
    if (!select || !select.value) return;

    let vault = [];
    try {
        vault = JSON.parse(localStorage.getItem('examy_templates_vault') || '[]');
    } catch (e) { return; }

    const target = vault.find(t => t.id === select.value);
    const name = target ? target.name : '';

    vault = vault.filter(t => t.id !== select.value);
    localStorage.setItem('examy_templates_vault', JSON.stringify(vault));
    loadTemplatesIntoSettingsUI();
    if (typeof SoundFX !== 'undefined') SoundFX.trash();
    if (typeof UIEffects !== 'undefined') {
        UIEffects.showToast("تم حذف النموذج بنجاح", "info");
    }
}


document.addEventListener('DOMContentLoaded', () => {
    loadTemplatesIntoSettingsUI();
});


function loadDefaultTemplateIfAvailable() {
    const raw = localStorage.getItem('examy_default_user_template');
    if (!raw) return;
    try {
        applyTemplateData(JSON.parse(raw));
    } catch (e) {}
}

function applyTemplateData(t) {
    if (t.htmlPayload) document.getElementById("sheetsWrapper").innerHTML = t.htmlPayload;
    if (t.watermark) watermarkConfig = t.watermark;
    if (t.borderSettings) activeBorderSettings = t.borderSettings;
    if (t.frameInset) syncFrameInset(parseInt(t.frameInset) || 12);
    if (t.sheetBg) sheetBgConfig = t.sheetBg;
    if (t.paperSize && typeof handlePaperSizeChange === 'function') handlePaperSizeChange(t.paperSize);
    if (typeof t.bookletMode !== 'undefined' && typeof handleBookletToggle === 'function') handleBookletToggle(t.bookletMode);
    if (t.numberSystem && typeof changeNumberSystem === 'function') changeNumberSystem(t.numberSystem);

    if (t.headerDir && document.getElementById("profDirInput")) document.getElementById("profDirInput").value = t.headerDir;
    if (t.headerSchool && document.getElementById("profSchoolInput")) document.getElementById("profSchoolInput").value = t.headerSchool;

    applyBorderToAllSheets();
    applyFrameInsetToAllSheets();
    applyWatermarkSettings();
    applySheetBgSettings();
    if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
    rebindAllDraggables();
    if (typeof bindAllQuestionsInteractions === 'function') bindAllQuestionsInteractions();
    updateUIIndicators();
    resetAllSheetsScroll();
    autoScaleStageToScreen();
}

window.saveExamToDb = async function() {
    try {
        if (typeof SoundFX !== 'undefined' && SoundFX && typeof SoundFX.pop === 'function') {
            try { SoundFX.pop(); } catch(e) {}
        }
        
        const titleEl = document.querySelector(".main-title");
        const defaultTitle = titleEl ? titleEl.innerText.trim() : "اختبار جديد";
        const customExamName = prompt("اكتب اسماً لحفظ هذا الاختبار في الأرشيف:", defaultTitle);
        if (!customExamName || !customExamName.trim()) return;

        if (typeof recordUndoState === 'function') recordUndoState();
        if (typeof SoundFX !== 'undefined' && SoundFX.success) SoundFX.success();

        const sheetsWrapper = document.getElementById("sheetsWrapper");
        if (!sheetsWrapper) {
            alert("خطأ: لم يتم العثور على محتوى الصفحات للحفظ!");
            return;
        }

        const payload = sheetsWrapper.innerHTML;
        const record = {
            id: typeof examUid !== 'undefined' && examUid ? examUid : "EX-" + Math.floor(100000 + Math.random() * 900000),
            title: customExamName.trim(),
            date: new Date().toLocaleDateString('ar-IQ'),
            lang: typeof currentLang !== 'undefined' ? currentLang : 'ar',
            htmlPayload: payload,
            savedAt: new Date().toISOString()
        };

        let localArchive = [];
        try {
            const rawArchive = localStorage.getItem('examy_archive');
            if (rawArchive) {
                localArchive = JSON.parse(rawArchive);
                if (!Array.isArray(localArchive)) localArchive = [];
            }
        } catch (e) {
            localArchive = [];
        }

        const existingIndex = localArchive.findIndex(item => item.id === record.id);
        if (existingIndex !== -1) {
            localArchive[existingIndex] = record;
        } else {
            localArchive.unshift(record);
        }
        
        localStorage.setItem('examy_archive', JSON.stringify(localArchive));

        if (typeof UIEffects !== 'undefined' && UIEffects.showToast) {
            UIEffects.showToast(`تم حفظ [${record.title}] في الأرشيف بنجاح!`, 'success');
        } else {
            alert(`تم حفظ [${record.title}] في الأرشيف بنجاح!`);
        }
    } catch (err) {
        console.error("Save Exam Error:", err);
        alert("حدث خطأ أثناء حفظ الملف في الأرشيف: " + (err.message || "خطأ غير معروف"));
    }
};

async function renderArchiveData(filter = "") {
    const host = document.getElementById("archiveCardsHost");
    if (!host) return;
    host.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">جاري تحميل البيانات...</div>`;

    let items = [];

    if (activeArchiveTab === "full") {
        try { items = await AppAPI.fetchArchive(currentLang); } catch { items = []; }
        if (!items || items.length === 0) items = JSON.parse(localStorage.getItem('examy_archive') || '[]');

        const uniqueMap = new Map();
        items.forEach(it => {
            if (it && it.id && !uniqueMap.has(it.id)) uniqueMap.set(it.id, it);
        });
        items = Array.from(uniqueMap.values());

        host.innerHTML = "";
        const query = filter.trim().toLowerCase();
        const filtered = items.filter(it => !query || (it.id && it.id.toLowerCase().includes(query)) || (it.title && it.title.toLowerCase().includes(query)));

        if (filtered.length === 0) {
            host.innerHTML = `<div style="text-align:center; padding:35px 20px; color:#94a3b8;"><strong>لا توجد نماذج اختبار محفوظة</strong></div>`;
            return;
        }

        filtered.forEach(item => {
            const box = document.createElement("div");
            box.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:12px 16px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:8px;";
            box.innerHTML = `
                <div>
                    <strong style="color:#1e3a8a; font-size:15px;">${item.title || 'اختبار بدون عنوان'}</strong>
                    <div style="font-size:12px; color:#64748b; margin-top:3px;">المعرف: <b>${item.id}</b> | التاريخ: ${item.date || '--'}</div>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="tool-btn" style="background:#0284c7;" onclick='renameExamInArchive("${item.id}")' title="تغيير اسم الملف">✏️ تسمية</button>
                    <button class="tool-btn btn-preview" onclick='loadExamFromArchive("${item.id}")'>استرجاع 📥</button>
                    <button class="tool-btn" style="background:#ef4444;" onclick='deleteExamFromArchive("${item.id}")'>حذف 🗑️</button>
                </div>
            `;
            host.appendChild(box);
        });

    } else {
        try { items = await AppAPI.fetchBank(currentLang); } catch { items = []; }
        if (!items || items.length === 0) items = JSON.parse(localStorage.getItem(`exambuilder_bank_${currentLang}`) || '[]');

        host.innerHTML = "";
        const query = filter.trim().toLowerCase();
        const filtered = items.filter(it => !query || (it.title && it.title.toLowerCase().includes(query)) || (it.category && it.category.toLowerCase().includes(query)));

        if (filtered.length === 0) {
            host.innerHTML = `<div style="text-align:center; padding:35px 20px; color:#94a3b8;"><strong>لا توجد أسئلة فردية في هذا البنك</strong></div>`;
            return;
        }

        filtered.forEach(it => {
            const box = document.createElement("div");
            box.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:12px 16px; border-radius:8px; border:1px solid #cbd5e1; margin-bottom:8px;";
            box.innerHTML = `
                <div>
                    <strong style="color:#0f172a; font-size:14px;">${it.title}</strong>
                    <div style="font-size:12px; color:#64748b; margin-top:3px;">النوع: ${it.type} | الفئة: ${it.category || 'عام'}</div>
                </div>
                <button class="tool-btn btn-bank" onclick='createNewQuestion(${JSON.stringify(it)}); closeArchiveDialog();'>إدراج ➕</button>
            `;
            host.appendChild(box);
        });
    }
}

function renameExamInArchive(id) {
    let localArchive = JSON.parse(localStorage.getItem('examy_archive') || '[]');
    const target = localArchive.find(x => x.id === id);
    if (!target) return;

    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const newName = prompt("اكتب الاسم الجديد للاختبار:", target.title);
    if (!newName || !newName.trim() || newName.trim() === target.title) return;

    target.title = newName.trim();
    localStorage.setItem('examy_archive', JSON.stringify(localArchive));
    renderArchiveData(document.getElementById("archiveSearch")?.value || "");
}

function loadExamFromArchive(id) {
    const list = JSON.parse(localStorage.getItem('examy_archive') || '[]');
    const target = list.find(x => x.id === id);
    if (target) {
        if (typeof SoundFX !== 'undefined') SoundFX.success();
        document.getElementById("sheetsWrapper").innerHTML = target.htmlPayload;
        examUid = target.id;
        document.getElementById("examIdSpan").textContent = examUid;
        if (typeof restoreUIStateAfterDomUpdate === 'function') restoreUIStateAfterDomUpdate();
        closeArchiveDialog();
    }
}

async function deleteExamFromArchive(id) {
    if (!confirm("هل أنت متأكد من حذف هذا النموذج نهائياً؟")) return;
    if (typeof SoundFX !== 'undefined') SoundFX.trash();
    let localArchive = JSON.parse(localStorage.getItem('examy_archive') || '[]');
    localArchive = localArchive.filter(x => x.id !== id);
    localStorage.setItem('examy_archive', JSON.stringify(localArchive));
    await renderArchiveData(document.getElementById("archiveSearch")?.value || "");
}

function openQrModal() {
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const box = document.getElementById("qrCodeContainer");
    box.innerHTML = "";
    new QRCode(box, {
        text: window.location.href + "?id=" + examUid,
        width: 140,
        height: 140
    });
    document.getElementById("qrModal").classList.add("active");
}

function closeQrModal() {
    document.getElementById("qrModal").classList.remove("active");
}

function insertQrToActiveSheet() {
    const img = document.querySelector("#qrCodeContainer img");
    if (img && img.src) {
        createDraggableElement('image', img.src);
        closeQrModal();
    }
}


function insertFloatingImage(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(ev) {
        createDraggableElement('image', ev.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

// إنشاء وتثبيت الستيكر بشكل مستقل فوق الورقة بحجم مثالي وقابلية حركة حرة
function createDraggableElement(type, src = '') {
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();

    let targetSheet = (typeof getActiveSheet === 'function') ? getActiveSheet() : null;
    if (!targetSheet) targetSheet = document.querySelector('.a4-sheet');
    if (!targetSheet) return;

    // نثبت الستيكر داخل frame-box ليكون فوق كامل محتويات الورقة
    const frameBox = targetSheet.querySelector('.sheet-frame-box') || targetSheet;
    frameBox.style.position = 'relative';

    const wrapper = document.createElement('div');
    wrapper.className = 'draggable-item';
    
    // إعطاء أبعاد افتراضية واضحة ومستقلة تمنع تشوه الصورة
    wrapper.style.cssText = `
        position: absolute !important;
        left: 80px;
        top: 180px;
        width: 170px;
        min-height: 80px;
        z-index: 5000;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        touch-action: none;
        user-select: none;
        background: transparent;
        padding: 4px;
        box-sizing: border-box;
    `;

    // 1. مقبض التحريك (أعلى اليمين)
    const move = document.createElement('div');
    move.className = 'drag-move-handle';
    move.innerHTML = '✥';
    move.title = 'اسحب لتحريك الستيكر في أي مكان على الورقة';
    move.style.cssText = `
        position: absolute;
        top: -10px;
        right: -10px;
        width: 22px;
        height: 22px;
        background: #0284c7;
        color: #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: move;
        font-size: 12px;
        font-weight: bold;
        z-index: 5010;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    `;
    wrapper.appendChild(move);

    // 2. زر الحذف (أعلى اليسار)
    const ctrl = document.createElement('div');
    ctrl.className = 'img-controls';
    ctrl.style.cssText = `position: absolute; top: -10px; left: -10px; z-index: 5010;`;
    
    const del = document.createElement('button');
    del.innerHTML = '✖';
    del.title = 'حذف الستيكر';
    del.style.cssText = `
        background: #ef4444;
        color: #fff;
        border: 1.5px solid #fff;
        border-radius: 50%;
        width: 22px;
        height: 22px;
        font-size: 11px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    `;
    del.onclick = (e) => {
        e.stopPropagation();
        if (typeof recordUndoState === 'function') recordUndoState();
        if (typeof SoundFX !== 'undefined') SoundFX.trash();
        wrapper.remove();
    };
    ctrl.appendChild(del);
    wrapper.appendChild(ctrl);

    // 3. مقبض تغيير الحجم (أسفل اليسار)
    const resize = document.createElement('div');
    resize.className = 'img-resize-handle';
    resize.innerHTML = '↘';
    resize.title = 'اسحب لتكبير وتصغير الستيكر';
    resize.style.cssText = `
        position: absolute;
        bottom: -8px;
        left: -8px;
        width: 20px;
        height: 20px;
        background: #0f172a;
        color: #fff;
        border: 1px solid #38bdf8;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: se-resize;
        font-size: 11px;
        z-index: 5010;
    `;
    wrapper.appendChild(resize);

    // 4. عنصر الصورة الفعلي
    if (type === 'image' && src) {
        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = `
            width: 100%;
            height: auto;
            max-height: 100%;
            object-fit: contain;
            display: block;
            pointer-events: none;
            -webkit-user-drag: none;
        `;
        wrapper.appendChild(img);
    }

    frameBox.appendChild(wrapper);
    bindDraggableEvents(wrapper, move, resize);

    if (typeof UIEffects !== 'undefined') {
        UIEffects.showToast("تم إدراج الستيكر بنجاح! يمكنك سحبه وتكبيره بحرية", "success", 2500);
    }
}



function rebindAllDraggables() {
    document.querySelectorAll('.draggable-item').forEach(w => {
        const move = w.querySelector('.drag-move-handle');
        const resize = w.querySelector('.img-resize-handle');
        bindDraggableEvents(w, move, resize);
    });
}

function bindDraggableEvents(wrap, moveBtn, resizeBtn) {
    let isMoving = false, isResizing = false;
    let startX, startY, startLeft, startTop, startW, startH;

    if (moveBtn) {
        moveBtn.onmousedown = function(e) {
            e.preventDefault();
            e.stopPropagation();
            isMoving = true;
            startX = e.clientX;
            startY = e.clientY;
            startLeft = wrap.offsetLeft;
            startTop = wrap.offsetTop;

            function onMouseMove(ev) {
                if (!isMoving) return;
                wrap.style.left = (startLeft + (ev.clientX - startX)) + 'px';
                wrap.style.top = (startTop + (ev.clientY - startY)) + 'px';
            }

            function onMouseUp() {
                isMoving = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
    }

    if (resizeBtn) {
        resizeBtn.onmousedown = function(e) {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startW = wrap.offsetWidth;

            function onMouseMove(ev) {
                if (!isResizing) return;
                const newWidth = Math.max(40, startW + (ev.clientX - startX));
                const img = wrap.querySelector('img');
                if (img) img.style.width = newWidth + 'px';
                wrap.style.width = newWidth + 'px';
            }

            function onMouseUp() {
                isResizing = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
    }
}

async function exportDirectPNG() {
    if (typeof SoundFX !== 'undefined') SoundFX.success();
    const sheets = document.querySelectorAll("#sheetsWrapper .a4-sheet");
    alert("جاري تحويل صفحات الاختبار إلى صور عالية الدقة...");

    for (let i = 0; i < sheets.length; i++) {
        const canvas = await html2canvas(sheets[i], { scale: 2, useCORS: true });
        const link = document.createElement('a');
        link.download = `Exam_Page_${i + 1}_${examUid}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
}

// تصدير حزمة احتياطية كاملة (Backup Package)
function exportFullBackupZip() {
    if (typeof SoundFX !== 'undefined') SoundFX.success();
    const fullArchive = localStorage.getItem('examy_archive') || '[]';
    const templates = localStorage.getItem('examy_custom_templates') || '[]';
    const bankAr = localStorage.getItem('exambuilder_bank_ar') || '[]';
    const bankEn = localStorage.getItem('exambuilder_bank_en') || '[]';

    const backupPackage = {
        app: "Examy PRO",
        exportedAt: new Date().toISOString(),
        archive: JSON.parse(fullArchive),
        templates: JSON.parse(templates),
        bank_ar: JSON.parse(bankAr),
        bank_en: JSON.parse(bankEn)
    };

    const blob = new Blob([JSON.stringify(backupPackage, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Examy_PRO_Full_Backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportExamFile() {
    if (typeof SoundFX !== 'undefined') SoundFX.success();
    const examPackage = {
        meta: {
            id: examUid,
            title: document.querySelector(".main-title")?.innerText || "اختبار جديد",
            date: new Date().toISOString(),
            lang: currentLang,
            numberSystem: currentNumberSystem,
            watermark: watermarkConfig,
            borderSettings: activeBorderSettings,
            frameInset: activeFrameInset,
            sheetBg: sheetBgConfig,
            paperSize: currentPaperSize,
            bookletMode: isBookletMode
        },
        payloadHtml: document.getElementById("sheetsWrapper").innerHTML
    };

    const blob = new Blob([JSON.stringify(examPackage, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${examPackage.meta.title}_${examUid}.exam`;
    a.click();
    URL.revokeObjectURL(a.href);
}

function handleImportExamFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const pkg = JSON.parse(e.target.result);
            if (!pkg.payloadHtml) throw new Error();

            recordUndoState();
            if (typeof SoundFX !== 'undefined') SoundFX.success();

            document.getElementById("sheetsWrapper").innerHTML = pkg.payloadHtml;
            examUid = pkg.meta.id || examUid;
            document.getElementById("examIdSpan").textContent = examUid;

            if (pkg.meta.watermark) watermarkConfig = pkg.meta.watermark;
            if (pkg.meta.borderSettings) activeBorderSettings = pkg.meta.borderSettings;
            if (pkg.meta.sheetBg) sheetBgConfig = pkg.meta.sheetBg;
            if (pkg.meta.numberSystem) changeNumberSystem(pkg.meta.numberSystem);
            if (pkg.meta.paperSize) handlePaperSizeChange(pkg.meta.paperSize);
            if (typeof pkg.meta.bookletMode !== 'undefined') handleBookletToggle(pkg.meta.bookletMode);

            if (typeof restoreUIStateAfterDomUpdate === 'function') restoreUIStateAfterDomUpdate();
            alert("تم استيراد ملف الاختبار بنجاح!");
        } catch {
            alert("عذراً، ملف الاختبار غير صالح أو تالف!");
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}
// متغير لحفظ التحديد قبل النقر على أزرار لوحة الألوان
let savedTextSelectionRange = null;

function saveCurrentSelectionRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
        savedTextSelectionRange = sel.getRangeAt(0).cloneRange();
    }
}

function restoreCurrentSelectionRange() {
    if (savedTextSelectionRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedTextSelectionRange);
    }
}

// فتح وإغلاق لوحة ألوان التظليل
function toggleHighlightPalette(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    saveCurrentSelectionRange();
    const pop = document.getElementById("highlightColorPalette");
    if (!pop) return;
    pop.style.display = (pop.style.display === "flex") ? "none" : "flex";
}

// تطبيق لون التظليل على النص المحدد
function applyTextHighlight(color) {
    restoreCurrentSelectionRange();
    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.click();

    // إغلاق لوحة الألوان
    const pop = document.getElementById("highlightColorPalette");
    if (pop) pop.style.display = "none";

    // تحديث مؤشر اللون المختار في الزر
    const indicator = document.getElementById("currentHighlightIndicator");
    if (indicator) {
        indicator.style.backgroundColor = (color === 'transparent') ? '#cbd5e1' : color;
    }

    // تطبيق خلفية اللون
    if (color === 'transparent') {
        document.execCommand('hiliteColor', false, 'transparent');
        document.execCommand('backColor', false, 'transparent');
    } else {
        document.execCommand('hiliteColor', false, color);
    }

    // حفظ التغيير وضمان استقرار شريط التنسيق
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    const bar = document.getElementById("inlineTextFormatter");
    if (bar) bar.classList.remove("active");
}

// حفظ موضع التحديد عند تحريك الفأرة أو رفع اليد عنها داخل نصوص الأسئلة
document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
        saveCurrentSelectionRange();
    }
});

// إغلاق لوحة الألوان عند النقر في أي مكان خارجها
document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.highlight-picker-wrap')) {
        const pop = document.getElementById("highlightColorPalette");
        if (pop) pop.style.display = "none";
    }
});
// تطبيق وتحديد مقياس واجهة البرنامج والتعرف التلقائي على أبعاد الشاشة

let isApplyingScale = false;
let lastAppliedScale = 1.0;

function applyGlobalUiScale(val) {
    if (isApplyingScale) return; // منع التكرار اللانهائي نهائياً
    isApplyingScale = true;

    let targetScale = 1.0;

 if (val === 'auto') {
        const screenW = window.screen.width;
        // الشاشات القياسية والصغيرة 1366 وما دون تأخذ 75% فوراً
        if (screenW <= 1366) {
            targetScale = 0.75;
        } else if (screenW <= 1500) {
            targetScale = 0.85;
        } else if (screenW <= 1680) {
            targetScale = 0.90;
        } else {
            targetScale = 1.0;
        }
        localStorage.setItem('examy_ui_scale_pref', 'auto');
    } else {
        targetScale = parseFloat(val) || 1.0;
        localStorage.setItem('examy_ui_scale_pref', String(val));
    }

    // إذا كان المقياس هو نفسه المطبق حالياً، نلغي التنفيذ فوراً لمنع الاهتزاز
    if (Math.abs(lastAppliedScale - targetScale) < 0.01) {
        isApplyingScale = false;
        return;
    }

    lastAppliedScale = targetScale;

    // تطبيق المقياس عبر محرك Electron أو الـ zoom مرة واحدة فقط وبثبات
    if (window.examy) {
        window.examy.setZoomFactor(targetScale).then(r => { if (!r?.success) document.body.style.zoom = targetScale; }).catch(() => { document.body.style.zoom = targetScale; });
    } else {
        document.body.style.zoom = targetScale;
    }

    const sel = document.getElementById('uiScaleSelect');
    const stored = localStorage.getItem('examy_ui_scale_pref') || 'auto';
    if (sel && sel.value !== stored) {
        sel.value = stored;
    }

    setTimeout(() => {
        isApplyingScale = false;
    }, 200);
}

// الاستماع لملفات .exam التي يتم فتحها بالنقر المزدوج
if (window.examy) {
    try {
        window.examy.onOpenExam((jsonRaw) => {
            try {
                const pkg = JSON.parse(jsonRaw);
                if (pkg.payloadHtml) {
                    recordUndoState();
                    document.getElementById("sheetsWrapper").innerHTML = pkg.payloadHtml;
                    if (pkg.meta) {
                        examUid = pkg.meta.id || examUid;
                        document.getElementById("examIdSpan").textContent = examUid;
                        if (pkg.meta.borderSettings) activeBorderSettings = pkg.meta.borderSettings;
                        if (pkg.meta.frameInset) syncFrameInset(parseInt(pkg.meta.frameInset) || 12);
                        if (pkg.meta.watermark) watermarkConfig = pkg.meta.watermark;
                        if (pkg.meta.sheetBg) sheetBgConfig = pkg.meta.sheetBg;
                    }
                    applyBorderToAllSheets();
                    applyWatermarkSettings();
                    applySheetBgSettings();
                    if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
                    if (typeof updateUIIndicators === 'function') updateUIIndicators();
                    if (typeof SoundFX !== 'undefined') SoundFX.success();
                    if (typeof UIEffects !== 'undefined') {
                        UIEffects.showToast("تم فتح ملف الاختبار بنجاح!", "success", 3000);
                    }
                }
            } catch (e) {
                console.error("فشل استيراد الملف التلقائي:", e);
            }
        });
    } catch (e) {}
}
// تشغيل الفحص الذكي عند بدء التطبيق وتغيير حجم النافذة
window.addEventListener('DOMContentLoaded', () => {
    const savedScale = localStorage.getItem('examy_ui_scale_pref') || 'auto';
    applyGlobalUiScale(savedScale);
});

// دالة تصحيح وإظهار القوائم المنسدلة كـ Popups عائمة ومنفصلة تماماً
function toggleDropdown(dropdownId, event) {
    event.stopPropagation();
    const targetDropdown = document.getElementById(dropdownId);
    if (!targetDropdown) return;
    
    // إغلاق أي قوائم أخرى مفتوحة
    document.querySelectorAll('.dropdown-content-pane').forEach(pane => {
        if (pane.id !== dropdownId) pane.classList.remove('active');
    });
    
    // تبديل حالة القائمة الحالية
    const isActive = targetDropdown.classList.contains('active');
    if (isActive) {
        targetDropdown.classList.remove('active');
    } else {
        // حساب مكان الزر لإظهار القائمة تحته بدقة وفوق كل العناصر
        const rect = event.currentTarget.getBoundingClientRect();
        targetDropdown.style.position = 'fixed';
        targetDropdown.style.top = (rect.bottom + 8) + 'px';
        targetDropdown.style.right = (window.innerWidth - rect.right) + 'px';
        targetDropdown.style.left = 'auto';
        targetDropdown.classList.add('active');
    }
}

// إغلاق القوائم عند النقر خارجها
document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-content-pane') && !e.target.closest('[onclick*="toggleDropdown"]')) {
        document.querySelectorAll('.dropdown-content-pane').forEach(pane => pane.classList.remove('active'));
    }
});

// دالة تفعيل وعرض شريط التحكم الجانبي للسؤال عند النقر عليه
function activateQuestionCard(cardElement) {
    // إزالة التفعيل عن باقي الأسئلة
    document.querySelectorAll('.question-container').forEach(q => q.classList.remove('is-active'));
    
    // تفعيل السؤال الحالي
    cardElement.classList.add('is-active');
    window.activeQuestionCard = cardElement;
    
    // إظهار لوحة التحكم الجانبية (Side HUD Panel) بوضع النشاط
    const sidePanel = document.getElementById('questionSidePanel');
    if (sidePanel) {
        sidePanel.classList.add('active');
    }
}

// ربط النقر على أي سؤال بتفعيل الشريط الجانبي تلقائياً
document.addEventListener('click', (e) => {
    const card = e.target.closest('.question-container');
    if (card) {
        activateQuestionCard(card);
    }
});

// ==========================================================================
// محرك التبديل السريع بين تبويبات الشريط (Ribbon Tab Switching Engine)
// ==========================================================================

window.toggleDropdown = function(id, event) {
    try {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        const targetPane = document.getElementById(id);
        if (!targetPane) return;
        const wasOpen = targetPane.classList.contains('active');
        document.querySelectorAll('.dropdown-content-pane').forEach(pane => {
            pane.classList.remove('active', 'floating-dropdown');
            pane.style.display = 'none';
            ['top', 'left', 'right', 'position', 'max-height', 'overflow-y', 'width', 'max-width', 'visibility'].forEach(prop => pane.style.removeProperty(prop));
        });
        if (wasOpen) return;
        const trigger = event && (event.currentTarget || (event.target && event.target.closest('button')));
        targetPane.classList.add('active', 'floating-dropdown');
        targetPane.style.display = 'flex';
        targetPane.style.position = 'fixed';
        targetPane.style.zIndex = '2147483000';
        targetPane.style.maxHeight = 'min(72vh, 620px)';
        targetPane.style.overflowY = 'auto';
        targetPane.style.width = 'max-content';
        targetPane.style.maxWidth = 'min(440px, calc(100vw - 24px))';
        targetPane.style.visibility = 'hidden';
        requestAnimationFrame(() => {
            if (!targetPane.classList.contains('active')) return;
            const rect = trigger && trigger.getBoundingClientRect ? trigger.getBoundingClientRect() : null;
            const margin = 12;
            const paneRect = targetPane.getBoundingClientRect();
            const paneWidth = Math.min(paneRect.width || 320, window.innerWidth - margin * 2);
            const paneHeight = Math.min(targetPane.scrollHeight || paneRect.height || 360, window.innerHeight * 0.72);
            let left = rect ? rect.left : window.innerWidth - paneWidth - margin;
            left = Math.max(margin, Math.min(left, window.innerWidth - paneWidth - margin));
            let top = rect ? rect.bottom + 7 : 120;
            if (top + paneHeight > window.innerHeight - margin && rect) top = Math.max(margin, rect.top - paneHeight - 7);
            targetPane.style.setProperty('left', `${Math.round(left)}px`, 'important');
            targetPane.style.setProperty('right', 'auto', 'important');
            targetPane.style.setProperty('top', `${Math.round(top)}px`, 'important');
            targetPane.style.visibility = 'visible';
        });
    } catch (err) { console.error('Dropdown positioning error:', err); }
};

// الدالة المحصنة كلياً للتبديل بين التبويبات وضمان عملها 100%
window.switchRibbonTab = function(tabKey, btnElement) {
    try {
        if (typeof SoundFX !== 'undefined' && SoundFX && typeof SoundFX.click === 'function') {
            try { SoundFX.click(); } catch(e) {}
        }

        // إزالة التنشيط عن جميع أزرار التبويبات وتفعيل الزر الحالي
        document.querySelectorAll('.r-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        if (btnElement) {
            btnElement.classList.add('active');
        } else {
            const fallbackBtn = document.querySelector(`.r-tab-btn[onclick*="${tabKey}"]`);
            if (fallbackBtn) fallbackBtn.classList.add('active');
        }

        // إخفاء جميع لوحات التبويبات تماماً
        document.querySelectorAll('.ribbon-tab-panel').forEach(panel => {
            panel.classList.remove('active');
            panel.style.display = 'none';
        });

        // إظهار اللوحة المستهدفة فوراً
        const targetPanel = document.getElementById(`rtab-${tabKey}`);
        if (targetPanel) {
            targetPanel.style.display = 'flex';
            targetPanel.classList.add('active');
        }

        // إغلاق أي قوائم منسدلة عائمة قديمة لمنع أي تداخل
        document.querySelectorAll('.dropdown-content-pane').forEach(p => {
            p.classList.remove('active');
            p.style.display = 'none';
        });

    } catch (err) {
        console.error("Safe Ribbon Tab Switch Error:", err);
    }
};

// ==========================================================================
// محرك التبويبات المستقل والمحصن نهائياً
// ==========================================================================
document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.r-tab-btn');
    if (!tabBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const tabKey = tabBtn.getAttribute('data-tab');
    if (!tabKey) return;

    try {
        if (typeof SoundFX !== 'undefined' && SoundFX && typeof SoundFX.click === 'function') {
            try { SoundFX.click(); } catch(err) {}
        }

        // إزالة التنشيط عن جميع الأزرار وتفعيل الزر المضغوط
        document.querySelectorAll('.r-tab-btn').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');

        // إخفاء جميع اللوحات تماماً
        document.querySelectorAll('.ribbon-tab-panel').forEach(panel => {
            panel.classList.remove('active');
            panel.style.display = 'none';
        });

        // إظهار اللوحة المستهدفة فوراً
        const targetPanel = document.getElementById(`rtab-${tabKey}`);
        if (targetPanel) {
            targetPanel.style.display = 'flex';
            targetPanel.classList.add('active');
        }

        // إغلاق أي قوائم منسدلة
        document.querySelectorAll('.dropdown-content-pane').forEach(p => {
            p.classList.remove('active');
            p.style.display = 'none';
        });

    } catch (err) {
        console.error("Tab Navigation Error:", err);
    }
}, true);

// مزامنة شارة حجم الخط في تبويب الرئيسية عند التكبير والتصغير
const originalStepFontSize = window.stepFontSize;
window.stepFontSize = function(event, delta) {
    if (typeof originalStepFontSize === 'function') {
        originalStepFontSize(event, delta);
    }
    const ribbonBadge = document.getElementById('ribbonFontSizeDisplay');
    const floatingBadge = document.getElementById('fontSizeBadgeDisplay');
    if (ribbonBadge && floatingBadge) {
        ribbonBadge.textContent = floatingBadge.textContent;
    }
};

// ==========================================================================
// تحسين الأداء الصاروخي (Performance Boost via Debounce)
// إلغاء الفحص المتكرر أثناء كل حرف مدخل وتشغيله فقط عند استقرار الكتابة
// ==========================================================================
const originalCheckOverflow = window.checkExactSheetOverflow;

let overflowDebounceTimer = null;
   window.checkExactSheetOverflowDebounced = function(sheet) {
       clearTimeout(overflowDebounceTimer);
       overflowDebounceTimer = setTimeout(() => {
           if (typeof checkExactSheetOverflow === 'function') {
               checkExactSheetOverflow(sheet);
           }
       }, 300); // زيادة المدة لضمان أداء سلس وصاروخي
   };

// استبدال مستمع تغيير النصوص ليعمل عبر الديباونس المسرع
document.addEventListener('input', (e) => {
    if (e.target && e.target.isContentEditable) {
        const curSheet = e.target.closest('.a4-sheet') || (typeof getActiveSheet === 'function' ? getActiveSheet() : null);
        if (curSheet) checkExactSheetOverflowDebounced(curSheet);
    }
});
// مزامنة قائمة النماذج في الشريط العلوي تلقائياً

// مزامنة قائمة النماذج في الشريط العلوي تلقائياً
function syncRibbonTemplatesDropdown() {
    const ribbonSelect = document.getElementById("ribbonTemplatesSelect");
    if (!ribbonSelect) return;
    ribbonSelect.innerHTML = "";

    let vault = [];
    try {
        vault = JSON.parse(localStorage.getItem('examy_templates_vault') || '[]');
    } catch (e) { vault = []; }

    if (vault.length === 0) {
        ribbonSelect.innerHTML = '<option value="">لا توجد نماذج</option>';
        return;
    }

    vault.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.name;
        ribbonSelect.appendChild(opt);
    });
}

function loadRibbonSelectedTemplate() {
    const sel = document.getElementById("ribbonTemplatesSelect");
    const settingsSel = document.getElementById("savedTemplatesSelect");
    if (sel && settingsSel) {
        settingsSel.value = sel.value;
        loadSelectedTemplate();
    }
}

function deleteRibbonSelectedTemplate() {
    const sel = document.getElementById("ribbonTemplatesSelect");
    const settingsSel = document.getElementById("savedTemplatesSelect");
    if (sel && settingsSel) {
        settingsSel.value = sel.value;
        deleteSelectedTemplate();
        syncRibbonTemplatesDropdown();
    }
}

// تحديث القائمة فور فتح التطبيق
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(syncRibbonTemplatesDropdown, 1200);
});