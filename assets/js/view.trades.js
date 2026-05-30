/* ============================================================
   view.trades.js — trade log, add/edit form, CSV import
   Exports: Views.Trades, Views.TradeForm, Views.ImportCsv
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, C = window.Store.calc, Store = window.Store;
  var useState = React.useState, useMemo = React.useMemo, useRef = React.useRef;

  var EMOTIONS = ['Calm', 'Confident', 'Focused', 'Anxious', 'Greedy', 'Frustrated', 'Fearful', 'Bored'];
  var MISTAKES = ['Moved stop', 'Chased entry', 'Oversized', 'No setup (FOMO)', 'Exited early', 'Revenge trade', 'Ignored plan', 'Held too long', 'No stop loss', 'Averaged down'];
  var TAGS = ['A+ setup', 'News', 'Trend day', 'Choppy', 'Breakout', 'Reversal', 'Earnings', 'Pre-market plan', 'Scalp', 'Swing'];

  /* ===================== Trade table page ===================== */
  function Trades(props) {
    var state = props.state, ctx = props.ctx;
    var search = useState(''); var q = search[0];
    var filter = useState('all'); var f = filter[0];
    var sort = useState({ key: 'date', dir: -1 }); var sk = sort[0];

    var rows = useMemo(function () {
      var all = Store.getTrades(ctx);
      var ql = q.trim().toLowerCase();
      var list = all.filter(function (t) {
        if (f !== 'all' && C.resultOf(t) !== f) return false;
        if (!ql) return true;
        return (t.symbol + ' ' + (t.setup || '') + ' ' + (t.notes || '') + ' ' + (t.tags || []).join(' ') + ' ' + (t.mistakes || []).join(' ')).toLowerCase().indexOf(ql) >= 0;
      });
      list.sort(function (a, b) {
        var va, vb;
        if (sk.key === 'date') { va = C.timeKey(a); vb = C.timeKey(b); }
        else if (sk.key === 'pnl') { va = C.pnlOf(a); vb = C.pnlOf(b); }
        else if (sk.key === 'r') { va = C.rOf(a) || 0; vb = C.rOf(b) || 0; }
        else { va = a[sk.key]; vb = b[sk.key]; }
        if (va < vb) return -sk.dir; if (va > vb) return sk.dir; return 0;
      });
      return list;
    }, [state, ctx.accountId, ctx.range, q, f, sk.key, sk.dir]);

    var s = C.stats(rows);

    function th(label, key) {
      var active = sk.key === key;
      return h('th', { key: label, onClick: key ? function () { setSort(key); } : null,
        className: window.cx('py-2.5 px-3 font-semibold whitespace-nowrap', key ? 'cursor-pointer hover:text-slate-700 dark:hover:text-white' : '') },
        label, active ? (sk.dir === 1 ? ' ▲' : ' ▼') : '');
    }
    function setSort(key) {
      if (sk.key === key) sort[1]({ key: key, dir: sk.dir * -1 });
      else sort[1]({ key: key, dir: key === 'symbol' ? 1 : -1 });
    }

    return h('div', { className: 'space-y-4 animate-fade-in' },
      h(UI.SectionHead, { title: 'Trade Log', sub: 'Every fill with P&L, R-multiple, tags, mistakes and screenshots.',
        right: [h(UI.Button, { key: 'tv', variant: 'ghost', onClick: props.openTradingView }, '⇪ TradingView'),
                h(UI.Button, { key: 'csv', variant: 'ghost', onClick: props.openCsv }, '⤓ Import CSV'),
                h(UI.Button, { key: 'add', variant: 'primary', onClick: function () { props.openTradeForm(); } }, '+ Add Trade')] }),
      h('div', { className: 'flex flex-wrap gap-2.5 items-center' },
        h(UI.Input, { className: 'max-w-xs', placeholder: '🔎 Search symbol, setup, tag, notes…', value: q, onChange: function (e) { search[1](e.target.value); } }),
        h(UI.Select, { className: 'max-w-[160px]', value: f, onChange: function (e) { filter[1](e.target.value); } },
          h('option', { value: 'all' }, 'All results'), h('option', { value: 'win' }, 'Winners'), h('option', { value: 'loss' }, 'Losers'), h('option', { value: 'be' }, 'Break-even')),
        h(UI.Pill, { className: 'ml-auto' }, rows.length + ' trades · ' + Fmt.money(s.netPnl, { plus: true }) + ' · ' + Fmt.pct(s.winRate) + ' win')),
      rows.length === 0
        ? h(UI.Empty, { icon: '🔍', title: 'No trades match', sub: 'Clear the search or filter.' })
        : h(UI.Card, { className: 'overflow-hidden' }, h('div', { className: 'overflow-x-auto' },
            h('table', { className: 'w-full text-sm min-w-[920px]' },
              h('thead', null, h('tr', { className: 'text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50 dark:bg-ink-750' },
                th('Date', 'date'), th('Symbol', 'symbol'), th('Side'), th('Setup'), th('Entry'), th('Exit'), th('Qty'), th('P&L', 'pnl'), th('R', 'r'), th('Result'), th('Tags'), th(''))),
              h('tbody', null, rows.map(function (t) { return h(Row, { key: t.id, t: t, onEdit: props.openTradeForm }); })))))
    );
  }

  function Row(props) {
    var t = props.t, p = C.pnlOf(t), r = C.rOf(t);
    function open(e) { e.stopPropagation(); props.onEdit(t); }
    return h('tr', { className: 'border-t border-slate-100 dark:border-ink-700 hover:bg-slate-50 dark:hover:bg-ink-700/60 cursor-pointer', onClick: function () { props.onEdit(t); } },
      h('td', { className: 'py-2.5 px-3 whitespace-nowrap' }, Fmt.dateShort(t.date), ' ', h('span', { className: 'text-slate-400' }, t.time || '')),
      h('td', { className: 'px-3 font-semibold' }, t.symbol, (t.screenshots && t.screenshots.length) ? h('span', { className: 'ml-1', title: t.screenshots.length + ' screenshot(s)' }, '📎') : null),
      h('td', { className: 'px-3' }, h(UI.SideBadge, { side: t.side })),
      h('td', { className: 'px-3 text-slate-400 whitespace-nowrap' }, t.setup || '—'),
      h('td', { className: 'px-3 text-right tabular-nums' }, Fmt.num(t.entry, 2)),
      h('td', { className: 'px-3 text-right tabular-nums' }, Fmt.num(t.exit, 2)),
      h('td', { className: 'px-3 text-right tabular-nums' }, Fmt.num(t.quantity)),
      h('td', { className: window.cx('px-3 text-right font-semibold tabular-nums', Fmt.signColor(p)) }, Fmt.money(p, { plus: true })),
      h('td', { className: window.cx('px-3 text-right tabular-nums', r == null ? 'text-slate-400' : Fmt.signColor(r)) }, r == null ? '—' : Fmt.num(r, 2) + 'R'),
      h('td', { className: 'px-3' }, h(UI.ResultBadge, { result: C.resultOf(t) })),
      h('td', { className: 'px-3 whitespace-nowrap max-w-[200px] truncate' },
        (t.mistakes || []).map(function (m) { return h(UI.Chip, { key: 'm' + m, mistake: true }, m); }),
        (t.tags || []).map(function (tg) { return h(UI.Chip, { key: 't' + tg }, tg); }),
        (!(t.mistakes || []).length && !(t.tags || []).length) ? h('span', { className: 'text-slate-400' }, '—') : null),
      h('td', { className: 'px-3 whitespace-nowrap' },
        h('button', { className: 'text-brand-400 font-semibold text-xs px-1.5 py-1 rounded hover:bg-brand/10', onClick: open }, 'Edit'),
        h('button', { className: 'text-loss font-semibold text-xs px-1.5 py-1 rounded hover:bg-loss/10', onClick: function (e) { e.stopPropagation(); del(t); } }, 'Delete'))
    );
  }

  function del(t) {
    if (window.confirm('Delete this ' + t.symbol + ' trade from ' + Fmt.date(t.date) + '? This cannot be undone.')) {
      Store.remove('trades', t.id); window.toast('Trade deleted', 'ok');
    }
  }

  /* ===================== Trade form modal ===================== */
  function resizeImage(file, maxDim) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          var w = Math.round(img.width * scale), hh = Math.round(img.height * scale);
          var canvas = document.createElement('canvas'); canvas.width = w; canvas.height = hh;
          canvas.getContext('2d').drawImage(img, 0, 0, w, hh);
          try { resolve(canvas.toDataURL('image/jpeg', 0.82)); } catch (e) { resolve(reader.result); }
        };
        img.onerror = function () { resolve(reader.result); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function TradeForm(props) {
    var state = Store.getState();
    var isEdit = !!props.trade;
    var init = props.trade || { accountId: (state.accounts[0] || {}).id, symbol: '', date: Fmt.todayISO(), time: '09:30', side: 'long', quantity: '', entry: '', exit: '', fees: 0, multiplier: '', riskAmount: '', setup: '', emotion: '', rating: '', tags: [], mistakes: [], screenshots: [], notes: '' };
    var fs = useState(Object.assign({}, init)); var form = fs[0], setForm = fs[1];
    function set(k, v) { setForm(function (cur) { var n = Object.assign({}, cur); n[k] = v; return n; }); }

    var preview = useMemo(function () {
      var entry = parseFloat(form.entry), exit = parseFloat(form.exit), qty = parseFloat(form.quantity);
      if (![entry, exit, qty].every(isFinite)) return null;
      return C.pnlOf({ side: form.side, entry: entry, exit: exit, quantity: qty, fees: parseFloat(form.fees) || 0, multiplier: parseFloat(form.multiplier) || 1 });
    }, [form.entry, form.exit, form.quantity, form.side, form.fees, form.multiplier]);

    function onFiles(e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      Promise.all(files.slice(0, 4).map(function (f) { return resizeImage(f, 1100); })).then(function (urls) {
        setForm(function (cur) { return Object.assign({}, cur, { screenshots: (cur.screenshots || []).concat(urls).slice(0, 6) }); });
      });
      e.target.value = '';
    }

    function save() {
      var symbol = String(form.symbol || '').trim().toUpperCase();
      var entry = parseFloat(form.entry), exit = parseFloat(form.exit), qty = parseFloat(form.quantity);
      if (!symbol) { window.toast('Symbol is required', 'err'); return; }
      if (![entry, exit, qty].every(isFinite)) { window.toast('Entry, exit and quantity are required', 'err'); return; }
      var obj = {
        accountId: form.accountId, symbol: symbol, date: form.date, time: form.time, side: form.side,
        quantity: qty, entry: entry, exit: exit, fees: parseFloat(form.fees) || 0,
        multiplier: form.multiplier === '' || form.multiplier == null ? 1 : (parseFloat(form.multiplier) || 1),
        riskAmount: form.riskAmount === '' || form.riskAmount == null ? null : parseFloat(form.riskAmount),
        setup: form.setup, emotion: form.emotion, rating: form.rating ? parseInt(form.rating, 10) : null,
        tags: form.tags || [], mistakes: form.mistakes || [], screenshots: form.screenshots || [], notes: String(form.notes || '').trim()
      };
      if (isEdit) { Store.update('trades', props.trade.id, obj); window.toast('Trade updated', 'ok'); }
      else { Store.add('trades', obj); window.toast('Trade added', 'ok'); }
      props.onClose();
    }

    var footer = [
      h(UI.Button, { key: 'c', variant: 'ghost', onClick: props.onClose }, 'Cancel'),
      h(UI.Button, { key: 's', variant: 'primary', onClick: save }, isEdit ? 'Save changes' : 'Add trade')
    ];

    return h(UI.Modal, { title: isEdit ? 'Edit Trade' : 'Add Trade', wide: true, onClose: props.onClose, footer: footer },
      h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3.5' },
        h(UI.Field, { label: 'Account' }, h(UI.Select, { value: form.accountId, onChange: function (e) { set('accountId', e.target.value); } },
          state.accounts.map(function (a) { return h('option', { key: a.id, value: a.id }, a.name); }))),
        h(UI.Field, { label: 'Symbol' }, h(UI.Input, { value: form.symbol, placeholder: 'e.g. NQ, AAPL', onChange: function (e) { set('symbol', e.target.value); } })),
        h(UI.Field, { label: 'Date' }, h(UI.Input, { type: 'date', value: form.date, onChange: function (e) { set('date', e.target.value); } })),
        h(UI.Field, { label: 'Time' }, h(UI.Input, { type: 'time', value: form.time, onChange: function (e) { set('time', e.target.value); } })),
        h(UI.Field, { label: 'Direction' }, h(UI.Select, { value: form.side, onChange: function (e) { set('side', e.target.value); } },
          h('option', { value: 'long' }, '▲ Long'), h('option', { value: 'short' }, '▼ Short'))),
        h(UI.Field, { label: 'Quantity / Contracts' }, h(UI.Input, { type: 'number', step: 'any', value: form.quantity, onChange: function (e) { set('quantity', e.target.value); } })),
        h(UI.Field, { label: 'Entry price' }, h(UI.Input, { type: 'number', step: 'any', value: form.entry, onChange: function (e) { set('entry', e.target.value); } })),
        h(UI.Field, { label: 'Exit price' }, h(UI.Input, { type: 'number', step: 'any', value: form.exit, onChange: function (e) { set('exit', e.target.value); } })),
        h(UI.Field, { label: 'Fees / commission' }, h(UI.Input, { type: 'number', step: 'any', value: form.fees, onChange: function (e) { set('fees', e.target.value); } })),
        h(UI.Field, { label: 'Contract multiplier', hint: '— 1 stocks · 50 ES · 20 NQ' }, h(UI.Input, { type: 'number', step: 'any', placeholder: '1', value: form.multiplier == null ? '' : form.multiplier, onChange: function (e) { set('multiplier', e.target.value); } })),
        h(UI.Field, { label: 'Risk amount ($)', hint: '— for R-multiple' }, h(UI.Input, { type: 'number', step: 'any', value: form.riskAmount, onChange: function (e) { set('riskAmount', e.target.value); } })),
        h(UI.Field, { label: 'Playbook / Setup' }, h(UI.Select, { value: form.setup, onChange: function (e) { set('setup', e.target.value); } },
          h('option', { value: '' }, '— none —'), state.playbooks.map(function (pb) { return h('option', { key: pb.id, value: pb.name }, pb.name); }))),
        h(UI.Field, { label: 'Emotion' }, h(UI.Select, { value: form.emotion, onChange: function (e) { set('emotion', e.target.value); } },
          h('option', { value: '' }, '—'), EMOTIONS.map(function (em) { return h('option', { key: em, value: em }, em); }))),
        h(UI.Field, { label: 'Execution rating' }, h(UI.Select, { value: form.rating, onChange: function (e) { set('rating', e.target.value); } },
          h('option', { value: '' }, '—'), [1, 2, 3, 4, 5].map(function (n) { return h('option', { key: n, value: n }, '★'.repeat(n)); }))),
        h(UI.Field, { label: 'Live P&L preview' }, h('div', { className: window.cx('rounded-xl px-3 py-2 text-sm font-bold bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-ink-600', preview == null ? 'text-slate-400' : Fmt.signColor(preview)) }, preview == null ? '—' : Fmt.money(preview, { plus: true })))
      ),
      h('div', { className: 'mt-3.5' }, h(UI.Field, { label: 'Tags', full: true }, h(UI.TagEditor, { value: form.tags, suggestions: dedupe(TAGS.concat(Store.allTags())), onChange: function (v) { set('tags', v); } }))),
      h('div', { className: 'mt-3.5' }, h(UI.Field, { label: 'Mistakes / rule breaks', full: true }, h(UI.TagEditor, { value: form.mistakes, mistake: true, suggestions: dedupe(MISTAKES.concat(Store.allMistakes())), onChange: function (v) { set('mistakes', v); } }))),
      h('div', { className: 'mt-3.5' }, h(UI.Field, { label: 'Notes', full: true }, h(UI.Textarea, { value: form.notes, placeholder: 'Thesis, what happened, lessons…', onChange: function (e) { set('notes', e.target.value); } }))),
      h('div', { className: 'mt-3.5' },
        h(UI.Field, { label: 'Screenshots', hint: '(stored locally, auto-resized)', full: true },
          h('div', null,
            h('input', { type: 'file', accept: 'image/*', multiple: true, onChange: onFiles, className: 'text-sm text-slate-500' }),
            (form.screenshots && form.screenshots.length) ? h('div', { className: 'grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3' },
              form.screenshots.map(function (src, i) {
                return h('div', { key: i, className: 'relative group' },
                  h('img', { src: src, className: 'w-full h-24 object-cover rounded-lg border border-slate-200 dark:border-ink-600' }),
                  h('button', { type: 'button', onClick: function () { set('screenshots', form.screenshots.filter(function (_, j) { return j !== i; })); },
                    className: 'absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs leading-none' }, '×'));
              })) : null)))
    );
  }
  function dedupe(a) { var seen = {}; return a.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; }); }

  /* ===================== CSV import ===================== */
  var CSV_FIELDS = {
    date: ['date', 'open date', 'opened', 'entry date', 'date/time', 'datetime', 'trade date'],
    time: ['time', 'entry time', 'open time'],
    symbol: ['symbol', 'ticker', 'instrument', 'market', 'contract', 'asset'],
    side: ['side', 'direction', 'type', 'b/s', 'buy/sell', 'position', 'long/short'],
    quantity: ['qty', 'quantity', 'size', 'shares', 'contracts', 'volume', 'units'],
    entry: ['entry', 'entry price', 'entryprice', 'open price', 'avg entry', 'buy price', 'price in', 'open', 'avgentry'],
    exit: ['exit', 'exit price', 'exitprice', 'close price', 'avg exit', 'sell price', 'price out', 'close', 'avgexit'],
    fees: ['fees', 'fee', 'commission', 'commissions', 'comm', 'cost'],
    setup: ['setup', 'playbook', 'strategy', 'system'],
    mistakes: ['mistakes', 'mistake', 'errors'], tags: ['tags', 'tag', 'labels'],
    riskAmount: ['risk', 'riskamount', 'risk amount', 'risk $', '$risk', 'risk$'],
    multiplier: ['multiplier', 'point value', 'pointvalue', 'contract size', 'big point value', 'tick value'],
    notes: ['notes', 'note', 'comment', 'comments', 'description']
  };
  function parseCSV(text) {
    var rows = [], row = [], field = '', i = 0, q = false; text = String(text).replace(/^\uFEFF/, '');
    while (i < text.length) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; } field += ch; i++; continue; }
      if (ch === '"') { q = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
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
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
    if ((m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/))) { var y = m[3]; if (y.length === 2) y = '20' + y; return y + '-' + pad2(m[1]) + '-' + pad2(m[2]); }
    var d = new Date(s); return isNaN(d) ? '' : d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function normTime(raw) { var m = String(raw || '').match(/(\d{1,2}):(\d{2})/); return m ? pad2(m[1]) + ':' + m[2] : ''; }
  function csvNum(raw) { if (raw == null) return NaN; var s = String(raw).replace(/[$,\s]/g, ''); if (/^\(.*\)$/.test(s)) s = '-' + s.replace(/[()]/g, ''); return parseFloat(s); }
  function headerIndex(headerRow) {
    var idx = {};
    headerRow.forEach(function (hh, i) { var n = String(hh).trim().toLowerCase(); Object.keys(CSV_FIELDS).forEach(function (fld) { if (idx[fld] === undefined && CSV_FIELDS[fld].indexOf(n) >= 0) idx[fld] = i; }); });
    return idx;
  }
  function mapCsv(text, accountId) {
    var rows = parseCSV(text); if (!rows.length) return { trades: [], invalid: 0, recognized: false };
    var idx = headerIndex(rows[0]);
    if (idx.symbol === undefined || idx.entry === undefined || idx.exit === undefined) return { trades: [], invalid: 0, recognized: false };
    var out = [], invalid = 0;
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r], g = function (f) { return idx[f] !== undefined ? row[idx[f]] : ''; };
      var sym = String(g('symbol') || '').trim().toUpperCase();
      var entry = csvNum(g('entry')), exit = csvNum(g('exit')), qty = csvNum(g('quantity'));
      var date = normDate(g('date')), time = normTime(g('time')) || normTime(g('date'));
      if (!sym || !isFinite(entry) || !isFinite(exit) || !isFinite(qty) || !date) { invalid++; continue; }
      var fees = csvNum(g('fees')); if (!isFinite(fees)) fees = 0;
      var risk = csvNum(g('riskAmount'));
      var mult = csvNum(g('multiplier'));
      var split = function (v) { v = String(v || '').trim(); return v ? v.split(/[;|]/).map(function (x) { return x.trim(); }).filter(Boolean) : []; };
      var sideRaw = String(g('side') || '').trim().toLowerCase();
      out.push({ accountId: accountId, date: date, time: time || '09:30', symbol: sym,
        side: (sideRaw === 's' || sideRaw === 'sell' || sideRaw.indexOf('short') >= 0) ? 'short' : 'long',
        quantity: qty, entry: entry, exit: exit, fees: fees, riskAmount: isFinite(risk) ? risk : null,
        multiplier: isFinite(mult) && mult > 0 ? mult : 1,
        setup: String(g('setup') || '').trim(), tags: split(g('tags')), mistakes: split(g('mistakes')),
        emotion: '', rating: null, screenshots: [], notes: String(g('notes') || '').trim() });
    }
    return { trades: out, invalid: invalid, recognized: true };
  }
  var SAMPLE = 'Date,Time,Symbol,Side,Quantity,Entry,Exit,Fees,Setup,Tags,Mistakes,Risk,Notes\n' +
    '2026-05-20,09:34,NQ,Long,2,18520.25,18560.50,4.40,Opening Range Breakout,Trend day,,300,Clean break with volume\n' +
    '2026-05-20,10:12,AAPL,Short,150,224.80,223.10,1.50,Mean Reversion Fade,Reversal,Chased entry,250,Faded into resistance\n' +
    '05/21/2026,11:05,ES,Long,1,5305.00,5298.25,2.20,Trend Pullback,,Moved stop;Exited early,200,Broke the plan';

  function ImportCsv(props) {
    var state = Store.getState();
    var defAcc = (props.ctx && props.ctx.accountId && props.ctx.accountId !== 'all') ? props.ctx.accountId : (state.accounts[0] || {}).id;
    var acc = useState(defAcc); var text = useState('');
    var parsed = useMemo(function () { return text[0].trim() ? mapCsv(text[0], acc[0]) : { trades: [], invalid: 0, recognized: false }; }, [text[0], acc[0]]);

    function onFile(e) { var f = e.target.files && e.target.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { text[1](rd.result); }; rd.readAsText(f); }
    function doImport() {
      if (!parsed.recognized || !parsed.trades.length) return;
      parsed.trades.forEach(function (t) { t.accountId = acc[0]; Store.add('trades', t); });
      window.toast('Imported ' + parsed.trades.length + ' trade' + (parsed.trades.length > 1 ? 's' : ''), 'ok');
      props.onClose();
    }
    var n = parsed.trades.length;
    var footer = [
      h(UI.Button, { key: 'c', variant: 'ghost', onClick: props.onClose }, 'Cancel'),
      h(UI.Button, { key: 'i', variant: 'primary', disabled: !parsed.recognized || n === 0, onClick: doImport }, n ? ('Import ' + n + ' trade' + (n > 1 ? 's' : '')) : 'Import')
    ];

    return h(UI.Modal, { title: 'Import Trades from CSV', wide: true, onClose: props.onClose, footer: footer },
      h('p', { className: 'text-sm text-slate-500 dark:text-slate-400 mb-3' }, 'Upload or paste a CSV. The first row must be headers; columns are auto-detected (date, symbol, side, quantity, entry, exit, fees, setup, tags, mistakes, risk, notes). P&L and R are calculated for you.'),
      h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3.5' },
        h(UI.Field, { label: 'Import into account' }, h(UI.Select, { value: acc[0], onChange: function (e) { acc[1](e.target.value); } },
          state.accounts.map(function (a) { return h('option', { key: a.id, value: a.id }, a.name); }))),
        h(UI.Field, { label: 'CSV file' }, h('input', { type: 'file', accept: '.csv,text/csv', onChange: onFile, className: 'text-sm text-slate-500 py-2' }))),
      h('div', { className: 'mt-3.5' }, h(UI.Field, { label: 'Paste CSV', full: true }, h(UI.Textarea, { value: text[0], placeholder: '…or paste rows here (first row = headers)', className: 'font-mono text-xs min-h-[130px]', onChange: function (e) { text[1](e.target.value); } }))),
      h('div', { className: 'flex gap-3 mt-2' },
        h('button', { className: 'text-brand-400 text-xs font-semibold hover:underline', onClick: function () { text[1](SAMPLE); } }, 'Load sample'),
        h('button', { className: 'text-brand-400 text-xs font-semibold hover:underline', onClick: function () { Fmt.download('zeroemotionai-import-template.csv', SAMPLE, 'text/csv'); } }, '⭳ Download template')),
      text[0].trim() ? h('div', { className: 'mt-4' },
        !parsed.recognized
          ? h('div', { className: 'rounded-xl border border-dashed border-loss/40 bg-loss/5 text-sm p-4' }, '⚠️ Could not detect required columns. Make sure the header row includes at least symbol, entry and exit.')
          : h('div', null,
              h('div', { className: 'flex gap-3 mb-3 flex-wrap' },
                h(UI.Pill, null, h('strong', { className: 'text-profit' }, n), ' valid'),
                parsed.invalid ? h(UI.Pill, null, h('strong', { className: 'text-loss' }, parsed.invalid), ' skipped') : null),
              n ? h('div', { className: 'overflow-x-auto' }, h('table', { className: 'w-full text-sm min-w-[560px]' },
                h('thead', null, h('tr', { className: 'text-left text-[11px] uppercase tracking-wide text-slate-400' },
                  ['Date', 'Symbol', 'Side', 'Qty', 'Entry', 'Exit', 'P&L'].map(function (c) { return h('th', { key: c, className: 'py-1.5 pr-3 font-semibold' }, c); }))),
                h('tbody', null, parsed.trades.slice(0, 6).map(function (t, i) {
                  var p = C.pnlOf(t);
                  return h('tr', { key: i, className: 'border-t border-slate-100 dark:border-ink-700' },
                    h('td', { className: 'py-1.5 pr-3' }, t.date), h('td', { className: 'pr-3 font-semibold' }, t.symbol),
                    h('td', { className: 'pr-3' }, h(UI.SideBadge, { side: t.side })), h('td', { className: 'pr-3' }, Fmt.num(t.quantity)),
                    h('td', { className: 'pr-3' }, Fmt.num(t.entry, 2)), h('td', { className: 'pr-3' }, Fmt.num(t.exit, 2)),
                    h('td', { className: window.cx('pr-3 font-semibold', Fmt.signColor(p)) }, Fmt.money(p, { plus: true })));
                })))) : null,
              n > 6 ? h('p', { className: 'text-xs text-slate-400 mt-2' }, '+ ' + (n - 6) + ' more…') : null)) : null
    );
  }

  /* ===================== TradingView import ===================== */
  var SAMPLE_TV = 'Trade #,Type,Date/Time,Signal,Price USD,Contracts,Profit USD,Cumulative profit USD,Run-up USD,Drawdown USD\n' +
    '1,Entry long,2026-05-01 09:30,Buy,18500,2,,,,\n' +
    '1,Exit long,2026-05-01 11:00,Close,18560,2,2400,2400,2600,-300\n' +
    '2,Entry short,2026-05-02 10:15,Sell,18620,1,,,,\n' +
    '2,Exit short,2026-05-02 13:45,Close,18580,1,800,3200,900,-150';

  function ImportTradingView(props) {
    var state = Store.getState();
    var defAcc = (props.ctx && props.ctx.accountId && props.ctx.accountId !== 'all') ? props.ctx.accountId : (state.accounts[0] || {}).id;
    var acc = useState(defAcc); var symbol = useState(''); var mult = useState(''); var text = useState('');

    var parsed = useMemo(function () {
      return text[0].trim() ? window.TVImport.parse(text[0], { symbol: symbol[0], accountId: acc[0], defaultMultiplier: parseFloat(mult[0]) || 1 })
        : { recognized: false, trades: [], invalid: 0, mode: null };
    }, [text[0], symbol[0], acc[0], mult[0]]);

    function onFile(e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      if (!symbol[0]) { var g = window.TVImport.guessSymbol(f.name); if (g) symbol[1](g); }
      var rd = new FileReader(); rd.onload = function () { text[1](rd.result); }; rd.readAsText(f);
    }
    function doImport() {
      if (!parsed.recognized || !parsed.trades.length) return;
      if (parsed.needsSymbol && !symbol[0].trim()) return;
      parsed.trades.forEach(function (t) { Store.add('trades', t); });
      window.toast('Imported ' + parsed.trades.length + ' trade' + (parsed.trades.length > 1 ? 's' : '') + ' from TradingView', 'ok');
      props.onClose();
    }
    var n = parsed.trades.length;
    var missingSym = (!parsed.recognized || parsed.needsSymbol) && !symbol[0].trim();
    var footer = [
      h(UI.Button, { key: 'c', variant: 'ghost', onClick: props.onClose }, 'Cancel'),
      h(UI.Button, { key: 'i', variant: 'primary', disabled: !parsed.recognized || n === 0 || missingSym, onClick: doImport }, n ? ('Import ' + n + ' trade' + (n > 1 ? 's' : '')) : 'Import')
    ];
    var MODE_LABEL = { paired: 'List of Trades', single: 'List of Trades', fills: 'Order history (reconstructed)' };

    return h(UI.Modal, { title: 'Import from TradingView', wide: true, onClose: props.onClose, footer: footer },
      h('div', { className: 'rounded-xl border border-slate-200 dark:border-ink-600 bg-slate-50 dark:bg-ink-900 p-3 mb-3.5 text-sm text-slate-500 dark:text-slate-400' },
        h('strong', { className: 'text-slate-700 dark:text-slate-200' }, 'Which TradingView export to use: '),
        'in the Account Manager, the export (download) icon works on ', h('strong', null, 'Order History'), ' and ', h('strong', null, 'List of Trades'), ' — both import here. ',
        h('em', null, 'Orders / Order History'), ' are individual fills, which are auto-paired into round-trip trades.',
        h('div', { className: 'mt-1.5 text-xs' }, h('strong', null, 'Not importable: '), '“Positions” (open trades only, no exit) and “Balance History” (cash movements, no trade prices). Order history has no P&L column, so the multiplier below is applied to every reconstructed trade — import one instrument type at a time (e.g. futures separately from stocks), or fix the multiplier per trade afterwards.')),
      h('div', { className: 'grid grid-cols-1 sm:grid-cols-3 gap-3.5' },
        h(UI.Field, { label: 'Account' }, h(UI.Select, { value: acc[0], onChange: function (e) { acc[1](e.target.value); } },
          state.accounts.map(function (a) { return h('option', { key: a.id, value: a.id }, a.name); }))),
        h(UI.Field, { label: 'Symbol', hint: '— for List of Trades' }, h(UI.Input, { value: symbol[0], placeholder: 'e.g. NQ1!, AAPL', onChange: function (e) { symbol[1](e.target.value); } })),
        h(UI.Field, { label: 'Multiplier fallback', hint: '— if no P&L col' }, h(UI.Input, { type: 'number', step: 'any', placeholder: '1', value: mult[0], onChange: function (e) { mult[1](e.target.value); } }))),
      h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3.5' },
        h(UI.Field, { label: 'TradingView CSV file' }, h('input', { type: 'file', accept: '.csv,text/csv', onChange: onFile, className: 'text-sm text-slate-500 py-2' }))),
      h('div', { className: 'mt-3.5' }, h(UI.Field, { label: '…or paste the exported rows', full: true }, h(UI.Textarea, { value: text[0], placeholder: 'Trade #,Type,Date/Time,Signal,Price,Contracts,Profit …', className: 'font-mono text-xs min-h-[130px]', onChange: function (e) { text[1](e.target.value); } }))),
      h('div', { className: 'flex gap-3 mt-2' },
        h('button', { className: 'text-brand-400 text-xs font-semibold hover:underline', onClick: function () { text[1](SAMPLE_TV); if (!symbol[0]) symbol[1]('NQ1!'); } }, 'Load sample'),
        h('button', { className: 'text-brand-400 text-xs font-semibold hover:underline', onClick: function () { Fmt.download('tradingview-sample.csv', SAMPLE_TV, 'text/csv'); } }, '⭳ Download sample')),
      text[0].trim() ? h('div', { className: 'mt-4' },
        !parsed.recognized
          ? h('div', { className: 'rounded-xl border border-dashed border-loss/40 bg-loss/5 text-sm p-4' },
              h('div', null, '⚠️ Couldn\'t read this as trades. Use TradingView\'s ', h('strong', null, 'Order History'), ' or ', h('strong', null, 'List of Trades'), ' export. ',
                h('em', null, 'Positions'), ' (open only) and ', h('em', null, 'Balance History'), ' (no trade prices) can\'t be turned into closed trades.'),
              (parsed.headers && parsed.headers.length) ? h('div', { className: 'mt-2 text-xs' }, h('span', { className: 'text-slate-500 dark:text-slate-400' }, 'Detected columns: '), h('span', { className: 'font-mono text-slate-600 dark:text-slate-300' }, parsed.headers.join(', '))) : null)
          : missingSym
            ? h('div', { className: 'rounded-xl border border-dashed border-amber/50 bg-amber/5 text-sm p-4' }, 'ℹ️ This export doesn\'t include the symbol — enter it above to enable import.')
            : h('div', null,
                h('div', { className: 'flex gap-3 mb-3 flex-wrap items-center' },
                  h(UI.Pill, null, h('strong', { className: 'text-profit' }, n), ' trade' + (n === 1 ? '' : 's')),
                  parsed.invalid ? h(UI.Pill, null, h('strong', { className: 'text-loss' }, parsed.invalid), parsed.mode === 'fills' ? ' open/unpaired' : ' skipped') : null,
                  h(UI.Pill, null, MODE_LABEL[parsed.mode] || parsed.mode)),
                n ? h('div', { className: 'overflow-x-auto' }, h('table', { className: 'w-full text-sm min-w-[600px]' },
                  h('thead', null, h('tr', { className: 'text-left text-[11px] uppercase tracking-wide text-slate-400' },
                    ['Date', 'Symbol', 'Side', 'Qty', 'Entry', 'Exit', 'Mult', 'P&L'].map(function (c) { return h('th', { key: c, className: 'py-1.5 pr-3 font-semibold' }, c); }))),
                  h('tbody', null, parsed.trades.slice(0, 8).map(function (t, i) {
                    var p = C.pnlOf(t);
                    return h('tr', { key: i, className: 'border-t border-slate-100 dark:border-ink-700' },
                      h('td', { className: 'py-1.5 pr-3' }, t.date), h('td', { className: 'pr-3 font-semibold' }, t.symbol),
                      h('td', { className: 'pr-3' }, h(UI.SideBadge, { side: t.side })), h('td', { className: 'pr-3' }, Fmt.num(t.quantity)),
                      h('td', { className: 'pr-3' }, Fmt.num(t.entry, 2)), h('td', { className: 'pr-3' }, Fmt.num(t.exit, 2)),
                      h('td', { className: 'pr-3 text-slate-400' }, '×' + t.multiplier),
                      h('td', { className: window.cx('pr-3 font-semibold', Fmt.signColor(p)) }, Fmt.money(p, { plus: true })));
                  })))) : null,
                n > 8 ? h('p', { className: 'text-xs text-slate-400 mt-2' }, '+ ' + (n - 8) + ' more…') : null)) : null
    );
  }

  window.Views = window.Views || {};
  window.Views.Trades = Trades;
  window.Views.TradeForm = TradeForm;
  window.Views.ImportCsv = ImportCsv;
  window.Views.ImportTradingView = ImportTradingView;
})();
