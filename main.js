'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execFile } = require('child_process');

// Only one application instance may own the local HTTP service and its JSON database.
const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) {
    app.quit();
} else {
    // Keep writable JSON data outside app.asar / the installed application directory.
    process.env.EXAMY_DATA_DIR = process.env.EXAMY_DATA_DIR || path.join(app.getPath('userData'), 'database');
    try {
        require('./server.js');
    } catch (err) {
        console.error('تعذر تشغيل خدمة Examy المحلية:', err);
    }
}

let mainWindow = null;
let pendingExamFile = null;
let rendererReady = false;

function getExamFilePathFromArgs(argv = []) {
    const candidate = argv.find(arg =>
        typeof arg === 'string' &&
        arg.toLowerCase().endsWith('.exam') &&
        fs.existsSync(arg) &&
        fs.statSync(arg).isFile()
    );
    return candidate ? path.resolve(candidate) : null;
}

function queueExamFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return;
    try {
        if (!fs.statSync(filePath).isFile() || path.extname(filePath).toLowerCase() !== '.exam') return;
        pendingExamFile = path.resolve(filePath);
        sendPendingExamFile();
    } catch (error) {
        console.error('تعذر تجهيز ملف الاختبار:', error.message);
    }
}

function sendPendingExamFile() {
    if (!pendingExamFile || !rendererReady || !mainWindow || mainWindow.isDestroyed()) return;
    const filePath = pendingExamFile;
    pendingExamFile = null;
    try {
        const stat = fs.statSync(filePath);
        if (stat.size > 25 * 1024 * 1024) throw new Error('حجم ملف الاختبار يتجاوز الحد المسموح (25MB).');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        mainWindow.webContents.send('load-exam-from-file', fileContent);
    } catch (error) {
        console.error('خطأ قراءة ملف الاختبار:', error.message);
        dialog.showErrorBox('تعذر فتح ملف الاختبار', error.message);
    }
}

function isTrustedAppOrigin(origin) {
    try {
        return new URL(origin).protocol === 'file:';
    } catch {
        return origin === 'file://';
    }
}

function isTrustedSender(event) {
    return !!mainWindow &&
        !mainWindow.isDestroyed() &&
        event.sender === mainWindow.webContents &&
        isTrustedAppOrigin(event.senderFrame?.url || event.sender.getURL());
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1360,
        height: 880,
        minWidth: 1050,
        minHeight: 720,
        backgroundColor: '#070b14',
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#172746',
            symbolColor: '#f8fafc',
            height: 34
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

    const ses = mainWindow.webContents.session;
    try {
        ses.setSpellCheckerLanguages(['en-US']);
    } catch (error) {
        console.warn('تعذر تفعيل قاموس التدقيق الإملائي:', error.message);
    }

    // Grant microphone access only to this packaged local application, never to remote pages.
    ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) =>
        webContents === mainWindow?.webContents &&
        permission === 'media' &&
        isTrustedAppOrigin(requestingOrigin)
    );
    ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
        const origin = details?.requestingUrl || webContents?.getURL() || '';
        callback(
            webContents === mainWindow?.webContents &&
            permission === 'media' &&
            isTrustedAppOrigin(origin)
        );
    });

    mainWindow.webContents.on('did-finish-load', () => {
        rendererReady = true;
        sendPendingExamFile();
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
        rendererReady = false;
        console.error('توقف محرك الواجهة:', details);
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // The application does not need arbitrary child windows.
        console.warn('تم منع فتح نافذة خارجية من داخل التطبيق:', url);
        return { action: 'deny' };
    });

    mainWindow.maximize();
    mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));
    queueExamFile(getExamFilePathFromArgs(process.argv));

    mainWindow.on('closed', () => {
        mainWindow = null;
        rendererReady = false;
    });
}

if (hasSingleInstance) {
    app.on('second-instance', (_event, commandLine) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
        queueExamFile(getExamFilePathFromArgs(commandLine));
    });

    app.on('open-file', (event, filePath) => {
        event.preventDefault();
        queueExamFile(filePath);
    });

    app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

function rejectUntrusted(event) {
    return isTrustedSender(event);
}

ipcMain.handle('set-zoom-factor', (event, factor) => {
    if (!rejectUntrusted(event)) return { success: false, error: 'طلب غير موثوق.' };
    const value = Number(factor);
    if (!Number.isFinite(value) || value < 0.5 || value > 2) {
        return { success: false, error: 'قيمة التكبير خارج النطاق المسموح.' };
    }
    event.sender.setZoomFactor(value);
    return { success: true };
});

