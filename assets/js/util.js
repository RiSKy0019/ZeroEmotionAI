/* ============================================================
   util.js — formatting + DOM helpers (global `U`)
   ============================================================ */
(function (global) {
  'use strict';

  function money(n, opts) {
    opts = opts || {};
    var num = Number(n) || 0;
    var sign = num < 0 ? '-' : (opts.showPlus && num > 0 ? '+' : '');
    var abs = Math.abs(num);
    var str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return sign + '$' + str;
  }
  function moneyShort(n) {
    var num = Number(n) || 0;
    var sign = num < 0 ? '-' : '';
    var abs = Math.abs(num);
    if (abs >= 1000000) return sign + '$' + (abs / 1000000).toFixed(2) + 'M';
    if (abs >= 1000) return sign + '$' + (abs / 1000).toFixed(1) + 'k';
    return sign + '$' + abs.toFixed(0);
  }
  function pct(n, dec) { return (Number(n) || 0).toFixed(dec == null ? 1 : dec) + '%'; }
  function num(n, dec) {
    var v = Number(n);
    if (!isFinite(v)) return '∞';
    return v.toLocaleString('en-US', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  }
  function signClass(n) { return n > 0 ? 'pos' : n < 0 ? 'neg' : 'muted'; }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso + (iso.length <= 10 ? 'T00:00:00' : ''));
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtDateShort(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function dowName(i) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]; }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // tiny element builder: el('div', {class:'x'}, [child, 'text'])
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    });
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return node;
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function hourLabel(h) {
    var hr = parseInt(h, 10);
    if (isNaN(hr)) return h;
    var ampm = hr >= 12 ? 'PM' : 'AM';
    var disp = hr % 12; if (disp === 0) disp = 12;
    return disp + ' ' + ampm;
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  global.U = {
    money: money, moneyShort: moneyShort, pct: pct, num: num, signClass: signClass,
    fmtDate: fmtDate, fmtDateShort: fmtDateShort, dowName: dowName, esc: esc, el: el,
    todayISO: todayISO, hourLabel: hourLabel, download: download
  };
})(window);
