/* Examy PRO — safe dropdown and settings polish.
   Avoid observing style mutations: writing to observed styles caused an endless
   MutationObserver loop that could freeze the whole application. */
(function(){
 'use strict';
 function polishSettings(){
  const dialog=document.querySelector('#settingsModal .modal-dialog');
  if(dialog){
   dialog.style.maxWidth='min(1120px,96vw)';
   dialog.style.maxHeight='min(88vh,900px)';
   dialog.style.overflow='hidden';
  }
  document.querySelectorAll('#settingsModal .field-row').forEach(row=>{
   const label=row.querySelector('label');
   if(label&&label.textContent.includes('موضع شريط الأدوات'))row.style.display='none';
  });
  document.querySelectorAll('#settingsModal .settings-section-card').forEach(card=>{
   if(!card.classList.contains('ex-settings-card-polished'))card.classList.add('ex-settings-card-polished');
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',polishSettings,{once:true});
 else polishSettings();
 /* app.js owns toggleDropdown. Preserve its native open/close and positioning logic. */
})();