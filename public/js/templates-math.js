/**
 * ExamBuilder Pro - قوالب الرياضيات والفيزياء ومصمم الجداول التفاعلي
 */

let activePreviewCell = null;
let customCellColorsMap = {};
let activeSelectedTableCell = null;

// ==========================================================================
// 1. نظام مصمم الجداول الاحترافي المتقدم
// ==========================================================================

function openCustomTableModal() {
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    customCellColorsMap = {};
    activePreviewCell = null;
    const modal = document.getElementById("advancedTableModal");
    if (modal) modal.classList.add("active");
    renderTableLivePreview();
}

function closeAdvancedTableModal() {
    const modal = document.getElementById("advancedTableModal");
    if (modal) modal.classList.remove("active");
}

function renderTableLivePreview() {
    const rows = parseInt(document.getElementById("tblRowsInput")?.value) || 3;
    const cols = parseInt(document.getElementById("tblColsInput")?.value) || 4;
    const borderStyle = document.getElementById("tblBorderStyle")?.value || 'solid';
    const borderColor = document.getElementById("tblBorderColor")?.value || '#334155';
    const headerBg = document.getElementById("tblHeaderBg")?.value || '#f1f5f9';

    const host = document.getElementById("tableLivePreviewHost");
    if (!host) return;

    let thCells = "";
    for (let c = 0; c < cols; c++) {
        const cellId = `c-0-${c}`;
        const bg = customCellColorsMap[cellId] || headerBg;
        thCells += `<th id="${cellId}" style="background-color:${bg};" onclick="selectPreviewCell('${cellId}')">عنوان ${c + 1}</th>`;
    }

    let tbodyRows = "";
    for (let r = 1; r < rows; r++) {
        let tdCells = "";
        for (let c = 0; c < cols; c++) {
            const cellId = `c-${r}-${c}`;
            const bg = customCellColorsMap[cellId] || "#ffffff";
            tdCells += `<td id="${cellId}" style="background-color:${bg};" onclick="selectPreviewCell('${cellId}')">نص</td>`;
        }
        tbodyRows += `<tr>${tdCells}</tr>`;
    }

    let borderCss = `border: 1.5px ${borderStyle} ${borderColor};`;
    if (borderStyle === 'minimal') {
        borderCss = `border-top: 2px solid ${borderColor}; border-bottom: 2px solid ${borderColor};`;
    }

    host.innerHTML = `
        <table style="${borderCss}">
            <thead><tr>${thCells}</tr></thead>
            <tbody>${tbodyRows}</tbody>
        </table>
    `;

    host.querySelectorAll('th, td').forEach(cell => {
        if (borderStyle === 'minimal') {
            cell.style.borderBottom = `1px solid ${borderColor}`;
            cell.style.borderTop = `none`;
            cell.style.borderLeft = `none`;
            cell.style.borderRight = `none`;
        } else {
            cell.style.border = `1px ${borderStyle} ${borderColor}`;
        }
    });
}

function selectPreviewCell(cellId) {
    if (typeof SoundFX !== 'undefined') SoundFX.click();
    activePreviewCell = cellId;
    document.querySelectorAll('#tableLivePreviewHost th, #tableLivePreviewHost td').forEach(el => {
        el.style.outline = el.id === cellId ? "3px solid #0284c7" : "none";
    });
}

function applyColorToSelectedCell() {
    if (!activePreviewCell) {
        alert("يرجى الضغط على خلية أولاً داخل المعاينة لتحديدها ثم تلوينها!");
        return;
    }
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const color = document.getElementById("tblSelectedCellColor")?.value || "#e0f2fe";
    customCellColorsMap[activePreviewCell] = color;
    renderTableLivePreview();
    selectPreviewCell(activePreviewCell);
}

