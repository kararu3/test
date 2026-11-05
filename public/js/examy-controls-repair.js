/* Examy PRO control accessibility & diagnostics repair */
(function(){
'use strict';
function prepare(root=document){
 root.querySelectorAll('input,select,textarea').forEach(el=>{
  el.style.setProperty('pointer-events','auto','important');
  el.style.setProperty('user-select','text','important');
  el.style.setProperty('-webkit-user-select','text','important');
  if(el.matches('input[type=number]')){
   el.style.setProperty('appearance','auto','important');
   el.style.setProperty('-webkit-appearance','auto','important');
   el.setAttribute('inputmode','decimal');
  }
 });
}
function checkInlineHandlers(){
 const scripts=[...document.scripts].filter(s=>s.src).map(s=>s.src);
 const unresolved=[];
 document.querySelectorAll('[onclick],[onchange],[oninput],[onmousedown]').forEach(el=>{
  ['onclick','onchange','oninput','onmousedown'].forEach(attr=>{
   const code=el.getAttribute(attr);if(!code)return;
   const m=code.match(/^\s*([A-Za-z_$][\w$]*)\s*\(/);if(!m)return;
   const n=m[1];if(['alert','confirm','prompt','setTimeout','setInterval'].includes(n))return;
   if(typeof window[n]!=='function'&&!code.includes('.')&&!code.startsWith('document.')&&!code.startsWith('window.'))unresolved.push({name:n,el,code});
  });
 });
 if(unresolved.length)console.warn('[Examy control audit] Missing global handlers',unresolved);
 window.ExamyControlAudit={inputs:document.querySelectorAll('input,select,textarea').length,buttons:document.querySelectorAll('button').length,unresolved:unresolved.map(x=>x.name),scripts};
}
function boot(){prepare();checkInlineHandlers();const obs=new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1)prepare(n)});obs.observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
