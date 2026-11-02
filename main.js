const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Keep writable JSON data outside app.asar / the installed application directory.
try {
    process.env.EXAMY_DATA_DIR = process.env.EXAMY_DATA_DIR || path.join(app.getPath('userData'), 'database');
    require('./server.js');
} catch (err) {
    console.log("السيرفر قيد العمل مسبقاً:", err.message);
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({

        width: 1360,
        height: 880,
        minWidth: 1050,
        minHeight: 720,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0f172a',
            symbolColor: '#f8fafc',
            height: 32
        },
        icon: path.join(__dirname, 'public', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            spellcheck: true
        }
    });
    // البحث عن أي ملف .exam تم تمريره عند فتح التطبيق
function getExamFilePathFromArgs(argv) {
    return argv.find(arg => arg && arg.toLowerCase().endsWith('.exam'));
}

// إرسال محتوى الملف إلى واجهة البرنامج عند اكتمال التحميل
function handleFileOpen(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return;
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('load-exam-from-file', fileContent);
        });
        // في حال كانت النافذة مفتوحة مسبقاً
        if (!mainWindow.webContents.isLoading()) {
            mainWindow.webContents.send('load-exam-from-file', fileContent);
        }
    } catch (err) {
        console.error("خطأ قراءة ملف الاختبار:", err);
    }
}

    // تفعيل قواميس التدقيق الإملائي العربي والإنجليزي
    // تفعيل التدقيق الإملائي بأمان للإنجليزية فقط لمنع التنبيه
    const ses = mainWindow.webContents.session;
    try {
        ses.setSpellCheckerLanguages(['en-US']);
    } catch (e) {}

    // منح تصريح استخدام الميكروفون تلقائياً
    ses.setPermissionCheckHandler((_webContents, permission) => permission === 'media');
    ses.setPermissionRequestHandler((_webContents, permission, callback) => {
        callback(permission === 'media');
    });

    mainWindow.maximize();
    mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));
    const startFile = getExamFilePathFromArgs(process.argv);
    if (startFile) {
        handleFileOpen(startFile);
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        const openFile = getExamFilePathFromArgs(commandLine);
        if (openFile) handleFileOpen(openFile);
    }
});

ipcMain.handle('set-zoom-factor', (event, factor) => {
    if (event.sender !== mainWindow?.webContents) return { success: false };
    const value = Number(factor);
    if (!Number.isFinite(value) || value < 0.5 || value > 2) return { success: false };
    event.sender.setZoomFactor(value);
    return { success: true };
});

// 1. جلب الطابعات الحقيقية من مشغل ويندوز
ipcMain.handle('get-system-printers', async () => {
    return new Promise((resolve) => {
        const psCmd = `powershell -NoProfile -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Drawing; [System.Drawing.Printing.PrinterSettings]::InstalledPrinters | ForEach-Object { $ps = New-Object System.Drawing.Printing.PrinterSettings; $ps.PrinterName = $_; $pList = @($ps.PaperSizes | ForEach-Object { $_.PaperName }); [PSCustomObject]@{ name = $_; isDefault = $ps.IsDefaultPrinter; papers = $pList } } | ConvertTo-Json -Depth 2"`;

        exec(psCmd, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }, async (err, stdout) => {
            let printersList = [];
            if (!err && stdout && stdout.trim()) {
                try {
                    let parsed = JSON.parse(stdout.trim());
                    if (!Array.isArray(parsed)) parsed = [parsed];
                    printersList = parsed.map(p => ({
                        name: p.name,
                        isDefault: !!p.isDefault,
                        papers: Array.isArray(p.papers) && p.papers.length > 0 
                            ? Array.from(new Set(p.papers.map(x => String(x).trim()).filter(Boolean))) 
                            : ['A4', 'A3', 'Letter', 'Legal']
                    }));
                } catch (e) {
                    console.log("خطأ تحليل JSON الطابعات:", e.message);
                }
            }

            if (printersList.length === 0) {
                try {
                    const win = BrowserWindow.getFocusedWindow() || mainWindow;
                    const elPrinters = await win.webContents.getPrintersAsync();
                    printersList = elPrinters.map(p => ({
                        name: p.name,
                        isDefault: p.isDefault,
                        papers: (p.paperSizes && p.paperSizes.length > 0) ? p.paperSizes.map(sz => sz.name || sz) : ['A4', 'A3', 'Letter', 'Legal']
                    }));
                } catch (e) {}
            }

            resolve({ success: true, printers: printersList });
        });
    });
});

// 2. تفضيلات الطابعة
ipcMain.handle('open-printer-properties', async (event, printerName) => {
    if (!printerName) return { success: false, message: "يرجى تحديد طابعة" };
    return new Promise((resolve) => {
        const cmd = `rundll32 printui.dll,PrintUIEntry /e /n "${printerName}"`;
        exec(cmd, (err) => resolve({ success: !err, error: err ? err.message : null }));
    });
});

// 3. الطباعة الصامتة والمباشرة
ipcMain.handle('print-sheet-direct', async (event, { printerName = '', pageSize = 'A4', landscape = false } = {}) => {
    try {
        const win = BrowserWindow.getFocusedWindow() || mainWindow;
        const printOptions = {
            silent: false,
            printBackground: true,
            color: true,
            landscape: !!landscape,
            margins: { marginType: 'none' }
        };

        if (printerName && printerName.trim() !== '' && printerName !== 'طابعة النظام الافتراضية') {
            printOptions.deviceName = printerName.trim();
        }

        if (pageSize && typeof pageSize === 'string') {
            printOptions.pageSize = pageSize.trim();
        }

        const printed = await new Promise((resolve) => {
            win.webContents.print(printOptions, (success, failureReason) => {
                if (!success) console.log("حالة تنفيذ الطباعة:", failureReason);
                resolve({ success: !!success, error: success ? null : (failureReason || 'فشلت الطباعة') });
            });
        });
        return printed;
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// 4. تصدير PDF مباشر فائق الدقة
ipcMain.handle('print-to-pdf-native', async (event, { pageSize = 'A4', landscape = false } = {}) => {
    try {
        const win = BrowserWindow.getFocusedWindow() || mainWindow;
        const pdfData = await win.webContents.printToPDF({
            pageSize: pageSize || 'A4',
            landscape: !!landscape,
            printBackground: true,
            margins: { marginType: 'none' }
        });

        const { filePath, canceled } = await dialog.showSaveDialog(win, {
            title: `حفظ ملف الاختبار PDF (${pageSize})`,
            defaultPath: path.join(app.getPath('desktop'), `اختبار_${Date.now()}.pdf`),
            filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
        });

        if (canceled || !filePath) return { success: false, canceled: true };
        fs.writeFileSync(filePath, pdfData);
        return { success: true, filePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
});



app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (error) => {
    console.error('An uncaught error occurred in main process:', error);
});