function insertConfiguredTableToExam() {
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.success();

    const host = document.getElementById("tableLivePreviewHost");
    const previewTable = host ? host.querySelector("table") : null;
    if (!previewTable) {
        alert("لم يتم العثور على الجدول داخل المعاينة!");
        return;
    }

    const finalTable = previewTable.cloneNode(true);
    finalTable.className = "custom-pro-table";
    finalTable.removeAttribute("id");

    finalTable.querySelectorAll("th, td").forEach(cell => {
        cell.removeAttribute("id");
        cell.removeAttribute("onclick");
        cell.style.outline = "none";
        cell.setAttribute("contenteditable", "true");
        cell.setAttribute("spellcheck", "false");
    });

    const tableId = "tbl_" + Date.now();
    const wrapperHtml = `
        <div class="custom-table-wrapper" id="${tableId}" onclick="handleTableSelection(event, this)">
            <div class="table-quick-toolbar" contenteditable="false">
                <span class="t-tool-btn t-drag-handle" title="اسحب لتحريك الجدول" onmousedown="enableTableDrag(this)">✥ تحريك</span>
                <button type="button" class="t-tool-btn" onclick="tableAddRow(this, 'above')" title="إضافة صف للأعلى">⬆ +صف</button>
                <button type="button" class="t-tool-btn" onclick="tableAddRow(this, 'below')" title="إضافة صف للأسفل">⬇ +صف</button>
                <button type="button" class="t-tool-btn" onclick="tableAddCol(this, 'left')" title="إضافة عمود">⬅ +عمود</button>
                <button type="button" class="t-tool-btn" onclick="tableAddCol(this, 'right')" title="إضافة عمود">➡ +عمود</button>
                <button type="button" class="t-tool-btn" onclick="tableDeleteCurrentRow(this)" title="حذف الصف">✖ صف</button>
                <button type="button" class="t-tool-btn" onclick="tableDeleteCurrentCol(this)" title="حذف العمود">✖ عمود</button>
                <input type="color" title="تلوين الخلية المحددة" onchange="tableColorActiveCell(this)" style="width:20px;height:20px;border:none;cursor:pointer;background:transparent;">
                <button type="button" class="t-tool-btn btn-del-tbl" onclick="tableRemoveEntire(this)" title="حذف الجدول بالكامل">🗑️ حذف</button>
            </div>
            <div style="overflow-x:auto;">
                ${finalTable.outerHTML}
            </div>
        </div><p><br></p>
    `;

    insertSafeHtml(wrapperHtml);
    closeAdvancedTableModal();

    if (typeof UIEffects !== 'undefined') {
        UIEffects.showToast("تم إدراج الجدول بنجاح في ورقة الامتحان!", "success");
    }
}

function insertSafeHtml(html) {
    let ok = false;
    const sel = window.getSelection();
    
    // 1. إذا كان المؤشر داخل أي نص أو فرع بالورقة، يتم الإدراج في مكانه مباشرة
    if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const stage = document.getElementById('sheetsWrapper');
        if (stage && stage.contains(range.commonAncestorContainer)) {
            try {
                range.deleteContents();
                const el = document.createElement("div");
                el.innerHTML = html;
                const frag = document.createDocumentFragment();
                let node, lastNode;
                while ((node = el.firstChild)) {
                    lastNode = frag.appendChild(node);
                }
                range.insertNode(frag);
                if (lastNode) {
                    range.setStartAfter(lastNode);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                ok = true;
            } catch(e) {
                ok = false;
            }
        }
    }

    // 2. إذا لم يكن المؤشر داخل منطقة كتابة، يتم الإدراج داخل السؤال النشط أو الفرع النشط
    if (!ok) {
        const target = (activeQuestionCard && activeQuestionCard.querySelector(".branch-text"))
                    || (activeQuestionCard && activeQuestionCard.querySelector(".q-content-box"))
                    || (activeQuestionCard && activeQuestionCard.querySelector(".text-area"))
                    || document.querySelector(".question-container:last-child .branch-text")
                    || document.querySelector(".question-container:last-child .q-content-box")
                    || document.querySelector(".question-container:last-child .text-area");
        if (target) {
            target.insertAdjacentHTML('beforeend', html);
            ok = true;
        } else {
            // إنشاء سؤال جديد فقط إذا كانت الورقة فارغة تماماً
            if (typeof createNewQuestion === 'function') {
                createNewQuestion();
                setTimeout(() => {
                    const fresh = document.querySelector(".question-container:last-child .q-content-box, .question-container:last-child .text-area");
                    if (fresh) fresh.innerHTML = html;
                }, 100);
                ok = true;
            }
        }
    }

    const curSheet = typeof getActiveSheet === 'function' ? getActiveSheet() : document.querySelector(".a4-sheet");
    if (typeof checkExactSheetOverflow === 'function') checkExactSheetOverflow(curSheet);
    if (typeof resetAllSheetsScroll === 'function') resetAllSheetsScroll();
}

function handleTableSelection(e, wrapper) {
    document.querySelectorAll(".custom-table-wrapper").forEach(w => w.classList.remove("is-selected"));
    wrapper.classList.add("is-selected");

    const cell = e.target.closest("th, td");
    if (cell) {
        activeSelectedTableCell = cell;
    }
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-table-wrapper") && !e.target.closest(".table-quick-toolbar")) {
        document.querySelectorAll(".custom-table-wrapper").forEach(w => w.classList.remove("is-selected"));
    }
});

