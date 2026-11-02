const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;

// CORS محدود إلى نفس الجهاز أو عناوين الشبكة المحلية؛ مع السماح بتطبيق Electron (بدون Origin).
app.use(cors({
    origin(origin, callback) {
        if (!origin) return callback(null, true);
        try {
            const u = new URL(origin);
            const host = u.hostname;
            const local = host === 'localhost' || host === '127.0.0.1' ||
                /^10\./.test(host) || /^192\.168\./.test(host) ||
                /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
            callback(local ? null : new Error('Origin غير مسموح'), local);
        } catch { callback(new Error('Origin غير صالح')); }
    }
}));
app.use(express.json({ limit: '50mb' }));

const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

const DB_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const StorageEngine = {
    read(fileName, defaultVal = []) {
        const safeName = path.basename(fileName);
        const filePath = path.join(DB_DIR, safeName);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2), 'utf-8');
            return defaultVal;
        }
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (readError) {
            // Recover from the last known-good atomic-write backup if available.
            const backupPath = filePath + '.bak';
            try {
                if (fs.existsSync(backupPath)) {
                    const recovered = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
                    fs.copyFileSync(backupPath, filePath);
                    console.error(`تمت استعادة ${fileName} من النسخة الاحتياطية.`);
                    return recovered;
                }
            } catch (backupError) {
                console.error('تعذرت استعادة النسخة الاحتياطية:', backupError.message);
            }
            console.error('تعذر قراءة ملف البيانات:', fileName, readError.message);
            return defaultVal;
        }
    },
    write(fileName, data) {
        if (!fileName || path.basename(fileName) !== fileName) throw new Error('اسم ملف قاعدة البيانات غير صالح');
        if (data === undefined) throw new Error('لا يمكن حفظ قيمة غير معرفة');
        // Atomic write + rotating backup: لا يُستبدل ملف البيانات قبل اكتمال الكتابة.
        const safeName = path.basename(fileName);
        const filePath = path.join(DB_DIR, safeName);
        const tempPath = filePath + '.tmp';
        const backupPath = filePath + '.bak';
        const serialized = JSON.stringify(data, null, 2);
        fs.writeFileSync(tempPath, serialized, { encoding: 'utf-8', flag: 'w' });
        if (fs.existsSync(filePath)) {
            try { fs.copyFileSync(filePath, backupPath); } catch (e) { console.error('تعذر إنشاء النسخة الاحتياطية:', e.message); }
        }
        fs.renameSync(tempPath, filePath);
    }
};

function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

app.get('/api/lan/info', (req, res) => {
    const ip = getLocalIpAddress();
    res.json({
        ip: ip,
        port: PORT,
        url: `http://${ip}:${PORT}`,
        active: true
    });
});

app.post('/api/lan/submit', (req, res) => {
    const incomingExam = req.body;
    if (!incomingExam || !incomingExam.htmlPayload) {
        return res.status(400).json({ success: false, message: 'بيانات الاختبار غير مكتملة' });
    }
    let queue = StorageEngine.read('lan_queue.json', []);
    const queueItem = {
        id: "LAN-" + Date.now(),
        sender: incomingExam.sender || "جهاز عبر الشبكة",
        title: incomingExam.title || "اختبار مرسل",
        date: new Date().toISOString(),
        payload: incomingExam
    };
    queue.unshift(queueItem);
    StorageEngine.write('lan_queue.json', queue);
    res.json({ success: true, message: 'تم إرسال الاختبار بنجاح', queueId: queueItem.id });
});

app.get('/api/lan/queue', (req, res) => {
    res.json(StorageEngine.read('lan_queue.json', []));
});

// مسارات الترخيص
app.post('/api/license/activate', (req, res) => {
    const { key, hwid } = req.body;
    if (!key || key.trim() === '') {
        return res.status(400).json({ success: false, message: 'يرجى إدخال مفتاح الترخيص' });
    }

    const licData = {
        key: key.trim(),
        hwid: hwid || 'HW-LOCAL',
        status: 'active',
        activatedAt: new Date().toISOString()
    };
    StorageEngine.write('config.json', licData);
    return res.json({ success: true, message: 'تم تفعيل البرنامج بنجاح' });
});

