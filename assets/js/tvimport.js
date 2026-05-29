/* ============================================================
   tvimport.js — TradingView "List of Trades" CSV parser (window.TVImport)
   TradingView (Strategy Tester / Paper Trading panel → Export) has no public
   API, so we import the CSV it produces. It exports two rows per trade
   (an Entry leg and an Exit leg); we pair them into round-trip trades.
   Pure module (no React/DOM) so it can be unit-tested.
   ============================================================ */
(function () {
  'use strict';

  function parseCSV(text) {
    var rows = [], row = [], field = '', i = 0, q = false; text = String(text).replace(/^\uFEFF/, '');
    // auto-detect delimiter (comma or semicolon) from the header line
    var firstLine = text.split(/\r?\n/)[0] || '';
    var delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
    while (i < text.length) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; } field += ch; i++; continue; }
      if (ch === '"') { q = true; i++; continue; }
      if (ch === delim) { row.push(field); field = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += ch; i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }

  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
  function normDate(raw) {
    if (!raw) return ''; var s = String(raw).trim(), m;
    if ((m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    if ((m = s.match(/(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})/))) { var y = m[3]; if (y.length === 2) y = '20' + y; return y + '-' + pad2(m[1]) + '-' + pad2(m[2]); }
    var d = new Date(s); return isNaN(d) ? '' : d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function normTime(raw) { var m = String(raw || '').match(/(\d{1,2}):(\d{2})/); return m ? pad2(m[1]) + ':' + m[2] : ''; }
  function num(raw) { if (raw == null) return NaN; var s = String(raw).replace(/[^0-9.\-()]/g, ''); if (/^\(.*\)$/.test(s)) s = '-' + s.replace(/[()]/g, ''); return parseFloat(s); }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  // column synonyms (lower-cased compare; also prefix match for currency-suffixed headers)
  var SYN = {
    tradeNo: ['trade #', 'trade#', 'trade number', 'trade', '#'],
    type: ['type'],
    datetime: ['date/time', 'datetime', 'date', 'time'],
    price: ['price'],
    qty: ['contracts', 'quantity', 'qty', 'position size', 'position size (qty)', 'position size qty', 'size', 'shares'],
    profit: ['profit', 'net p&l', 'p&l', 'net profit', 'pnl'],
    side: ['side', 'direction'],
    entryPrice: ['entry price', 'avg entry', 'entry'],
    exitPrice: ['exit price', 'avg exit', 'exit']
  };
  function indexOfField(header, field) {
    for (var i = 0; i < header.length; i++) {
      var hcol = String(header[i]).trim().toLowerCase();
      var syns = SYN[field];
      for (var j = 0; j < syns.length; j++) {
        var syn = syns[j];
        if (hcol === syn) return i;
        // currency-suffixed: "price usd", "profit usd", "net p&l usd"
        if ((field === 'price' || field === 'profit') && hcol.indexOf(syn) === 0) return i;
      }
    }
    return -1;
  }

  function sideFromText(txt) {
    var v = String(txt || '').toLowerCase();
    if (v.indexOf('short') >= 0 || v.indexOf('sell') >= 0) return 'short';
    return 'long';
  }

  // opts: { symbol, accountId, defaultMultiplier }
  function parse(text, opts) {
    opts = opts || {};
    var rows = parseCSV(text);
    if (rows.length < 2) return { recognized: false, trades: [], invalid: 0, mode: null };
    var header = rows[0];
    var idx = {};
    Object.keys(SYN).forEach(function (f) { idx[f] = indexOfField(header, f); });

    var singleRow = idx.entryPrice >= 0 && idx.exitPrice >= 0;
    var paired = idx.type >= 0 && idx.price >= 0;
    if (!singleRow && !paired) return { recognized: false, trades: [], invalid: 0, mode: null };

    var sym = String(opts.symbol || '').trim().toUpperCase();
    var defMult = Number(opts.defaultMultiplier) || 1;
    var acc = opts.accountId;
    var out = [], invalid = 0;

    function build(side, entry, exit, qty, dt, profit) {
      if (!sym || !isFinite(entry) || !isFinite(exit) || !isFinite(qty) || qty === 0) { invalid++; return; }
      var dir = side === 'short' ? -1 : 1;
      var gross = (exit - entry) * qty * dir;
      var mult = defMult;
      if (isFinite(profit) && gross !== 0) {
        var derived = profit / gross;
        // snap near-1 to 1 (stocks/crypto/fx); otherwise keep the implied point value
        mult = Math.abs(derived - 1) < 0.02 ? 1 : round2(derived);
      }
      out.push({
        accountId: acc, symbol: sym, date: normDate(dt) || todayISO(), time: normTime(dt) || '09:30',
        side: side, entry: round2(entry), exit: round2(exit), quantity: Math.abs(qty), fees: 0,
        multiplier: mult, riskAmount: null, setup: '', tags: ['TradingView'], mistakes: [], emotion: '', rating: null,
        screenshots: [], notes: 'Imported from TradingView'
      });
    }

    if (singleRow) {
      for (var r = 1; r < rows.length; r++) {
        var row = rows[r];
        var side = idx.side >= 0 ? sideFromText(row[idx.side]) : (idx.type >= 0 ? sideFromText(row[idx.type]) : 'long');
        build(side, num(row[idx.entryPrice]), num(row[idx.exitPrice]),
          idx.qty >= 0 ? num(row[idx.qty]) : NaN, idx.datetime >= 0 ? row[idx.datetime] : '',
          idx.profit >= 0 ? num(row[idx.profit]) : NaN);
      }
      return { recognized: true, mode: 'single', trades: out, invalid: invalid };
    }

    // paired mode: group rows by trade #, else pair sequentially
    var groups = [];
    if (idx.tradeNo >= 0) {
      var map = {}; var order = [];
      for (var k = 1; k < rows.length; k++) {
        var key = String(rows[k][idx.tradeNo]).trim();
        if (!map[key]) { map[key] = []; order.push(key); }
        map[key].push(rows[k]);
      }
      order.forEach(function (key) { groups.push(map[key]); });
    } else {
      for (var p = 1; p < rows.length; p += 2) groups.push(rows.slice(p, p + 2));
    }

    groups.forEach(function (g) {
      var entryRow = null, exitRow = null;
      g.forEach(function (rw) {
        var ty = String(rw[idx.type] || '').toLowerCase();
        if (ty.indexOf('entry') >= 0 || ty.indexOf('open') >= 0 || ty.indexOf('buy') === 0 || (ty.indexOf('sell') === 0 && !exitRow && !entryRow)) {
          if (!entryRow) entryRow = rw;
        } else if (ty.indexOf('exit') >= 0 || ty.indexOf('close') >= 0) { exitRow = rw; }
      });
      if (!entryRow && g.length) entryRow = g[0];
      if (!exitRow && g.length > 1) exitRow = g[1];
      if (!entryRow || !exitRow) { invalid++; return; }
      var side = sideFromText(entryRow[idx.type] !== undefined ? entryRow[idx.type] : '');
      var qty = idx.qty >= 0 ? num(entryRow[idx.qty]) || num(exitRow[idx.qty]) : NaN;
      var profit = idx.profit >= 0 ? num(exitRow[idx.profit]) : NaN;
      build(side, num(entryRow[idx.price]), num(exitRow[idx.price]), qty,
        idx.datetime >= 0 ? entryRow[idx.datetime] : '', profit);
    });
    return { recognized: true, mode: 'paired', trades: out, invalid: invalid };
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // best-effort symbol guess from an exported filename, e.g. "BATS_AAPL, 5_Strategy.csv" -> AAPL
  function guessSymbol(filename) {
    if (!filename) return '';
    var base = String(filename).replace(/\.[a-z0-9]+$/i, '');
    base = base.split(',')[0].trim();          // before first comma
    if (base.indexOf(':') >= 0) base = base.split(':').pop();   // NASDAQ:AAPL -> AAPL
    if (base.indexOf('_') >= 0) base = base.split('_').pop();   // BATS_AAPL -> AAPL
    return base.toUpperCase().replace(/[^A-Z0-9!.\-]/g, '');
  }

  window.TVImport = { parse: parse, guessSymbol: guessSymbol, _parseCSV: parseCSV };
})();
