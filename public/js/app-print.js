/**
 * ExamBuilder Pro - إدارة الطابعات، المعاينة الحقيقية وتصدير الدفتر الامتحاني و PDF
 */

let systemPrintersList = [];

async function loadSystemPrintersToSettings() {
    const select = document.getElementById("printerSelect");
    if (!select) return;

    select.innerHTML = `<option value="">جاري فحص واكتشاف الطابعات...</option>`;

    if (ipcRenderer) {
        try {
            const res = await ipcRenderer.invoke('get-system-printers');
            if (res && res.success && res.printers && res.printers.length > 0) {
                systemPrintersList = res.printers;
                select.innerHTML = `<option value="">الطابعة الافتراضية للويندوز (System Default)</option>`;
                const savedPrinter = localStorage.getItem('exambuilder_default_printer') || '';

                res.printers.forEach(p => {
                    const opt = document.createElement("option");
                    opt.value = p.name;
                    opt.textContent = `${p.name} ${p.isDefault ? ' ⭐ (الافتراضية)' : ''}`;
                    if (savedPrinter === p.name || (!savedPrinter && p.isDefault)) {
                        opt.selected = true;
                    }
                    select.appendChild(opt);
                });

                const activePrinter = res.printers.find(x => x.name === savedPrinter) || res.printers.find(x => x.isDefault) || res.printers[0];
                if (activePrinter) {
                    select.value = activePrinter.name;
                    populatePrinterPaperSizes(activePrinter.name);
                }
            } else {
                select.innerHTML = `<option value="">لم يتم العثور على طابعات متصلة</option>`;
            }
        } catch (e) {
            select.innerHTML = `<option value="">تعذر قراءة الطابعات</option>`;
        }
    }
}

function handlePrinterChange(val) {
    localStorage.setItem('exambuilder_default_printer', val);
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    populatePrinterPaperSizes(val);
}

function normalizePrinterPaperSize(value) {
    const raw = String(value || '').trim().toLowerCase();
    const aliases = [
        ['A4', /(^|\b)a4(\b|$)/i], ['A3', /(^|\b)a3(\b|$)/i],
        ['A5', /(^|\b)a5(\b|$)/i], ['Letter', /letter/i], ['Legal', /legal/i],
        ['Tabloid', /tabloid|11\s*[x×]\s*17/i], ['Executive', /executive/i],
        ['B5', /(^|\b)b5(\b|$)/i]
    ];
    return aliases.find(([, pattern]) => pattern.test(raw))?.[0] || null;
}

function populatePrinterPaperSizes(printerName) {
    const selectors = ["ribbonPaperSizeSelect", "previewPaperSizeSelect", "settingsPaperSizeSelect", "examyPaperSize", "examyPreviewPaper"]
        .map(id => document.getElementById(id)).filter(Boolean);
    if (!selectors.length) return;
    const pr = systemPrintersList.find(p => p.name === printerName) || systemPrintersList[0];
    const driverPapers = pr && Array.isArray(pr.papers) ? pr.papers : [];
    const supported = [...new Set(driverPapers.map(normalizePrinterPaperSize).filter(Boolean))];
    const papers = supported.length ? supported : ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid', 'Executive', 'B5'];
    const wanted = papers.includes(currentPaperSize) ? currentPaperSize : (papers.includes('A4') ? 'A4' : papers[0]);
    selectors.forEach(sel => {
        sel.replaceChildren();
        papers.forEach(paper => {
            const option = document.createElement('option');
            option.value = paper; option.textContent = paper; sel.appendChild(option);
        });
        sel.value = wanted; sel.disabled = false;
    });
    if (wanted !== currentPaperSize && typeof handlePaperSizeChange === 'function') handlePaperSizeChange(wanted);
}

async function openSelectedPrinterProps() {
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const select = document.getElementById("printerSelect");
    const printerName = select ? select.value : '';

    if (!printerName) {
        alert("يرجى اختيار طابعة محددة من القائمة أولاً لفتح خصائصها.");
        return;
    }

    if (ipcRenderer) {
        const res = await ipcRenderer.invoke('open-printer-properties', printerName);
        if (!res.success) {
            alert("تعذر فتح خصائص الطابعة: " + (res.error || res.message));
        }
    }
}