app.post('/api/license/verify', (req, res) => {
    const saved = StorageEngine.read('config.json', {});
    if (saved && saved.key) {
        return res.json({ valid: true, license: saved });
    }
    return res.json({ valid: false });
});

app.get('/api/local/license', (req, res) => {
    res.json(StorageEngine.read('config.json', {}));
});

app.post('/api/local/license', (req, res) => {
    StorageEngine.write('config.json', req.body);
    res.json({ success: true });
});

// إحصائيات النظام
app.get('/api/system/stats', (req, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPercent = Math.round((usedMem / totalMem) * 100);

    const cpus = os.cpus();
    let idle = 0, total = 0;
    for (let cpu of cpus) {
        for (let type in cpu.times) {
            total += cpu.times[type];
        }
        idle += cpu.times.idle;
    }
    const cpuPercent = Math.min(100, Math.max(0, Math.round(100 - (100 * idle / total))));

    res.json({
        cpuPercent: cpuPercent || 8,
        ramPercent: ramPercent,
        cores: cpus.length
    });
});

// بنك الأسئلة
app.get('/api/bank/:lang', (req, res) => {
    const lang = req.params.lang === 'en' ? 'en' : 'ar';
    res.json(StorageEngine.read(`bank_${lang}.json`));
});

app.post('/api/bank/:lang', (req, res) => {
    const lang = req.params.lang === 'en' ? 'en' : 'ar';
    const bank = StorageEngine.read(`bank_${lang}.json`);
    if (!Array.isArray(bank)) return res.status(500).json({ success: false, message: 'بنك الأسئلة تالف أو غير صالح' });
    const newQuestion = {
        id: "Q-" + Math.floor(1000 + Math.random() * 9000),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    bank.unshift(newQuestion);
    StorageEngine.write(`bank_${lang}.json`, bank);
    res.json({ success: true, question: newQuestion });
});

// مسارات الأرشيف الأساسية والبديلة لمنع أي خطأ 404
app.get('/api/archive/:lang', (req, res) => {
    const lang = req.params.lang === 'en' ? 'en' : 'ar';
    res.json(StorageEngine.read(`archive_${lang}.json`));
});

app.post('/api/archive/:lang', (req, res) => {
    const lang = req.params.lang === 'en' ? 'en' : 'ar';
    let archive = StorageEngine.read(`archive_${lang}.json`);
    if (!Array.isArray(archive)) return res.status(500).json({ success: false, message: 'الأرشيف تالف أو غير صالح' });
    const record = {
        id: req.body.id || ("EX-" + Math.floor(100000 + Math.random() * 900000)),
        title: req.body.title,
        date: req.body.date,
        lang: lang,
        htmlPayload: req.body.htmlPayload,
        updatedAt: new Date().toISOString()
    };
    
    const idx = archive.findIndex(x => x.id === record.id);
    if (idx !== -1) {
        archive[idx] = record;
    } else {
        archive.unshift(record);
    }
    
    StorageEngine.write(`archive_${lang}.json`, archive);
    res.json({ success: true, exam: record });
});

// توافق إضافي مع مسارات /api/exams
app.get('/api/exams/all', (req, res) => {
    const archiveAr = StorageEngine.read('archive_ar.json');
    const archiveEn = StorageEngine.read('archive_en.json');
    res.json([...archiveAr, ...archiveEn]);
});

app.post('/api/exams/save', (req, res) => {
    let archive = StorageEngine.read('archive_ar.json');
    const record = {
        id: req.body.exam_id || ("EX-" + Date.now()),
        title: req.body.title,
        date: req.body.created_at,
        lang: 'ar',
        htmlPayload: req.body.html_content,
        updatedAt: new Date().toISOString()
    };
    archive.unshift(record);
    StorageEngine.write('archive_ar.json', archive);
    res.json({ success: true });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Examy PRO LAN Server running on http://localhost:${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`تنبيه: المنفذ ${PORT} محجوز ويعمل مسبقاً.`);
    } else {
        console.error("خطأ تشغيل السيرفر:", err);
    }
});
// OpenAI-compatible local AI assistant. API key stays in the local database folder.
const https = require('https');
function openAIChatCompletion(apiKey, model, messages) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ model, messages, temperature: 0.7 });
        const req = https.request({
            hostname: 'api.openai.com', path: '/v1/chat/completions', method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 90000
        }, response => {
            let raw = ''; response.setEncoding('utf8'); response.on('data', chunk => raw += chunk);
            response.on('end', () => { let data; try { data = JSON.parse(raw); } catch { return reject(new Error('استجابة غير مفهومة من خدمة الذكاء الاصطناعي')); }
                if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(data.error?.message || `خطأ خدمة الذكاء الاصطناعي (${response.statusCode})`));
                resolve(data.choices?.[0]?.message?.content || 'لم تُرجع الخدمة محتوى.');
            });
        });
        req.on('timeout', () => req.destroy(new Error('انتهت مهلة الاتصال بخدمة الذكاء الاصطناعي')));
        req.on('error', reject); req.write(body); req.end();
    });
}
function requireLoopbackForAI(req, res, next) {
    const ip = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    const host = String(req.hostname || '').toLowerCase();
    if (!['127.0.0.1', '::1', 'localhost'].includes(ip) || !['localhost', '127.0.0.1'].includes(host)) {
        return res.status(403).json({ error: 'إعدادات الذكاء الاصطناعي متاحة من الجهاز المحلي فقط.' });
    }
    next();
}
app.use('/api/ai', requireLoopbackForAI);
app.get('/api/ai/config', (req, res) => {
    const cfg = StorageEngine.read('ai-config.json', {});
    res.json({ configured: !!cfg.apiKey, model: cfg.model || 'gpt-4o-mini' });
});
app.post('/api/ai/config', (req, res) => {
    const key = String(req.body?.key || '').trim();
    const model = String(req.body?.model || 'gpt-4o-mini').trim().slice(0, 100);
    if (!key || key.length < 20 || key.length > 300) return res.status(400).json({ success: false, message: 'مفتاح API غير صالح أو فارغ.' });
    const aiConfigPath = path.join(DB_DIR, 'ai-config.json');
    const aiTempPath = aiConfigPath + '.tmp';
    fs.writeFileSync(aiTempPath, JSON.stringify({ apiKey: key, model, updatedAt: new Date().toISOString() }, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(aiTempPath, aiConfigPath);
    res.json({ success: true, message: 'تم حفظ مفتاح API محلياً.' });
});
app.post('/api/ai/generate', async (req, res) => {
    try {
        const cfg = StorageEngine.read('ai-config.json', {});
        if (!cfg.apiKey) return res.status(400).json({ error: 'أضف مفتاح API من إعدادات مساعد الذكاء الاصطناعي أولاً.' });
        const subject = String(req.body?.subject || 'عام').slice(0, 120);
        const grade = String(req.body?.grade || 'غير محدد').slice(0, 120);
        const prompt = String(req.body?.prompt || '').trim().slice(0, 6000);
        if (!prompt) return res.status(400).json({ error: 'وصف الأسئلة مطلوب.' });
        const text = await openAIChatCompletion(cfg.apiKey, cfg.model || 'gpt-4o-mini', [
            { role: 'system', content: 'أنت مساعد متخصص في إعداد الاختبارات المدرسية باللغة العربية. أنشئ أسئلة دقيقة ومتنوعة، رقّمها، وأضف الإجابات النموذجية في قسم منفصل. لا تخترع مصادر أو حقائق، واذكر أن المعلم يجب أن يراجع المحتوى.' },
            { role: 'user', content: `المادة: ${subject}\nالصف: ${grade}\nالمطلوب: ${prompt}` }
        ]);
        res.json({ success: true, text });
    } catch (error) { console.error('AI generation failed:', error.message); res.status(502).json({ error: error.message || 'تعذر الاتصال بخدمة الذكاء الاصطناعي.' }); }
});
