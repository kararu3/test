/**
 * Examy PRO - التدقيق الذكي قبل الطباعة ومطابقة الدرجات وضغط الورق والتدقيق الإملائي اللحظي
 */

const PreFlightSystem = {
    // 1. فحص شامل للورقة قبل إرسال أمر الطباعة
    inspectExam() {
        const issues = [];
        let totalCalculatedGrade = 0;

        const questions = document.querySelectorAll(".question-container");
        if (questions.length === 0) {
            issues.push({ type: 'error', text: 'لا يوجد أي سؤال في ورقة الامتحان!' });
            return issues;
        }

        // التدقيق في كل سؤال
        questions.forEach((q, idx) => {
            const qNum = idx + 1;
            const titleEl = q.querySelector(".q-title-text");
            const titleText = titleEl ? titleEl.innerText.trim() : '';
            if (!titleText || titleText === 'اكتب صيغة السؤال هنا...') {
                issues.push({ type: 'warning', text: `السؤال (${qNum}): لم يتم كتابة صيغة أو عنوان السؤال.` });
            }

            // فحص الفروع الفارغة
            const branchRows = q.querySelectorAll(".branch-row");
            branchRows.forEach((br, bIdx) => {
                const bText = br.querySelector(".branch-text")?.innerText.trim();
                if (!bText) {
                    issues.push({ type: 'error', text: `السؤال (${qNum}) - الفرع (${bIdx + 1}): الفرع فارغ تماماً.` });
                }
            });

            // حساب الدرجة وتدقيقها
            const branchInputs = q.querySelectorAll(".branch-grade-input");
            if (branchInputs.length > 0) {
                branchInputs.forEach(inp => {
                    const val = typeof parseAnyNumber === 'function' ? parseAnyNumber(inp.value) : parseInt(inp.value) || 0;
                    totalCalculatedGrade += val;
                });
            } else {
                const gradeBadge = q.querySelector(".q-grade-badge");
                if (gradeBadge) {
                    const val = typeof parseAnyNumber === 'function' ? parseAnyNumber(gradeBadge.innerText) : parseInt(gradeBadge.innerText) || 0;
                    totalCalculatedGrade += val;
                }
            }
        });

        // مطابقة الدرجة الكلية للـ 100
        if (totalCalculatedGrade !== 100) {
            issues.push({
                type: 'warning',
                text: `مجموع الدرجات الحالي (${totalCalculatedGrade}) لا يساوي 100 درجة بالضبط.`
            });
        }

        // فحص الأخطاء الإملائية الشائعة
        const docText = document.getElementById("sheetsWrapper")?.innerText || "";
        const commonSpellMistakes = [
            { wrong: 'انشاء', correct: 'إنشاء' },
            { wrong: 'إستخرج', correct: 'استخرج' },
            { wrong: 'إستنتج', correct: 'استنتج' },
            { wrong: 'مدرسه', correct: 'مدرسة' },
            { wrong: 'اجابة', correct: 'إجابة' },
            { wrong: 'انضر', correct: 'انظر' },
            { wrong: 'ذالك', correct: 'ذلك' },
            { wrong: 'كذالك', correct: 'كذلك' },
            { wrong: 'هاذا', correct: 'هذا' },
            { wrong: 'هاذه', correct: 'هذه' },
            { wrong: 'أسئلة فقط لكل سؤال', correct: 'أسئلة فقط، لكل سؤال' }
        ];

        commonSpellMistakes.forEach(item => {
            const regex = new RegExp(`\\b${item.wrong}\\b`, 'g');
            if (regex.test(docText)) {
                issues.push({
                    type: 'info',
                    text: `خطأ إملائي محتمل: وُجدت كلمة "${item.wrong}" والأصح كتابتها "${item.correct}".`
                });
            }
        });

        return issues;
    },

    // 2. فتح نافذة المعاينة والتدقيق
    openPreflightModal() {
        const issues = this.inspectExam();
        const host = document.getElementById("preflightIssuesList");
        if (!host) return;

        host.innerHTML = "";
        if (issues.length === 0) {
            host.innerHTML = `<div style="text-align:center; color:#10b981; padding:20px; font-weight:bold;">✅ الورقة الامتحانية سليمة 100% ومكتملة الدرجات وجاهزة للطباعة فوراً!</div>`;
        } else {
            issues.forEach(iss => {
                const row = document.createElement("div");
                row.style.cssText = `padding:8px 12px; border-radius:6px; margin-bottom:6px; font-size:12.5px; font-weight:700; display:flex; align-items:center; gap:8px; ${
                    iss.type === 'error' ? 'background:#fee2e2; color:#b91c1c; border:1px solid #f87171;' : 
                    iss.type === 'warning' ? 'background:#fef3c7; color:#92400e; border:1px solid #f59e0b;' : 
                    'background:#e0f2fe; color:#0369a1; border:1px solid #38bdf8;'
                }`;
                row.innerHTML = `<span>${iss.type === 'error' ? '❌' : iss.type === 'warning' ? '⚠️' : '💡'}</span> <span>${iss.text}</span>`;
                host.appendChild(row);
            });
        }

        const modal = document.getElementById("preflightModal");
        if (modal) modal.classList.add("active");
    },

    // 3. ضغط الورقة المطور (إلغاء الموازنة السابقة وتصفير المسافات والخطوط وحذف الصفحات الفارغة)
    smartShrinkPage() {
        if (typeof SoundFX !== 'undefined') SoundFX.pop();
        recordUndoState();

        const activeSheet = (typeof getActiveSheet === 'function') ? getActiveSheet() : document.querySelector('.a4-sheet');
        if (!activeSheet) return;

        // إلغاء آثار الموازنة وتوزيع الفراغات
        const stream = activeSheet.querySelector('.questions-stream');
        if (stream) {
            stream.style.justifyContent = 'flex-start';
            stream.style.gap = '6px';
            stream.style.paddingTop = '2px';
        }

        // تقليص المسافات العمودية بين الأسئلة والفروع
        const qContainers = activeSheet.querySelectorAll('.question-container');
        qContainers.forEach(q => {
            q.style.marginTop = '4px';
            q.style.marginBottom = '2px';
            q.style.paddingTop = '16px';
            q.style.paddingBottom = '6px';
        });

        const branchRows = activeSheet.querySelectorAll('.branch-row');
        branchRows.forEach(b => {
            b.style.padding = '3px 8px';
            b.style.gap = '5px';
            b.style.marginTop = '2px';
        });

        // تصغير حجم خط النصوص داخل الورقة بنقطة واحدة
        const textElements = activeSheet.querySelectorAll('.q-content-box, .branch-text, .text-area, .point-cell');
        textElements.forEach(el => {
            const currentSize = parseFloat(window.getComputedStyle(el).fontSize) || 14;
            if (currentSize > 11.5) {
                el.style.fontSize = `${currentSize - 0.8}px`;
            }
        });

        // حذف أي صفحة إضافية فارغة أنشئت بالخطأ
        const sheets = document.querySelectorAll('#sheetsWrapper .a4-sheet');
        if (sheets.length > 1) {
            sheets.forEach((sheet, idx) => {
                if (idx > 0 && sheet.querySelectorAll('.question-container').length === 0) {
                    sheet.remove();
                }
            });
        }

        if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
        if (typeof updateUIIndicators === 'function') updateUIIndicators();

        if (typeof UIEffects !== 'undefined') {
            UIEffects.showToast("تم إلغاء الموازنة وضغط المسافات لاستيعاب الصفحة بنجاح!", "success", 3000);
        }

        if (typeof checkExactSheetOverflow === 'function') {
            checkExactSheetOverflow(activeSheet);
        }
    },

    // 4. تحديث مؤشر وزن الصفحة اللحظي
    updatePageWeight(sheet) {
        if (!sheet) return;
        let weightBar = sheet.querySelector(".page-weight-bar");
        if (!weightBar) {
            weightBar = document.createElement("div");
            weightBar.className = "page-weight-bar";
            weightBar.innerHTML = `<div class="page-weight-fill safe" style="height:20%;"></div>`;
            sheet.appendChild(weightBar);
        }

        const frameBox = sheet.querySelector(".sheet-frame-box");
        const stream = sheet.querySelector(".questions-stream");
        if (!frameBox || !stream) return;

        const maxH = frameBox.clientHeight - 80;
        const currentH = stream.scrollHeight;
        const percent = Math.min(100, Math.round((currentH / maxH) * 100));

        const fill = weightBar.querySelector(".page-weight-fill");
        if (fill) {
            fill.style.height = `${percent}%`;
            fill.className = `page-weight-fill ${percent > 95 ? 'overflow' : percent > 80 ? 'warning' : 'safe'}`;
        }
    },

   // 5. محرك التدقيق الإملائي التفاعلي مع قائمة الاستبدال السريع
    initRealtimeSpellChecker() {
        const dictionary = {
            'انضر': 'انظر',
            'ذالك': 'ذلك',
            'كذالك': 'كذلك',
            'هاذا': 'هذا',
            'هاذه': 'هذه',
            'هاؤلاء': 'هؤلاء',
            'لاكن': 'لكن',
            'اللة': 'الله',
            'انشاء': 'إنشاء',
            'إستخرج': 'استخرج',
            'إستنتج': 'استنتج',
            'مسئله': 'مسألة',
            'اسئله': 'أسئلة',
            'قرأن': 'قرآن',
            'فجأه': 'فجأة'
        };

        // تدقيق عند مغادرة الحقل
        document.addEventListener('focusout', (e) => {
            const target = e.target;
            if (target && target.isContentEditable && !target.closest('#inlineTextFormatter')) {
                let html = target.innerHTML;
                let modified = false;

                Object.keys(dictionary).forEach(wrong => {
                    const regex = new RegExp(`(?<![\\u0621-\\u064A])(${wrong})(?![\\u0621-\\u064A]|[^<]*>|[^<>]*<\\/span>)`, 'gi');
                    if (regex.test(html)) {
                        const correct = dictionary[wrong];
                        html = html.replace(regex, `<span class="spell-error-highlight" data-correct="${correct}" title="خطأ إملائي - انقر للتصحيح إلى: ${correct}">$1</span>`);
                        modified = true;
                    }
                });

                if (modified) {
                    target.innerHTML = html;
                }
            }
        });

        // النقر على الكلمة الخاطئة لإظهار قائمة الاقتراح السريع
        document.addEventListener('click', (e) => {
            const errorWord = e.target.closest('.spell-error-highlight');
            if (!errorWord) {
                const existingMenu = document.getElementById('spellSuggestMenu');
                if (existingMenu) existingMenu.remove();
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const correct = errorWord.getAttribute('data-correct');
            const rect = errorWord.getBoundingClientRect();

            let menu = document.getElementById('spellSuggestMenu');
            if (menu) menu.remove();

            menu = document.createElement('div');
            menu.id = 'spellSuggestMenu';
            menu.className = 'spell-suggest-popup';
            menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
            menu.style.left = `${rect.left + window.scrollX}px`;

            menu.innerHTML = `
                <div class="suggest-header">اقتراح التصحيح:</div>
                <button type="button" class="suggest-btn" onclick="PreFlightSystem.applyCorrection(this, '${correct}')">
                    ✨ استبدال بـ: <strong>${correct}</strong>
                </button>
                <button type="button" class="suggest-ignore-btn" onclick="PreFlightSystem.ignoreCorrection(this)">تجاهل</button>
            `;

            document.body.appendChild(menu);
            menu.targetWordElement = errorWord;
        });
    },

    applyCorrection(btn, correctText) {
        recordUndoState();
        const menu = btn.closest('#spellSuggestMenu');
        if (menu && menu.targetWordElement) {
            const el = menu.targetWordElement;
            const textNode = document.createTextNode(correctText);
            el.parentNode.replaceChild(textNode, el);
            menu.remove();
            if (typeof SoundFX !== 'undefined') SoundFX.success();
        }
    },

    ignoreCorrection(btn) {
        const menu = btn.closest('#spellSuggestMenu');
        if (menu && menu.targetWordElement) {
            const el = menu.targetWordElement;
            const textNode = document.createTextNode(el.innerText);
            el.parentNode.replaceChild(textNode, el);
            menu.remove();
        }
    }
    
};

// بدء تشغيل التدقيق الإملائي المباشر
document.addEventListener('DOMContentLoaded', () => {
    PreFlightSystem.initRealtimeSpellChecker();
});