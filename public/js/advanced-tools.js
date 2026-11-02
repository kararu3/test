/**
 * Examy PRO - المكتبة المتقدمة للنماذج والآيات والكيمياء والشبكة المحلية
 */

const AdvancedExamTools = {
    generateShuffleVersion(versionName = 'B') {
        recordUndoState();
        if (typeof SoundFX !== 'undefined') SoundFX.pop();

        const stream = document.querySelector(".questions-stream");
        if (!stream) return;

        const cards = Array.from(stream.querySelectorAll(".question-container"));
        if (cards.length < 2) {
            alert("يرجى كتابة سؤالين على الأقل لتوليد نموذج بديل.");
            return;
        }

        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }

        cards.forEach(card => stream.appendChild(card));

        const centerHdr = document.getElementById("hdrCenter");
        if (centerHdr) {
            centerHdr.innerHTML = centerHdr.innerHTML.replace(/\(نموذج [أ-يA-Z]\)/g, '') + `<br><b style="color:#d97706;">(نموذج ${versionName})</b>`;
        }

        if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
        if (typeof updateUIIndicators === 'function') updateUIIndicators();
        if (typeof UIEffects !== 'undefined') UIEffects.showToast(`تم توليد النموذج (${versionName}) بنجاح!`, "success");
    },

    autoDistributeBranchGrades(card) {
        if (!card) return;
        const branches = card.querySelectorAll(".branch-row");
        if (branches.length === 0) return;

        const qGradeBadge = card.querySelector(".q-grade-badge");
        const total = qGradeBadge ? (typeof parseAnyNumber === 'function' ? parseAnyNumber(qGradeBadge.innerText) : 20) : 20;
        const eachGrade = Math.floor(total / branches.length);

        branches.forEach(br => {
            const input = br.querySelector(".branch-grade-input");
            if (input) {
                input.value = typeof formatNumberBySystem === 'function' ? formatNumberBySystem(eachGrade) : eachGrade;
            }
        });

        if (typeof updateUIIndicators === 'function') updateUIIndicators();
        if (typeof SoundFX !== 'undefined') SoundFX.click();
    },

    toggleTwoColumnSplit(card) {
        recordUndoState();
        if (!card) card = activeQuestionCard;
        if (!card) return;
        card.classList.toggle("two-column-split");
        if (typeof SoundFX !== 'undefined') SoundFX.pop();
    },

    insertChemEquation(reactants = '2H₂ + O₂', condition = 'حرارة Δ', products = '2H₂O') {
        recordUndoState();
        if (typeof SoundFX !== 'undefined') SoundFX.pop();

        const html = `
            <span class="chem-equation-inline" contenteditable="false">
                <span contenteditable="true">${reactants}</span>
                <span class="chem-arrow-wrap">
                    <span class="chem-condition" contenteditable="true">${condition}</span>
                    <span class="chem-arrow">➔</span>
                </span>
                <span contenteditable="true">${products}</span>
            </span>&nbsp;
        `;
        if (typeof insertSafeHtml === 'function') insertSafeHtml(html);
    },

    openQuranModal() {
        if (typeof SoundFX !== 'undefined') SoundFX.pop();
        const modal = document.getElementById("quranModal");
        if (modal) modal.classList.add("active");
        QuranEngine.init();
    },

    generateStudentAnswerSheet() {
        recordUndoState();
        if (typeof SoundFX !== 'undefined') SoundFX.pop();

        const count = document.querySelectorAll(".question-container").length || 5;
        let rows = "";
        for (let i = 1; i <= count; i++) {
            rows += `
                <tr>
                    <td style="font-weight:bold;">س${i}</td>
                    <td><span class="bubble-circle">أ</span><span class="bubble-circle">ب</span><span class="bubble-circle">ج</span><span class="bubble-circle">د</span></td>
                    <td style="width:50%; border-bottom:1px dotted #94a3b8;"></td>
                </tr>
            `;
        }

        const sheetHtml = `
            <div class="student-bubble-sheet" contenteditable="false">
                <div style="text-align:center; font-weight:bold; margin-bottom:10px; border-bottom:2px solid #0f172a; padding-bottom:6px;">
                    استمارة الإجابة النموذجية المخصصة للطالب
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px;">
                    <span>اسم الطالب: .......................................</span>
                    <span>الرقم الامتحاني: ...................</span>
                </div>
                <table class="bubble-grid-table">
                    <thead><tr><th>السؤال</th><th>خيارات الإجابة</th><th>الملاحظات أو الإجابة المختصرة</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div><p><br></p>
        `;

        if (typeof insertSafeHtml === 'function') insertSafeHtml(sheetHtml);
    },

    checkCrashRecovery() {
        const saved = localStorage.getItem('exambuilder_autosave_payload');
        if (saved && saved.trim().length > 100) {
            setTimeout(() => {
                if (confirm("تم العثور على جلسة عمل سابقة غير محفوظة، هل تريد استعادتها الآن؟")) {
                    recordUndoState();
                    document.getElementById("sheetsWrapper").innerHTML = saved;
                    if (typeof restoreUIStateAfterDomUpdate === 'function') restoreUIStateAfterDomUpdate();
                }
            }, 600);
        }
    }
};

