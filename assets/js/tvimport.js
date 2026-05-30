/* ============================================================
   tvimport.js — TradingView CSV importer (window.TVImport)
   TradingView has no public API, so we import the CSV it exports. We support:
     1) "List of Trades" export  — two rows per trade (Entry leg + Exit leg)
     2) "List of Trades" (single-row variant with Entry/Exit price columns)
     3) "History" / Order history — individual Buy/Sell fills, which we pair
        into round-trip trades via FIFO position matching per symbol.
   Pure module (no React/DOM) so it can be unit-tested.
   ============================================================ */
(function () {
  'use strict';

  function parseCSV(text) {
    var rows = [], row = [], field = '', i = 0, q = false; text = String(text).replace(/^\uFEFF/, '');
    var firstLine = text.split(/\r?\n/)[0] || '';
    var delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';'
              : (firstLine.split('\t').length > firstLine.split(',').length) ? '\t' : ',';
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
  function sortKey(raw) { var d = new Date(String(raw || '').replace(' ', 'T')); var t = d.getTime(); return isNaN(t) ? 0 : t; }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  var SYN = {
    tradeNo: ['trade #', 'trade#', 'trade number', 'trade', '#'],
    type: ['type', 'order type', 'action'],
    side: ['side', 'direction', 'b/s', 'buy/sell'],
    symbol: ['symbol', 'ticker', 'instrument', 'contract', 'asset', 'name'],
    datetime: ['closing time', 'close time', 'fill time', 'filled time', 'execution time', 'placing time', 'order time', 'date/time', 'datetime', 'time', 'date'],
    price: ['price'],
    fillPrice: ['fill price', 'avg fill price', 'average fill price', 'filled price', 'exec price', 'execution price', 'traded price', 'limit price', 'avg price', 'fill', 'price'],
    qty: ['contracts', 'quantity', 'qty', 'filled qty', 'filled quantity', 'executed qty', 'position size', 'position size (qty)', 'size', 'shares', 'units'],
    profit: ['profit', 'net p&l', 'p&l', 'realized p&l', 'realized pnl', 'closed p&l', 'net profit', 'pnl', 'gross p&l'],
    commission: ['commission', 'commissions', 'comm', 'fees', 'fee', 'commission paid'],
    entryPrice: ['entry price', 'avg entry', 'open price'],
    exitPrice: ['exit price', 'avg exit', 'close price']
  };
  function indexOfField(header, field) {
    for (var i = 0; i < header.length; i++) {
      var hcol = String(header[i]).trim().toLowerCase();
      var syns = SYN[field];
      for (var j = 0; j < syns.length; j++) {
        if (hcol === syns[j]) return i;
        if ((field === 'price' || field === 'fillPrice' || field === 'profit') && hcol.indexOf(syns[j]) === 0) return i;
      }
    }
    return -1;
  }
  function scanValues(rows, col, re) {
    if (col < 0) return false;
    for (var i = 1; i < rows.length && i < 60; i++) { if (re.test(String(rows[i][col] || ''))) return true; }
    return false;
  }
  function sideFromText(txt) { var v = String(txt || '').toLowerCase(); return (v.indexOf('short') >= 0 || v.indexOf('sell') >= 0) ? 'short' : 'long'; }
  function dirFromText(txt) { var v = String(txt || '').toLowerCase(); if (/sell|short/.test(v)) return -1; if (/buy|long/.test(v)) return 1; return null; }

  function parse(text, opts) {
    opts = opts || {};
    var rows = parseCSV(text);
    if (rows.length < 2) return unrec(rows);
    var header = rows[0];
    var idx = {}; Object.keys(SYN).forEach(function (f) { idx[f] = indexOfField(header, f); });

    var typeCol = idx.type >= 0 ? idx.type : idx.side;
    var sideCol = idx.side >= 0 ? idx.side : idx.type;
    var hasEntryExit = scanValues(rows, typeCol, /entry|exit/i);
    var hasBuySell = scanValues(rows, sideCol, /\b(buy|sell)\b/i) || scanValues(rows, idx.side, /\b(buy|sell)\b/i);

    // 1) single-row list of trades (Entry price + Exit price columns)
    if (idx.entryPrice >= 0 && idx.exitPrice >= 0) {
      return single(rows, idx, opts, header);
    }
    // 2) list of trades (paired Entry/Exit legs)
    if (hasEntryExit && (idx.price >= 0 || idx.fillPrice >= 0)) {
      return paired(rows, idx, opts, header);
    }
    // 3) order history / fills (Buy/Sell rows) → FIFO reconstruction
    if (hasBuySell && (idx.fillPrice >= 0 || idx.price >= 0) && idx.qty >= 0) {
      return fills(rows.slice(1), idx, opts, header);
    }
    // 4) P&L-only (e.g. Balance History with a realized P&L column) → entries with no prices
    if (idx.profit >= 0) {
      return pnlOnly(rows.slice(1), idx, opts, header);
    }
    return unrec(rows, header);
  }

  function unrec(rows, header) {
    return { recognized: false, trades: [], invalid: 0, mode: null, headers: header || (rows[0] || []) };
  }

  function makeTrade(opts, sym, side, entry, exit, qty, dt, mult, fees, note) {
    return {
      accountId: opts.accountId, symbol: sym, date: normDate(dt) || todayISO(), time: normTime(dt) || '09:30',
      side: side, entry: round2(entry), exit: round2(exit), quantity: round2(Math.abs(qty)), fees: round2(fees || 0),
      multiplier: mult, riskAmount: null, setup: '', tags: ['TradingView'], mistakes: [], emotion: '', rating: null,
      screenshots: [], notes: note || 'Imported from TradingView'
    };
  }
  function deriveMult(profit, gross, defMult) {
    if (isFinite(profit) && gross !== 0) { var d = profit / gross; return Math.abs(d - 1) < 0.02 ? 1 : round2(d); }
    return defMult;
  }

  function single(rows, idx, opts, header) {
    var sym0 = String(opts.symbol || '').trim().toUpperCase();
    var defMult = Number(opts.defaultMultiplier) || 1, out = [], invalid = 0;
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r];
      var sym = idx.symbol >= 0 ? String(row[idx.symbol] || '').trim().toUpperCase() : sym0;
      var side = idx.side >= 0 ? sideFromText(row[idx.side]) : (idx.type >= 0 ? sideFromText(row[idx.type]) : 'long');
      var entry = num(row[idx.entryPrice]), exit = num(row[idx.exitPrice]), qty = idx.qty >= 0 ? num(row[idx.qty]) : NaN;
      var profit = idx.profit >= 0 ? num(row[idx.profit]) : NaN;
      if (!sym || !isFinite(entry) || !isFinite(exit) || !isFinite(qty) || qty === 0) { invalid++; continue; }
      var dir = side === 'short' ? -1 : 1;
      out.push(makeTrade(opts, sym, side, entry, exit, qty, idx.datetime >= 0 ? row[idx.datetime] : '', deriveMult(profit, (exit - entry) * qty * dir, defMult), 0));
    }
    return { recognized: true, mode: 'single', trades: out, invalid: invalid, headers: header, needsSymbol: idx.symbol < 0 };
  }

  function paired(rows, idx, opts, header) {
    var sym = String(opts.symbol || '').trim().toUpperCase();
    var defMult = Number(opts.defaultMultiplier) || 1, out = [], invalid = 0;
    var priceCol = idx.price >= 0 ? idx.price : idx.fillPrice;
    var groups = [];
    if (idx.tradeNo >= 0) {
      var map = {}, order = [];
      for (var k = 1; k < rows.length; k++) { var key = String(rows[k][idx.tradeNo]).trim(); if (!map[key]) { map[key] = []; order.push(key); } map[key].push(rows[k]); }
      order.forEach(function (key) { groups.push(map[key]); });
    } else { for (var p = 1; p < rows.length; p += 2) groups.push(rows.slice(p, p + 2)); }

    groups.forEach(function (g) {
      var entryRow = null, exitRow = null;
      g.forEach(function (rw) {
        var ty = String(rw[idx.type] || '').toLowerCase();
        if (ty.indexOf('exit') >= 0 || ty.indexOf('close') >= 0) exitRow = rw;
        else if (!entryRow) entryRow = rw;
      });
      if (!entryRow && g.length) entryRow = g[0];
      if (!exitRow && g.length > 1) exitRow = g[1];
      if (!entryRow || !exitRow) { invalid++; return; }
      var side = sideFromText(entryRow[idx.type]);
      var qty = idx.qty >= 0 ? (num(entryRow[idx.qty]) || num(exitRow[idx.qty])) : NaN;
      var entry = num(entryRow[priceCol]), exit = num(exitRow[priceCol]);
      var profit = idx.profit >= 0 ? num(exitRow[idx.profit]) : NaN;
      if (!sym || !isFinite(entry) || !isFinite(exit) || !isFinite(qty) || qty === 0) { invalid++; return; }
      var dir = side === 'short' ? -1 : 1;
      out.push(makeTrade(opts, sym, side, entry, exit, qty, idx.datetime >= 0 ? entryRow[idx.datetime] : '', deriveMult(profit, (exit - entry) * qty * dir, defMult), 0));
    });
    return { recognized: true, mode: 'paired', trades: out, invalid: invalid, headers: header, needsSymbol: true };
  }

  // FIFO reconstruction from individual Buy/Sell fills
  function fills(dataRows, idx, opts, header) {
    var defMult = Number(opts.defaultMultiplier) || 1;
    var sym0 = String(opts.symbol || '').trim().toUpperCase();
    var bySym = {}, order = [];
    dataRows.forEach(function (row) {
      var sym = idx.symbol >= 0 ? String(row[idx.symbol] || '').trim().toUpperCase() : sym0;
      if (!sym) return;
      var dir = dirFromText(idx.side >= 0 ? row[idx.side] : (idx.type >= 0 ? row[idx.type] : ''));
      if (dir === null) return;
      var qty = num(idx.qty >= 0 ? row[idx.qty] : NaN);
      var price = num(idx.fillPrice >= 0 ? row[idx.fillPrice] : (idx.price >= 0 ? row[idx.price] : NaN));
      if (!isFinite(qty) || qty <= 0 || !isFinite(price)) return;
      var comm = idx.commission >= 0 ? num(row[idx.commission]) : 0; if (!isFinite(comm)) comm = 0;
      var t = idx.datetime >= 0 ? row[idx.datetime] : '';
      if (!bySym[sym]) { bySym[sym] = []; order.push(sym); }
      bySym[sym].push({ dir: dir, qty: qty, price: price, time: t, comm: comm, sk: sortKey(t) });
    });

    var trades = [], openSymbols = 0;
    order.forEach(function (sym) {
      var fl = bySym[sym].slice().sort(function (a, b) { return a.sk - b.sk; });
      var lots = [];
      fl.forEach(function (f) {
        var cpu = f.qty ? f.comm / f.qty : 0, q = f.qty;
        if (lots.length === 0 || lots[0].dir === f.dir) { lots.push({ dir: f.dir, qtyRem: q, price: f.price, time: f.time, cpu: cpu }); return; }
        while (q > 1e-9 && lots.length && lots[0].dir === -f.dir) {
          var lot = lots[0], m = Math.min(q, lot.qtyRem);
          var side = lot.dir === 1 ? 'long' : 'short';
          trades.push(makeTrade(opts, sym, side, lot.price, f.price, m, lot.time, defMult, (lot.cpu + cpu) * m, 'Imported from TradingView (order history)'));
          lot.qtyRem -= m; q -= m; if (lot.qtyRem <= 1e-9) lots.shift();
        }
        if (q > 1e-9) lots.push({ dir: f.dir, qtyRem: q, price: f.price, time: f.time, cpu: cpu });
      });
      if (lots.reduce(function (s, l) { return s + l.qtyRem; }, 0) > 1e-9) openSymbols++;
    });
    trades.sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
    return { recognized: true, mode: 'fills', trades: trades, invalid: openSymbols, headers: header, needsSymbol: idx.symbol < 0 };
  }

  // P&L-only: rows that carry a realized P&L but no usable prices (e.g. Balance
  // History with a "Realized P&L" column). Stored with pnlOverride so they still
  // count toward net P&L / win rate / calendar, just without entry/exit.
  function pnlOnly(dataRows, idx, opts, header) {
    var sym0 = String(opts.symbol || '').trim().toUpperCase();
    var out = [], invalid = 0;
    dataRows.forEach(function (row) {
      var sym = idx.symbol >= 0 ? String(row[idx.symbol] || '').trim().toUpperCase() : sym0;
      var profit = num(row[idx.profit]);
      if (!sym || !isFinite(profit)) { invalid++; return; }
      var dt = idx.datetime >= 0 ? row[idx.datetime] : '';
      var qty = idx.qty >= 0 ? num(row[idx.qty]) : NaN;
      out.push({
        accountId: opts.accountId, symbol: sym, date: normDate(dt) || todayISO(), time: normTime(dt) || '09:30',
        side: idx.side >= 0 ? sideFromText(row[idx.side]) : 'long',
        entry: null, exit: null, quantity: isFinite(qty) && qty > 0 ? qty : 1, fees: 0, multiplier: 1,
        pnlOverride: round2(profit), riskAmount: null, setup: '', tags: ['TradingView'], mistakes: [],
        emotion: '', rating: null, screenshots: [], notes: 'P&L-only import (TradingView)'
      });
    });
    return { recognized: out.length > 0, mode: 'pnl', trades: out, invalid: invalid, headers: header, needsSymbol: idx.symbol < 0 };
  }

  function guessSymbol(filename) {
    if (!filename) return '';
    var base = String(filename).replace(/\.[a-z0-9]+$/i, '');
    base = base.split(',')[0].trim();
    if (base.indexOf(':') >= 0) base = base.split(':').pop();
    if (base.indexOf('_') >= 0) base = base.split('_').pop();
    return base.toUpperCase().replace(/[^A-Z0-9!.\-]/g, '');
  }

  window.TVImport = { parse: parse, guessSymbol: guessSymbol, _parseCSV: parseCSV };
})();
