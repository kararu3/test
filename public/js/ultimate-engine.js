/* Examy PRO Ultimate engines: page controls, rich editing, exam variants, backup and review. */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const root=()=>$('#sheetsWrapper'), sheets=()=>$$('.a4-sheet',root()||document);
const toast=(m,t='info')=>window.UIEffects?.showToast?.(m,t,2600)||console.info(m);
const undo=()=>window.recordUndoState?.();
const safe=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sanitizeHTML=(html)=>{
 const template=document.createElement('template');template.innerHTML=String(html||'');
 template.content.querySelectorAll('script,iframe,object,embed,form').forEach(el=>el.remove());
 template.content.querySelectorAll('*').forEach(el=>Array.from(el.attributes).forEach(attr=>{
  const name=attr.name.toLowerCase(),value=String(attr.value||'').trim();
  if(name.startsWith('on')||(['href','src','xlink:href','action'].includes(name)&&/^javascript:/i.test(value)))el.removeAttribute(attr.name);
 }));
 return template.innerHTML;
};
const api=window.ExamyUltimate=window.ExamyUltimate||{};
api.sanitizeHTML=sanitizeHTML;

// --- Page layout / numbering / section headers and footers ---
const defaultPageSettings={size:localStorage.getItem('exambuilder_paper_size')||'A4',orientation:'portrait',marginTop:15,marginRight:15,marginBottom:15,marginLeft:15,numbering:'arabic',start:1};
try{api.pageSettings={...defaultPageSettings,...JSON.parse(localStorage.getItem('examy_page_settings')||'{}')};}catch{api.pageSettings={...defaultPageSettings};}
if(!['A4','A3','A5','Letter','Legal','Tabloid','Executive','B5'].includes(api.pageSettings.size))api.pageSettings.size=defaultPageSettings.size;
api.refreshRulers=()=>sheets().forEach((sheet,index)=>{let ruler=$('.examy-ruler',sheet);if(!ruler){ruler=document.createElement('div');ruler.className='examy-ruler';ruler.setAttribute('aria-hidden','true');sheet.prepend(ruler)}ruler.innerHTML='';for(let i=0;i<=20;i++){const tick=document.createElement('i');tick.style.insetInlineStart=`${i*5}%`;tick.className=i%5===0?'major':'minor';if(i%5===0){const n=document.createElement('b');n.textContent=String(i/5);tick.append(n)}ruler.append(tick)}ruler.dataset.page=String(index+1)});
api.refreshPageNumbers=()=>{
 const list=sheets(), total=list.length;
 list.forEach((s,i)=>{
   s.dataset.index=String(i+1); s.id=`sheet-${i+1}`;
   const label=$('.footer-page-index',s); if(label){label.style.display='inline-flex';label.textContent='';label.append(`صفحة ${api.pageSettings.start+i} من ${total}`);}
   const custom=$('.footer-custom-text',s); if(custom) custom.dataset.page=String(i+1);
 });
 const a=$('#pageTotalCount'),b=$('#footerPageCountBadge'); if(a)a.textContent=total;if(b)b.textContent=total;api.refreshRulers();
};
api.setPageSize=(size,orientation='portrait',recordHistory=true)=>{
 if(!['A4','A3','A5','Letter','Legal','Tabloid','Executive','B5'].includes(size))return false;
 if(!['portrait','landscape'].includes(orientation))orientation='portrait';
 if(recordHistory)undo(); api.pageSettings.size=size;api.pageSettings.orientation=orientation;
 const dimensions={
  A3:orientation==='landscape'?[1587,1123]:[1123,1587],
  A4:orientation==='landscape'?[1123,794]:[794,1123],
  A5:orientation==='landscape'?[794,559]:[559,794],
  Letter:orientation==='landscape'?[1056,816]:[816,1056],
  Legal:orientation==='landscape'?[1344,816]:[816,1344],
  Tabloid:orientation==='landscape'?[1632,1056]:[1056,1632],
  Executive:orientation==='landscape'?[1008,696]:[696,1008],
  B5:orientation==='landscape'?[945,665]:[665,945]
 };
 const dims=dimensions[size];
 document.documentElement.style.setProperty('--a4-w',`${dims[0]}px`);document.documentElement.style.setProperty('--a4-h',`${dims[1]}px`);
 try{let st=$('#examy-dynamic-page-rule');if(!st){st=document.createElement('style');st.id='examy-dynamic-page-rule';document.head.append(st)}st.textContent=`@page{size:${size} ${orientation};margin:0}`;}catch{}
 sheets().forEach(s=>{s.dataset.paper=size;s.dataset.orientation=orientation;}); api.refreshPageNumbers();
 try{localStorage.setItem('examy_page_settings',JSON.stringify(api.pageSettings));localStorage.setItem('exambuilder_paper_size',size);if(typeof currentPaperSize!=='undefined')currentPaperSize=size;}catch{}
 return true;
};
api.setMargins=(top,right,bottom,left,recordHistory=true)=>{
 const vals=[top,right,bottom,left].map(v=>Math.max(0,Math.min(50,Number(v)||0)));
 if(recordHistory)undo();api.pageSettings.marginTop=vals[0];api.pageSettings.marginRight=vals[1];api.pageSettings.marginBottom=vals[2];api.pageSettings.marginLeft=vals[3];
 sheets().forEach(s=>{const f=$('.sheet-frame-box',s);if(f)f.style.padding=vals.map(v=>`${v*96/25.4}px`).join(' ')});
 try{localStorage.setItem('examy_page_settings',JSON.stringify(api.pageSettings));}catch{}
};
api.setHeaderFooter=(kind,text,{all=false,page=null}={})=>{
 if(!['header','footer'].includes(kind))return; undo();
 const targets=all?sheets():[page?sheets()[page-1]:($('.a4-sheet')||null)].filter(Boolean);
 targets.forEach(s=>{
  if(kind==='header'){
   let zone=$('.sheet-header-locked-zone',s);if(!zone){zone=document.createElement('div');zone.className='sheet-header-locked-zone';$('.sheet-frame-box',s)?.prepend(zone)}
   let h=$('.sheet-header',zone);if(!h){h=document.createElement('div');h.className='sheet-header';zone.append(h)}
   let cell=$('.hdr-cell.hdr-center',h);if(!cell){cell=document.createElement('div');cell.className='hdr-cell hdr-center';h.append(cell)}cell.innerHTML=safe(text).replace(/\n/g,'<br>');
  }else{let f=$('.footer-custom-text',s);if(f)f.textContent=text;}
 });
};
api.flow=()=>{
 const list=sheets();if(!list.length)return;
 // Flow whole cards first. If a single question overflows, split its editable content at safe block boundaries.
 for(let i=0;i<list.length;i++){
  let sheet=list[i],stream=$('.questions-stream',sheet);if(!stream)continue;
  let guard=0;
  while(stream.scrollHeight>stream.clientHeight+4 && guard++<80){
   const cards=$$('.question-container',stream);if(!cards.length)break;
   if(cards.length>1){
    let next=list[i+1];if(!next){next=window.insertNewPageSheetManual?.(true);if(!next)break;list.push(next);}
    $('.questions-stream',next)?.prepend(cards[cards.length-1]);
    continue;
   }
   const card=cards[0], content=$('.q-content-box',card);
   if(!content || !content.isContentEditable)break;
   const blocks=Array.from(content.children).filter(el=>!el.matches('.page-split-continuation')); 
   if(blocks.length<2)break;
   let next=list[i+1];if(!next){next=window.insertNewPageSheetManual?.(true);if(!next)break;list.push(next);}
   const clone=card.cloneNode(false);clone.id=(card.id||'question')+'_cont_'+(i+1)+'_'+Date.now();clone.classList.add('question-continuation');
   clone.innerHTML='<div class="q-cont-label">(تابع السؤال السابق)</div><div class="text-area q-content-box" contenteditable="true" spellcheck="true"></div>';
   const dest=$('.q-content-box',clone);let moved=0;
   // Move trailing block nodes until source fits. Preserve node markup and inline editing.
   while(content.scrollHeight>content.clientHeight+3 && content.children.length>1){dest.prepend(content.lastElementChild);moved++;}
   if(!moved)break;
   $('.questions-stream',next)?.prepend(clone);window.makeQuestionDraggable?.(clone);
  }
 }
 api.refreshPageNumbers();window.reindexAllQuestions?.();window.updateUIIndicators?.();
};
api.scheduleFlow=()=>{if(api._flowQueued)return;api._flowQueued=true;requestAnimationFrame(()=>{api._flowQueued=false;api.flow();});};

