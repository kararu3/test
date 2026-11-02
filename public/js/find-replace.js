/**
 * Examy PRO — بحث واستبدال آمن يحافظ على بنية HTML والتنسيقات.
 * الاستبدال يتم على عقد النص فقط ولا يعيد كتابة innerHTML.
 */
const FindReplace = {
    matches: [],
    currentIndex: -1,
    getRoot() { return document.querySelector('#sheetsWrapper'); },
    getTextNodes() {
        const root = this.getRoot();
        if (!root) return [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                const p = node.parentElement;
                if (!p || p.closest('script,style,textarea,input,select,button,[contenteditable="false"],.find-replace-pane')) return NodeFilter.FILTER_REJECT;
                return p.closest('[contenteditable="true"]') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode); return nodes;
    },
    toggle() {
        const pane=document.getElementById('findReplacePane');
        if(!pane) return;
        const open=!pane.classList.contains('active');
        pane.classList.toggle('active',open);
        pane.setAttribute('aria-hidden',String(!open));
        if(open) document.getElementById('findInput')?.focus();
        else this.clearHighlights();
    },
    clearHighlights() {
        document.querySelectorAll('.examy-find-current').forEach(el=>{
            const parent=el.parentNode; if(!parent) return;
            parent.replaceChild(document.createTextNode(el.textContent),el); parent.normalize();
        });
        this.matches=[]; this.currentIndex=-1;
    },
    findAll() {
        this.clearHighlights();
        const q=document.getElementById('findInput')?.value || '';
        if(!q) return [];
        const escaped=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const re=new RegExp(escaped,'giu');
        this.getTextNodes().forEach(node=>{
            const value=node.nodeValue; let m, last=0, found=false;
            const frag=document.createDocumentFragment();
            while((m=re.exec(value))!==null) {
                found=true;
                if(m.index>last) frag.appendChild(document.createTextNode(value.slice(last,m.index)));
                const mark=document.createElement('mark');
                mark.className='examy-find-current'; mark.textContent=m[0];
                frag.appendChild(mark); last=m.index+m[0].length;
                if(!m[0].length) re.lastIndex++;
            }
            if(found) { if(last<value.length) frag.appendChild(document.createTextNode(value.slice(last))); node.parentNode.replaceChild(frag,node); }
        });
        this.matches=Array.from(document.querySelectorAll('.examy-find-current'));
        this.currentIndex=this.matches.length?0:-1;
        this.focusCurrent();
        return this.matches;
    },
    focusCurrent() {
        this.matches.forEach((m,i)=>m.classList.toggle('examy-find-selected',i===this.currentIndex));
        const el=this.matches[this.currentIndex];
        if(el) el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
        const status=document.getElementById('findReplaceStatus');
        if(status) status.textContent=this.matches.length?`${this.currentIndex+1} / ${this.matches.length}`:'لا توجد نتائج';
    },
    next(direction=1) {
        if(!this.matches.length) this.findAll();
        if(!this.matches.length) return;
        this.currentIndex=(this.currentIndex+direction+this.matches.length)%this.matches.length;
        this.focusCurrent();
    },
    executeReplaceAll() {
        const findVal=document.getElementById('findInput')?.value || '';
        const replaceVal=document.getElementById('replaceInput')?.value ?? '';
        if(!findVal) { alert('يرجى كتابة الكلمة المراد البحث عنها.'); return; }
        this.clearHighlights();
        if(typeof recordUndoState==='function') recordUndoState();
        const escaped=findVal.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const re=new RegExp(escaped,'giu');
        let count=0;
        this.getTextNodes().forEach(node=>{
            const old=node.nodeValue;
            const next=old.replace(re,()=>{count++; return replaceVal;});
            if(next!==old) node.nodeValue=next;
        });
        if(typeof UIEffects!=='undefined') UIEffects.showToast(`تم استبدال ${count} تطابقاً بنجاح`,'success');
        else alert(`تم استبدال ${count} تطابقاً`);
        this.toggle();
        if(typeof updateUIIndicators==='function') updateUIIndicators();
    }
};
document.addEventListener('keydown',e=>{
    if(e.ctrlKey && e.key.toLowerCase()==='f') { e.preventDefault(); FindReplace.toggle(); }
    if(e.key==='Escape') { const p=document.getElementById('findReplacePane'); if(p?.classList.contains('active')) FindReplace.toggle(); }
});
