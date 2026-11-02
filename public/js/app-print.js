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

                populatePrinterPaperSizes(savedPrinter || (res.printers.find(x => x.isDefault) || res.printers[0]).name);
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

function populatePrinterPaperSizes(printerName) {
    const prevSelect = document.getElementById("previewPaperSizeSelect");
    const settSelect = document.getElementById("settingsPaperSizeSelect");
    if (!prevSelect && !settSelect) return;

    const pr = systemPrintersList.find(p => p.name === printerName) || systemPrintersList[0];
let papers = (pr && pr.papers && pr.papers.length > 0) ? pr.papers : ['A4', 'A3', 'Letter', 'Legal', 'Executive', 'B5'];

    const fillOptions = (sel) => {
        if (!sel) return;
        sel.innerHTML = "";
        papers.forEach(pap => {
            const opt = document.createElement("option");
            opt.value = pap;
            opt.textContent = pap;
            if (pap.toLowerCase() === currentPaperSize.toLowerCase()) opt.selected = true;
            sel.appendChild(opt);
        });
    };

    fillOptions(prevSelect);
    fillOptions(settSelect);
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

    const printerName = (typeof selectedPrinter !== 'undefined' && selectedPrinter) 
        ? selectedPrinter 
        : (document.getElementById('printerSelect')?.value || '');

    const paperSize = (typeof activePaperSize !== 'undefined' && activePaperSize) 
        ? activePaperSize 
        : 'A4';

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

    const printerName = (typeof selectedPrinter !== 'undefined' && selectedPrinter) 
        ? selectedPrinter 
        : (document.getElementById('printerSelect')?.value || '');

    const paperSize = (typeof activePaperSize !== 'undefined' && activePaperSize) 
        ? activePaperSize 
        : 'A4';

    try {
        // إذا كان التطبيق يعمل داخل Electron
        if (window.examy) {
            const res = await window.examy.printSheetDirect({
                printerName: printerName,
                pageSize: paperSize,
                landscape: false
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
async function exportNativeVectorPDF() {
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    if (typeof UIEffects !== 'undefined') {
        UIEffects.showToast("جاري تجهيز وتصدير ملف PDF عالي الدقة...", "info", 3000);
    }

    try {
        if (window.examy) {
            const res = await window.examy.printToPdf({
                pageSize: (typeof activePaperSize !== 'undefined') ? activePaperSize : 'A4'
            });

            if (res && res.success) {
                if (typeof SoundFX !== 'undefined') SoundFX.success();
                if (typeof UIEffects !== 'undefined') {
                    UIEffects.showToast(`تم حفظ ملف PDF بنجاح في: ${res.filePath}`, "success", 4000);
                }
            } else if (!res.canceled) {
                throw new Error(res.error || "تعذر حفظ الملف");
            }
        } else {
            // خطة بديلة للمتصفح
            window.print();
        }
    } catch (e) {
        console.error("خطأ تصدير PDF:", e);
        if (typeof UIEffects !== 'undefined') {
            UIEffects.showToast("حدث خطأ أثناء تصدير PDF، تأكد من إعطاء إذن الحفظ", "error");
        }
    }
}

async function exportDirectPDF() {
       if (typeof SoundFX !== 'undefined') SoundFX.success();
       if (window.examy) {
           // استخدام محرك Electron الداخلي المتجهي (Vector PDF)
           const res = await window.examy.printToPdf({
               pageSize: currentPaperSize || 'A4',
               landscape: isBookletMode || currentPaperSize === 'A3'
           });
           if (res && res.success && typeof UIEffects !== 'undefined') {
               UIEffects.showToast("تم تصدير ملف PDF المتجهي بنجاح!", "success", 3500);
           }
       } else {
           window.print();
       }
   }