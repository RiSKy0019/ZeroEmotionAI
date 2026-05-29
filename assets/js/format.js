/* ============================================================
   format.js — formatting helpers (window.Fmt)
   ============================================================ */
(function () {
  'use strict';

  function money(n, opts) {
    opts = opts || {};
    var num = Number(n) || 0;
    var sign = num < 0 ? '-' : (opts.plus && num > 0 ? '+' : '');
    var abs = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return sign + '$' + abs;
  }
  function moneyShort(n) {
    var num = Number(n) || 0;
    var sign = num < 0 ? '-' : '';
    var abs = Math.abs(num);
    if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(1) + 'k';
    return sign + '$' + abs.toFixed(0);
  }
  function pct(n, d) { return (Number(n) || 0).toFixed(d == null ? 1 : d) + '%'; }
  function num(n, d) {
    var v = Number(n);
    if (!isFinite(v)) return '∞';
    return v.toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function signColor(n) { return n > 0 ? 'text-profit' : n < 0 ? 'text-loss' : 'text-slate-400'; }

  function date(iso) {
    if (!iso) return '—';
    var d = new Date(iso + (iso.length <= 10 ? 'T00:00:00' : ''));
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function dateShort(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function dow(i) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]; }
  function hourLabel(h) {
    var hr = parseInt(h, 10); if (isNaN(hr)) return h;
    var ap = hr >= 12 ? 'PM' : 'AM'; var d = hr % 12; if (d === 0) d = 12;
    return d + ap;
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function download(filename, text, type) {
    var blob = new Blob([text], { type: type || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  window.Fmt = {
    money: money, moneyShort: moneyShort, pct: pct, num: num, signColor: signColor,
    date: date, dateShort: dateShort, dow: dow, hourLabel: hourLabel, todayISO: todayISO, download: download
  };
})();
