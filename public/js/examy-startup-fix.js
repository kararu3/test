/* Runs before the application UI paints so saved theme and toolbar state agree. */
(function () {
  'use strict';
  try {
    var saved = localStorage.getItem('examy_theme_mode');
    var mode = saved === 'dark' || saved === 'light' ? saved : 'dark';
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.colorScheme = mode;
    document.addEventListener('DOMContentLoaded', function () {
      var current = document.documentElement.getAttribute('data-theme') || mode;
      document.querySelectorAll('.segmented-btns button').forEach(function (button) {
        var action = button.getAttribute('onclick') || '';
        var active = action.indexOf("'" + current + "'") !== -1;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      var ribbon = document.getElementById('mainToolbar');
      if (ribbon) ribbon.classList.add('examy-ribbon-ready');
    });
  } catch (error) {
    console.warn('Examy theme startup fallback:', error);
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
