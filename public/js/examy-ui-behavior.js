/* Examy PRO — contextual table ribbon and semantic toolbar colors */
(() => {
 'use strict';
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
 let activeTable=null;
 function tableFromNode(node){const el=node?.nodeType===3?node.parentElement:node;return el?.closest?.('#sheetsWrapper table')||null}
 function showTableTab(table){const tab=$('#tabBtnTableDesign'),panel=$('#rtab-tableDesign');if(!tab||!panel)return;if (table !== undefined) activeTable=table;tab.style.display=activeTable?'inline-flex':'none';panel.dataset.contextTable=activeTable?'active':'inactive';if(!activeTable&&tab.classList.contains('active')){tab.classList.remove('active');panel.classList.remove('active');const home=$('.r-tab-btn[data-tab="home"]');const homePanel=$('#rtab-home');home?.classList.add('active');homePanel?.classList.add('active')}}
 function bindTableContext(){const toolbar=$('#mainToolbar');if(!toolbar)return;
  document.addEventListener('pointerdown',e=>{const table=tableFromNode(e.target);if(table){showTableTab(table);return}if(e.target.closest('#tabBtnTableDesign,#rtab-tableDesign'))return;activeTable=null;showTableTab(null)},true);
  document.addEventListener('focusin',e=>{const table=tableFromNode(e.target);if(table)showTableTab(table)},true);
  document.addEventListener('selectionchange',()=>{const sel=getSelection();const table=tableFromNode(sel?.anchorNode);if(table)showTableTab(table)});
  toolbar.addEventListener('click',e=>{if(e.target.closest('#tabBtnTableDesign')&&!activeTable){e.preventDefault();e.stopImmediatePropagation()}},true);
  const observer=new MutationObserver(()=>{if(activeTable&&!activeTable.isConnected){activeTable=null;showTableTab(null)}});observer.observe($('#sheetsWrapper')||document.body,{childList:true,subtree:true});
  showTableTab(null);
 }
 const roles=[
  ['delete',/حذف|مسح|إزالة|تفريغ/],
  ['save',/حفظ|أرشيف|نسخة احتياطية|تصدير|تنزيل|استيراد/],
  ['print',/طباعة|معاينة|pdf|png|ورقة إجابة/],
  ['ai',/ذكي|ذكاء|مساعد|توليد|نموذج بديل/],
  ['table',/صف|عمود|خلية|جدول/],
  ['insert',/إدراج|إضافة|جديد|صورة|شكل|سؤال|خيارات|باركود|رمز|معادلة/],
  ['layout',/صفحة|هامش|مسطرة|اتجاه|ورقة|إطار|تخطيط|حجم/],
  ['format',/خط|حجم|غامق|مائل|لون|محاذاة|تنسيق|مسافة|تمييز/],
  ['edit',/تراجع|إعادة|قص|نسخ|لصق|بحث|استبدال|تحريك|تكرار/]
 ];
 function groupRole(button){
  const group=button.closest('.r-group');
  const title=group?.querySelector('.r-group-title')?.textContent||'';
  if(/سؤال|إدراج|إضافة/.test(title))return 'insert';
  if(/تنسيق|خط|محاذاة/.test(title))return 'format';
  if(/حفظ|ملف|أرشيف/.test(title))return 'save';
  if(/طباعة|معاينة/.test(title))return 'print';
  if(/جدول/.test(title))return 'table';
  if(/ذكاء|ذكي/.test(title))return 'ai';
  if(/صفحة|تخطيط/.test(title))return 'layout';
  return 'primary';
 }
 function paintToolbarButtons(){
  $$('#mainToolbar button:not(.r-tab-btn):not(.ribbon-pin-toggle)').forEach(button=>{
   if(button.matches('input,select,[role="switch"]'))return;
   const label=[button.textContent,button.title,button.getAttribute('aria-label'),button.getAttribute('onclick'),button.id].filter(Boolean).join(' ');
   const match=roles.find(([,re])=>re.test(label));
   button.dataset.examyRole=match?match[0]:groupRole(button);
  });
 }
 function boot(){
  bindTableContext();paintToolbarButtons();
  const toolbar=$('#mainToolbar');
  if(toolbar&&typeof ResizeObserver!=='undefined'){
   const syncHeight=()=>document.documentElement.style.setProperty('--examy-ribbon-height',Math.ceil(toolbar.getBoundingClientRect().height)+'px');
   new ResizeObserver(syncHeight).observe(toolbar);syncHeight();
  }
  const observer=new MutationObserver(()=>paintToolbarButtons());observer.observe(toolbar||document.body,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,150));else setTimeout(boot,150);
})();
