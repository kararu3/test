'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');

function fail(message) { throw new Error(message); }
function walk(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'out'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (entry.isFile() && entry.name.endsWith('.js')) output.push(full);
  }
  return output;
}

const required = [
  'main.js', 'preload.js', 'server.js', 'package.json',
  'public/index.html', 'public/js/editor-engine.js',
  'public/js/ultimate-engine.js', 'public/js/completion-suite.js',
  'public/js/examy-controls-repair.js', 'public/js/examy-feature-bridge.js',
  'public/js/examy-ribbon-interaction.js', 'public/js/examy-shape-studio.js', 'public/js/examy-ui-behavior.js',
  'public/css/examy-ultimate.css', 'public/css/examy-controls-repair.css', 'public/css/examy-shape-studio.css', 'public/css/examy-ui-behavior.css'
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) fail('Missing ' + file);

const databaseDir = path.join(root, 'database');
if (!fs.existsSync(databaseDir)) fail('Missing database directory');
for (const file of fs.readdirSync(databaseDir).filter(name => name.endsWith('.json'))) {
  const raw = fs.readFileSync(path.join(databaseDir, file), 'utf8');
  if (raw.trim()) JSON.parse(raw);
}

const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
for (const asset of [
  'js/editor-engine.js', 'js/ultimate-engine.js', 'js/completion-suite.js',
  'js/examy-controls-repair.js', 'js/examy-feature-bridge.js',
  'js/examy-ribbon-interaction.js', 'js/examy-shape-studio.js', 'js/examy-ui-behavior.js'
]) if (!html.includes(asset)) fail('Required script not loaded: ' + asset);

const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
if (main.indexOf('function getExamFilePathFromArgs') > main.indexOf('function createWindow')) fail('Exam file argument helper must be top-level');
for (const token of ['requestSingleInstanceLock', 'isTrustedSender', 'setPermissionRequestHandler', 'audioOnly', 'will-navigate', "execFile('rundll32.exe'", "execFile('powershell.exe'", 'sendPendingExamFile']) {
  if (!main.includes(token)) fail('Missing Electron hardening: ' + token);
}
if (main.includes('const cmd = `rundll32')) fail('Printer name must never be interpolated into a shell command');

const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
for (const token of ['isLoopbackRequest', 'requireLoopbackForAI', '10 * 1024 * 1024', '50 * 1024 * 1024', "req.path === '/lan/submit'", "app.put('/api/bank/:lang'", "app.put('/api/archive/:lang'"]) {
  if (!server.includes(token)) fail('Missing local API / LAN protection: ' + token);
}

const ribbon = fs.readFileSync(path.join(root, 'public/js/examy-ribbon-interaction.js'), 'utf8');
if (!ribbon.includes("const KEY = 'examy.ribbon.pinned.v2'")) fail('Ribbon state migration key missing');
if (!ribbon.includes('let saved = true')) fail('Ribbon must remain expanded on first launch');

const app = fs.readFileSync(path.join(root, 'public/js/app.js'), 'utf8');
for (const token of ['function sanitizeExamHtml', 'function downloadExamyBlob', '25 * 1024 * 1024', 'sanitizeExamHtml(pkg.payloadHtml)']) {
  if (!app.includes(token)) fail('Missing safe exam import/export handling: ' + token);
}
if (app.includes('URL.revokeObjectURL(a.href)')) fail('Export URLs must not be revoked synchronously');
if (!app.includes("!e.target.closest('.ribbon-tabs-nav')")) fail('Ribbon clicks must not trigger table deselection');
if (!app.includes('Let the ribbon interaction module receive the bubbling event')) fail('Ribbon click must bubble to its interaction controller');

const printerUi = fs.readFileSync(path.join(root, 'public/js/app-print.js'), 'utf8');
const printCss = fs.readFileSync(path.join(root, 'public/css/print.css'), 'utf8');
const studioControls = fs.readFileSync(path.join(root, 'public/js/examy-studio-controls.js'), 'utf8');
if (!html.includes('id="ribbonPaperSizeSelect"')) fail('Top ribbon paper-size selector missing');
if (!printerUi.includes('normalizePrinterPaperSize') || !printerUi.includes('"ribbonPaperSizeSelect"')) fail('Printer paper options must populate the ribbon selector');
if (!printerUi.includes('body.classList.add(\'examy-document-export\')') || !printCss.includes('body.examy-document-export > *:not(#appStage)')) fail('PDF export must isolate the examination sheets from the app UI');
if (!studioControls.includes('.examy-ruler')) fail('Ruler toggle must target the actual page ruler');
if (!ribbon.includes('hasFocusedFormControl')) fail('Ribbon must remain open while editing numeric and select controls');

