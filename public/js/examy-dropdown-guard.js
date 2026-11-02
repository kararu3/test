/* Examy PRO — dropdown edge protection. Loaded after app.js. */
(function(){
 'use strict';
 function placeDropdown(id, event){
  const pane=document.getElementById(id);
  if(!pane)return;
  const trigger=event&&(event.currentTarget||event.target?.closest?.('button'));
  document.querySelectorAll('.dropdown-content-pane').forEach(p=>{
   if(p!==pane){p.classList.remove('active','floating-dropdown');p.style.display='none';}
  });
  if(pane.classList.contains('active')){pane.classList.remove('active','floating-dropdown');pane.style.display='none';return;}
  pane.classList.add('active','floating-dropdown');
  Object.assign(pane.style,{display:'flex',position:'fixed',zIndex:'1000001',visibility:'hidden',
   maxWidth:'min(420px, calc(100vw - 28px))',maxHeight:'min(70vh, 560px)',overflowY:'auto',overflowX:'hidden',width:'max-content'});
  requestAnimationFrame(()=>{
   const margin=14, gap=8, vw=document.documentElement.clientWidth, vh=document.documentElement.clientHeight;
   const tr=trigger?.getBoundingClientRect?.(), pr=pane.getBoundingClientRect();
   const w=Math.min(pr.width||320,vw-margin*2),h=Math.min(pane.scrollHeight||pr.height||300,vh-margin*2);
   let left=tr?tr.right-w:vw-w-margin;
   /* RTL: nudge left from the trigger edge, then clamp inside the viewport. */
   if(tr)left=Math.min(left,tr.left+Math.max(0,tr.width-w))-10;
   left=Math.max(margin,Math.min(left,vw-w-margin));
   let top=tr?tr.bottom+gap:margin;
   if(top+h>vh-margin)top=Math.max(margin,(tr?.top||vh-margin)-h-gap);
   Object.assign(pane.style,{left:Math.round(left)+'px',right:'auto',top:Math.round(top)+'px',visibility:'visible'});
  });
 }
 window.addEventListener('resize',()=>{
  document.querySelectorAll('.dropdown-content-pane.active.floating-dropdown').forEach(p=>{
   const r=p.getBoundingClientRect(),m=14;
   p.style.left=Math.max(m,Math.min(r.left,innerWidth-r.width-m))+'px';
   p.style.top=Math.max(m,Math.min(r.top,innerHeight-r.height-m))+'px';
  });
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.dropdown-content-pane.active').forEach(p=>{p.classList.remove('active','floating-dropdown');p.style.display='none';});});
 /* Override the legacy implementation whose positioning used the viewport's far edge. */
 window.toggleDropdown=placeDropdown;
})();
