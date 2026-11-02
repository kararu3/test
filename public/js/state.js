/**
 * ExamBuilder Pro - إدارة الحالة والإعدادات العامة
 */
let currentLang = "ar";
let currentNumberSystem = localStorage.getItem('exambuilder_number_system') || "ar";
let examUid = "";
let colorIndex = 0;
let savedSelectionRange = null;
let currentPreviewZoom = 0.9;
let activeQuestionCard = null;

let undoHistory = [];
let redoHistory = [];
const MAX_HISTORY = 40;

let activeBorderSettings = {
    shape: 'gradient',
    size: '12px',
    color: '#2563eb'
};
let activeFrameInset = '12mm';

let watermarkConfig = {
    text: '',
    opacity: '0.08',
    color: '#000000',
    angle: '-35deg'
};

let sheetBgConfig = {
    type: 'color',
    color: '#ffffff',
    imageUrl: '',
    opacity: '1'
};

const COLOR_CLASSES = ['q1','q2','q3','q4','q5','q6','q7','q8','q9','q10','q11','q12','q13','q14','q15'];
const COLOR_HEX_MAP = {
    'q1': '#ff9f43', 'q2': '#ff4d6d', 'q3': '#10ac84', 'q4': '#5f27cd', 'q5': '#0abde3',
    'q6': '#f368e0', 'q7': '#2980b9', 'q8': '#8e44ad', 'q9': '#c0392b', 'q10': '#16a085',
    'q11': '#f39c12', 'q12': '#d35400', 'q13': '#27ae60', 'q14': '#34495e', 'q15': '#7f8c8d'
};

const AR_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'];
const EN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

let currentPaperSize = localStorage.getItem('exambuilder_paper_size') || 'A4';
let isBookletMode = localStorage.getItem('exambuilder_booklet_mode') === 'true';

let ipcRenderer = window.examy ? {
    invoke(channel, ...args) {
        const methods = { 'get-system-printers': () => window.examy.getSystemPrinters(), 'open-printer-properties': () => window.examy.openPrinterProperties(args[0]), 'print-sheet-direct': () => window.examy.printSheetDirect(args[0]), 'print-to-pdf-native': () => window.examy.printToPdf(args[0]) };
        return methods[channel] ? methods[channel]() : Promise.reject(new Error('IPC channel not allowed'));
    }
} : null;

function recordUndoState() {
    const wrapper = document.getElementById("sheetsWrapper");
    if (!wrapper) return;
    undoHistory.push(wrapper.innerHTML);
    if (undoHistory.length > MAX_HISTORY) undoHistory.shift();
    redoHistory = [];
}

function undoLastAction() {
    const wrapper = document.getElementById("sheetsWrapper");
    if (!wrapper || undoHistory.length === 0) return;
    
    SoundFX.pop();
    redoHistory.push(wrapper.innerHTML);
    wrapper.innerHTML = undoHistory.pop();

    restoreUIStateAfterDomUpdate();
}

function redoLastAction() {
    const wrapper = document.getElementById("sheetsWrapper");
    if (!wrapper || redoHistory.length === 0) return;

    SoundFX.pop();
    undoHistory.push(wrapper.innerHTML);
    wrapper.innerHTML = redoHistory.pop();

    restoreUIStateAfterDomUpdate();
}

function restoreUIStateAfterDomUpdate() {
    if (typeof rebindAllDraggables === 'function') rebindAllDraggables();
    if (typeof applyBorderToAllSheets === 'function') applyBorderToAllSheets();
    if (typeof applyFrameInsetToAllSheets === 'function') applyFrameInsetToAllSheets();
    if (typeof applyWatermarkSettings === 'function') applyWatermarkSettings();
    if (typeof applySheetBgSettings === 'function') applySheetBgSettings();
    if (typeof reindexAllQuestions === 'function') reindexAllQuestions();
    if (typeof bindAllQuestionsInteractions === 'function') bindAllQuestionsInteractions();
    if (typeof updateUIIndicators === 'function') updateUIIndicators();
    if (typeof resetAllSheetsScroll === 'function') resetAllSheetsScroll();
    if (typeof autoScaleStageToScreen === 'function') autoScaleStageToScreen();
}

function formatNumberBySystem(val) {
    if (val === null || typeof val === 'undefined') return '';
    const str = String(val);
    const arMap = {'0':'٠','1':'١','2':'٢','3':'٣','4':'٤','5':'٥','6':'٦','7':'٧','8':'٨','9':'٩'};
    const enMap = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9'};
    
    if (currentNumberSystem === 'en') {
        return str.replace(/[٠-٩]/g, d => enMap[d]);
    } else {
        return str.replace(/[0-9]/g, d => arMap[d]);
    }
}

// محول الأرقام التلقائي مع حماية المقادير الفيزيائية والمعادلات
document.addEventListener('beforeinput', (e) => {
    if (currentNumberSystem === 'ar' && e.data && /^[0-9]+$/.test(e.data)) {
        const target = e.target;
       if (target && (target.closest('.physics-val') || target.closest('[dir="ltr"]') || target.classList.contains('branch-grade-input') || target.dataset.noshrq)) {
           return; // تجاوز التحويل الحرفي للحقول المخصصة
        }
        const arMap = {'0':'٠','1':'١','2':'٢','3':'٣','4':'٤','5':'٥','6':'٦','7':'٧','8':'٨','9':'٩'};
        const arChar = e.data.replace(/[0-9]/g, d => arMap[d]);
        e.preventDefault();
        document.execCommand('insertText', false, arChar);
    }
});