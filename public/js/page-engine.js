/* Examy PRO page layout engine: rulers, page geometry, overflow flow and numbering. */
(function(){
 'use strict';
 const api=window.ExamyPages=window.ExamyPages||{};
 const wrapper=()=>document.getElementById('sheetsWrapper');
 const sheets=()=>Array.from(wrapper()?.querySelectorAll('.a4-sheet')||[]);
 const px=(v)=>Math.max(0,Number(v)||0);
 api.refreshRulers=()=>{
   sheets().forEach((sheet,index)=>{
     let ruler=sheet.querySelector(':scope > .examy-ruler');
     if(!ruler){ruler=document.createElement('div');ruler.className='examy-ruler';ruler.setAttribute('aria-hidden','true');sheet.prepend(ruler);}
     ruler.innerHTML='';
     const width=sheet.getBoundingClientRect().width||794;
     for(let i=0;i<=20;i++){const tick=document.createElement('i');tick.style.insetInlineStart=`${(i/20)*100}%`;tick.className=i%5===0?'major':'minor';if(i%5===0){const n=document.createElement('b');n.textContent=String(i/5);tick.appendChild(n);}ruler.appendChild(tick);}
     ruler.dataset.page=String(index+1);
   });
 };
 api.reindex=()=>{
   const list=sheets(),total=list.length;
   list.forEach((sheet,i)=>{
     sheet.dataset.index=String(i+1);sheet.id=`sheet-${i+1}`;
     const label=sheet.querySelector('.footer-page-index');
     if(label){const refs=label.querySelectorAll('.total-pages-ref');label.firstChild.textContent=`صفحة ${i+1} من `;refs.forEach(x=>x.textContent=String(total));}
   });
   const top=document.getElementById('pageTotalCount'),bottom=document.getElementById('footerPageCountBadge');
   if(top)top.textContent=String(total);if(bottom)bottom.textContent=String(total);
   api.refreshRulers();
 };
 api.geometry=sheet=>{
   const s=sheet||sheets()[0];if(!s)return null;
   const frame=s.querySelector('.sheet-frame-box'),stream=s.querySelector('.questions-stream'),footer=s.querySelector('.sheet-smart-footer');
   if(!frame||!stream)return null;
   const fr=frame.getBoundingClientRect(),sr=stream.getBoundingClientRect(),foot=footer?.getBoundingClientRect();
   return {top:sr.top,bottom:foot?foot.top-8:fr.bottom-35,available:Math.max(0,(foot?foot.top-8:fr.bottom-35)-sr.top),used:stream.scrollHeight,overflow:stream.scrollHeight>Math.max(0,(foot?foot.top-8:fr.bottom-35)-sr.top)+2};
 };
 api.flow=()=>{
   const list=sheets();if(!list.length)return;
   // Move complete question cards only; never split their markup or mutate user content.
   for(let i=0;i<list.length;i++){
     let sheet=list[i],stream=sheet.querySelector('.questions-stream');if(!stream)continue;
     let guard=0,geo=api.geometry(sheet);
     while(geo?.overflow&&guard++<100){
       const cards=Array.from(stream.children).filter(el=>el.matches('.question-container'));
       if(cards.length<2)break; // an individual tall question must remain intact for manual editing
       let next=list[i+1];if(!next){if(typeof window.insertNewPageSheetManual!=='function')break;next=window.insertNewPageSheetManual(true);if(!next)break;list.push(next);}
       const moved=cards[cards.length-1];next.querySelector('.questions-stream')?.prepend(moved);
       geo=api.geometry(sheet);
     }
   }
   api.reindex();if(typeof window.reindexAllQuestions==='function')window.reindexAllQuestions();
   if(typeof window.updateUIIndicators==='function')window.updateUIIndicators();
 };
 api.setMargins=(top,right,bottom,left)=>{
   const values={top:px(top),right:px(right),bottom:px(bottom),left:px(left)};
   sheets().forEach(s=>{const f=s.querySelector('.sheet-frame-box');if(f){f.style.padding=`${values.top}px ${values.right}px ${values.bottom}px ${values.left}px`;}});
   if(typeof window.recordUndoState==='function')window.recordUndoState();api.reindex();
 };
 let scheduled=false;api.scheduleFlow=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;api.flow();});};
 document.addEventListener('examy:contentchange',api.scheduleFlow);
 window.addEventListener('resize',()=>api.refreshRulers());
 document.addEventListener('DOMContentLoaded',()=>{api.reindex();});
 const observer=new MutationObserver(records=>{if(records.some(r=>{const t=r.target.nodeType===1?r.target:r.target.parentElement;return !!t?.closest('.questions-stream');}))api.scheduleFlow();});
 const start=()=>{const host=wrapper();if(host){observer.observe(host,{childList:true,subtree:true});api.reindex();}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