const controlCss = fs.readFileSync(path.join(root, 'public/css/examy-controls-repair.css'), 'utf8');
const controlJs = fs.readFileSync(path.join(root, 'public/js/examy-controls-repair.js'), 'utf8');
if (!controlCss.includes('user-select:text!important')) fail('Numeric/form controls must be text-selectable');
if (!controlJs.includes('ExamyControlAudit')) fail('Control audit diagnostic missing');

const ultimate = fs.readFileSync(path.join(root, 'public/js/ultimate-engine.js'), 'utf8');
for (const token of ['sanitizeHTML', 'setTimeout(()=>URL.revokeObjectURL(url),30000)', 'api.openEquationEditor();', 'api.setPageSize(settings.size,settings.orientation,false)', 'تعذر حفظ سجل المراجعات المحلي']) {
  if (!ultimate.includes(token)) fail('Missing backup/import/equation safeguard: ' + token);
}
if (!app.includes('window.ExamyUltimate.setPageSize(val, orientation)')) fail('Paper-size selector must update actual page geometry');
for (const feature of ['A5', 'Legal', 'setPageSize', 'setMargins', 'setHeaderFooter', 'refreshPageNumbers', 'generateVariants', 'backup', 'restore', 'importDocument', 'insertTable']) {
  if (!ultimate.includes(feature)) fail('Missing Ultimate feature: ' + feature);
}
const bridge = fs.readFileSync(path.join(root, 'public/js/examy-feature-bridge.js'), 'utf8');
if (!bridge.includes('window.ExamyUltimate?.scheduleFlow?.()')) fail('Page flow bridge must call the active pagination engine');
if (!bridge.includes('setTimeout(()=>URL.revokeObjectURL(url),30000)')) fail('Question bank download must not revoke its URL immediately');

const apiClient = fs.readFileSync(path.join(root, 'public/js/api.js'), 'utf8');
if (!apiClient.includes('replaceBank') || !apiClient.includes('replaceArchive')) fail('Bulk restore API methods missing');
const shapeStudio = fs.readFileSync(path.join(root, 'public/js/examy-shape-studio.js'), 'utf8');
const uiBehavior = fs.readFileSync(path.join(root, 'public/js/examy-ui-behavior.js'), 'utf8');
const behaviorCss = fs.readFileSync(path.join(root, 'public/css/examy-ui-behavior.css'), 'utf8');
if (!app.includes('AppAPI.saveExamArchive') || !app.includes('getUnifiedArchiveRecord') || !app.includes('AppAPI.replaceArchive')) fail('Archive must save, merge, rename/delete and restore from unified local/server records');
if ((app.match(/async function renderArchiveData\(/g) || []).length !== 1 || (app.match(/async function loadExamFromArchive\(/g) || []).length !== 1) fail('Only one authoritative archive render/restore implementation may remain');
if (!shapeStudio.includes('أشكال هندسية') || !shapeStudio.includes('أشكال ورموز رياضية') || !shapeStudio.includes('أشكال عربية وزخرفية') || !shapeStudio.includes('examy-shape-object')) fail('Editable shape gallery categories or page objects missing');
if (!shapeStudio.includes('shape-resize-handle') || !shapeStudio.includes('shape-rotate-handle')) fail('Shape resize/rotation controls missing');
if (!uiBehavior.includes('tabBtnTableDesign') || !uiBehavior.includes('showTableTab(null)')) fail('Table design tab must be contextual');
if (!uiBehavior.includes('data-examy-role') || !behaviorCss.includes('data-examy-role="save"')) fail('Semantic toolbar button color system missing');
if (!uiBehavior.includes('ResizeObserver') || !behaviorCss.includes('--examy-ribbon-height')) fail('Ribbon height must be measured to keep workspace aligned');

if (!app.includes('async function exportFullBackupZip') || !app.includes('async function handleFullBackupImport') || !app.includes('activeExam:') || !app.includes('new Blob([backupJson]).size')) fail('Full backup export/restore workflow missing');
if (!html.includes('onclick="importFullBackupZip()"')) fail('Backup restore control missing from the UI');

const state = fs.readFileSync(path.join(root, 'public/js/state.js'), 'utf8');
if (state.includes("require('electron')")) fail('Renderer must not import Electron directly');

const jsFiles = walk(root);
for (const file of jsFiles) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}
console.log('Examy PRO smoke checks and JavaScript syntax checks passed (' + jsFiles.length + ' files).');
