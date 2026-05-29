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

  /* ---------- CSV ---------- */
  // RFC-ish CSV parser: handles quoted fields, escaped quotes ("") and CRLF.
  function parseCSV(text) {
    var rows = [], row = [], field = '', i = 0, inQuotes = false;
    text = String(text).replace(/^\uFEFF/, ''); // strip BOM
    while (i < text.length) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += ch; i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    // drop fully-empty trailing rows
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }

  // Normalise common date formats to YYYY-MM-DD; returns '' if unparseable.
  function normalizeDate(raw) {
    if (!raw) return '';
    var s = String(raw).trim();
    var m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) {
      return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    }
    if ((m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/))) {
      var mm = m[1], dd = m[2], yy = m[3];
      if (yy.length === 2) yy = '20' + yy;
      return yy + '-' + pad2(mm) + '-' + pad2(dd); // assumes MM/DD/YYYY
    }
    var d = new Date(s);
    if (!isNaN(d)) return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    return '';
  }
  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  function normalizeTime(raw) {
    if (!raw) return '';
    var m = String(raw).trim().match(/(\d{1,2}):(\d{2})/);
    return m ? pad2(m[1]) + ':' + m[2] : '';
  }

  global.U = {
    money: money, moneyShort: moneyShort, pct: pct, num: num, signClass: signClass,
    fmtDate: fmtDate, fmtDateShort: fmtDateShort, dowName: dowName, esc: esc, el: el,
    todayISO: todayISO, hourLabel: hourLabel, download: download,
    parseCSV: parseCSV, normalizeDate: normalizeDate, normalizeTime: normalizeTime
  };
})(window);
