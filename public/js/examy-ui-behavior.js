/* Examy PRO — contextual table ribbon and semantic toolbar colors */
(() => {
 'use strict';
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
 let activeTable=null;
 function tableFromNode(node){const el=node?.nodeType===3?node.parentElement:node;return el?.closest?.('#sheetsWrapper table')||null}
 function showTableTab(table){const tab=$('#tabBtnTableDesign'),panel=$('#rtab-tableDesign');if(!tab||!panel)return;activeTable=table||activeTable;tab.style.display=activeTable?'inline-flex':'none';panel.dataset.contextTable=activeTable?'active':'inactive';if(!activeTable&&tab.classList.contains('active')){tab.classList.remove('active');panel.classList.remove('active');const home=$('.r-tab-btn[data-tab="home"]');const homePanel=$('#rtab-home');home?.classList.add('active');homePanel?.classList.add('active')}}
 function bindTableContext(){const toolbar=$('#mainToolbar');if(!toolbar)return;
  document.addEventListener('pointerdown',e=>{const table=tableFromNode(e.target);if(table){showTableTab(table);return}if(e.target.closest('#tabBtnTableDesign,#rtab-tableDesign'))return;activeTable=null;showTableTab(null)},true);
  document.addEventListener('focusin',e=>{const table=tableFromNode(e.target);if(table)showTableTab(table)},true);
  document.addEventListener('selectionchange',()=>{const sel=getSelection();const table=tableFromNode(sel?.anchorNode);if(table)showTableTab(table)});
  toolbar.addEventListener('click',e=>{if(e.target.closest('#tabBtnTableDesign')&&!activeTable){e.preventDefault();e.stopImmediatePropagation()}},true);
  const observer=new MutationObserver(()=>{if(activeTable&&!activeTable.isConnected){activeTable=null;showTableTab(null)}});observer.observe($('#sheetsWrapper')||document.body,{childList:true,subtree:true});
  showTableTab(null);
 }
 const roles=[
  ['save',/حفظ|أرشيف|نسخة احتياطية|تصدير/],['insert',/إدراج|صورة|شكل|جدول|سؤال توصيل|خيارات|باركود|رمز/],
  ['print',/طباعة|معاينة|pdf|png/],['delete',/حذف|مسح|إزالة/],['edit',/تراجع|إعادة|قص|نسخ|لصق|بحث|استبدال/],
  ['format',/خط|حجم|غامق|مائل|لون|محاذاة|تنسيق|مسافة/],['ai',/ذكي|ذكاء|مساعد|توليد|نموذج بديل/],
  ['layout',/صفحة|هامش|مسطرة|اتجاه|ورقة|إطار|تخطيط/],['table',/صف|عمود|خلية|جدول/]
 ];
 function paintToolbarButtons(){ $$('#mainToolbar .tool-btn, #mainToolbar .ribbon-btn, #mainToolbar .hdr-mini-btn').forEach(button=>{
   if(button.classList.contains('ribbon-pin-toggle')||button.classList.contains('r-tab-btn'))return;
   const label=[button.textContent,button.title,button.getAttribute('onclick')].filter(Boolean).join(' ');
   const match=roles.find(([,re])=>re.test(label));if(match)button.dataset.examyRole=match[0];
  });
 }
 function boot(){bindTableContext();paintToolbarButtons();const observer=new MutationObserver(()=>paintToolbarButtons());observer.observe($('#mainToolbar')||document.body,{childList:true,subtree:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,150));else setTimeout(boot,150);
})();
