/**
 * ExamBuilder Pro - إدارة الأسئلة والسحب والتمرير والتحكم
 */

function setActiveQuestion(card) {
    document.querySelectorAll('.question-container').forEach(c => c.classList.remove('is-active'));
    activeQuestionCard = card;
    if (card) {
        card.classList.add('is-active');
        const panel = document.getElementById('questionSidePanel');
        const badge = document.getElementById('sidePanelQNum');
        const qNum = card.querySelector('.q-num-prefix')?.innerText || 'سؤال';
        if (badge) badge.textContent = qNum;
        if (panel) panel.classList.add('active');
    }
}
function generateUniqueId(prefix = 'el') {
    return prefix + '_' + Math.random().toString(36).substring(2, 9);
}

function deactivateCurrentQuestion() {
    if (activeQuestionCard) {
        activeQuestionCard.classList.remove('is-active');
        activeQuestionCard = null;
    }
    const panel = document.getElementById('questionSidePanel');
    if (panel) panel.classList.remove('active');
}

function createNewQuestion(custom = null) {
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.click();

    const cClass = COLOR_CLASSES[colorIndex % COLOR_CLASSES.length];
    const currentColorHex = COLOR_HEX_MAP[cClass] || '#ff9f43';
    colorIndex++;

    const isAr = currentLang === 'ar';
    const defGrade = isAr ? `[ ${formatNumberBySystem(20)} درجة ]` : `[ ${formatNumberBySystem(20)} Marks ]`;
    const titlePlaceholder = isAr ? "اكتب صيغة السؤال هنا..." : "Write question title here...";
    const bodyPlaceholder = isAr ? "اكتب تفاصيل وفروع السؤال هنا..." : "Write question details here...";

    let innerContent = `<div class="text-area q-content-box" contenteditable="true" spellcheck="false" data-placeholder="${bodyPlaceholder}"></div>`;

    let customTitle = "";
    if (custom) {
        if (custom.title) {
            customTitle = custom.title.replace(/📝/g, '').replace(/(س|Q)\s*\d+\s*[\/:-]?/gi, '').trim();
        }
        if (custom.type === 'grid4' && custom.items) {
            const divs = custom.items.map((it, idx) => {
                const num = formatNumberBySystem(idx + 1);
                const cleanTxt = it.replace(/^[0-9١-٩]+[-–.]?\s*/, '');
                return `<div class="point-cell"><span class="pt-num">${num}-</span><span class="pt-txt" contenteditable="true" spellcheck="false">${cleanTxt}</span></div>`;
            }).join('');
            innerContent = `<div class="dynamic-points-host layout-multi-col cols-4 q-content-box">${divs}</div>`;
        } else if (custom.content) {
            innerContent = `<div class="text-area q-content-box" contenteditable="true" spellcheck="false">${custom.content.replace(/\n/g, '<br>')}</div>`;
        }
    }

    const card = document.createElement("div");
    card.id = generateUniqueId("q_card");
    card.className = `question-container shape-classic align-right ${cClass}`;
    card.style.borderColor = currentColorHex;

    card.innerHTML = `
        <div class="q-grade-badge" contenteditable="true" spellcheck="false" onblur="updateUIIndicators()">${defGrade}</div>
        <div class="q-title-badge" style="background-color: ${currentColorHex};">
            <span>📝</span>
            <span class="q-num-prefix" contenteditable="false"></span>
            <span class="q-title-text" contenteditable="true" spellcheck="false" data-placeholder="${titlePlaceholder}">${customTitle}</span>
        </div>
        ${innerContent}
    `;

    card.addEventListener('click', (e) => {
        if (e.target.closest('.del-note-btn') || e.target.closest('.branch-del-btn')) return;
        setActiveQuestion(card);
    });

    // تحديد الصفحة المناسبة للإضافة
    let targetSheet = (typeof getActiveSheet === 'function') ? getActiveSheet() : null;
    if (!targetSheet) {
        targetSheet = document.querySelector(".a4-sheet") || document.getElementById("sheet-1");
    }

    // إذا كانت الصفحة الحالية ممتلئة مسبقاً، ننتقل لآخر صفحة أو ننشئ صفحة جديدة
    const frameBox = targetSheet.querySelector('.sheet-frame-box');
    const stream = targetSheet.querySelector('.questions-stream');
    if (frameBox && stream) {
        const header = targetSheet.querySelector('.sheet-header-locked-zone');
        const headerH = (header && !header.classList.contains('header-hidden')) ? header.offsetHeight : 0;
        const maxH = frameBox.clientHeight - headerH - 60;
        
        let curH = 0;
        stream.querySelectorAll('.question-container').forEach(q => curH += q.offsetHeight + 12);

        // إذا كانت الصفحة ممتلئة فعلياً، نتجه للصفحة التالية أو ننشئ صفحة جديدة
        if (curH + 110 > maxH) {
            let nextSheet = targetSheet.nextElementSibling;
            if (!nextSheet) {
                targetSheet = insertNewPageSheetManual(true);
            } else {
                targetSheet = nextSheet;
            }
        }
    }

    const targetStream = targetSheet.querySelector(".questions-stream");
    if (targetStream) {
        targetStream.appendChild(card);
    }

    makeQuestionDraggable(card);
    reindexAllQuestions();
    updateUIIndicators();
    setActiveQuestion(card);

    setTimeout(() => {
        checkExactSheetOverflow(targetSheet);
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
}

function panelMoveQuestion(dir) {
    if (!activeQuestionCard) return;
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.click();
    const card = activeQuestionCard;
    if (dir === -1 && card.previousElementSibling) {
        card.parentNode.insertBefore(card, card.previousElementSibling);
    } else if (dir === 1 && card.nextElementSibling) {
        card.parentNode.insertBefore(card.nextElementSibling, card);
    }
    reindexAllQuestions();
    setActiveQuestion(card);
}

function panelMoveToNextSheet() {
    if (!activeQuestionCard) {
        if (typeof UIEffects !== 'undefined') UIEffects.showToast("يرجى تحديد السؤال أولاً!", "warning");
        return;
    }
    moveQuestionToNextSheet(activeQuestionCard);
}

function panelDuplicateQuestion() {
    if (!activeQuestionCard) return;
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.click();
    const card = activeQuestionCard;
    const clone = card.cloneNode(true);
    clone.classList.remove('is-active');

    clone.addEventListener('click', (e) => {
        if (e.target.closest('.del-note-btn') || e.target.closest('.branch-del-btn')) return;
        setActiveQuestion(clone);
    });

    card.parentNode.insertBefore(clone, card.nextElementSibling);
    makeQuestionDraggable(clone);
    reindexAllQuestions();
    updateUIIndicators();
    setActiveQuestion(clone);

    setTimeout(() => {
        clone.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const sheet = clone.closest('.a4-sheet');
        if (sheet && typeof checkExactSheetOverflow === 'function') checkExactSheetOverflow(sheet);
    }, 80);
}

function panelDeleteQuestion() {
    if (!activeQuestionCard) return;
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.trash();
    const sheet = activeQuestionCard.closest('.a4-sheet');
    activeQuestionCard.remove();
    deactivateCurrentQuestion();
    reindexAllQuestions();
    updateUIIndicators();
    if (sheet && typeof checkExactSheetOverflow === 'function') checkExactSheetOverflow(sheet);
}

function panelOpenShapeModal() {
    if (!activeQuestionCard) return;
    if (typeof SoundFX !== 'undefined') SoundFX.pop();
    const card = activeQuestionCard;

    const currentBorder = card.style.borderColor || '#ff9f43';
    const badge = card.querySelector('.q-title-badge');
    const currentBadgeBg = badge ? (badge.style.backgroundColor || currentBorder) : currentBorder;

    const colInput = document.getElementById("modalQBorderColor");
    const badgeColInput = document.getElementById("modalQBadgeBg");
    if (colInput) colInput.value = rgbToHex(currentBorder);
    if (badgeColInput) badgeColInput.value = rgbToHex(currentBadgeBg);

    document.getElementById("qShapeModal").classList.add("active");
}

function panelTriggerSticker() {
    const uploadInput = document.getElementById("stickerUpload") || document.getElementById("imgUpload");
    if (uploadInput) uploadInput.click();
}

let targetBranchElementForNumbering = null;
function panelOpenNumbering() {
    if (!activeQuestionCard) return;
    const sel = window.getSelection();
    let currentBranch = null;
    if (sel && sel.anchorNode) {
        let node = sel.anchorNode;
        if (node.nodeType === 3) node = node.parentElement;
        currentBranch = node.closest('.branch-text');
    }

    targetBranchElementForNumbering = currentBranch;
    const modal = document.getElementById("numberingModal");
    if (modal) modal.classList.add("active");
}

function panelConvertToBranches() {
    if (!activeQuestionCard) return;
    convertToBranchesOnCard(activeQuestionCard);
}

function convertToBranchesOnCard(card) {
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();

    const isAr = currentLang === 'ar';
    const letters = isAr ? AR_LETTERS : EN_LETTERS;
    const defGrade = formatNumberBySystem(10);

    const qContent = card.querySelector('.q-content-box');
    let existingText = qContent ? qContent.innerText.trim() : '';
    if (existingText === 'اكتب تفاصيل وفروع السؤال هنا...' || existingText === 'Write question details here...') {
        existingText = '';
    }

    const branchesWrap = document.createElement('div');
    branchesWrap.className = 'branches-wrapper';

    const count = 2;
    for (let i = 0; i < count; i++) {
        const letter = letters[i] || `${i + 1}`;
        const bRow = document.createElement('div');
        bRow.className = 'branch-row';
        bRow.innerHTML = `
            <span class="branch-letter-tag">${letter}-</span>
            <div class="branch-text" contenteditable="true" spellcheck="false" data-placeholder="${isAr ? 'نص الفرع...' : 'Branch text...'}">${i === 0 && existingText ? existingText : ''}</div>
            <div class="branch-meta-controls">
                <span class="branch-grade-label">${isAr ? 'الدرجة:' : 'Marks:'}</span>
                <input type="text" class="branch-grade-input" value="${defGrade}" onblur="updateUIIndicators()">
                <button type="button" class="branch-del-btn" onclick="this.closest('.branch-row').remove(); updateUIIndicators();" title="حذف الفرع">✖</button>
            </div>
        `;
        branchesWrap.appendChild(bRow);
    }

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-branch-inline-btn';
    addBtn.innerHTML = `<span>➕</span> ${isAr ? 'إضافة فرع جديد' : 'Add Branch'}`;
    addBtn.onclick = () => {
        if (typeof recordUndoState === 'function') recordUndoState();
        if (typeof SoundFX !== 'undefined') SoundFX.click();
        const curRows = branchesWrap.querySelectorAll('.branch-row').length;
        const letter = letters[curRows] || `${curRows + 1}`;
        const row = document.createElement('div');
        row.className = 'branch-row';
        row.innerHTML = `
            <span class="branch-letter-tag">${letter}-</span>
            <div class="branch-text" contenteditable="true" spellcheck="false" data-placeholder="${isAr ? 'نص الفرع...' : 'Branch text...'}"></div>
            <div class="branch-meta-controls">
                <span class="branch-grade-label">${isAr ? 'الدرجة:' : 'Marks:'}</span>
                <input type="text" class="branch-grade-input" value="${defGrade}" onblur="updateUIIndicators()">
                <button type="button" class="branch-del-btn" onclick="this.closest('.branch-row').remove(); updateUIIndicators();" title="حذف الفرع">✖</button>
            </div>
        `;
        branchesWrap.insertBefore(row, addBtn);
        updateUIIndicators();
        const sheet = card.closest('.a4-sheet');
        if (sheet && typeof checkExactSheetOverflow === 'function') checkExactSheetOverflow(sheet);
    };

    branchesWrap.appendChild(addBtn);

    if (qContent) {
        qContent.replaceWith(branchesWrap);
    } else {
        card.appendChild(branchesWrap);
    }

    updateUIIndicators();
    const sheet = card.closest('.a4-sheet');
    if (sheet && typeof checkExactSheetOverflow === 'function') checkExactSheetOverflow(sheet);
}

function panelSaveToBank() {
    if (!activeQuestionCard) return;
    saveCardToBank(activeQuestionCard);
}

function saveCardToBank(card) {
    const isAr = currentLang === 'ar';
    const title = card.querySelector('.q-title-text')?.innerText.trim() || 'سؤال مخصص';
    const content = card.querySelector('.q-content-box, .branches-wrapper')?.innerText.trim() || '';

    const qItem = {
        title: title,
        content: content,
        type: 'text',
        category: 'عام',
        savedAt: new Date().toISOString()
    };

    let bank = JSON.parse(localStorage.getItem(`exambuilder_bank_${currentLang}`) || '[]');
    bank.unshift(qItem);
    localStorage.setItem(`exambuilder_bank_${currentLang}`, JSON.stringify(bank));

    if (typeof AppAPI !== 'undefined' && AppAPI.saveSingleQuestion) {
        AppAPI.saveSingleQuestion(currentLang, qItem).catch(() => {});
    }

    if (typeof SoundFX !== 'undefined') SoundFX.success();
    if (typeof UIEffects !== 'undefined') {
        UIEffects.showToast(isAr ? "تم حفظ السؤال في بنك الأسئلة بنجاح!" : "Question saved to Question Bank!", "success");
    }
}

function makeQuestionDraggable(card) {
    card.setAttribute('draggable', 'true');

card.addEventListener('dragstart', (e) => {
       if (e.target.isContentEditable || e.target.closest('[contenteditable="true"]')) {
           e.preventDefault(); // منع سحب النص الداخلي بالخطأ
           return;
       }
       card.classList.add('dragging');
       e.dataTransfer.effectAllowed = 'move';
   });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.question-container').forEach(c => c.classList.remove('drag-over'));
        reindexAllQuestions();
        updateUIIndicators();
    });

    card.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.question-container.dragging');
        if (dragging && dragging !== card) {
            card.classList.add('drag-over');
        }
    });

    card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const dragging = document.querySelector('.question-container.dragging');
        if (dragging && dragging !== card) {
            if (typeof recordUndoState === 'function') recordUndoState();
            const parent = card.parentNode;
            const all = Array.from(parent.querySelectorAll('.question-container'));
            const srcIdx = all.indexOf(dragging);
            const dstIdx = all.indexOf(card);

            if (srcIdx < dstIdx) {
                parent.insertBefore(dragging, card.nextSibling);
            } else {
                parent.insertBefore(dragging, card);
            }
            if (typeof SoundFX !== 'undefined') SoundFX.pop();
            reindexAllQuestions();
            updateUIIndicators();
            setActiveQuestion(dragging);
        }
    });
}

