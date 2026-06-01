/* ============================================================
   propfirm-import.js — Prop Firm Import Hub (window.PFImport)
   Firm-specific CSV parsers for:
     TopStep, Apex Trader Funding, FTMO, Tradeovate,
     Earn2Trade, Lucid Trading
   Each parser converts a firm's CSV export into the standard
   ZeroEmotionAI trade object format.
   ============================================================ */
(function () {
  'use strict';

  /* ── shared CSV parser ── */
  function parseCSV(text) {
    var rows = [], row = [], field = '', i = 0, q = false;
    text = String(text).replace(/^\uFEFF/, '');
    var delim = (text.split('\n')[0] || '').split(';').length >
                (text.split('\n')[0] || '').split(',').length ? ';' : ',';
    while (i < text.length) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i+1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
        field += ch; i++; continue;
      }
      if (ch === '"')  { q = true; i++; continue; }
      if (ch === delim){ row.push(field); field = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += ch; i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
  }

  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
  function num(raw) {
    if (raw == null) return NaN;
    var s = String(raw).replace(/[$,\s]/g, '');
    if (/^\(.*\)$/.test(s)) s = '-' + s.replace(/[()]/g, '');
    return parseFloat(s);
  }
  function normDate(raw) {
    if (!raw) return ''; var s = String(raw).trim(), m;
    if ((m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1]+'-'+pad2(m[2])+'-'+pad2(m[3]);
    if ((m = s.match(/(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})/))) {
      var y = m[3]; if (y.length===2) y='20'+y;
      return y+'-'+pad2(m[1])+'-'+pad2(m[2]);
    }
    var d = new Date(s); return isNaN(d) ? '' : d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
  }
  function normTime(raw) { var m = String(raw||'').match(/(\d{1,2}):(\d{2})/); return m ? pad2(m[1])+':'+m[2] : ''; }
  function sideFromText(txt) { var v = String(txt||'').toLowerCase(); return (v.indexOf('sell')>=0||v.indexOf('short')>=0) ? 'short' : 'long'; }
  function r2(n) { return Math.round((n+Number.EPSILON)*100)/100; }
  function todayISO() { var d=new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }

  function baseTrade(accountId, sym, side, entry, exit, qty, dt, fees, pnlOverride) {
    var t = {
      accountId: accountId, symbol: String(sym||'').trim().toUpperCase(),
      side: side, entry: r2(entry)||null, exit: r2(exit)||null,
      quantity: Math.abs(qty)||1, fees: r2(fees)||0,
      date: normDate(dt) || todayISO(), time: normTime(dt) || '09:30',
      closeDate: normDate(dt) || todayISO(), closeTime: normTime(dt) || '09:30',
      setup: '', tags: ['Prop Firm Import'], mistakes: [],
      emotion: '', rating: null, screenshots: [], notes: ''
    };
    if (pnlOverride !== undefined && pnlOverride !== null && isFinite(pnlOverride)) t.pnlOverride = r2(pnlOverride);
    return t;
  }

  /* ============================================================
     FIRM METADATA — name, colour, logo emoji, export instructions
     ============================================================ */
  var FIRMS = {
    topstep: {
      id: 'topstep', name: 'TopStep', emoji: '🔵', color: '#1E90FF',
      instructions: [
        'Log in to your TopStep account at app.topstep.com',
        'Go to the "Performance" or "Account" tab in the dashboard',
        'Click "Trade History" on the left sidebar',
        'Set the date range you want to import',
        'Click the "Export" or "Download CSV" button (top-right of the table)',
        'Upload the downloaded CSV file below'
      ],
      sampleHeaders: ['Entry Date/Time', 'Exit Date/Time', 'Symbol', 'Side', 'Qty', 'Entry Price', 'Exit Price', 'PnL', 'Commission']
    },
    apex: {
      id: 'apex', name: 'Apex Trader Funding', emoji: '🟠', color: '#FF6B00',
      instructions: [
        'Log in at my.apextraderfunding.com',
        'Click "Dashboard" and select your funded account',
        'Go to "Reports" → "Trade History"',
        'Choose your date range and click "Export to CSV"',
        'Upload the downloaded file below'
      ],
      sampleHeaders: ['Open Date', 'Close Date', 'Symbol', 'Position', 'Size', 'Open Price', 'Close Price', 'Profit', 'Commission']
    },
    ftmo: {
      id: 'ftmo', name: 'FTMO', emoji: '⚫', color: '#2D2D2D',
      instructions: [
        'Log in to your FTMO account at ftmo.com',
        'Go to "Trading Journal" in the left menu',
        'Click on your account',
        'Click the "Export" button (top-right) → select "CSV"',
        'Upload the downloaded file below'
      ],
      sampleHeaders: ['Open Time', 'Close Time', 'Symbol', 'Action', 'Volume', 'Open Price', 'Close Price', 'Profit', 'Commission', 'Swap']
    },
    tradeovate: {
      id: 'tradeovate', name: 'Tradeovate', emoji: '🟣', color: '#7B2FBE',
      instructions: [
        'Log in to your Tradeovate account at trader.tradeovate.com',
        'Go to "Reports" in the top navigation',
        'Click "Trade P&L" or "Fills"',
        'Set your date range using the filters',
        'Click "Download" (CSV icon) on the top-right',
        'Upload the downloaded file below'
      ],
      sampleHeaders: ['Fill Date', 'Symbol', 'Buy/Sell', 'Qty', 'Price', 'Commission', 'PnL']
    },
    earn2trade: {
      id: 'earn2trade', name: 'Earn2Trade', emoji: '🟢', color: '#00A651',
      instructions: [
        'Log in to your Earn2Trade account at earn2trade.com',
        'Click your account name (top-right) → "My Account"',
        'Go to "Trading History" or "Account History"',
        'Click "Export" or the CSV download icon',
        'Upload the downloaded file below'
      ],
      sampleHeaders: ['Date', 'Instrument', 'Direction', 'Qty', 'Entry', 'Exit', 'P&L', 'Fee']
    },
    lucid: {
      id: 'lucid', name: 'Lucid Trading', emoji: '💎', color: '#00D4FF',
      instructions: [
        'Log in to your Lucid Trading account',
        'Go to "Account" → "Trade History" or "Reports"',
        'Select the date range you want to export',
        'Click "Export CSV" or "Download Report"',
        'Upload the downloaded file below'
      ],
      sampleHeaders: ['Date/Time', 'Symbol', 'Side', 'Qty', 'Entry Price', 'Exit Price', 'P&L', 'Fees']
    }
  };

  /* ============================================================
     FIRM-SPECIFIC PARSERS
     ============================================================ */

  /* ─── TopStep ─── */
  function parseTopStep(rows, accountId) {
    var h = rows[0].map(function(c){return String(c).trim().toLowerCase();});
    var idx = function(names) {
      for (var i=0;i<names.length;i++) { var j=h.indexOf(names[i]); if(j>=0) return j; } return -1;
    };
    var sym   = idx(['symbol','contract','instrument','ticker']);
    var side  = idx(['side','direction','action','buy/sell','b/s']);
    var qty   = idx(['qty','quantity','size','contracts','volume']);
    var entry = idx(['entry price','open price','entryprice','avg entry','open']);
    var exit  = idx(['exit price','close price','exitprice','avg exit','close']);
    var dt    = idx(['entry date/time','entry date','open date/time','open date','date/time','date']);
    var pnl   = idx(['pnl','net p&l','profit','realized pnl','net pnl','p&l']);
    var comm  = idx(['commission','comm','fees','fee']);
    if (sym<0||qty<0) return { trades:[], invalid: rows.length-1, recognized: false };
    var out=[], invalid=0;
    for (var r=1;r<rows.length;r++) {
      var rw=rows[r];
      var s=String(rw[sym]||'').trim().toUpperCase(); if(!s){invalid++;continue;}
      var q2=num(rw[qty]); var ep=entry>=0?num(rw[entry]):NaN; var xp=exit>=0?num(rw[exit]):NaN;
      var fees=comm>=0?(num(rw[comm])||0):0; var pnlVal=pnl>=0?num(rw[pnl]):undefined;
      var sd=side>=0?sideFromText(rw[side]):'long';
      out.push(baseTrade(accountId, s, sd, ep, xp, q2, dt>=0?rw[dt]:'', fees, isFinite(pnlVal)?pnlVal:undefined));
    }
    return { trades:out, invalid:invalid, recognized:true, mode:'topstep' };
  }

  /* ─── Apex ─── */
  function parseApex(rows, accountId) {
    var h = rows[0].map(function(c){return String(c).trim().toLowerCase();});
    var idx = function(names){ for(var i=0;i<names.length;i++){var j=h.indexOf(names[i]);if(j>=0)return j;} return -1; };
    var sym   = idx(['symbol','instrument','contract','ticker']);
    var pos   = idx(['position','side','direction','type','action']);
    var qty   = idx(['size','qty','quantity','contracts','volume']);
    var entry = idx(['open price','entry price','avg entry','entryprice']);
    var exit  = idx(['close price','exit price','avg exit','exitprice']);
    var openDt= idx(['open date','entry date','open date/time','date']);
    var profit= idx(['profit','p&l','net p&l','pnl','realized p&l','net profit']);
    var comm  = idx(['commission','comm','fees','fee']);
    if (sym<0||qty<0) return { trades:[], invalid:rows.length-1, recognized:false };
    var out=[], invalid=0;
    for (var r=1;r<rows.length;r++) {
      var rw=rows[r];
      var s=String(rw[sym]||'').trim().toUpperCase(); if(!s){invalid++;continue;}
      var q2=num(rw[qty]); var ep=entry>=0?num(rw[entry]):NaN; var xp=exit>=0?num(rw[exit]):NaN;
      var fees=comm>=0?(num(rw[comm])||0):0; var pnlVal=profit>=0?num(rw[profit]):undefined;
      var sd=pos>=0?sideFromText(rw[pos]):'long';
      out.push(baseTrade(accountId, s, sd, ep, xp, q2, openDt>=0?rw[openDt]:'', fees, isFinite(pnlVal)?pnlVal:undefined));
    }
    return { trades:out, invalid:invalid, recognized:true, mode:'apex' };
  }

  /* ─── FTMO ─── */
  function parseFTMO(rows, accountId) {
    var h = rows[0].map(function(c){return String(c).trim().toLowerCase();});
    var idx = function(names){ for(var i=0;i<names.length;i++){var j=h.indexOf(names[i]);if(j>=0)return j;} return -1; };
    var sym    = idx(['symbol','instrument']);
    var action = idx(['action','type','direction','side']);
    var vol    = idx(['volume','lots','size','qty','quantity']);
    var openP  = idx(['open price','entry price','price in','open']);
    var closeP = idx(['close price','exit price','price out','close']);
    var openT  = idx(['open time','entry time','open date/time','date/time','date']);
    var closeT = idx(['close time','exit time','close date/time']);
    var profit = idx(['profit','p&l','net p&l','net profit','pnl']);
    var comm   = idx(['commission','comm']);
    var swap   = idx(['swap']);
    if (sym<0||vol<0) return { trades:[], invalid:rows.length-1, recognized:false };
    var out=[], invalid=0;
    for (var r=1;r<rows.length;r++) {
      var rw=rows[r];
      var s=String(rw[sym]||'').trim().toUpperCase(); if(!s){invalid++;continue;}
      var q2=num(rw[vol]); var ep=openP>=0?num(rw[openP]):NaN; var xp=closeP>=0?num(rw[closeP]):NaN;
      var fees=(comm>=0?(num(rw[comm])||0):0)+(swap>=0?(num(rw[swap])||0):0);
      var pnlVal=profit>=0?num(rw[profit]):undefined;
      var sd=action>=0?sideFromText(rw[action]):'long';
      var t=baseTrade(accountId, s, sd, ep, xp, q2, openT>=0?rw[openT]:'', fees, isFinite(pnlVal)?pnlVal:undefined);
      if (closeT>=0 && rw[closeT]) { t.closeDate=normDate(rw[closeT]); t.closeTime=normTime(rw[closeT]); }
      out.push(t);
    }
    return { trades:out, invalid:invalid, recognized:true, mode:'ftmo' };
  }

  /* ─── Tradeovate ─── */
  function parseTradeovate(rows, accountId) {
    var h = rows[0].map(function(c){return String(c).trim().toLowerCase();});
    var idx = function(names){ for(var i=0;i<names.length;i++){var j=h.indexOf(names[i]);if(j>=0)return j;} return -1; };
    var sym   = idx(['symbol','contract name','contract','instrument']);
    var bs    = idx(['buy/sell','side','direction','action','b/s']);
    var qty   = idx(['qty','quantity','size','contracts','lots']);
    var price = idx(['price','fill price','avg fill price','avg price']);
    var dt    = idx(['fill date','date/time','date','time']);
    var pnl   = idx(['pnl','realized pnl','p&l','net p&l','profit','gain/loss']);
    var comm  = idx(['commission','comm','fees','fee']);
    if (sym<0||qty<0) return { trades:[], invalid:rows.length-1, recognized:false };
    // Tradeovate lists individual fills — pair them FIFO per symbol
    var fills = [], invalid = 0;
    for (var r=1;r<rows.length;r++) {
      var rw=rows[r];
      var s=String(rw[sym]||'').trim().toUpperCase(); if(!s){invalid++;continue;}
      var q2=num(rw[qty]); var pr=price>=0?num(rw[price]):NaN;
      if(!isFinite(q2)||!isFinite(pr)){invalid++;continue;}
      var dir=bs>=0?sideFromText(rw[bs]):'long';
      var fees=comm>=0?(num(rw[comm])||0):0;
      fills.push({ sym:s, dir:dir, qty:q2, price:pr, dt:dt>=0?rw[dt]:'', fees:fees,
                   pnl:pnl>=0?num(rw[pnl]):NaN, sk: new Date((dt>=0?rw[dt]:'')||'').getTime()||0 });
    }
    // FIFO pairing per symbol
    var bySym = {};
    fills.forEach(function(f){ if(!bySym[f.sym]) bySym[f.sym]=[]; bySym[f.sym].push(f); });
    var out = [];
    Object.keys(bySym).forEach(function(sym2) {
      var fl = bySym[sym2].slice().sort(function(a,b){return a.sk-b.sk;});
      var lots = [];
      fl.forEach(function(f) {
        var q = f.qty;
        if (!lots.length || lots[0].dir === f.dir) { lots.push({dir:f.dir,qtyRem:q,price:f.price,dt:f.dt,fees:f.fees/f.qty}); return; }
        while (q>1e-9 && lots.length && lots[0].dir !== f.dir) {
          var lot=lots[0], m=Math.min(q,lot.qtyRem);
          var sd=lot.dir==='long'?'long':'short';
          out.push(baseTrade(accountId,sym2,sd,lot.price,f.price,m,lot.dt,(lot.fees+f.fees/f.qty)*m,undefined));
          lot.qtyRem-=m; q-=m; if(lot.qtyRem<=1e-9) lots.shift();
        }
        if(q>1e-9) lots.push({dir:f.dir,qtyRem:q,price:f.price,dt:f.dt,fees:f.fees/f.qty});
      });
      invalid += lots.reduce(function(s,l){return s+l.qtyRem;},0)>1e-9 ? 1 : 0;
    });
    return { trades:out, invalid:invalid, recognized:true, mode:'tradeovate' };
  }

  /* ─── Earn2Trade ─── */
  function parseEarn2Trade(rows, accountId) {
    var h = rows[0].map(function(c){return String(c).trim().toLowerCase();});
    var idx = function(names){ for(var i=0;i<names.length;i++){var j=h.indexOf(names[i]);if(j>=0)return j;} return -1; };
    var sym   = idx(['instrument','symbol','contract','ticker']);
    var dir   = idx(['direction','side','type','action','buy/sell']);
    var qty   = idx(['qty','quantity','size','contracts','lots']);
    var entry = idx(['entry','entry price','open','open price','avg entry']);
    var exit  = idx(['exit','exit price','close','close price','avg exit']);
    var dt    = idx(['date','date/time','open date','entry date','time']);
    var pnl   = idx(['p&l','pnl','profit','net p&l','net profit','gain/loss']);
    var fee   = idx(['fee','fees','commission','comm']);
    if (sym<0||qty<0) return { trades:[], invalid:rows.length-1, recognized:false };
    var out=[], invalid=0;
    for (var r=1;r<rows.length;r++) {
      var rw=rows[r];
      var s=String(rw[sym]||'').trim().toUpperCase(); if(!s){invalid++;continue;}
      var q2=num(rw[qty]); var ep=entry>=0?num(rw[entry]):NaN; var xp=exit>=0?num(rw[exit]):NaN;
      var fees=fee>=0?(num(rw[fee])||0):0; var pnlVal=pnl>=0?num(rw[pnl]):undefined;
      var sd=dir>=0?sideFromText(rw[dir]):'long';
      out.push(baseTrade(accountId,s,sd,ep,xp,q2,dt>=0?rw[dt]:'',fees,isFinite(pnlVal)?pnlVal:undefined));
    }
    return { trades:out, invalid:invalid, recognized:true, mode:'earn2trade' };
  }

  /* ─── Lucid Trading ─── */
  function parseLucid(rows, accountId) {
    var h = rows[0].map(function(c){return String(c).trim().toLowerCase();});
    var idx = function(names){ for(var i=0;i<names.length;i++){var j=h.indexOf(names[i]);if(j>=0)return j;} return -1; };
    var sym   = idx(['symbol','instrument','ticker','contract','market']);
    var side  = idx(['side','direction','type','action','buy/sell','b/s','position']);
    var qty   = idx(['qty','quantity','size','contracts','lots','volume']);
    var entry = idx(['entry price','entry','open price','open','avg entry','fill price']);
    var exit  = idx(['exit price','exit','close price','close','avg exit']);
    var dt    = idx(['date/time','datetime','date','open date','entry date','time','timestamp']);
    var pnl   = idx(['p&l','pnl','profit','net p&l','realized p&l','net profit','gain/loss','profit/loss']);
    var fee   = idx(['fees','fee','commission','comm']);
    if (sym<0||qty<0) return { trades:[], invalid:rows.length-1, recognized:false };
    var out=[], invalid=0;
    for (var r=1;r<rows.length;r++) {
      var rw=rows[r];
      var s=String(rw[sym]||'').trim().toUpperCase(); if(!s){invalid++;continue;}
      var q2=num(rw[qty]); var ep=entry>=0?num(rw[entry]):NaN; var xp=exit>=0?num(rw[exit]):NaN;
      var fees=fee>=0?(num(rw[fee])||0):0; var pnlVal=pnl>=0?num(rw[pnl]):undefined;
      var sd=side>=0?sideFromText(rw[side]):'long';
      out.push(baseTrade(accountId,s,sd,ep,xp,q2,dt>=0?rw[dt]:'',fees,isFinite(pnlVal)?pnlVal:undefined));
    }
    return { trades:out, invalid:invalid, recognized:true, mode:'lucid' };
  }

  /* ── Auto-detect firm from headers ── */
  function detectFirm(rows) {
    if (!rows || !rows[0]) return null;
    var header = rows[0].map(function(c){return String(c).trim().toLowerCase();}).join('|');
    if (header.indexOf('swap') >= 0 && header.indexOf('open time') >= 0) return 'ftmo';
    if (header.indexOf('open price') >= 0 && header.indexOf('commission') >= 0 && header.indexOf('open date') >= 0) return 'apex';
    if (header.indexOf('fill date') >= 0 || header.indexOf('fill price') >= 0) return 'tradeovate';
    if (header.indexOf('entry date/time') >= 0) return 'topstep';
    if (header.indexOf('direction') >= 0 && header.indexOf('entry') >= 0 && header.indexOf('exit') >= 0) return 'earn2trade';
    return null;
  }

  /* ── Main parse function ── */
  function parse(text, firmId, accountId) {
    var rows = parseCSV(text);
    if (rows.length < 2) return { trades:[], invalid:0, recognized:false, headers:[], firmId:firmId };
    var fid = firmId || detectFirm(rows);
    var result;
    if      (fid === 'topstep')   result = parseTopStep(rows, accountId);
    else if (fid === 'apex')      result = parseApex(rows, accountId);
    else if (fid === 'ftmo')      result = parseFTMO(rows, accountId);
    else if (fid === 'tradeovate')result = parseTradeovate(rows, accountId);
    else if (fid === 'earn2trade')result = parseEarn2Trade(rows, accountId);
    else if (fid === 'lucid')     result = parseLucid(rows, accountId);
    else {
      // try all parsers
      var parsers = [parseTopStep, parseApex, parseFTMO, parseTradeovate, parseEarn2Trade, parseLucid];
      for (var pi=0; pi<parsers.length; pi++) {
        var r = parsers[pi](rows, accountId);
        if (r.recognized && r.trades.length > 0) { result = r; break; }
      }
      if (!result) result = { trades:[], invalid:rows.length-1, recognized:false };
    }
    result.headers = rows[0];
    result.firmId = fid;
    return result;
  }

  window.PFImport = { FIRMS: FIRMS, parse: parse, detectFirm: detectFirm, _parseCSV: parseCSV };
})();
