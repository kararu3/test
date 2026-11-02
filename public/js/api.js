/**
 * إدارة اتصالات الـ API المتوافقة مع السيرفر المحلي وسيرفر الأدمن السحابي
 */
const AppAPI = {
    // المسار المباشر لخدمة exam في سيرفر Railway
    ADMIN_REMOTE_URL: "https://scanner-license-server-production.up.railway.app/api/exam",
    LOCAL_URL: "http://localhost:3000",

    getMachineHWID() {
        let hwid = localStorage.getItem("EXAM_HWID_KEY");
        if (!hwid) {
            hwid = "HW-" + Math.random().toString(36).substring(2, 8).toUpperCase();
            localStorage.setItem("EXAM_HWID_KEY", hwid);
        }
        return hwid;
    },

    async verifyLicenseRemote(key, hwid) {
        try {
            const res = await fetch(`${this.ADMIN_REMOTE_URL}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, hwid })
            });
            const data = await res.json();
            return data;
        } catch (err) {
            console.error("تعذر التحقق من سيرفر الأدمن:", err);
            return { valid: false };
        }
    },

    async activateLicenseRemote(key, hwid) {
        try {
            const res = await fetch(`${this.ADMIN_REMOTE_URL}/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, hwid })
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                return {
                    success: false,
                    valid: false,
                    message: data.message || `خطأ من السيرفر (رمز: ${res.status})`
                };
            }

            return {
                success: data.valid === true,
                valid: data.valid === true,
                message: data.message || 'تم التفعيل بنجاح',
                expiresAt: data.expiresAt
            };
        } catch (err) {
            console.error("فشل الاتصال بسيرفر الأدمن:", err);
            return { success: false, valid: false, message: "تعذر الاتصال بالسيرفر السحابي.. تأكد من اتصال الإنترنت" };
        }
    },

    async saveLocalLicense(data) {
        try {
            await fetch(`${this.LOCAL_URL}/api/local/license`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } catch {}
    },

    async getLocalLicense() {
        try {
            const res = await fetch(`${this.LOCAL_URL}/api/local/license`);
            return await res.json();
        } catch {
            return {};
        }
    },

    async fetchBank(lang) {
        const res = await fetch(`${this.LOCAL_URL}/api/bank/${lang}`);
        return await res.json();
    },

    async saveSingleQuestion(lang, qData) {
        const res = await fetch(`${this.LOCAL_URL}/api/bank/${lang}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(qData)
        });
        return await res.json();
    },

    async fetchArchive(lang) {
        const res = await fetch(`${this.LOCAL_URL}/api/archive/${lang}`);
        return await res.json();
    },

    async saveExamArchive(lang, payload) {
        const res = await fetch(`${this.LOCAL_URL}/api/archive/${lang}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await res.json();
    }
};
// حفظ الاختبار في الأرشيف وقاعدة البيانات المزدوجة
async function saveExamToDb() {
    recordUndoState();
    if (typeof SoundFX !== 'undefined') SoundFX.pop();

    const stage = document.getElementById("sheetsWrapper");
    if (!stage) return;

    // استخراج عنوان الامتحان من الترويسة
    const mainTitle = document.querySelector(".main-title")?.innerText.trim() || "امتحان نصف السنة";
    const examId = document.getElementById("examIdSpan")?.innerText.trim() || `EX-${Math.floor(100000 + Math.random() * 900000)}`;
    const dateStr = new Date().toLocaleDateString('ar-IQ');

    const examRecord = {
        exam_id: examId,
        title: mainTitle,
        created_at: dateStr,
        html_content: stage.innerHTML
    };

    // 1. الحفظ الفوري المضمون في LocalStorage
    let archiveList = [];
    try {
        archiveList = JSON.parse(localStorage.getItem('examy_archive_db') || '[]');
    } catch(e) { archiveList = []; }

    const existIdx = archiveList.findIndex(x => x.exam_id === examId);
    if (existIdx >= 0) {
        archiveList[existIdx] = examRecord;
    } else {
        archiveList.unshift(examRecord);
    }
    localStorage.setItem('examy_archive_db', JSON.stringify(archiveList));

    // 2. محاولة الحفظ عبر خادم السيرفر إذا كان متصلاً
    try {
        await fetch('http://localhost:3000/api/exams/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(examRecord)
        });
    } catch (netErr) {
        // تم الحفظ محلياً بنجاح في الخطوة 1 كحماية قصوى
    }

    if (typeof SoundFX !== 'undefined') SoundFX.success();
    if (typeof UIEffects !== 'undefined') {
        UIEffects.showToast(`تم حفظ الاختبار بنجاح في الأرشيف (معرف: ${examId})`, "success", 3500);
    }
}

// دالة جلب الأرشيف المتكاملة
async function loadArchiveFromDb() {
    let list = [];
    try {
        // محاولة القراءة من السيرفر أولاً
        const res = await fetch('http://localhost:3000/api/exams/all');
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) list = data;
        }
    } catch(e) {}

    // إذا تعذر السيرفر يتم الجلب من قاعدة البيانات المحلية المباشرة
    if (list.length === 0) {
        try {
            list = JSON.parse(localStorage.getItem('examy_archive_db') || '[]');
        } catch(e) { list = []; }
    }

    renderArchiveItems(list);
}
async function checkServerConnectionStatus() {
       try {
           const res = await fetch('http://localhost:3000/api/system/stats', { signal: AbortSignal.timeout(1500) });
           if (res.ok) {
               document.getElementById('hudLicStatus').textContent = "متصل بالسيرفر محلياً";
               document.getElementById('hudLicStatus').className = "hud-val text-success";
           }
       } catch(e) {
           const licStat = document.getElementById('hudLicStatus');
           if (licStat) {
               licStat.textContent = "وضع الأرشيف المحلي (بدون سيرفر)";
               licStat.style.color = "#f59e0b";
           }
       }
   }
   setInterval(checkServerConnectionStatus, 10000);