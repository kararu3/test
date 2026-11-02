const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const required = ['main.js','preload.js','server.js','public/index.html','public/js/editor-engine.js','public/js/ultimate-engine.js','public/css/examy-ultimate.css'];
for (const file of required) if (!fs.existsSync(path.join(root,file))) throw new Error('Missing '+file);
for (const file of fs.readdirSync(path.join(root,'database')).filter(x=>x.endsWith('.json'))) {
  const raw=fs.readFileSync(path.join(root,'database',file),'utf8');
  if (raw.trim()) JSON.parse(raw);
}
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
if (!html.includes('js/editor-engine.js')) throw new Error('Editor engine not loaded');
if (!html.includes('js/ultimate-engine.js')) throw new Error('Ultimate engine not loaded');
const ultimate=fs.readFileSync(path.join(root,'public/js/ultimate-engine.js'),'utf8');
for (const feature of ['setPageSize','setMargins','setHeaderFooter','refreshPageNumbers','generateVariants','backup','restore','importDocument','insertTable']) if (!ultimate.includes(feature)) throw new Error('Missing Ultimate feature: '+feature);
const state=fs.readFileSync(path.join(root,'public/js/state.js'),'utf8');
if (state.includes("require('electron')")) throw new Error('Renderer still imports Electron directly');
console.log('Examy PRO smoke checks passed');
