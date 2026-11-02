/**
 * Examy PRO - محرك الإملاء الصوتي المباشر النظيف (بدون رموز عشوائية)
 */
const VoiceEngine = {
    isListening: false,
    recInstance: null,

   async toggleListening() {
        if (this.isListening) {
            this.stop();
            return;
        }

        this.isListening = true;
        this.updateUI(true);
        if (typeof SoundFX !== 'undefined') SoundFX.pop();

        // فتح صندوق الكتابة الصوتي الفوري
        let box = document.getElementById('voiceLiveBox');
        if (box) box.remove();

        box = document.createElement('div');
        box.id = 'voiceLiveBox';
        box.style.cssText = 'position:fixed; bottom:60px; left:50%; transform:translateX(-50%); width:460px; max-width:90vw; background:#0f172a; border:2px solid #38bdf8; border-radius:12px; padding:12px; z-index:999999; box-shadow:0 15px 40px rgba(0,0,0,0.8); color:#fff; display:flex; flex-direction:column; gap:8px;';
        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:#38bdf8; font-size:13px;">🎙️ تحدث الآن أو اكتب بصوتك عبر [Win + H]</strong>
                <button type="button" onclick="VoiceEngine.stop()" style="background:#334155; border:none; color:#cbd5e1; border-radius:50%; width:22px; height:22px; cursor:pointer;">✖</button>
            </div>
            <textarea id="liveVoiceText" placeholder="سجل هنا ثم اضغط إدراج..." style="width:100%; height:70px; background:#1e293b; color:#fff; border:1px solid #334155; border-radius:6px; padding:8px; font-family:inherit; font-size:13px; resize:none; outline:none; box-sizing:border-box;"></textarea>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
                <button type="button" class="tool-btn" style="background:#059669; padding:5px 14px; font-weight:bold;" onclick="VoiceEngine.commitBoxText()">إدراج في السؤال ↵</button>
            </div>
        `;
        document.body.appendChild(box);

        const area = document.getElementById('liveVoiceText');
        if (area) area.focus();

        // تجربة التقاط الصوت إذا كان SpeechRecognition متاحاً
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRec) {
            try {
                this.recognition = new SpeechRec();
                this.recognition.lang = (typeof currentLang !== 'undefined' && currentLang === 'en') ? 'en-US' : 'ar-IQ';
                this.recognition.continuous = true;
                this.recognition.onresult = (ev) => {
                    let res = '';
                    for (let i = ev.resultIndex; i < ev.results.length; ++i) {
                        res += ev.results[i][0].transcript;
                    }
                    if (area && res.trim()) area.value = res;
                };
                this.recognition.start();
            } catch(e) {}
        }
    },

    commitBoxText() {
        const area = document.getElementById('liveVoiceText');
        if (area && area.value.trim()) {
            this.insertTextToActiveArea(area.value.trim());
        }
        this.stop();
    },

    stop() {
        this.isListening = false;
        if (this.recInstance) {
            try { this.recInstance.stop(); } catch(e){}
            this.recInstance = null;
        }
        this.updateUI(false);
        const box = document.getElementById('voiceLiveBox');
        if (box) box.remove();
    },

    openDictationBox() {
        let box = document.getElementById('voiceLiveBox');
        if (box) box.remove();

        box = document.createElement('div');
        box.id = 'voiceLiveBox';
        box.style.cssText = `
            position: fixed;
            bottom: 60px;
            left: 50%;
            transform: translateX(-50%);
            width: 480px;
            max-width: 92vw;
            background: #0f172a;
            border: 2px solid #38bdf8;
            border-radius: 14px;
            padding: 14px;
            z-index: 1000000;
            box-shadow: 0 20px 50px rgba(0,0,0,0.85);
            display: flex;
            flex-direction: column;
            gap: 10px;
            color: #fff;
            animation: dropdownPop 0.2s ease-out;
            font-family: inherit;
        `;

        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:#38bdf8; font-size:13.5px; display:flex; align-items:center; gap:8px;">
                    <span style="font-size:18px;">🎙️</span> لوحة الإملاء الصوتي المباشر
                </strong>
                <button type="button" onclick="VoiceEngine.stop()" style="background:#334155; border:none; color:#cbd5e1; border-radius:50%; width:24px; height:24px; cursor:pointer;">✖</button>
            </div>
            <textarea id="liveVoiceTranscript" placeholder="تحدث الآن أو اكتب بصوتك هنا (يمكنك أيضاً ضغط Win + H للكتابة بصوتك عبر ويندوز)..." style="width:100%; height:75px; background:#1e293b; color:#fff; border:1.5px solid #334155; border-radius:8px; padding:8px 10px; font-family:inherit; font-size:13px; resize:none; outline:none; box-sizing:border-box;"></textarea>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <small style="color:#94a3b8; font-size:11px;">اضغط زر (إدراج) أو اضغط Enter لنقل الكلام للورقة فوراً</small>
                <div style="display:flex; gap:8px;">
                    <button type="button" class="tool-btn" style="background:#059669; padding:6px 16px; font-weight:800;" onclick="VoiceEngine.commitText()">إدراج في السؤال ↵</button>
                    <button type="button" class="tool-btn" style="background:#475569; padding:6px 12px;" onclick="VoiceEngine.stop()">إلغاء</button>
                </div>
            </div>
        `;

        document.body.appendChild(box);
        const area = document.getElementById('liveVoiceTranscript');
        if (area) {
            area.focus();
            area.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    VoiceEngine.commitText();
                }
            });
        }
    },

    commitText() {
        const area = document.getElementById('liveVoiceTranscript');
        if (!area || !area.value.trim()) {
            this.stop();
            return;
        }

        let text = area.value.trim();

        if (text.includes("سؤال جديد") || text.includes("انشئ سؤال")) {
            if (typeof createNewQuestion === 'function') createNewQuestion();
            this.stop();
            return;
        }

        text = text
            .replace(/علامة استفهام/g, '؟')
            .replace(/فاصلة/g, '،')
            .replace(/نقطتين/g, ':');

        const activeArea = document.activeElement && document.activeElement.isContentEditable
            ? document.activeElement
            : (typeof activeQuestionCard !== 'undefined' && activeQuestionCard 
                ? activeQuestionCard.querySelector('.text-area, .q-content-box') 
                : document.querySelector('.question-container:last-child .text-area'));

        if (activeArea) {
            activeArea.focus();
            document.execCommand('insertText', false, text + ' ');
        } else {
            if (typeof insertSafeHtml === 'function') {
                insertSafeHtml(`<span>${text} </span>`);
            }
        }

        if (typeof SoundFX !== 'undefined') SoundFX.pop();
        this.stop();
    },

    updateUI(active) {
        const btn = document.getElementById("voiceTypingBtn");
        if (btn) {
            btn.style.background = active ? "#dc2626" : "#6366f1";
            btn.innerHTML = active ? "🎙️ استماع نشط..." : "🎤 إملاء صوتي";
        }
    }
};

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        VoiceEngine.toggleListening();
    }
});