/* ============================================================
   base.js — globals shared by every module
   - window.h     : htm bound to React.createElement (JSX-like, no build)
   - window.Theme : light/dark controller (persisted)
   - window.Bus   : tiny pub/sub used for toasts
   ============================================================ */
(function () {
  'use strict';

  if (!window.React || !window.ReactDOM) {
    console.error('React failed to load from CDN. Check your internet connection.');
  }
  // hyperscript helper: same signature as React.createElement(type, props, ...children)
  window.h = function () { return React.createElement.apply(null, arguments); };

  /* ---------- Theme ---------- */
  var THEME_KEY = 'zea.theme';
  var themeListeners = [];
  function getTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { return 'dark'; }
  }
  function applyTheme(t) {
    document.documentElement.classList.toggle('dark', t !== 'light');
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    themeListeners.forEach(function (fn) { try { fn(t); } catch (e) {} });
  }
  window.Theme = {
    get: getTheme,
    set: applyTheme,
    toggle: function () { applyTheme(getTheme() === 'light' ? 'dark' : 'light'); },
    subscribe: function (fn) { themeListeners.push(fn); return function () { themeListeners = themeListeners.filter(function (x) { return x !== fn; }); }; }
  };

  /* ---------- Tiny event bus ---------- */
  var handlers = {};
  window.Bus = {
    on: function (evt, fn) { (handlers[evt] = handlers[evt] || []).push(fn); return function () { handlers[evt] = (handlers[evt] || []).filter(function (x) { return x !== fn; }); }; },
    emit: function (evt, payload) { (handlers[evt] || []).forEach(function (fn) { try { fn(payload); } catch (e) { console.error(e); } }); }
  };
  // convenience
  window.toast = function (message, kind) { window.Bus.emit('toast', { message: message, kind: kind || 'info', id: Math.random().toString(36).slice(2) }); };

  /* ---------- misc helpers ---------- */
  window.cx = function () {
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (!a) continue;
      if (typeof a === 'string') out.push(a);
      else if (typeof a === 'object') Object.keys(a).forEach(function (k) { if (a[k]) out.push(k); });
    }
    return out.join(' ');
  };
})();