// --- Unified editing commands ---
api.command=(cmd,value=null)=>{
 const sel=getSelection();if(!sel||!sel.rangeCount||!root()?.contains(sel.anchorNode))return false;
 undo();document.execCommand(cmd,false,value);document.dispatchEvent(new CustomEvent('examy:contentchange',{detail:{command:cmd}}));return true;
};
api.copyFormat=()=>{
 const s=getSelection();if(!s?.rangeCount)return false;const n=s.anchorNode.nodeType===1?s.anchorNode:s.anchorNode.parentElement;const e=n?.closest('[contenteditable="true"]');if(!e)return false;
 api._format={font:getComputedStyle(e).fontFamily,size:getComputedStyle(e).fontSize,color:getComputedStyle(e).color,lineHeight:getComputedStyle(e).lineHeight,textAlign:getComputedStyle(e).textAlign};document.body.classList.add('examy-format-painter');toast('تم نسخ التنسيق؛ حدد النص الهدف ثم اضغط لصق التنسيق.');return true;
};
api.pasteFormat=()=>{const s=getSelection();if(!api._format||!s?.rangeCount)return false;const n=s.anchorNode.nodeType===1?s.anchorNode:s.anchorNode.parentElement;const e=n?.closest('[contenteditable="true"]');if(!e)return false;undo();Object.assign(e.style,{fontFamily:api._format.font,fontSize:api._format.size,color:api._format.color,lineHeight:api._format.lineHeight,textAlign:api._format.textAlign});document.body.classList.remove('examy-format-painter');return true;};
api.insertTable=(rows=3,cols=3)=>{
 const s=getSelection();if(!s?.rangeCount||!root()?.contains(s.anchorNode)){toast('ضع المؤشر داخل نص السؤال أولاً','warning');return false;}
 rows=Math.max(1,Math.min(20,Number(rows)||3));cols=Math.max(1,Math.min(10,Number(cols)||3));
 let html='<table class="examy-edit-table"><tbody>';for(let r=0;r<rows;r++){html+='<tr>';for(let c=0;c<cols;c++)html+=`<td contenteditable="true">${r===0?'عنوان':''}</td>`;html+='</tr>';}html+='</tbody></table><p><br></p>';
 undo();return api.command('insertHTML',html);
};
api.insertEquation=(latex)=>{const text=String(latex||'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}');return api.command('insertHTML',`<span class="examy-equation" contenteditable="true" dir="ltr">${safe(text)}</span>&nbsp;`);};
api.insertSymbol=(sym)=>api.command('insertText',sym);
api.insertImage=()=>$('#imgUpload')?.click();
api.setSelectedImageSize=(width)=>{const img=$('.question-container img:focus')||window._examySelectedImage;if(!img)return false;undo();img.style.width=`${Math.max(24,Math.min(100,Number(width)||50))}%`;img.style.height='auto';return true;};