function bindAllQuestionsInteractions() {
    document.querySelectorAll('.question-container').forEach(card => {
        makeQuestionDraggable(card);
        card.onclick = (e) => {
            if (e.target.closest('.del-note-btn') || e.target.closest('.branch-del-btn')) return;
            setActiveQuestion(card);
        };
    });
}

function applyCustomNumbering() {
    const count = parseInt(document.getElementById("numCountInput")?.value) || 4;
    const layout = document.getElementById("numLayoutSelect")?.value || "2";

    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();

    let cells = "";
    for (let i = 1; i <= count; i++) {
        const numStr = formatNumberBySystem(i);
        cells += `
            <div class="point-cell">
                <span class="pt-num">${numStr}-</span>
                <span class="pt-txt" contenteditable="true" spellcheck="false" data-placeholder="اكتب هنا..."></span>
            </div>
        `;
    }

    const html = `<div class="dynamic-points-host cols-${layout}">${cells}</div><p><br></p>`;
    let inserted = false;

    if (targetBranchElementForNumbering) {
        targetBranchElementForNumbering.insertAdjacentHTML('beforeend', html);
        inserted = true;
    } else if (activeQuestionCard) {
        const target = activeQuestionCard.querySelector('.branch-text') 
                    || activeQuestionCard.querySelector('.q-content-box') 
                    || activeQuestionCard.querySelector('.text-area');
        if (target) {
            target.insertAdjacentHTML('beforeend', html);
            inserted = true;
        }
    }

    if (!inserted && typeof insertSafeHtml === 'function') {
        insertSafeHtml(html);
    }

    closeNumberingModal();
}

