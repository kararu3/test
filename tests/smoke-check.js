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
  'public/js/examy-ribbon-interaction.js',
  'public/css/examy-ultimate.css', 'public/css/examy-controls-repair.css'
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
  'js/examy-ribbon-interaction.js'
]) if (!html.includes(asset)) fail('Required script not loaded: ' + asset);

const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
if (main.indexOf('function getExamFilePathFromArgs') > main.indexOf('function createWindow')) fail('Exam file argument helper must be top-level');
for (const token of ['requestSingleInstanceLock', 'isTrustedSender', 'setPermissionRequestHandler', "execFile('rundll32.exe'", 'sendPendingExamFile']) {
  if (!main.includes(token)) fail('Missing Electron hardening: ' + token);
}
if (main.includes('const cmd = `rundll32')) fail('Printer name must never be interpolated into a shell command');

const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
for (const token of ['isLoopbackRequest', '10 * 1024 * 1024', '50 * 1024 * 1024', "req.path === '/lan/submit'"]) {
  if (!server.includes(token)) fail('Missing local API / LAN protection: ' + token);
}

const app = fs.readFileSync(path.join(root, 'public/js/app.js'), 'utf8');
if (!app.includes("!e.target.closest('.ribbon-tabs-nav')")) fail('Ribbon clicks must not trigger table deselection');
if (!app.includes('Let the ribbon interaction module receive the bubbling event')) fail('Ribbon click must bubble to its interaction controller');

const controlCss = fs.readFileSync(path.join(root, 'public/css/examy-controls-repair.css'), 'utf8');
const controlJs = fs.readFileSync(path.join(root, 'public/js/examy-controls-repair.js'), 'utf8');
if (!controlCss.includes('user-select:text!important')) fail('Numeric/form controls must be text-selectable');
if (!controlJs.includes('ExamyControlAudit')) fail('Control audit diagnostic missing');

const ultimate = fs.readFileSync(path.join(root, 'public/js/ultimate-engine.js'), 'utf8');
for (const feature of ['A5', 'Legal', 'setPageSize', 'setMargins', 'setHeaderFooter', 'refreshPageNumbers', 'generateVariants', 'backup', 'restore', 'importDocument', 'insertTable']) {
  if (!ultimate.includes(feature)) fail('Missing Ultimate feature: ' + feature);
}
const state = fs.readFileSync(path.join(root, 'public/js/state.js'), 'utf8');
if (state.includes("require('electron')")) fail('Renderer must not import Electron directly');

const jsFiles = walk(root);
for (const file of jsFiles) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}
console.log('Examy PRO smoke checks and JavaScript syntax checks passed (' + jsFiles.length + ' files).');