// --- Exam form generation using bank records ---
api.generateVariants=async({count=2,subject='',topic='',perVariant=0,gradeMode='preserve'}={})=>{
 let bank=[];try{bank=JSON.parse(localStorage.getItem(`exambuilder_bank_${window.currentLang||'ar'}`)||'[]')}catch{}
 if(!bank.length){try{bank=await window.AppAPI?.fetchBank?.(window.currentLang||'ar')||[]}catch{}}
 const norm=s=>String(s||'').trim().toLowerCase();
 let pool=bank.filter(q=>(!subject||norm(q.subject||q.category).includes(norm(subject)))&&(!topic||norm(q.topic||q.unit).includes(norm(topic))));
 if(!pool.length){toast('لا توجد أسئلة مطابقة في بنك الأسئلة.','warning');return [];}
 count=Math.max(1,Math.min(10,Number(count)||2));const made=[];
 const base=pool.slice();count=Math.min(count,base.length);const maxUniquePer=Math.max(1,Math.floor(base.length/count));const requestedPer=perVariant>0?Math.max(1,Number(perVariant)):maxUniquePer;const targetPer=Math.min(requestedPer,maxUniquePer);if(requestedPer>maxUniquePer)toast(`تم ضبط عدد الأسئلة إلى ${targetPer} لكل نموذج لمنع تكرار الأسئلة بين النماذج.`,'warning');let remaining=base.slice();
 for(let i=0;i<count;i++){
  if(remaining.length<targetPer)break;
  const shuffled=remaining.slice().sort(()=>Math.random()-.5);const chosen=shuffled.slice(0,Math.min(targetPer,shuffled.length));
  const used=new Set(chosen);remaining=remaining.filter(q=>!used.has(q));
  const wrapper=document.createElement('div');wrapper.className='a4-sheet examy-generated-variant';wrapper.innerHTML='<div class="sheet-frame-box"><div class="sheet-header-locked-zone"><div class="sheet-header"><div class="hdr-cell hdr-center">اختبار '+String.fromCharCode(65+i)+'</div></div></div><div class="questions-stream"></div><div class="sheet-smart-footer"><span class="footer-custom-text">نموذج '+String.fromCharCode(65+i)+'</span><span class="footer-page-index"></span></div></div>';
  const stream=$('.questions-stream',wrapper);
  chosen.forEach(q=>{const card=document.createElement('article');card.className='question-container';const title=safe(q.title||q.question||'سؤال');const body=safe(q.content||q.answer||q.text||'');const grade=safe(q.grade??q.marks??q.score??'');card.dataset.questionId=String(q.id||q.questionId||q.title||q.question||('q-'+Math.random()));card.innerHTML=`<div class="q-grade-badge">${grade?`[ ${grade} درجة ]`:''}</div><div class="q-title-badge"><span class="q-title-text">${title}</span></div><div class="text-area q-content-box">${body}</div>`;stream.append(card);});
  made.push({name:`نموذج ${String.fromCharCode(65+i)}`,questions:chosen.map(q=>q.id||q.title||q.question),html:wrapper.outerHTML});
 }
 const dlg=document.createElement('div');dlg.className='examy-variants-dialog';dlg.innerHTML=`<div class="examy-dialog-card"><button class="examy-close" aria-label="إغلاق">×</button><h2>النماذج المتعددة</h2><p>تم إعداد ${made.length} نماذج مستقلة من بنك الأسئلة.</p><div class="examy-variant-list">${made.map((m,i)=>`<button data-index="${i}">${m.name} — ${m.questions.length} سؤال</button>`).join('')}</div><button class="examy-primary" data-action="compare">مقارنة النماذج بالتفصيل</button><button class="examy-primary" data-action="insert">إدراج النماذج في المستند</button></div>`;
 document.body.append(dlg);dlg.addEventListener('click',e=>{if(e.target===dlg||e.target.closest('.examy-close'))dlg.remove();const b=e.target.closest('[data-index]');if(b){const m=made[Number(b.dataset.index)];const host=$('#examyVariantPreview');if(host)host.remove();const p=document.createElement('div');p.id='examyVariantPreview';p.innerHTML=m.html;dlg.querySelector('.examy-dialog-card').append(p);}if(e.target.closest('[data-action="compare"]')){const variants=made.map((m,i)=>({name:m.name,ids:new Set(m.questions.map(String)),count:m.questions.length,html:m.html}));const all=new Set(variants.flatMap(v=>[...v.ids]));const rows=variants.map((v,i)=>{const other=new Set(variants.filter((_,j)=>i!==j).flatMap(x=>[...x.ids]));const common=[...v.ids].filter(x=>other.has(x)).length;const temp=document.createElement('div');temp.innerHTML=v.html;const marks=$$('.q-grade-badge',temp).reduce((n,x)=>n+(Number((x.textContent.match(/[\d.]+/)||[])[0])||0),0);return `<tr><td>${v.name}</td><td>${v.count}</td><td>${marks}</td><td>${common}</td><td>${v.count-common}</td></tr>`;}).join('');let cmp=$('#examyMadeCompare');if(!cmp){cmp=document.createElement('div');cmp.id='examyMadeCompare';dlg.querySelector('.examy-dialog-card').append(cmp);}cmp.innerHTML=`<h3>تقرير مقارنة النماذج</h3><p>الأسئلة الفريدة في جميع النماذج: ${all.size}</p><div class="suite-table-wrap"><table><thead><tr><th>النموذج</th><th>الأسئلة</th><th>الدرجات</th><th>المشتركة</th><th>المنفردة</th></tr></thead><tbody>${rows}</tbody></table></div>`;}if(e.target.closest('[data-action="insert"]')){undo();made.forEach(m=>{const temp=document.createElement('div');temp.innerHTML=m.html;const sheet=temp.firstElementChild;root()?.append(sheet);});api.refreshPageNumbers();dlg.remove();toast('تم إدراج النماذج.','success');}});
 return made;
};