function tableAddRow(btn, pos) {
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const wrapper = btn.closest(".custom-table-wrapper");
    const table = wrapper.querySelector("table");
    const targetRow = (activeSelectedTableCell && activeSelectedTableCell.closest("tr")) || table.querySelector("tr:last-child");
    
    const colsCount = table.rows[0].cells.length;
    const newRow = document.createElement("tr");

    for (let i = 0; i < colsCount; i++) {
        const td = document.createElement("td");
        td.setAttribute("contenteditable", "true");
        td.setAttribute("spellcheck", "false");
        td.style.border = table.rows[0].cells[0].style.border;
        td.textContent = "خلية";
        newRow.appendChild(td);
    }

    if (pos === 'above' && targetRow) {
        targetRow.before(newRow);
    } else if (targetRow) {
        targetRow.after(newRow);
    } else {
        table.appendChild(newRow);
    }
}

function tableAddCol(btn, pos) {
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const wrapper = btn.closest(".custom-table-wrapper");
    const table = wrapper.querySelector("table");
    const cellIdx = activeSelectedTableCell ? activeSelectedTableCell.cellIndex : (pos === 'right' ? table.rows[0].cells.length - 1 : 0);

    Array.from(table.rows).forEach((row, rIdx) => {
        const cell = rIdx === 0 ? document.createElement("th") : document.createElement("td");
        cell.setAttribute("contenteditable", "true");
        cell.setAttribute("spellcheck", "false");
        cell.style.border = row.cells[0]?.style.border || "1px solid #334155";
        cell.textContent = rIdx === 0 ? "عنوان" : "خلية";

        if (pos === 'left' && row.cells[cellIdx]) {
            row.cells[cellIdx].before(cell);
        } else if (row.cells[cellIdx]) {
            row.cells[cellIdx].after(cell);
        } else {
            row.appendChild(cell);
        }
    });
}

function tableDeleteCurrentRow(btn) {
    if (!activeSelectedTableCell) {
        alert("يرجى وضع المؤشر داخل الصف المطلوب حذفه");
        return;
    }
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.trash();
    const row = activeSelectedTableCell.closest("tr");
    if (row) row.remove();
}

function tableDeleteCurrentCol(btn) {
    if (!activeSelectedTableCell) {
        alert("يرجى وضع المؤشر داخل العمود المطلوب حذفه");
        return;
    }
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.trash();
    const colIdx = activeSelectedTableCell.cellIndex;
    const table = activeSelectedTableCell.closest("table");
    Array.from(table.rows).forEach(row => {
        if (row.cells[colIdx]) row.cells[colIdx].remove();
    });
}

function tableColorActiveCell(colorPicker) {
    if (!activeSelectedTableCell) return;
    if (typeof recordUndoState === 'function') recordUndoState();
    activeSelectedTableCell.style.backgroundColor = colorPicker.value;
}

function tableRemoveEntire(btn) {
    if (!confirm("هل أنت متأكد من حذف هذا الجدول بالكامل؟")) return;
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.trash();
    const wrapper = btn.closest(".custom-table-wrapper");
    if (wrapper) wrapper.remove();
}

function enableTableDrag(handle) {
    const wrapper = handle.closest(".custom-table-wrapper");
    wrapper.setAttribute("draggable", "true");

    wrapper.ondragstart = (e) => {
        e.dataTransfer.setData("text/plain", wrapper.id);
        wrapper.style.opacity = "0.5";
    };

    wrapper.ondragend = () => {
        wrapper.removeAttribute("draggable");
        wrapper.style.opacity = "1";
    };
}

// ==========================================================================
// 2. قوالب الأسئلة والرياضيات
// ==========================================================================

function insertMatchColumnsQuestion() {
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const html = `
        <div class="match-columns-grid" contenteditable="false">
            <div class="match-col-box">
                <div class="match-col-title" contenteditable="true">القائمة ( أ )</div>
                <div class="match-col-content" contenteditable="true">
                    1- القلب<br>
                    2- الرئتان<br>
                    3- المعدة
                </div>
            </div>
            <div class="match-col-box">
                <div class="match-col-title" contenteditable="true">القائمة ( ب )</div>
                <div class="match-col-content" contenteditable="true">
                    ( أ ) تبادل الغازات والتنفس<br>
                    ( ب ) ضخ الدم لجميع أجزاء الجسم<br>
                    ( ج ) هضم الطعام وتفكيكه
                </div>
            </div>
        </div><p><br></p>
    `;
    insertSafeHtml(html);
}

