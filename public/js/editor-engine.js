/* Examy PRO editor core v3: safe selection, formatting, page-breaks and editor commands. */
(function () {
  'use strict';
  const api = window.ExamyEditor = window.ExamyEditor || {};
  const root = () => document.getElementById('sheetsWrapper');
  const editableRoot = node => {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return el && el.closest('#sheetsWrapper [contenteditable="true"], #sheetsWrapper .question-container');
  };
  api.getSelection = () => {
    const s = getSelection(); if (!s || !s.rangeCount) return null;
    const r = s.getRangeAt(0); return root()?.contains(r.commonAncestorContainer) ? r.cloneRange() : null;
  };
  api.restoreSelection = r => { if (!r) return false; const s=getSelection(); if(!s)return false; s.removeAllRanges();s.addRange(r);return true; };
  api.focusSelection = () => { const r=api.getSelection(); if(!r)return false; const el=editableRoot(r.commonAncestorContainer); el?.focus(); return api.restoreSelection(r); };
  api.command = (name, value=null) => {
    const r=api.getSelection(); if(!r)return false;
    if (typeof window.recordUndoState==='function') window.recordUndoState();
    api.restoreSelection(r); document.execCommand(name,false,value);
    document.dispatchEvent(new CustomEvent('examy:contentchange',{detail:{command:name}})); return true;
  };
  api.setLineHeight = delta => {
    const r=api.getSelection(); if(!r)return false;
    const el=editableRoot(r.commonAncestorContainer); if(!el)return false;
    if(typeof window.recordUndoState==='function')window.recordUndoState();
    const target=el.closest('.question-container') || el;
    const current=parseFloat(getComputedStyle(target).lineHeight)/parseFloat(getComputedStyle(target).fontSize) || 1.35;
    target.style.lineHeight=Math.max(1,Math.min(2.5,current+delta)).toFixed(2);
    document.dispatchEvent(new CustomEvent('examy:contentchange',{detail:{command:'line-height'}})); return true;
  };
  api.insertPageBreak = () => {
    const s=getSelection(); if(!s||!s.rangeCount)return false;
    const r=s.getRangeAt(0); if(!root()?.contains(r.commonAncestorContainer))return false;
    const sheet=(r.commonAncestorContainer.nodeType===1?r.commonAncestorContainer:r.commonAncestorContainer.parentElement)?.closest('.a4-sheet');
    if(!sheet)return false;
    if(typeof window.recordUndoState==='function')window.recordUndoState();
    const marker=document.createElement('div'); marker.className='examy-manual-page-break'; marker.contentEditable='false'; marker.dataset.pageBreak='manual'; marker.setAttribute('role','separator'); marker.innerHTML='<span>فاصل صفحة يدوي</span>';
    r.deleteContents(); r.insertNode(marker); const after=document.createRange();after.setStartAfter(marker);after.collapse(true);s.removeAllRanges();s.addRange(after);
    document.dispatchEvent(new CustomEvent('examy:contentchange',{detail:{command:'page-break'}})); return true;
  };
  api.removePageBreaks = scope => {const host=scope||root();if(!host)return 0;const nodes=host.querySelectorAll('.examy-manual-page-break');const n=nodes.length;nodes.forEach(x=>x.remove());return n;};
  api.clearFormatting = () => api.command('removeFormat');
  api.insertSymbol = symbol => { if(!api.focusSelection())return false; return api.command('insertText',symbol); };
  document.addEventListener('keydown', e => {
    if(e.ctrlKey&&e.key==='Enter'&&editableRoot(document.activeElement)){e.preventDefault();api.insertPageBreak();}
    if(e.ctrlKey&&e.key.toLowerCase()==='b'&&editableRoot(document.activeElement)){e.preventDefault();api.command('bold');}
    if(e.ctrlKey&&e.key.toLowerCase()==='i'&&editableRoot(document.activeElement)){e.preventDefault();api.command('italic');}
    if(e.ctrlKey&&e.key.toLowerCase()==='u'&&editableRoot(document.activeElement)){e.preventDefault();api.command('underline');}
  });
})();