// --- Export, autosave and revision snapshots ---
api.backup=()=>{
 const container=root();if(!container)throw new Error('مساحة تحرير الاختبار غير متاحة.');
 const saved={};
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i)||'';
  if(/^(exambuilder_|examy[._])/.test(key)&&!/(license|token|api.?key)/i.test(key))saved[key]=localStorage.getItem(key);
 }
 const payload={version:1,createdAt:new Date().toISOString(),html:container.innerHTML,localStorage:saved,settings:api.pageSettings};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`Examy-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
 a.style.display='none';document.body.append(a);a.click();a.remove();
 // Do not revoke the object URL synchronously: Chromium may not have started the download yet.
 setTimeout(()=>URL.revokeObjectURL(url),30000);
 toast('تم إنشاء النسخة الاحتياطية.','success');
};
api.restore=async(file)=>{
 if(!file)throw new Error('اختر ملف النسخة الاحتياطية أولاً.');
 if(file.size>25*1024*1024)throw new Error('حجم النسخة الاحتياطية يتجاوز 25MB.');
 const data=JSON.parse(await file.text());
 const container=root();
 if(!data||typeof data.html!=='string'||!data.html.trim()||!container)throw new Error('ملف النسخة الاحتياطية غير صالح.');
 undo();container.innerHTML=sanitizeHTML(data.html);
 if(data.localStorage&&typeof data.localStorage==='object'&&!Array.isArray(data.localStorage)){
  Object.entries(data.localStorage).forEach(([key,value])=>{
   if(/^(exambuilder_|examy[._])/.test(key)&&!/(license|token|api.?key)/i.test(key)&&typeof value==='string'){
    try{localStorage.setItem(key,value)}catch(error){console.warn('تعذر استعادة إعداد محلي:',key,error.message)}
   }
  });
 }
 const settings=data.settings&&typeof data.settings==='object'?data.settings:{};
 const allowedSizes=['A4','A3','A5','Letter','Legal','Tabloid','Executive','B5'];
 const size=allowedSizes.includes(settings.size)?settings.size:'A4';
 const orientation=['portrait','landscape'].includes(settings.orientation)?settings.orientation:'portrait';
 api.pageSettings={...api.pageSettings,...settings,size,orientation};
 api.setPageSize(size,orientation);
 api.setMargins(api.pageSettings.marginTop,api.pageSettings.marginRight,api.pageSettings.marginBottom,api.pageSettings.marginLeft);
 api.refreshPageNumbers();window.restoreUIStateAfterDomUpdate?.();toast('تمت استعادة النسخة الاحتياطية.','success');
};
api.snapshot=()=>{
 try{
  let history=[];try{const parsed=JSON.parse(localStorage.getItem('examy_revision_history')||'[]');if(Array.isArray(parsed))history=parsed}catch{}
  const html=root()?.innerHTML||'';if(!html)return false;
  history.push({at:new Date().toISOString(),html});
  while(history.length>10||JSON.stringify(history).length>4*1024*1024)history.shift();
  localStorage.setItem('examy_revision_history',JSON.stringify(history));return true;
 }catch(error){console.warn('تعذر حفظ سجل المراجعات المحلي:',error);return false}
};
let saveTimer,revisionTimer;const autosave=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem('examy_ultimate_autosave',JSON.stringify({at:Date.now(),html:root()?.innerHTML||''}));clearTimeout(revisionTimer);revisionTimer=setTimeout(()=>api.snapshot(),30000);}catch(e){console.warn('autosave quota',e)}},800);};
document.addEventListener('input',e=>{if(e.target.closest('#sheetsWrapper'))autosave();});
document.addEventListener('focusin',e=>{const el=e.target.closest?.('[contenteditable=\"true\"]');if(el)el.setAttribute('spellcheck','true');});
document.addEventListener('click',e=>{const img=e.target.closest?.('#sheetsWrapper img');if(img){window._examySelectedImage=img;img.classList.add('examy-image-selected')}else{$$('.examy-image-selected').forEach(x=>x.classList.remove('examy-image-selected'));window._examySelectedImage=null;}});document.addEventListener('examy:contentchange',autosave);

// Import .docx and PDF text into editable question blocks.
api.importDocument=()=>{let input=$('#examyDocumentImport');if(!input){input=document.createElement('input');input.type='file';input.id='examyDocumentImport';input.accept='.docx,.pdf,.txt';input.hidden=true;document.body.append(input);input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;try{let html='';if(file.name.toLowerCase().endsWith('.txt')){html=safe(await file.text()).replace(/\r?\n/g,'<br>')}else if(file.name.toLowerCase().endsWith('.docx')){if(!window.mammoth)throw new Error('مكتبة قراءة Word غير متاحة؛ اتصل بالإنترنت ثم أعد المحاولة');const result=await window.mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()});html=result.value;}else if(file.name.toLowerCase().endsWith('.pdf')){if(!window.pdfjsLib)throw new Error('مكتبة قراءة PDF غير متاحة؛ اتصل بالإنترنت ثم أعد المحاولة');const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),content=await page.getTextContent();html+=`<h3>صفحة ${n}</h3><p>${safe(content.items.map(x=>x.str).join(' '))}</p>`;}}if(!html.trim())throw new Error('لم يتم العثور على نص قابل للاستيراد');html=sanitizeHTML(html);undo();const card=document.createElement('article');card.className='question-container';card.innerHTML=`<div class="q-title-badge"><span class="q-title-text">${safe(file.name)}</span></div><div class="text-area q-content-box" contenteditable="true" spellcheck="true">${html}</div>`;const stream=$('.questions-stream',sheets().at(-1)||root());stream?.append(card);window.makeQuestionDraggable?.(card);api.scheduleFlow();toast('تم استيراد محتوى الملف إلى الاختبار.','success');}catch(err){toast(err.message||'تعذر استيراد الملف','error')}finally{input.value=''}});}input.click();};

// --- Built-in controls panel ---
function installPanel(){
 const nav=$('.ribbon-tabs-nav'),panels=$('.ribbon-panels-host');if(!nav||!panels||$('#examyUltimateTab'))return;
 const tab=document.createElement('button');tab.type='button';tab.id='examyUltimateTab';tab.className='r-tab-btn';tab.dataset.tab='ultimate';tab.textContent='✨ أدوات متقدمة';nav.append(tab);
 const panel=document.createElement('div');panel.id='rtab-ultimate';panel.className='ribbon-tab-panel';panel.innerHTML=`
 <section class="r-group"><b class="r-group-title">الصفحات والطباعة</b><div class="r-group-row"><label>الورق <select id="euPaper"><option>A4</option><option>A3</option><option>A5</option><option>Letter</option><option>Legal</option><option>Tabloid</option><option>Executive</option><option>B5</option></select></label><label>الاتجاه <select id="euOrientation"><option value="portrait">عمودي</option><option value="landscape">أفقي</option></select></label><button class="tool-btn" data-eu="flow">توزيع الصفحات</button><button class="tool-btn" data-eu="numbers">ترقيم الصفحات</button></div></section>
 <section class="r-group"><b class="r-group-title">الهوامش (ملم)</b><div class="r-group-row"><input id="euMargins" value="15,15,15,15" aria-label="أعلى، يمين، أسفل، يسار"><button class="tool-btn" data-eu="margins">تطبيق الهوامش</button></div></section>
 <section class="r-group"><b class="r-group-title">الرأس والتذييل</b><div class="r-group-row"><input id="euHeader" placeholder="نص الرأس"><button class="tool-btn" data-eu="header">تطبيق الرأس لكل الصفحات</button><input id="euFooter" placeholder="نص التذييل"><button class="tool-btn" data-eu="footer">تطبيق التذييل</button><label>رقم الصفحة <input id="euPageTarget" type="number" min="1" value="1"></label><button class="tool-btn" data-eu="headerOne">رأس لهذه الصفحة</button><button class="tool-btn" data-eu="footerOne">تذييل لهذه الصفحة</button></div></section>
 <section class="r-group"><b class="r-group-title">التحرير المتقدم</b><div class="r-group-row"><button class="tool-btn" data-eu="paint">نسخ التنسيق</button><button class="tool-btn" data-eu="pastepaint">لصق التنسيق</button><button class="tool-btn" data-eu="table">إدراج جدول</button><button class="tool-btn" data-eu="equation">معادلة</button><button class="tool-btn" data-eu="image">إدراج صورة</button><label>عرض الصورة % <input id="euImageWidth" type="number" min="5" max="100" value="60"></label><button class="tool-btn" data-eu="imageSize">تطبيق الحجم</button><button class="tool-btn" data-eu="symbols">رموز علمية</button><button class="tool-btn" data-eu="import">استيراد Word / PDF</button></div></section>
 <section class="r-group"><b class="r-group-title">بناء النماذج والحماية</b><div class="r-group-row"><label>عدد النماذج <input id="euVariantCount" type="number" min="1" max="10" value="2"></label><label>عدد الأسئلة <input id="euQuestionCount" type="number" min="0" value="0"></label><button class="tool-btn" data-eu="variants">إنشاء نماذج عشوائية</button><button class="tool-btn" data-eu="backup">نسخة احتياطية</button><label class="tool-btn">استعادة نسخة<input id="euRestore" type="file" accept="application/json" hidden></label></div></section>`;
 panels.append(panel);
 // Tab switching is delegated centrally by app.js; avoid duplicate handlers.
 panel.addEventListener('click',async e=>{const b=e.target.closest('[data-eu]');if(!b)return;const act=b.dataset.eu;try{switch(act){case'flow':api.flow();break;case'numbers':api.refreshPageNumbers();break;case'margins':api.setMargins(...$('#euMargins').value.split(',').map(Number));break;case'header':api.setHeaderFooter('header',$('#euHeader').value,{all:true});break;case'footer':api.setHeaderFooter('footer',$('#euFooter').value,{all:true});break;case'headerOne':api.setHeaderFooter('header',$('#euHeader').value,{page:Number($('#euPageTarget').value)||1});break;case'footerOne':api.setHeaderFooter('footer',$('#euFooter').value,{page:Number($('#euPageTarget').value)||1});break;case'paint':api.copyFormat();break;case'pastepaint':api.pasteFormat();break;case'table':api.insertTable(3,3);break;case'equation':api.openEquationEditor();break;case'image':api.insertImage();break;case'imageSize':if(!api.setSelectedImageSize($('#euImageWidth').value))toast('حدد صورة داخل الاختبار أولاً','warning');break;case'import':api.importDocument();break;case'symbols':api.command('insertText',' ∑ ∫ √ π ± ≤ ≥ ≠ → α β θ ');break;case'variants':api.generateVariants({count:Number($('#euVariantCount').value)||2,perVariant:Number($('#euQuestionCount').value)||0});break;case'backup':api.backup();break;}}catch(err){console.error(err);toast(err.message||'تعذر تنفيذ العملية','error');}});
 $('#euPaper',panel).addEventListener('change',()=>api.setPageSize($('#euPaper').value,$('#euOrientation').value));$('#euOrientation',panel).addEventListener('change',()=>api.setPageSize($('#euPaper').value,$('#euOrientation').value));
 $('#euRestore',panel).addEventListener('change',async e=>{if(e.target.files[0])try{await api.restore(e.target.files[0])}catch(err){toast('تعذر استعادة الملف: '+err.message,'error')}e.target.value='';});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installPanel,{once:true});else installPanel();
window.addEventListener('load',()=>{
 const settings=api.pageSettings;
 api.setPageSize(settings.size,settings.orientation,false);
 api.setMargins(settings.marginTop,settings.marginRight,settings.marginBottom,settings.marginLeft,false);
 api.refreshPageNumbers();
});
const observer=new MutationObserver(records=>{let changed=false;for(const r of records){const t=r.target.nodeType===1?r.target:r.target.parentElement;if(t?.closest('.questions-stream'))changed=true;if(t===root()&&[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches?.('.a4-sheet')||n.querySelector?.('.a4-sheet')))){api.refreshPageNumbers();changed=true;}}if(changed)api.scheduleFlow()});
const start=()=>{if(root())observer.observe(root(),{childList:true,subtree:true});};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