function reindexAllQuestions() {
    const isAr = currentLang === 'ar';
    const allQuestions = document.querySelectorAll("#sheetsWrapper .question-container");

    allQuestions.forEach((card, index) => {
        const orderNum = formatNumberBySystem(index + 1);
        const prefixText = isAr ? `س${orderNum}/` : `Q${orderNum}/`;

        let prefixSpan = card.querySelector(".q-num-prefix");
        let titleSpan = card.querySelector(".q-title-text");

        if (!prefixSpan || !titleSpan) {
            const badge = card.querySelector(".q-title-badge");
            if (badge) {
                let rawText = badge.innerText
                    .replace(/📝/g, '')
                    .replace(/(س|Q)\s*\d+\s*[\/:-]?/gi, '')
                    .trim();

                badge.innerHTML = `
                    <span>📝</span>
                    <span class="q-num-prefix" contenteditable="false" style="user-select:none; margin-inline-end:4px;">${prefixText}</span>
                    <span class="q-title-text" contenteditable="true" spellcheck="false" style="outline:none; cursor:text; min-width:60px; display:inline-block;" data-placeholder="${isAr ? 'اكتب صيغة السؤال هنا...' : 'Question title...'}">${rawText}</span>
                `;
            }
        } else {
            prefixSpan.textContent = prefixText;
        }
    });

    if (activeQuestionCard) {
        const badge = document.getElementById('sidePanelQNum');
        if (badge) badge.textContent = activeQuestionCard.querySelector('.q-num-prefix')?.innerText || 'سؤال';
    }
}

