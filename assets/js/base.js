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

  /* ---------- Currency (display only — trades are stored in USD) ---------- */
  var CUR_KEY = 'zea.currency', RATES_KEY = 'zea.rates';
  var CUR_META = {
    USD: { symbol: '$', locale: 'en-US', dec: 2, rate: 1 },
    EUR: { symbol: '\u20AC', locale: 'en-IE', dec: 2, rate: 0.92 },
    GBP: { symbol: '\u00A3', locale: 'en-GB', dec: 2, rate: 0.79 },
    INR: { symbol: '\u20B9', locale: 'en-IN', dec: 2, rate: 83.2 },
    JPY: { symbol: '\u00A5', locale: 'ja-JP', dec: 0, rate: 157 },
    AUD: { symbol: 'A$', locale: 'en-AU', dec: 2, rate: 1.52 },
    CAD: { symbol: 'C$', locale: 'en-CA', dec: 2, rate: 1.37 }
  };
  var curListeners = [];
  function getCurCode() { try { var c = localStorage.getItem(CUR_KEY); return CUR_META[c] ? c : 'USD'; } catch (e) { return 'USD'; } }
  function getRates() {
    var r = {}; Object.keys(CUR_META).forEach(function (c) { r[c] = CUR_META[c].rate; });
    try { var saved = JSON.parse(localStorage.getItem(RATES_KEY) || '{}'); Object.keys(saved).forEach(function (c) { if (CUR_META[c] && isFinite(saved[c]) && saved[c] > 0) r[c] = saved[c]; }); } catch (e) {}
    return r;
  }
  function curGet() {
    var code = getCurCode(), m = CUR_META[code], rates = getRates();
    return { code: code, symbol: m.symbol, locale: m.locale, dec: m.dec, rate: rates[code] || 1 };
  }
  function curEmit() { curListeners.forEach(function (fn) { try { fn(); } catch (e) {} }); }
  window.Currency = {
    get: curGet, getRates: getRates, codes: Object.keys(CUR_META), meta: CUR_META,
    set: function (code) { if (CUR_META[code]) { try { localStorage.setItem(CUR_KEY, code); } catch (e) {} curEmit(); } },
    setRate: function (code, val) { var rates = getRates(); if (isFinite(Number(val)) && Number(val) > 0) rates[code] = Number(val); try { localStorage.setItem(RATES_KEY, JSON.stringify(rates)); } catch (e) {} curEmit(); },
    resetRates: function () { try { localStorage.removeItem(RATES_KEY); } catch (e) {} curEmit(); },
    subscribe: function (fn) { curListeners.push(fn); return function () { curListeners = curListeners.filter(function (x) { return x !== fn; }); }; }
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