const QuranEngine = {
    surahsList: [],
    currentAyahsText: '',

    normalizeArabic(txt) {
        if (!txt) return '';
        return txt
            .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
            .replace(/[إأآٱآ]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/ة/g, 'ه')
            .replace(/ـ/g, '')
            .trim();
    },

    async init() {
        const select = document.getElementById('quranSurahSelect');
        if (select && select.children.length > 0) return;

        try {
            const res = await fetch('https://api.alquran.cloud/v1/surah');
            const data = await res.json();
            if (data.code === 200) {
                this.surahsList = data.data;
                if (select) {
                    select.innerHTML = '';
                    this.surahsList.forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s.number;
                        opt.textContent = `${s.number}. سورة ${s.name} (${s.numberOfAyahs} آية)`;
                        opt.dataset.ayahs = s.numberOfAyahs;
                        select.appendChild(opt);
                    });
                    this.onSurahChange();
                }
            }
        } catch (e) {
            console.error("فشل جلب قائمة السور:", e);
        }
    },

    onSurahChange() {
        const select = document.getElementById('quranSurahSelect');
        if (!select || !select.options[select.selectedIndex]) return;
        const selected = select.options[select.selectedIndex];
        const maxAyahs = parseInt(selected.dataset.ayahs) || 7;

        const fromInp = document.getElementById('quranFromAyah');
        const toInp = document.getElementById('quranToAyah');
        if (fromInp) { fromInp.max = maxAyahs; fromInp.value = 1; }
        if (toInp) { toInp.max = maxAyahs; toInp.value = Math.min(5, maxAyahs); }
    },

    async loadAyahRange() {
        const surahNum = document.getElementById('quranSurahSelect')?.value || 1;
        const from = parseInt(document.getElementById('quranFromAyah')?.value) || 1;
        const to = parseInt(document.getElementById('quranToAyah')?.value) || 5;

        if (from > to) {
            alert("رقم آية البداية يجب أن يكون أصغر من أو يساوي آية النهاية");
            return;
        }

        const box = document.getElementById('quranResultBox');
        if (box) box.innerHTML = `<div style="text-align:center; padding:30px; font-size:14px; color:#0284c7;">جاري جلب الآيات الكريمة بالرسم العثماني...</div>`;

        try {
            const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/editions/quran-uthmani`);
            const data = await res.json();

            if (data.code === 200 && data.data && data.data[0]) {
                const ayahs = data.data[0].ayahs.filter(a => a.numberInSurah >= from && a.numberInSurah <= to);
                const surahName = data.data[0].name;

                let compiled = `﴿ `;
                ayahs.forEach((a) => {
                    let text = a.text;
                    if (a.numberInSurah === 1 && surahNum != 1) {
                        text = text.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', '').replace('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', '').trim();
                    }
                    compiled += `${text} ﴿${typeof formatNumberBySystem === 'function' ? formatNumberBySystem(a.numberInSurah) : a.numberInSurah}﴾ `;
                });
                compiled += `﴾ [${surahName}: ${from}-${to}]`;

                this.currentAyahsText = compiled;
                if (box) box.innerHTML = compiled;

                const info = document.getElementById('quranSelectionInfo');
                if (info) info.textContent = `${surahName} (الآيات: ${from} إلى ${to})`;
            }
        } catch (err) {
            if (box) box.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px;">تعذر الاتصال بقاعدة بيانات القرآن، تأكد من توفر الإنترنت</div>`;
        }
    },

    async searchKeyword() {
        const rawWord = document.getElementById('quranSearchWord')?.value.trim();
        if (!rawWord) return;

        const surahNum = document.getElementById('quranSurahSelect')?.value || 1;
        const box = document.getElementById('quranResultBox');
        if (box) box.innerHTML = `<div style="text-align:center; padding:20px; color:#0284c7;">جاري البحث عن "${rawWord}"...</div>`;

        const normalizedQuery = this.normalizeArabic(rawWord);

        try {
            const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/editions/quran-uthmani,quran-simple`);
            const data = await res.json();

            if (data.code === 200 && data.data && data.data.length >= 2) {
                const uthmaniAyahs = data.data[0].ayahs;
                const simpleAyahs = data.data[1].ayahs;
                const surahName = data.data[0].name;

                const matchedIndices = [];
                simpleAyahs.forEach((a, idx) => {
                    if (this.normalizeArabic(a.text).includes(normalizedQuery)) {
                        matchedIndices.push(idx);
                    }
                });

                if (matchedIndices.length === 0) {
                    if (box) box.innerHTML = `<div style="text-align:center; color:#b45309; padding:20px;">لم يتم العثور على كلمة "${rawWord}" في سورة ${surahName}</div>`;
                    return;
                }

                let compiled = `﴿ `;
                matchedIndices.forEach(idx => {
                    const a = uthmaniAyahs[idx];
                    let text = a.text;
                    if (a.numberInSurah === 1 && surahNum != 1) {
                        text = text.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', '').trim();
                    }
                    compiled += `${text} ﴿${typeof formatNumberBySystem === 'function' ? formatNumberBySystem(a.numberInSurah) : a.numberInSurah}﴾ `;
                });
                compiled += `﴾ [سورة ${surahName}]`;

                this.currentAyahsText = compiled;
                if (box) box.innerHTML = compiled;

                const info = document.getElementById('quranSelectionInfo');
                if (info) info.textContent = `تم العثور على (${matchedIndices.length}) آيات في سورة ${surahName}`;
            }
        } catch (e) {
            if (box) box.innerHTML = `<div style="text-align:center; color:#ef4444; padding:20px;">حدث خطأ في الاتصال بالإنترنت</div>`;
        }
    },

    insertSelectedAyahsToExam() {
        if (!this.currentAyahsText) {
            alert("يرجى جلب الآيات أو البحث عنها أولاً");
            return;
        }

        if (typeof recordUndoState === 'function') recordUndoState();
        if (typeof SoundFX !== 'undefined') SoundFX.pop();

        const formattedHtml = `<span class="quran-inline-text" style="font-family:'Amiri', serif; line-height:inherit;" contenteditable="true" spellcheck="false">${this.currentAyahsText}</span>&nbsp;`;

        if (typeof insertSafeHtml === 'function') {
            insertSafeHtml(formattedHtml);
        } else {
            document.execCommand('insertHTML', false, formattedHtml);
        }

        document.getElementById('quranModal').classList.remove('active');

        if (typeof UIEffects !== 'undefined') {
            UIEffects.showToast("تم إدراج الآيات الكريمة بنجاح!", "success", 3000);
        }
    }
};

if (typeof AdvancedExamTools !== 'undefined') {
    AdvancedExamTools.openQuranModal = function() {
        const modal = document.getElementById("quranModal");
        if (modal) modal.classList.add("active");
        QuranEngine.init();
    };
}