/**
 * Examy PRO - Local LAN Sharing & Printing Hub
 */

const LanHub = {
    async fetchLanInfo() {
        try {
            const res = await fetch('http://localhost:3000/api/lan/info');
            return await res.json();
        } catch {
            return { ip: '127.0.0.1', port: 3000, active: false };
        }
    },

    async openLanDialog() {
        if (typeof SoundFX !== 'undefined') SoundFX.pop();
        const info = await this.fetchLanInfo();
        const modal = document.getElementById("lanModal");
        const urlElem = document.getElementById("lanServerUrl");
        const qrBox = document.getElementById("lanQrCode");

        if (urlElem) urlElem.textContent = info.url || "http://127.0.0.1:3000";
        if (qrBox) {
            qrBox.innerHTML = "";
            new QRCode(qrBox, {
                text: info.url,
                width: 140,
                height: 140
            });
        }

        if (modal) modal.classList.add("active");
        this.checkLanQueue();
    },

    async checkLanQueue() {
        try {
            const res = await fetch('http://localhost:3000/api/lan/queue');
            const queue = await res.json();
            const host = document.getElementById("lanIncomingList");
            if (!host) return;

            host.innerHTML = "";
            if (queue.length === 0) {
                host.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:15px;">لا توجد اختبارات مرسلة حالياً عبر الشبكة</div>`;
                return;
            }

            queue.forEach(item => {
                const box = document.createElement("div");
                box.style.cssText = "background:#f8fafc; border:1px solid #cbd5e1; padding:8px 12px; border-radius:6px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;";
                box.innerHTML = `
                    <div>
                        <strong>${item.title}</strong>
                        <small style="display:block; color:#64748b;">المرسل: ${item.sender}</small>
                    </div>
                    <button class="tool-btn" style="background:#0284c7;" onclick="LanHub.loadIncomingExam('${item.id}')">فتح للطباعة 🖨️</button>
                `;
                host.appendChild(box);
            });
        } catch {}
    },

    async loadIncomingExam(id) {
        try {
            const res = await fetch('http://localhost:3000/api/lan/queue');
            const queue = await res.json();
            const exam = queue.find(x => x.id === id);
            if (exam && exam.payload) {
                recordUndoState();
                document.getElementById("sheetsWrapper").innerHTML = exam.payload.htmlPayload;
                if (typeof restoreUIStateAfterDomUpdate === 'function') restoreUIStateAfterDomUpdate();
                document.getElementById("lanModal")?.classList.remove("active");
                alert("تم استلام وفتح الاختبار من الشبكة بنجاح!");
            }
        } catch {}
    }
};