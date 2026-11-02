/* Examy PRO Ribbon: hover preview, idle collapse and pin-to-stay. */
(() => {
  'use strict';
  const KEY = 'examy.ribbon.pinned.v1';
  const IDLE_MS = 5000;
  let idleTimer = null;
  let pinned = false;
  let activeKey = 'home';
  let initialized = false;

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

  function panelFor(key) { return document.getElementById('rtab-' + key); }
  function buttonFor(key) { return $('.r-tab-btn[data-tab="' + key + '"]'); }

  function activate(key, button) {
    const panel = panelFor(key);
    if (!panel) return;
    activeKey = key;
    $$('.r-tab-btn').forEach(b => b.classList.toggle('active', b === (button || buttonFor(key))));
    $$('.ribbon-tab-panel').forEach(p => {
      const active = p === panel;
      p.classList.toggle('active', active);
      p.style.display = active ? 'flex' : 'none';
    });
    $('#mainToolbar')?.classList.add('ribbon-panel-open');
    resetIdle();
  }

  function showPanel() {
    const toolbar = $('#mainToolbar');
    if (!toolbar) return;
    toolbar.classList.remove('ribbon-collapsed');
    toolbar.classList.add('ribbon-panel-open');
  }

  function collapsePanel() {
    const toolbar = $('#mainToolbar');
    if (!toolbar || pinned || toolbar.matches(':hover') || toolbar.contains(document.activeElement)) return;
    toolbar.classList.add('ribbon-collapsed');
    toolbar.classList.remove('ribbon-panel-open');
  }

  function resetIdle() {
    clearTimeout(idleTimer);
    if (pinned) return;
    showPanel();
    idleTimer = setTimeout(collapsePanel, IDLE_MS);
  }

  function setPinned(value) {
    pinned = !!value;
    const toolbar = $('#mainToolbar');
    const pin = $('#ribbonPinToggle');
    if (!toolbar || !pin) return;
    toolbar.classList.toggle('ribbon-pinned', pinned);
    toolbar.classList.toggle('ribbon-collapsed', false);
    toolbar.classList.toggle('ribbon-panel-open', true);
    pin.classList.toggle('is-pinned', pinned);
    pin.setAttribute('aria-pressed', String(pinned));
    pin.setAttribute('title', pinned ? 'إلغاء تثبيت الشريط' : 'تثبيت الشريط وإبقاء الأدوات ظاهرة');
    pin.innerHTML = pinned ? '<span class="pin-symbol">📌</span><span>مثبّت</span>' : '<span class="pin-symbol">📍</span><span>تثبيت</span>';
    try { localStorage.setItem(KEY, pinned ? '1' : '0'); } catch (_) {}
    clearTimeout(idleTimer);
    if (!pinned) resetIdle();
  }

  function init() {
    if (initialized) return;
    const toolbar = $('#mainToolbar');
    const nav = $('.ribbon-tabs-nav');
    const controls = $('.ribbon-fixed-controls');
    if (!toolbar || !nav || !controls) return;
    initialized = true;

    const pin = document.createElement('button');
    pin.type = 'button';
    pin.id = 'ribbonPinToggle';
    pin.className = 'tool-btn ribbon-pin-toggle';
    pin.setAttribute('aria-pressed', 'false');
    pin.innerHTML = '<span class="pin-symbol">📍</span><span>تثبيت</span>';
    pin.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); setPinned(!pinned); });
    controls.appendChild(pin);

    nav.addEventListener('pointerover', e => {
      const tab = e.target.closest('.r-tab-btn');
      if (!tab || !nav.contains(tab)) return;
      const key = tab.dataset.tab;
      if (key) { activate(key, tab); showPanel(); }
    });
    toolbar.addEventListener('pointerenter', resetIdle);
    toolbar.addEventListener('pointermove', e => {
      if (e.target.closest('button,select,input,label,.r-group')) resetIdle();
    });
    toolbar.addEventListener('focusin', resetIdle);
    toolbar.addEventListener('click', e => {
      if (e.target.closest('button,select,input,label')) resetIdle();
    });
    toolbar.addEventListener('pointerleave', () => {
      if (!pinned) {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(collapsePanel, IDLE_MS);
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !pinned) collapsePanel();
    });

    const active = $('.r-tab-btn.active') || $('.r-tab-btn');
    if (active?.dataset.tab) activate(active.dataset.tab, active);
    let saved = false;
    try { saved = localStorage.getItem(KEY) === '1'; } catch (_) {}
    setPinned(saved);
    if (!saved) {
      toolbar.classList.add('ribbon-collapsed');
      toolbar.classList.remove('ribbon-panel-open');
      resetIdle();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