function rgbToHex(rgb) {
    if (!rgb || rgb.startsWith('#')) return rgb || '#ff9f43';
    const res = rgb.match(/\d+/g);
    if (!res || res.length < 3) return '#ff9f43';
    return "#" + ((1 << 24) + (parseInt(res[0]) << 16) + (parseInt(res[1]) << 8) + parseInt(res[2])).toString(16).slice(1);
}

function closeQShapeModal() {
    document.getElementById("qShapeModal").classList.remove("active");
}

function applyAdvancedQCustomization() {
    if (!activeQuestionCard) return;
    if (typeof recordUndoState === 'function') recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.success();

    const shape = document.getElementById("modalQShapeSelect")?.value || 'shape-classic';
    const align = document.getElementById("modalQAlignSelect")?.value || 'align-right';
    const borderColor = document.getElementById("modalQBorderColor")?.value || '#ff9f43';
    const badgeBg = document.getElementById("modalQBadgeBg")?.value || '#ff9f43';

    activeQuestionCard.className = `question-container ${shape} ${align}`;
    activeQuestionCard.style.borderColor = borderColor;

    const badge = activeQuestionCard.querySelector(".q-title-badge");
    if (badge) {
        badge.style.backgroundColor = badgeBg;
    }

    closeQShapeModal();
}

function closeNumberingModal() {
    document.getElementById("numberingModal").classList.remove("active");
}