function insertMCQQuestion() {
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const html = `
        <div class="mcq-options-grid" contenteditable="false">
            <div class="mcq-choice-item"><span class="mcq-bubble">أ</span> <span contenteditable="true">الخيار الأول</span></div>
            <div class="mcq-choice-item"><span class="mcq-bubble">ب</span> <span contenteditable="true">الخيار الثاني</span></div>
            <div class="mcq-choice-item"><span class="mcq-bubble">ج</span> <span contenteditable="true">الخيار الثالث</span></div>
            <div class="mcq-choice-item"><span class="mcq-bubble">د</span> <span contenteditable="true">الخيار الرابع</span></div>
        </div><p><br></p>
    `;
    insertSafeHtml(html);
}

function insertLinedAnswerSpace() {
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const html = `
        <div class="lined-answer-zone" contenteditable="false">
            <div></div>
            <div></div>
            <div></div>
        </div><p><br></p>
    `;
    insertSafeHtml(html);
}

function insertPoetryVerse() {
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const html = `
        <div class="poetry-verse-row" contenteditable="false">
            <div class="poetry-sadr" contenteditable="true">صدر البيت هنا</div>
            <div class="poetry-separator-stars">✦ ✦ ✦</div>
            <div class="poetry-ajuz" contenteditable="true">عجز البيت هنا</div>
        </div><p><br></p>
    `;
    insertSafeHtml(html);
}

// الحاوية الحرة للعمليات الرياضية
function getMathWrapperHtml(innerContent) {
    return `
    <div class="math-free-drag-card" style="position:relative; display:inline-block; margin:6px; cursor:move;">
        <div class="math-drag-handle" title="اسحب لتحريك العملية بحرية">⋮⋮</div>
        <button type="button" class="math-box-del-btn" onclick="this.closest('.math-free-drag-card').remove()" title="حذف العملية">✖</button>
        ${innerContent}
    </div>&nbsp;`;
}