// فتح نافذة تأكيد الطباعة أو الطباعة المباشرة
async function promptDirectPrint() {
    if (typeof SoundFX !== 'undefined') SoundFX.pop();

    const printerName = document.getElementById('printerSelect')?.value ||
        ((typeof selectedPrinter !== 'undefined' && selectedPrinter) ? selectedPrinter : (localStorage.getItem('exambuilder_default_printer') || ''));
    const paperSize = currentPaperSize || window.ExamyUltimate?.pageSettings?.size ||
        ((typeof activePaperSize !== 'undefined' && activePaperSize) ? activePaperSize : 'A4');

    // تحديث بيانات بطاقة التأكيد إن كانت معروضة
    const nameEl = document.getElementById('confirmPrinterName');
    const paperEl = document.getElementById('confirmPaperMode');
    if (nameEl) nameEl.textContent = printerName || 'طابعة النظام الافتراضية';
    if (paperEl) paperEl.textContent = `ورق قياسي ${paperSize}`;

    const confirmModal = document.getElementById('directPrintConfirmModal');
    if (confirmModal) {
        confirmModal.classList.add('active');
    } else {
        // تنفيذ فوري إذا لم يكن المودال موجوداً
        executeSilentDirectPrint();
    }
}

// تنفيذ أمر الطباعة الفعلي وإرساله إلى نظام التشغيل
async function executeSilentDirectPrint() {
    closePrintConfirmModal();
    if (typeof UIEffects !== 'undefined') {
        UIEffects.showToast("جاري إرسال الاختبار إلى الطابعة الآن...", "info", 3000);
    }

    const printerName = document.getElementById('printerSelect')?.value ||
        ((typeof selectedPrinter !== 'undefined' && selectedPrinter) ? selectedPrinter : (localStorage.getItem('exambuilder_default_printer') || ''));
    const paperSize = currentPaperSize || window.ExamyUltimate?.pageSettings?.size ||
        ((typeof activePaperSize !== 'undefined' && activePaperSize) ? activePaperSize : 'A4');

    try {
        // إذا كان التطبيق يعمل داخل Electron
        if (window.examy) {
            const res = await window.examy.printSheetDirect({
                printerName: printerName,
                pageSize: paperSize,
                landscape: (window.ExamyUltimate?.pageSettings?.orientation === 'landscape') || !!isBookletMode
            });

            if (res && res.success) {
                if (typeof SoundFX !== 'undefined') SoundFX.success();
                if (typeof UIEffects !== 'undefined') {
                    UIEffects.showToast("تم إرسال أمر الطباعة بنجاح!", "success", 3000);
                }
            } else {
                throw new Error(res ? res.error : "تعذر إرسال الأمر للطابعة");
            }
        } else {
            // كبديل قياسي للمتصفحات
            window.print();
        }
    } catch (err) {
        console.error("خطأ الطباعة:", err);
        // فتح حوار الطباعة الاعتيادي لويندوز كخطة طوارئ ناجحة 100%
        window.print();
    }
}

function closePrintConfirmModal() {
    const modal = document.getElementById('directPrintConfirmModal');
    if (modal) modal.classList.remove('active');
}




function closePrintPreview() {
    const modal = document.getElementById("printPreviewModal");
    if (modal) modal.classList.remove("active");
    document.body.classList.remove("in-preview");
}

function autoFitPreviewToScreen() {
    const viewport = document.querySelector(".preview-viewport-scroll");
    const host = document.getElementById("previewPagesHost");
    if (!viewport || !host) return;

    const availableHeight = viewport.clientHeight - 40;
    const standardSheetHeight = 1123;

    let scale = (availableHeight / standardSheetHeight);
    scale = Math.max(0.45, Math.min(0.95, scale));

    previewZoomScale = scale;
    applyPreviewZoom();
}

