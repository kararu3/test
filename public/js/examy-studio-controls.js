/* Examy PRO — Studio controls, smart contextual formatting, preview dock and AI assistant */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const safe=(fn)=>{try{fn()}catch(e){console.warn('[Examy Studio]',e)}};
function selectedEditable(){const s=window.getSelection();if(s&&s.rangeCount){let n=s.anchorNode;if(n&&n.nodeType===3)n=n.parentElement;return n?.closest?.('[contenteditable="true"]')||null}return document.activeElement?.closest?.('[contenteditable="true"]')||null}
function activeSheet(){const e=selectedEditable();return e?.closest('.a4-sheet')||$('.a4-sheet')}
function activeBlock(){const e=selectedEditable();if(!e)return null;let n=e;while(n&&n!==e.closest('[contenteditable="true"]'))n=n.parentElement;return e.closest('p,li,div,td,th')||e}
function refreshSheet(sheet){if(sheet&&typeof window.checkExactSheetOverflow==='function')window.checkExactSheetOverflow(sheet)}
function addGroup(parent,title,html){const g=document.createElement('section');g.className='r-group examy-added-group';g.innerHTML='<span class="r-group-title">'+title+'</span><div class="r-group-row">'+html+'</div>';parent.appendChild(g);return g}
function addLayoutTools(){
 const panel=$('#rtab-layout');if(!panel||$('.examy-layout-group'))return;
 const group=addGroup(panel,'مقاس الصفحة والهوامش',`<div class="examy-layout-controls">
 <label class="field">الورق <select id="examyPaperSize"><option value="A4">A4</option><option value="A3">A3</option><option value="A5">A5</option><option value="Letter">Letter</option></select></label>
 <label class="field">الهامش العلوي <input id="examyMarginTop" type="number" min="0" max="80" step="1" value="16"> مم</label>
 <label class="field">السفلي <input id="examyMarginBottom" type="number" min="0" max="80" step="1" value="16"> مم</label>
 <label class="field">الأيمن <input id="examyMarginRight" type="number" min="0" max="80" step="1" value="16"> مم</label>
 <label class="field">الأيسر <input id="examyMarginLeft" type="number" min="0" max="80" step="1" value="16"> مم</label>
 <button type="button" class="tool-btn" id="examyApplyMargins">تطبيق الهوامش</button>
 <button type="button" class="examy-ruler-toggle" id="examyRulerToggle">📏 إظهار المسطرة</button>
 </div>`);
 group.classList.add('examy-layout-group');
 const size=$('#examyPaperSize');size.value=localStorage.getItem('examy_studio_paper')||'A4';
 size.addEventListener('change',()=>{if(typeof window.handlePaperSizeChange==='function')window.handlePaperSizeChange(size.value);$$('.a4-sheet').forEach(s=>s.dataset.paperSize=size.value);localStorage.setItem('examy_studio_paper',size.value);});
 $('#examyApplyMargins').addEventListener('click',applyMargins);
 ['examyMarginTop','examyMarginBottom','examyMarginRight','examyMarginLeft'].forEach(id=>$('#'+id).addEventListener('keydown',e=>{if(e.key==='Enter')applyMargins()}));
 const ruler=$('#examyRulerToggle');let visible=localStorage.getItem('examy_ruler_visible')==='true';setRuler(visible);
 ruler.addEventListener('click',()=>{visible=!visible;setRuler(visible)});
 function setRuler(v){localStorage.setItem('examy_ruler_visible',String(v));ruler.textContent=v?'📏 إخفاء المسطرة':'📏 إظهار المسطرة';$$('.sheet-ruler,.sheet-ruler-top,.sheet-ruler-side,.ruler-horizontal,.ruler-vertical').forEach(x=>x.style.display=v?'':'none');document.body.classList.toggle('examy-rulers-on',v)}
}
function applyMargins(){
 const vals={top:+$('#examyMarginTop').value||0,bottom:+$('#examyMarginBottom').value||0,right:+$('#examyMarginRight').value||0,left:+$('#examyMarginLeft').value||0};
 Object.entries(vals).forEach(([k,v])=>vals[k]=Math.max(0,Math.min(80,v)));
 $$('.a4-sheet .sheet-frame-box').forEach(box=>{box.style.setProperty('--ex-margin-top',vals.top+'mm');box.style.setProperty('--ex-margin-bottom',vals.bottom+'mm');box.style.setProperty('--ex-margin-right',vals.right+'mm');box.style.setProperty('--ex-margin-left',vals.left+'mm');box.style.padding=`${vals.top}mm ${vals.left}mm ${vals.bottom}mm ${vals.right}mm`;});
 localStorage.setItem('examy_page_margins',JSON.stringify(vals));$$('.a4-sheet').forEach(refreshSheet);if(window.UIEffects?.showToast)UIEffects.showToast('تم تطبيق هوامش الصفحة','success');
}
function addParagraphControls(){
 const bar=$('#inlineTextFormatter');if(!bar||$('.examy-format-extra'))return;
 const wrap=document.createElement('span');wrap.className='examy-format-extra';wrap.innerHTML=`
 <button type="button" data-act="before" title="زيادة المسافة قبل الفقرة">↑ قبل +</button>
 <button type="button" data-act="after" title="زيادة المسافة بعد الفقرة">↓ بعد +</button>
 <button type="button" data-act="beforeLess" title="تقليل المسافة قبل الفقرة">قبل −</button>
 <button type="button" data-act="afterLess" title="تقليل المسافة بعد الفقرة">بعد −</button>
 <button type="button" data-act="removeSpace" title="إزالة مسافات الفقرة">↕ تصفير</button>
 <button type="button" data-act="deleteLine" title="حذف السطر الحالي">⌫ حذف السطر</button>`;
 bar.appendChild(wrap);
 wrap.addEventListener('mousedown',e=>{if(e.target.closest('button'))e.preventDefault()});
 wrap.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;formatBlock(b.dataset.act)});
}
function formatBlock(action){
 const block=activeBlock();if(!block){window.UIEffects?.showToast('ضع المؤشر داخل نص أولاً','warning');return}
 if(typeof window.recordUndoState==='function')window.recordUndoState();
 const px=v=>Math.max(0,Math.min(120,v));
 const cs=getComputedStyle(block);
 if(action==='before')block.style.marginBlockStart=px(parseFloat(cs.marginBlockStart)+4)+'px';
 if(action==='after')block.style.marginBlockEnd=px(parseFloat(cs.marginBlockEnd)+4)+'px';
 if(action==='beforeLess')block.style.marginBlockStart=px(parseFloat(cs.marginBlockStart)-4)+'px';
 if(action==='afterLess')block.style.marginBlockEnd=px(parseFloat(cs.marginBlockEnd)-4)+'px';
 if(action==='removeSpace'){block.style.marginBlockStart='0';block.style.marginBlockEnd='0'}
 if(action==='deleteLine'){
  const s=getSelection();
  if(s&&s.rangeCount&&!s.isCollapsed){s.deleteFromDocument()}
  else if(block.matches('p,li,td,th') && block!==selectedEditable()){block.remove()}
  else {window.UIEffects?.showToast('حدد نص السطر الذي تريد حذفه أولاً لتجنب حذف محتوى السؤال بالكامل','warning');return}
 }
 refreshSheet(block.closest('.a4-sheet'));
}
function addSettingsAndFrameControls(){
 const paper=$('#stab-paper');if(paper&&!$('#examy-settings-margins')){
  const card=document.createElement('div');card.id='examy-settings-margins';card.className='settings-section-card';
  card.innerHTML='<div class="settings-card-title">هوامش الطباعة الدقيقة</div><p style="color:var(--ex-ui-muted);font-size:12px">يمكن اختيار القيم الجاهزة أو كتابة كل هامش بالملليمتر.</p><div class="examy-layout-controls"><label class="field">جاهز <select id="examyMarginPreset"><option value="custom">مخصص</option><option value="normal">عادي 16 مم</option><option value="narrow">ضيق 8 مم</option><option value="wide">واسع 25 مم</option><option value="ministry">رسمي 20 مم</option></select></label></div><div class="examy-layout-controls" id="examySettingsMarginFields"></div><button type="button" class="tool-btn" id="examySettingsApplyMargins">حفظ وتطبيق الهوامش</button>';
  paper.appendChild(card);
  const fields=$('#examySettingsMarginFields');[['top','علوي'],['bottom','سفلي'],['right','أيمن'],['left','أيسر']].forEach(([k,n])=>{const l=document.createElement('label');l.className='field';l.innerHTML=n+' <input type="number" min="0" max="80" id="examySetMargin_'+k+'" value="16"> مم';fields.appendChild(l)});
  $('#examyMarginPreset').addEventListener('change',e=>{const v={normal:16,narrow:8,wide:25,ministry:20}[e.target.value];if(v!==undefined)['top','bottom','right','left'].forEach(k=>$('#examySetMargin_'+k).value=v)});
  $('#examySettingsApplyMargins').addEventListener('click',()=>{['top','bottom','right','left'].forEach(k=>$('#examyMargin'+k[0].toUpperCase()+k.slice(1)).value=$('#examySetMargin_'+k).value);applyMargins()});
 }
 const layout=$('#rtab-layout');if(layout&&!$('#examy-frame-controls')){
  const g=addGroup(layout,'استوديو الإطار',`<label class="field">النمط <select id="examyFrameShape"><option value="gradient">متدرج</option><option value="solid">متصل</option><option value="double">مزدوج</option><option value="dashed">متقطع</option><option value="islamic">إسلامي</option><option value="geometric">هندسي</option><option value="ministry">وزاري</option><option value="elegant">أنيق</option><option value="none">بلا إطار</option></select></label><label class="field">اللون <input id="examyFrameColor" type="color" value="#2563eb"></label><label class="field">السماكة <input id="examyFrameSize" type="number" min="1" max="25" value="12"> px</label><label class="field">الإزاحة <input id="examyFrameInset" type="number" min="2" max="30" value="12"> mm</label><button type="button" class="tool-btn" id="examyApplyFrame">تطبيق الإطار</button>`);
  g.id='examy-frame-controls';$('#examyApplyFrame').addEventListener('click',()=>{const shape=$('#examyFrameShape').value,color=$('#examyFrameColor').value,size=Math.max(1,Math.min(25,+$('#examyFrameSize').value||1)),inset=Math.max(2,Math.min(30,+$('#examyFrameInset').value||12));if(window.syncBorderSettings){syncBorderSettings('shape',shape);syncBorderSettings('color',color);syncBorderSettings('size',size+'px')}document.documentElement.style.setProperty('--frame-inset',inset+'mm');localStorage.setItem('examy_frame_inset',inset)});
 }
}
function buildPreviewDock(){
 const modal=$('#printPreviewModal');if(!modal||$('.examy-preview-side'))return;
 const dock=document.createElement('aside');dock.className='examy-preview-side';
 dock.innerHTML=`<div class="examy-preview-brand"><span class="brand-sparkle">✦</span><span class="animated-brand-title">Examy <span class="brand-pro-pill">PRO</span></span></div>
 <section class="examy-preview-section"><strong>الورقة</strong><label>حجم الورق<select id="examyPreviewPaper"><option>A4</option><option>A3</option><option>A5</option><option>Letter</option></select></label><label>نمط الإطار<select id="examyPreviewBorder"><option value="gradient">متدرج</option><option value="solid">متصل</option><option value="double">مزدوج</option><option value="dashed">متقطع</option><option value="islamic">إسلامي</option><option value="geometric">هندسي</option><option value="ministry">وزاري</option><option value="none">بدون</option></select></label><label>لون الإطار<input type="color" id="examyPreviewColor" value="#2563eb"></label></section>
 <section class="examy-preview-section"><strong>المراجعة والعرض</strong><button type="button" id="examyPreviewZoomOut">تصغير المعاينة</button><button type="button" id="examyPreviewZoomIn">تكبير المعاينة</button><button type="button" id="examyPreviewFit">ملاءمة الصفحة</button></section>
 <section class="examy-preview-section"><strong>الإجراءات</strong><button type="button" id="examyPreviewPrint">🖨️ طباعة الاختبار</button><button type="button" id="examyPreviewClose">إغلاق المعاينة</button></section>`;
 modal.insertBefore(dock,modal.firstChild);
 const oldPaper=$('#previewPaperSizeSelect'),oldShape=$('#prevBorderShape'),oldColor=$('#prevBorderColor');
 const p=$('#examyPreviewPaper');p.value=oldPaper?.value||'A4';p.addEventListener('change',()=>window.handlePaperSizeChange?.(p.value));
 $('#examyPreviewBorder').addEventListener('change',e=>window.syncBorderSettings?.('shape',e.target.value));
 $('#examyPreviewColor').addEventListener('input',e=>window.syncBorderSettings?.('color',e.target.value));
 $('#examyPreviewZoomOut').onclick=()=>window.adjustPreviewZoom?.(-.1);
 $('#examyPreviewZoomIn').onclick=()=>window.adjustPreviewZoom?.(.1);
 $('#examyPreviewFit').onclick=()=>{const host=$('#previewPagesHost'),vp=$('.preview-viewport-scroll');if(host&&vp){const sheet=$('.a4-sheet',host);if(sheet){const scale=Math.min(.98,(vp.clientWidth-36)/sheet.offsetWidth);host.style.transform='scale('+scale+')';host.style.transformOrigin='top center'}}};
 $('#examyPreviewPrint').onclick=()=>window.promptDirectPrint?.();
 $('#examyPreviewClose').onclick=()=>window.closePrintPreview?.();
 // Keep legacy controls synchronized for existing print handlers and integrations.
 if(oldPaper)oldPaper.addEventListener('change',()=>p.value=oldPaper.value);
 if(oldShape)$('#examyPreviewBorder').value=oldShape.value;
 if(oldColor)$('#examyPreviewColor').value=oldColor.value;
}
function addAdvancedWorkspace(){
 const nav=$('.ribbon-tabs-nav'),host=$('.ribbon-panels-host');if(!nav||!host||$('#rtab-advancedStudio'))return;
 const tab=document.createElement('button');tab.type='button';tab.className='r-tab-btn';tab.dataset.tab='advancedStudio';tab.textContent='🧠 الاستوديو المتقدم';nav.appendChild(tab);
 const panel=document.createElement('div');panel.id='rtab-advancedStudio';panel.className='ribbon-tab-panel';panel.innerHTML='<section class="r-group"><span class="r-group-title">إنشاء ذكي</span><div class="r-group-row"><button type="button" class="tool-btn" id="exAdvAI">✨ مساعد الأسئلة الذكي</button><button type="button" id="exAdvAnswer" class="tool-btn">📝 ورقة إجابة الطالب</button><button type="button" id="exAdvShuffle" class="tool-btn">🔀 إنشاء نموذج بديل</button></div></section><section class="r-group"><span class="r-group-title">تنظيم الاختبار</span><div class="r-group-row"><button type="button" id="exAdvBalance" class="tool-btn">⚖️ توزيع الدرجات</button><button type="button" id="exAdvSpacing" class="tool-btn">↕️ موازنة المسافات</button><button type="button" id="exAdvShrink" class="tool-btn">📄 ملاءمة محتوى الصفحة</button></div></section><section class="r-group"><span class="r-group-title">الفحص والجودة</span><div class="r-group-row"><button type="button" id="exAdvPreflight" class="tool-btn">🔎 فحص قبل الطباعة</button><button type="button" id="exAdvPageFlow" class="tool-btn">📚 إعادة توزيع الصفحات</button><button type="button" id="exAdvFind" class="tool-btn">🔍 بحث واستبدال</button></div></section>';
 host.appendChild(panel);
 $('#exAdvAI').onclick=openAIStudio;
 $('#exAdvAnswer').onclick=()=>window.AdvancedExamTools?.generateStudentAnswerSheet?.();
 $('#exAdvShuffle').onclick=()=>window.AdvancedExamTools?.generateShuffleVersion?.('ب');
 $('#exAdvBalance').onclick=()=>window.autoDistributeSpacing?.();
 $('#exAdvSpacing').onclick=()=>window.autoDistributeSpacing?.();
 $('#exAdvShrink').onclick=()=>window.PreFlightSystem?.smartShrinkPage?.();
 $('#exAdvPreflight').onclick=()=>window.PreFlightSystem?.openPreflightModal?.();
 $('#exAdvPageFlow').onclick=()=>window.ExamyPages?.flow?.();
 $('#exAdvFind').onclick=()=>window.FindReplace?.toggle?.();
}
function addAIStudio(){
 const home=$('#rtab-home');if(home&&!$('#examyAIStudioBtn')){
  const g=addGroup(home,'الستوديو الذكي',`<button type="button" class="tool-btn" id="examyAIStudioBtn">✨ فتح الستوديو الذكي</button>`);
  g.style.borderColor='rgba(126,105,255,.55)';$('#examyAIStudioBtn').onclick=openAIStudio;
 }
 if(!$('#examyAIStudioModal')){
  const modal=document.createElement('div');modal.id='examyAIStudioModal';modal.className='modal-backdrop';modal.innerHTML=`<div class="modal-dialog modal-wide"><div class="dialog-top"><h3>✨ الستوديو الذكي — مساعد إعداد الاختبارات</h3><button class="close-x" id="examyAIClose">✕</button></div><div class="dialog-content examy-ai-panel"><p>أنشئ أسئلة تعليمية منظمة حسب المادة والصف، ثم راجعها قبل إدراجها.</p><label>مفتاح OpenAI API <input id="examyAIKey" type="password" autocomplete="off" placeholder="أدخل المفتاح الجديد هنا"></label><label>النموذج <select id="examyAIModel"><option value="gpt-4o-mini">GPT-4o mini</option><option value="gpt-4.1-mini">GPT-4.1 mini</option><option value="gpt-4o">GPT-4o</option></select></label><button class="tool-btn" id="examyAISaveKey">حفظ المفتاح محلياً</button><div class="settings-grid-cols"><label>المادة <input id="examyAISubject" value="العلوم"></label><label>الصف <input id="examyAIGrade" value="السادس الابتدائي"></label></div><label>وصف الاختبار المطلوب <textarea id="examyAIPrompt" placeholder="مثلاً: أنشئ 10 أسئلة متنوعة مع إجابات نموذجية..."></textarea></label><button class="tool-btn" id="examyAIGenerate">⚡ توليد الأسئلة</button><div class="examy-ai-status" id="examyAIStatus" role="status"></div><div class="examy-ai-result" id="examyAIResult"></div><button class="tool-btn" id="examyAIInsert">إدراج النتيجة في الاختبار</button></div></div>`;
  document.body.appendChild(modal);
  $('#examyAIClose').onclick=()=>modal.classList.remove('active');
  $('#examyAISaveKey').onclick=async()=>{const key=$('#examyAIKey').value.trim();if(!key){$('#examyAIStatus').textContent='أدخل مفتاح API الجديد أولاً.';return}try{const r=await fetch('http://localhost:3000/api/ai/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,model:$('#examyAIModel').value})});const d=await r.json();$('#examyAIStatus').textContent=d.message||d.error||'تعذر حفظ المفتاح';if(r.ok)$('#examyAIKey').value=''}catch(e){$('#examyAIStatus').textContent='تعذر الوصول إلى خادم البرنامج المحلي.'}};
  $('#examyAIGenerate').onclick=async()=>{const prompt=$('#examyAIPrompt').value.trim();if(!prompt){$('#examyAIStatus').textContent='اكتب وصف الأسئلة أولاً.';return}$('#examyAIGenerate').disabled=true;$('#examyAIStatus').textContent='جارٍ إعداد الأسئلة…';$('#examyAIResult').textContent='';try{const r=await fetch('http://localhost:3000/api/ai/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:$('#examyAISubject').value,grade:$('#examyAIGrade').value,prompt})});const d=await r.json();if(!r.ok)throw new Error(d.error||'فشل التوليد');$('#examyAIResult').textContent=d.text||'';$('#examyAIStatus').textContent='اكتمل التوليد. راجع الأسئلة قبل إدراجها.'}catch(e){$('#examyAIStatus').textContent=e.message}finally{$('#examyAIGenerate').disabled=false}};
  $('#examyAIInsert').onclick=()=>{const result=$('#examyAIResult').textContent;if(!result)return;const target=$('.questions-stream',activeSheet()||document)||$('.questions-stream');if(!target){$('#examyAIStatus').textContent='لا توجد مساحة إدراج متاحة.';return}if(typeof window.createNewQuestion==='function'){const before=$$('.question-container').length;window.createNewQuestion();const cards=$$('.question-container');const card=cards[cards.length-1];const edit=card?.querySelector('[contenteditable="true"]');if(edit)edit.innerText=result;else target.insertAdjacentHTML('beforeend','<div contenteditable="true"></div>');}else{const div=document.createElement('div');div.contentEditable='true';div.textContent=result;target.appendChild(div)}modal.classList.remove('active')};
 }
}
function openAIStudio(){const m=$('#examyAIStudioModal');if(m){m.classList.add('active');fetch('http://localhost:3000/api/ai/config').then(r=>r.json()).then(d=>{$('#examyAIStatus').textContent=d.configured?'المفتاح محفوظ محلياً — النموذج: '+d.model:'أضف مفتاح API جديداً للبدء.'}).catch(()=>{$('#examyAIStatus').textContent='تعذر الاتصال بالخادم المحلي.'})}}
function observeContext(){
 document.addEventListener('selectionchange',()=>{const bar=$('#inlineTextFormatter');const sel=getSelection();if(!bar||!sel||sel.isCollapsed)return;const node=sel.anchorNode?.nodeType===3?sel.anchorNode.parentElement:sel.anchorNode;const edit=node?.closest?.('[contenteditable="true"]');if(!edit)return;bar.classList.add('active');});
 document.addEventListener('click',e=>{const menu=e.target.closest('.dropdown-content-pane');if(!menu||!menu.classList.contains('active'))return;requestAnimationFrame(()=>{const r=menu.getBoundingClientRect(),pad=12;let left=Math.max(pad,Math.min(r.left,innerWidth-r.width-pad));let top=Math.max(pad,Math.min(r.top,innerHeight-r.height-pad));menu.style.left=left+'px';menu.style.top=top+'px';menu.style.right='auto';menu.style.margin='0';menu.style.maxHeight=Math.max(180,innerHeight-top-pad)+'px';})},true);
}
function boot(){safe(addLayoutTools);safe(addParagraphControls);safe(addSettingsAndFrameControls);safe(buildPreviewDock);safe(addAIStudio);safe(addAdvancedWorkspace);safe(observeContext);
 const saved=localStorage.getItem('examy_page_margins');if(saved){try{const v=JSON.parse(saved);Object.entries(v).forEach(([k,n])=>{const id='examyMargin'+k[0].toUpperCase()+k.slice(1);if($('#'+id))$('#'+id).value=n;const set=$('#examySetMargin_'+k);if(set)set.value=n});}catch{}}
 const paper=localStorage.getItem('examy_studio_paper')||'A4';$$('.a4-sheet').forEach(s=>s.dataset.paperSize=paper);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,80));else setTimeout(boot,80);
})();