// نظام التحريك الحر الدقيق مع حفظ الموقع الجديد دائماً
document.addEventListener('mousedown', (e) => {
    const handle = e.target.closest('.math-drag-handle');
    if (!handle) return;

    const card = handle.closest('.math-free-drag-card');
    if (!card) return;

    e.preventDefault();
    e.stopPropagation();

    // قراءة الإحداثيات الحالية التراكمية للعنصر
    let currentLeft = parseFloat(card.style.left) || 0;
    let currentTop = parseFloat(card.style.top) || 0;

    let startX = e.clientX;
    let startY = e.clientY;

    card.style.position = 'relative';
    card.style.zIndex = '1000';

    function onMouseMove(ev) {
        let dx = ev.clientX - startX;
        let dy = ev.clientY - startY;

        // إضافة الفرق على الموقع السابق لحفظ الإحداثيات باستمرار
        card.style.left = `${currentLeft + dx}px`;
        card.style.top = `${currentTop + dy}px`;
    }

    function onMouseUp(ev) {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // تثبيت الموقع النهائي الدائم
        let dx = ev.clientX - startX;
        let dy = ev.clientY - startY;
        card.style.left = `${currentLeft + dx}px`;
        card.style.top = `${currentTop + dy}px`;
        card.style.zIndex = '';

        recordUndoState();
        if (typeof SoundFX !== 'undefined') SoundFX.pop();
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
});

// تعديل حالات insertMathElement
function insertMathElement(type) {
    let html = '';
    switch (type) {
        case 'vertical-add':
            html = getMathWrapperHtml(`
                <div class="math-vertical-op-arabic">
                    <div class="math-v-grid-ar">
                        <span></span><span class="math-v-num-cell" contenteditable="true" spellcheck="false">542</span>
                        <span class="math-v-op-sign">+</span><span class="math-v-num-cell" contenteditable="true" spellcheck="false">128</span>
                        <div class="math-v-line-ar"></div>
                    </div>
                </div>
            `);
            break;

        case 'vertical-sub':
            html = getMathWrapperHtml(`
                <div class="math-vertical-op-arabic">
                    <div class="math-v-grid-ar">
                        <span></span><span class="math-v-num-cell" contenteditable="true" spellcheck="false">542</span>
                        <span class="math-v-op-sign">-</span><span class="math-v-num-cell" contenteditable="true" spellcheck="false">128</span>
                        <div class="math-v-line-ar"></div>
                    </div>
                </div>
            `);
            break;

        case 'vertical-mult':
            html = getMathWrapperHtml(`
                <div class="math-vertical-op-arabic">
                    <div class="math-v-grid-ar">
                        <span></span><span class="math-v-num-cell" contenteditable="true" spellcheck="false">542</span>
                        <span class="math-v-op-sign">×</span><span class="math-v-num-cell" contenteditable="true" spellcheck="false">128</span>
                        <div class="math-v-line-ar"></div>
                    </div>
                </div>
            `);
            break;

        case 'long-division':
            html = getMathWrapperHtml(`
                <div class="exact-long-division-pro">
                    <span class="ld-divisor-box" contenteditable="true" spellcheck="false">4</span>
                    <span class="ld-step-vertical"></span>
                    <span class="ld-dividend-box" contenteditable="true" spellcheck="false">128</span>
                </div>
            `);
            break;

        case 'fraction':
            html = getMathWrapperHtml(`
                <span class="math-fraction">
                    <span class="math-numerator" contenteditable="true" spellcheck="false">1</span>
                    <span class="math-denominator" contenteditable="true" spellcheck="false">2</span>
                </span>
            `);
            break;

        case 'sqrt':
            html = getMathWrapperHtml(`
                <span class="exact-math-root-pro">
                    <span class="root-hook-zone">
                        <span class="root-index-badge" contenteditable="true" spellcheck="false">2</span>
                        <svg viewBox="0 0 32 54" style="width:16px; height:28px; stroke:#000; stroke-width:3.2; fill:none; stroke-linecap:round; stroke-linejoin:round;">
                            <path d="M 1 30 L 7 30 L 14 50 L 31 2"></path>
                        </svg>
                    </span>
                    <span class="root-body-text" contenteditable="true" spellcheck="false">25</span>
                </span>
            `);
            break;
    }

    if (html) insertSafeHtml(html);
}

// دوال سحب وتحريك العمليات
let draggedMathNode = null;
function handleMathDragStart(e) {
    draggedMathNode = e.currentTarget;
    e.dataTransfer.setData('text/plain', '');
    e.dataTransfer.effectAllowed = 'move';
}

document.addEventListener('dragover', (e) => {
    if (draggedMathNode) e.preventDefault();
});

document.addEventListener('drop', (e) => {
    if (draggedMathNode) {
        e.preventDefault();
        const dropZone = e.target.closest('.q-content-box, .branch-text, .text-area');
        if (dropZone) {
            dropZone.appendChild(draggedMathNode);
            draggedMathNode = null;
            if (typeof SoundFX !== 'undefined') SoundFX.pop();
        }
    }
});

function insertRawSymbol(sym) {
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.click();
    insertSafeHtml(sym);
}

function insertPhysicsValue(val, unit) {
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const html = `<span class="physics-val" contenteditable="true">${val} ${unit}</span>&nbsp;`;
    insertSafeHtml(html);
}

function autoWrapPhysicsInSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.success();
    const text = sel.toString();
    const html = `<span class="physics-val" contenteditable="true">${text}</span>`;
    document.execCommand('insertHTML', false, html);
}

function insertStockSvgSticker(type) {
    const svgs = {
        microscope: '🔬',
        flask: '🧪',
        atom: '⚛️',
        leaf: '🌿',
        dna: '🧬',
        star: '⭐'
    };
    const emoji = svgs[type] || '🔬';
    insertSafeHtml(`<span style="font-size:24px; vertical-align:middle; user-select:none;">${emoji}</span>&nbsp;`);
}
// دالة إدراج قوى العشرة ذات الأس السالب بعزل فيزيائي LTR قابل للتعديل
function insertScientificExp(powerVal = '-2') {
    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();

    let displayPower = powerVal;
    if (powerVal === '-n') {
        displayPower = prompt("اكتب قيمة الأس المطلوب (مثال: -5 أو -8):", "-5") || "-5";
    }

    // بناء كود HTML بمحاذاة LTR معزولة تمنع تشوه المعادلة
    const html = `&nbsp;<span class="physics-val sci-exp" contenteditable="false" style="display:inline-block; direction:ltr; unicode-bidi:isolate; font-family:'Roboto','Nunito',sans-serif; font-weight:700; padding:0 3px; margin:0 2px;"><span contenteditable="true" spellcheck="false">×10</span><sup contenteditable="true" spellcheck="false" style="font-size:11px; font-weight:800; color:#1e3a8a;">${displayPower}</sup></span>&nbsp;`;

    insertSafeHtml(html);
}