// Discover Windows printers. The renderer may only request this from the packaged app.
ipcMain.handle('get-system-printers', async (event) => {
    if (!rejectUntrusted(event)) return { success: false, printers: [], error: 'طلب غير موثوق.' };
    return new Promise((resolve) => {
        const psCmd = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Drawing; [System.Drawing.Printing.PrinterSettings]::InstalledPrinters | ForEach-Object { $ps = New-Object System.Drawing.Printing.PrinterSettings; $ps.PrinterName = $_; $pList = @($ps.PaperSizes | ForEach-Object { $_.PaperName }); [PSCustomObject]@{ name = $_; isDefault = $ps.IsDefaultPrinter; papers = $pList } } | ConvertTo-Json -Depth 2';
        exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCmd], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, windowsHide: true }, async (err, stdout) => {
            let printersList = [];
            if (!err && stdout?.trim()) {
                try {
                    let parsed = JSON.parse(stdout.trim());
                    if (!Array.isArray(parsed)) parsed = [parsed];
                    printersList = parsed.filter(p => p && typeof p.name === 'string').map(p => ({
                        name: p.name,
                        isDefault: !!p.isDefault,
                        papers: Array.isArray(p.papers) && p.papers.length
                            ? [...new Set(p.papers.map(x => String(x).trim()).filter(Boolean))]
                            : ['A4', 'A3', 'Letter', 'Legal']
                    }));
                } catch (error) {
                    console.warn('تعذر تحليل قائمة الطابعات:', error.message);
                }
            }
            if (!printersList.length) {
                try {
                    const printers = await mainWindow.webContents.getPrintersAsync();
                    printersList = printers.map(p => ({
                        name: p.name,
                        isDefault: !!p.isDefault,
                        papers: Array.isArray(p.paperSizes) && p.paperSizes.length
                            ? p.paperSizes.map(size => size.name || size)
                            : ['A4', 'A3', 'Letter', 'Legal']
                    }));
                } catch (error) {
                    console.warn('تعذر قراءة طابعات Electron:', error.message);
                }
            }
            resolve({ success: true, printers: printersList });
        });
    });
});

// Open printer properties without passing a user-controlled string through a shell.
ipcMain.handle('open-printer-properties', async (event, printerName) => {
    if (!rejectUntrusted(event)) return { success: false, error: 'طلب غير موثوق.' };
    if (typeof printerName !== 'string' || !printerName.trim()) {
        return { success: false, message: 'يرجى تحديد طابعة.' };
    }
    const name = printerName.trim();
    try {
        const installed = await mainWindow.webContents.getPrintersAsync();
        if (!installed.some(printer => printer.name === name)) {
            return { success: false, error: 'الطابعة المحددة غير موجودة ضمن طابعات Windows.' };
        }
    } catch (error) {
        return { success: false, error: 'تعذر التحقق من الطابعة: ' + error.message };
    }
    return new Promise(resolve => {
        execFile('rundll32.exe', ['printui.dll,PrintUIEntry', '/e', '/n', name], { windowsHide: true }, error =>
            resolve({ success: !error, error: error ? error.message : null })
        );
    });
});

function normalizePrintOptions(options = {}) {
    const allowedPaperSizes = new Set(['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid', 'Executive', 'B5']);
    const requested = typeof options.pageSize === 'string' ? options.pageSize.trim() : 'A4';
    return {
        pageSize: allowedPaperSizes.has(requested) ? requested : 'A4',
        landscape: options.landscape === true,
        printerName: typeof options.printerName === 'string' ? options.printerName.trim().slice(0, 200) : ''
    };
}

// Send a print job and return the actual callback result.
ipcMain.handle('print-sheet-direct', async (event, options = {}) => {
    if (!rejectUntrusted(event)) return { success: false, error: 'طلب غير موثوق.' };
    try {
        const win = mainWindow;
        if (!win || win.isDestroyed()) throw new Error('نافذة البرنامج غير متاحة.');
        const normalized = normalizePrintOptions(options);
        const printOptions = {
            silent: false,
            printBackground: true,
            color: true,
            landscape: normalized.landscape,
            pageSize: normalized.pageSize,
            margins: { marginType: 'none' }
        };
        if (normalized.printerName && normalized.printerName !== 'طابعة النظام الافتراضية') {
            const installed = await win.webContents.getPrintersAsync();
            if (!installed.some(printer => printer.name === normalized.printerName)) {
                throw new Error('الطابعة المحددة غير موجودة.');
            }
            printOptions.deviceName = normalized.printerName;
        }
        return await new Promise(resolve => {
            win.webContents.print(printOptions, (success, failureReason) => {
                if (!success) console.error('فشلت الطباعة:', failureReason);
                resolve({ success: !!success, error: success ? null : (failureReason || 'فشلت الطباعة.') });
            });
        });
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Native PDF export with a save dialog and explicit failure handling.
ipcMain.handle('print-to-pdf-native', async (event, options = {}) => {
    if (!rejectUntrusted(event)) return { success: false, error: 'طلب غير موثوق.' };
    try {
        const win = mainWindow;
        if (!win || win.isDestroyed()) throw new Error('نافذة البرنامج غير متاحة.');
        const normalized = normalizePrintOptions(options);
        const pdfData = await win.webContents.printToPDF({
            pageSize: normalized.pageSize,
            landscape: normalized.landscape,
            printBackground: true,
            margins: { marginType: 'none' }
        });
        const { filePath, canceled } = await dialog.showSaveDialog(win, {
            title: 'حفظ ملف الاختبار PDF (' + normalized.pageSize + ')',
            defaultPath: path.join(app.getPath('desktop'), 'اختبار_' + Date.now() + '.pdf'),
            filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
        });
        if (canceled || !filePath) return { success: false, canceled: true };
        fs.writeFileSync(filePath, pdfData);
        return { success: true, filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

process.on('uncaughtException', error => {
    console.error('خطأ غير معالج في العملية الرئيسية:', error);
});