let previewZoomScale = 0.9;
function applyPreviewZoom() {
    const host = document.getElementById("previewPagesHost");
    const label = document.getElementById("previewZoomLabel");
    if (host) {
        host.style.transform = `scale(${previewZoomScale})`;
    }
    if (label) {
        label.textContent = `${Math.round(previewZoomScale * 100)}%`;
    }
}

function adjustPreviewZoom(delta) {
    previewZoomScale = Math.max(0.3, Math.min(1.4, previewZoomScale + delta));
    applyPreviewZoom();
}

// فتح المعاينة مع إخفاء خط نهاية الورقة وترقيم الصفحات تماماً
function openPrintPreview() {
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const modal = document.getElementById("printPreviewModal");
    const host = document.getElementById("previewPagesHost");
    if (!modal || !host) return;

    host.innerHTML = "";
    
    const sheets = document.querySelectorAll("#sheetsWrapper .a4-sheet");
    sheets.forEach(sheet => {
        const clone = sheet.cloneNode(true);
        clone.removeAttribute("id");
        clone.querySelectorAll("[contenteditable]").forEach(el => el.removeAttribute("contenteditable"));
        
        // إزالة خط نهاية حد الطباعة والمسطرة وأزرار التحكم وترقيم 1 من 1 نهائياً
        clone.querySelectorAll(".page-break-indicator, .sheet-ruler-corner, .hdr-action-bar, .del-note-btn, .table-quick-toolbar, .sheet-restore-header-bar").forEach(el => el.remove());
        
        host.appendChild(clone);
    });

    modal.classList.add("active");
    document.body.classList.add("in-preview");

    if (typeof autoFitPreviewToScreen === 'function') autoFitPreviewToScreen();
}

// تصدير PDF الاحترافي المباشر عبر Electron مع رسالة نجاح واضحة
async function exportExamDocumentPdf() {
    const body = document.body;
    const previousPreview = body.classList.contains('in-preview');
    const orientation = window.ExamyUltimate?.pageSettings?.orientation || 'portrait';
    const pageSize = currentPaperSize || window.ExamyUltimate?.pageSettings?.size || 'A4';
    body.classList.add('examy-document-export');
    body.classList.remove('in-preview');
    try {
        if (typeof window.flushExamAutoSave === 'function') window.flushExamAutoSave();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (document.fonts?.ready) await document.fonts.ready;
        if (window.examy && typeof window.examy.printToPdf === 'function') {
            const res = await window.examy.printToPdf({
                pageSize, landscape: orientation === 'landscape' || !!isBookletMode || (pageSize === 'A3' && !!isBookletMode),
                printerName: localStorage.getItem('exambuilder_default_printer') || ''
            });
            if (res?.success) {
                if (typeof SoundFX !== 'undefined') SoundFX.success();
                if (typeof UIEffects !== 'undefined') UIEffects.showToast('تم حفظ ورقة الاختبار فقط بصيغة PDF.', 'success', 3500);
            } else if (!res?.canceled) throw new Error(res?.error || 'تعذر حفظ ملف PDF.');
        } else {
            const restore = () => {
                body.classList.remove('examy-document-export');
                if (previousPreview) body.classList.add('in-preview');
                window.removeEventListener('afterprint', restore);
            };
            window.addEventListener('afterprint', restore, { once: true });
            window.print(); setTimeout(restore, 12000); return;
        }
    } catch (error) {
        console.error('PDF export failed:', error);
        if (typeof UIEffects !== 'undefined') UIEffects.showToast('تعذر تصدير ورقة الاختبار: ' + error.message, 'error', 4500);
        else alert('تعذر تصدير ورقة الاختبار: ' + error.message);
    } finally {
        body.classList.remove('examy-document-export');
        if (previousPreview) body.classList.add('in-preview');
    }
}
async function exportNativeVectorPDF() {
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    if (typeof UIEffects !== 'undefined') UIEffects.showToast('جاري تجهيز ورقة الاختبار فقط لتصدير PDF...', 'info', 2200);
    await exportExamDocumentPdf();
}
async function exportDirectPDF() { await exportExamDocumentPdf(); }