/* ============================================================
   views.js — all screens + forms (global `Views`)
   Each renderer paints into `mount` and wires its own charts.
   ============================================================ */
(function (global) {
  'use strict';
  var el = U.el, C = Store.calc;

  var COMMON_MISTAKES = ['Moved stop', 'Chased entry', 'Oversized', 'No setup (FOMO)', 'Exited early',
    'Revenge trade', 'Ignored plan', 'Held too long', 'No stop loss', 'Averaged down'];
  var EMOTIONS = ['Calm', 'Confident', 'Focused', 'Anxious', 'Greedy', 'Frustrated', 'Fearful', 'Bored'];

  var Views = { _ctx: { accountId: 'all', range: 'all' } };
  function rerender() { if (global.App && App.rerender) App.rerender(); }
  function parseNum(str) { if (str == null) return NaN; var m = String(str).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; }

  function startingBalanceFor(ctx) {
    var st = Store.getState();
    if (ctx.accountId && ctx.accountId !== 'all') {
      var a = st.accounts.find(function (x) { return x.id === ctx.accountId; });
      return a ? a.startingBalance : 0;
    }
    return st.accounts.reduce(function (sum, a) { return sum + (a.startingBalance || 0); }, 0);
  }
  function accountName(id) {
    var a = Store.getState().accounts.find(function (x) { return x.id === id; });
    return a ? a.name : '—';
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */
  var calCursor = null; // {y, m}

  function renderDashboard(mount, ctx) {
    var trades = Store.getTrades(ctx);
    var s = C.computeStats(trades);
    var startBal = startingBalanceFor(ctx);
    var dd = C.maxDrawdown(trades, startBal);

    if (!trades.length) {
      mount.appendChild(UI.emptyState('📊', 'No trades in this range yet', 'Add a trade or widen the date range to see your analytics.'));
      return;
    }

    var pfDisplay = s.profitFactor === Infinity ? '∞' : U.num(s.profitFactor, 2);
    var wlRatio = s.avgLoss ? (s.avgWin / s.avgLoss) : 0;

    // Top stat cards
    var row = el('div', { class: 'cards-row' });
    row.appendChild(UI.statCard({ label: 'Net P&L', value: U.money(s.netPnl, { showPlus: true }), cls: U.signClass(s.netPnl),
      sub: 'Gross +' + U.moneyShort(s.grossWin) + ' / -' + U.moneyShort(s.grossLoss) + ' · fees ' + U.money(s.fees) }));
    row.appendChild(UI.statCard({ label: 'Win Rate', value: U.pct(s.winRate), barPct: s.winRate, barColor: 'var(--green)',
      sub: s.wins + 'W · ' + s.losses + 'L' + (s.be ? ' · ' + s.be + ' B/E' : '') }));
    row.appendChild(UI.statCard({ label: 'Profit Factor', value: pfDisplay, cls: s.profitFactor >= 1 ? 'pos' : 'neg',
      hint: 'Gross profit ÷ gross loss', sub: 'Win/Loss size ' + U.num(wlRatio, 2) + 'x' }));
    row.appendChild(UI.statCard({ label: 'Expectancy', value: U.money(s.expectancy, { showPlus: true }) + '/trade', cls: U.signClass(s.expectancy),
      sub: (s.avgR != null ? 'Avg ' + U.num(s.avgR, 2) + 'R' : 'Add risk $ for R') + ' · ' + s.total + ' trades' }));
    mount.appendChild(row);

    // Second row: equity curve + side panel
    var grid2 = el('div', { class: 'grid', style: 'grid-template-columns: 2fr 1fr; gap:16px; margin-top:16px;' });

    var eqCard = el('div', { class: 'card' });
    eqCard.appendChild(el('div', { class: 'flex-between', html: '<p class="card__title mb-0">Equity Curve</p><span class="pill">' + accountName(ctx.accountId) + (ctx.accountId === 'all' ? '' : '') + '</span>' }));
    if (ctx.accountId === 'all') eqCard.querySelector('.pill').textContent = 'All accounts';
    var eqBox = el('div', { class: 'chart-box' });
    var eqCanvas = el('canvas');
    eqBox.appendChild(eqCanvas); eqCard.appendChild(eqBox);
    grid2.appendChild(eqCard);

    var sideCard = el('div', { class: 'card' });
    sideCard.appendChild(el('p', { class: 'card__title', text: 'Win / Loss' }));
    var dBox = el('div', { class: 'chart-box chart-box--sm' });
    var dCanvas = el('canvas');
    dBox.appendChild(dCanvas); sideCard.appendChild(dBox);
    var best = trades.reduce(function (m, t) { return C.pnlOf(t) > C.pnlOf(m) ? t : m; }, trades[0]);
    var worst = trades.reduce(function (m, t) { return C.pnlOf(t) < C.pnlOf(m) ? t : m; }, trades[0]);
    sideCard.appendChild(el('dl', { class: 'kvs mt-16', html:
      '<dt>Max drawdown</dt><dd class="neg">-' + U.money(dd.amount).slice(1) + ' (' + U.pct(dd.pct) + ')</dd>' +
      '<dt>Best trade</dt><dd class="pos">' + U.money(C.pnlOf(best), { showPlus: true }) + ' <span class="faint">' + U.esc(best.symbol) + '</span></dd>' +
      '<dt>Worst trade</dt><dd class="neg">' + U.money(C.pnlOf(worst), { showPlus: true }) + ' <span class="faint">' + U.esc(worst.symbol) + '</span></dd>' +
      '<dt>Max win streak</dt><dd>' + s.winStreak + '</dd>' +
      '<dt>Max loss streak</dt><dd>' + s.lossStreak + '</dd>'
    }));
    grid2.appendChild(sideCard);
    mount.appendChild(grid2);

    // Calendar
    mount.appendChild(renderCalendar(trades));

    // Recent trades
    var recentCard = el('div', { class: 'card mt-16' });
    recentCard.appendChild(el('div', { class: 'flex-between', html: '<p class="card__title mb-0">Recent Trades</p>' }));
    var recent = trades.slice().sort(function (a, b) { return C.tradeTimeKey(b) - C.tradeTimeKey(a); }).slice(0, 8);
    recentCard.appendChild(tradesTable(recent, { compact: true }));
    mount.appendChild(recentCard);

    // charts
    var eq = C.equityCurve(trades, startBal);
    var labels = eq.map(function (p, i) { return i === 0 ? 'Start' : U.fmtDateShort(trades[i - 1].date); });
    Charts.line(eqCanvas, { labels: labels, data: eq.map(function (p) { return p.value; }) });
    Charts.doughnut(dCanvas, { labels: ['Wins', 'Losses', 'Break-even'], data: [s.wins, s.losses, s.be], colors: ['#16c784', '#ea3943', '#3a3a4a'] });
  }

  function renderCalendar(trades) {
    var daily = C.dailyPnl(trades);
    var keys = Object.keys(daily).sort();
    if (!calCursor) {
      var last = keys.length ? keys[keys.length - 1] : U.todayISO();
      var ld = new Date(last + 'T00:00:00');
      calCursor = { y: ld.getFullYear(), m: ld.getMonth() };
    }
    var card = el('div', { class: 'card mt-16' });
    var monthName = new Date(calCursor.y, calCursor.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // month total
    var monthTotal = 0, monthDays = 0;
    Object.keys(daily).forEach(function (d) {
      var dt = new Date(d + 'T00:00:00');
      if (dt.getFullYear() === calCursor.y && dt.getMonth() === calCursor.m) { monthTotal += daily[d].pnl; monthDays++; }
    });

    var head = el('div', { class: 'flex-between', style: 'margin-bottom:14px' });
    head.appendChild(el('p', { class: 'card__title mb-0', text: 'Daily P&L Calendar' }));
    var nav = el('div', { class: 'flex gap-8', style: 'align-items:center' });
    nav.appendChild(el('span', { class: monthTotal >= 0 ? 'pos' : 'neg', style: 'font-weight:700;margin-right:8px',
      text: U.money(monthTotal, { showPlus: true }) + ' · ' + monthDays + ' days' }));
    nav.appendChild(el('button', { class: 'btn btn--ghost btn--sm', text: '‹', onclick: function () { stepMonth(-1); } }));
    nav.appendChild(el('span', { class: 'pill', text: monthName }));
    nav.appendChild(el('button', { class: 'btn btn--ghost btn--sm', text: '›', onclick: function () { stepMonth(1); } }));
    head.appendChild(nav);
    card.appendChild(head);

    var cal = el('div', { class: 'cal' });
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(function (d) { cal.appendChild(el('div', { class: 'cal__dow', text: d })); });

    var first = new Date(calCursor.y, calCursor.m, 1);
    var startDow = first.getDay();
    var daysInMonth = new Date(calCursor.y, calCursor.m + 1, 0).getDate();
    for (var i = 0; i < startDow; i++) cal.appendChild(el('div', { class: 'cal__cell cal__cell--empty' }));
    for (var day = 1; day <= daysInMonth; day++) {
      var iso = calCursor.y + '-' + String(calCursor.m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      var info = daily[iso];
      var cls = 'cal__cell';
      if (info) cls += info.pnl >= 0 ? ' cal__cell--win' : ' cal__cell--loss';
      var cell = el('div', { class: cls });
      cell.appendChild(el('div', { class: 'cal__date', text: String(day) }));
      if (info) {
        cell.appendChild(el('div', { class: 'cal__pnl ' + (info.pnl >= 0 ? 'pos' : 'neg'), text: U.moneyShort(info.pnl) }));
        cell.appendChild(el('div', { class: 'cal__count', text: info.count + ' trade' + (info.count > 1 ? 's' : '') }));
      }
      cal.appendChild(cell);
    }
    card.appendChild(cal);
    return card;
  }
  function stepMonth(dir) {
    calCursor.m += dir;
    if (calCursor.m < 0) { calCursor.m = 11; calCursor.y--; }
    if (calCursor.m > 11) { calCursor.m = 0; calCursor.y++; }
    rerender();
  }

  /* ============================================================
     TRADES
     ============================================================ */
  var tradeSort = { key: 'date', dir: -1 };
  var tradeSearch = '';
  var tradeFilter = 'all';

  function tradesTable(list, opts) {
    opts = opts || {};
    var wrap = el('div', { class: 'table-wrap' });
    var t = el('table', { class: 'tbl' });
    var cols = ['Date', 'Symbol', 'Side', 'Setup', 'P&L', 'R', 'Result'];
    if (!opts.compact) cols = ['Date', 'Symbol', 'Side', 'Setup', 'Entry', 'Exit', 'Qty', 'P&L', 'R', 'Result', 'Mistakes', ''];
    var thead = el('thead'); var tr = el('tr');
    cols.forEach(function (c) { tr.appendChild(el('th', { text: c })); });
    thead.appendChild(tr); t.appendChild(thead);
    var tb = el('tbody');
    list.forEach(function (tr2) { tb.appendChild(tradeRow(tr2, opts)); });
    t.appendChild(tb);
    wrap.appendChild(t);
    return wrap;
  }

  function tradeRow(t, opts) {
    var p = C.pnlOf(t), r = C.rOf(t), res = C.resultOf(t);
    var row = el('tr');
    var cells = [];
    cells.push('<td>' + U.fmtDateShort(t.date) + ' <span class="faint">' + U.esc(t.time || '') + '</span></td>');
    cells.push('<td><strong>' + U.esc(t.symbol) + '</strong></td>');
    cells.push('<td>' + UI.sideBadge(t.side) + '</td>');
    cells.push('<td class="muted">' + U.esc(t.setup || '—') + '</td>');
    if (!opts.compact) {
      cells.push('<td class="num">' + U.num(t.entry, 2) + '</td>');
      cells.push('<td class="num">' + U.num(t.exit, 2) + '</td>');
      cells.push('<td class="num">' + U.num(t.quantity) + '</td>');
    }
    cells.push('<td class="num ' + U.signClass(p) + '"><strong>' + U.money(p, { showPlus: true }) + '</strong></td>');
    cells.push('<td class="num ' + (r == null ? 'faint' : U.signClass(r)) + '">' + (r == null ? '—' : U.num(r, 2) + 'R') + '</td>');
    cells.push('<td>' + UI.resultBadge(res) + '</td>');
    if (!opts.compact) {
      var mk = (t.mistakes || []).map(function (m) { return '<span class="tag-chip tag-chip--mistake">' + U.esc(m) + '</span>'; }).join('') || '<span class="faint">—</span>';
      cells.push('<td>' + mk + '</td>');
      cells.push('<td></td>');
    }
    row.innerHTML = cells.join('');
    if (!opts.compact) {
      var actc = row.lastChild;
      var actions = el('div', { class: 'row-actions' });
      actions.appendChild(el('button', { class: 'link-btn', text: 'Edit', onclick: function (e) { e.stopPropagation(); openTradeForm(t); } }));
      actions.appendChild(el('button', { class: 'link-btn link-btn--danger', text: 'Delete', onclick: function (e) { e.stopPropagation(); deleteTrade(t); } }));
      actc.appendChild(actions);
    }
    row.style.cursor = 'pointer';
    row.addEventListener('click', function () { openTradeForm(t); });
    return row;
  }

  function renderTrades(mount, ctx) {
    var head = el('div', { class: 'section-head', html: '<div><h2>Trade Log</h2><p class="section-sub">Every fill, with P&L, R-multiple, setup and mistakes.</p></div>' });
    head.appendChild(el('button', { class: 'btn btn--primary', text: '+ Add Trade', onclick: function () { openTradeForm(); } }));
    mount.appendChild(head);

    var toolbar = el('div', { class: 'toolbar' });
    var search = el('input', { class: 'search', placeholder: '🔎 Search symbol, setup, notes…', value: tradeSearch });
    var filterSel = el('select', { class: 'select' });
    [['all', 'All results'], ['win', 'Winners'], ['loss', 'Losers'], ['be', 'Break-even']].forEach(function (o) {
      filterSel.appendChild(el('option', { value: o[0], text: o[1], selected: tradeFilter === o[0] ? 'selected' : null }));
    });
    var summary = el('span', { class: 'pill', style: 'margin-left:auto' });
    toolbar.appendChild(search); toolbar.appendChild(filterSel); toolbar.appendChild(summary);
    mount.appendChild(toolbar);

    var tableHolder = el('div');
    mount.appendChild(tableHolder);

    function build() {
      var all = Store.getTrades(ctx);
      var q = tradeSearch.trim().toLowerCase();
      var list = all.filter(function (t) {
        if (tradeFilter !== 'all' && C.resultOf(t) !== tradeFilter) return false;
        if (!q) return true;
        return (t.symbol + ' ' + (t.setup || '') + ' ' + (t.notes || '') + ' ' + (t.mistakes || []).join(' ')).toLowerCase().indexOf(q) >= 0;
      });
      list.sort(function (a, b) {
        var k = tradeSort.key, va, vb;
        if (k === 'date') { va = C.tradeTimeKey(a); vb = C.tradeTimeKey(b); }
        else if (k === 'pnl') { va = C.pnlOf(a); vb = C.pnlOf(b); }
        else if (k === 'r') { va = C.rOf(a) || 0; vb = C.rOf(b) || 0; }
        else if (k === 'symbol') { va = a.symbol; vb = b.symbol; }
        else { va = a[k]; vb = b[k]; }
        if (va < vb) return -1 * tradeSort.dir;
        if (va > vb) return 1 * tradeSort.dir;
        return 0;
      });
      var s = C.computeStats(list);
      summary.textContent = list.length + ' trades · ' + U.money(s.netPnl, { showPlus: true }) + ' · ' + U.pct(s.winRate) + ' win';
      tableHolder.innerHTML = '';
      if (!list.length) { tableHolder.appendChild(UI.emptyState('🔍', 'No trades match', 'Try clearing the search or filter.')); return; }
      var tbl = tradesTable(list, { compact: false });
      // wire sortable headers
      var ths = tbl.querySelectorAll('th');
      var map = { 'Date': 'date', 'Symbol': 'symbol', 'P&L': 'pnl', 'R': 'r' };
      ths.forEach(function (th) {
        var key = map[th.textContent];
        if (!key) return;
        th.addEventListener('click', function () {
          if (tradeSort.key === key) tradeSort.dir *= -1; else { tradeSort.key = key; tradeSort.dir = key === 'symbol' ? 1 : -1; }
          build();
        });
        if (tradeSort.key === key) th.textContent = th.textContent + (tradeSort.dir === 1 ? ' ▲' : ' ▼');
      });
      tableHolder.appendChild(tbl);
    }

    search.addEventListener('input', function () { tradeSearch = search.value; build(); });
    filterSel.addEventListener('change', function () { tradeFilter = filterSel.value; build(); });
    build();
  }

  function deleteTrade(t) {
    UI.confirm({ title: 'Delete trade?', message: t.symbol + ' on ' + U.fmtDate(t.date) + ' — this cannot be undone.', danger: true, okText: 'Delete',
      onConfirm: function () { Store.remove('trades', t.id); UI.toast('Trade deleted', 'ok'); rerender(); } });
  }

  /* ---------- Trade form ---------- */
  function mistakeSelector(initial) {
    var selected = (initial || []).slice();
    var wrap = el('div');
    var chips = el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px' });
    function paint() {
      chips.innerHTML = '';
      var pool = COMMON_MISTAKES.slice();
      selected.forEach(function (m) { if (pool.indexOf(m) < 0) pool.push(m); });
      pool.forEach(function (m) {
        var on = selected.indexOf(m) >= 0;
        chips.appendChild(el('button', { type: 'button', class: 'tag-chip' + (on ? ' tag-chip--mistake' : ''),
          style: 'cursor:pointer;border:1px solid ' + (on ? 'rgba(234,57,67,.3)' : 'var(--border)'), text: (on ? '✓ ' : '') + m,
          onclick: function () { var i = selected.indexOf(m); if (i >= 0) selected.splice(i, 1); else selected.push(m); paint(); } }));
      });
    }
    var addRow = el('div', { class: 'field-inline' });
    var inp = el('input', { class: 'search', placeholder: 'Add custom mistake…', style: 'flex:1' });
    var addBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Add', onclick: function () {
      var v = inp.value.trim(); if (v && selected.indexOf(v) < 0) { selected.push(v); inp.value = ''; paint(); }
    } });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });
    addRow.appendChild(inp); addRow.appendChild(addBtn);
    wrap.appendChild(chips); wrap.appendChild(addRow);
    paint();
    return { node: wrap, get: function () { return selected.slice(); } };
  }

  function openTradeForm(trade) {
    var st = Store.getState();
    var isEdit = !!trade;
    trade = trade || {};
    var form = el('div');

    var accOpts = st.accounts.map(function (a) { return '<option value="' + a.id + '"' + (trade.accountId === a.id ? ' selected' : '') + '>' + U.esc(a.name) + '</option>'; }).join('');
    var pbOpts = ['<option value="">— none —</option>'].concat(st.playbooks.map(function (p) {
      return '<option value="' + U.esc(p.name) + '"' + (trade.setup === p.name ? ' selected' : '') + '>' + U.esc(p.name) + '</option>';
    })).join('');
    var emoOpts = ['<option value="">—</option>'].concat(EMOTIONS.map(function (e2) {
      return '<option' + (trade.emotion === e2 ? ' selected' : '') + '>' + e2 + '</option>';
    })).join('');
    var ratingOpts = [1, 2, 3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (Number(trade.rating) === n ? ' selected' : '') + '>' + '★'.repeat(n) + '</option>'; }).join('');

    var grid = el('div', { class: 'form-grid', html:
      '<div class="field"><label>Account</label><select id="f_acc">' + accOpts + '</select></div>' +
      '<div class="field"><label>Symbol</label><input id="f_sym" placeholder="e.g. NQ, AAPL" value="' + U.esc(trade.symbol || '') + '"></div>' +
      '<div class="field"><label>Date</label><input id="f_date" type="date" value="' + U.esc(trade.date || U.todayISO()) + '"></div>' +
      '<div class="field"><label>Time</label><input id="f_time" type="time" value="' + U.esc(trade.time || '09:30') + '"></div>' +
      '<div class="field"><label>Direction</label><select id="f_side"><option value="long"' + (trade.side !== 'short' ? ' selected' : '') + '>▲ Long</option><option value="short"' + (trade.side === 'short' ? ' selected' : '') + '>▼ Short</option></select></div>' +
      '<div class="field"><label>Quantity / Contracts</label><input id="f_qty" type="number" step="any" value="' + (trade.quantity != null ? trade.quantity : '') + '"></div>' +
      '<div class="field"><label>Entry price</label><input id="f_entry" type="number" step="any" value="' + (trade.entry != null ? trade.entry : '') + '"></div>' +
      '<div class="field"><label>Exit price</label><input id="f_exit" type="number" step="any" value="' + (trade.exit != null ? trade.exit : '') + '"></div>' +
      '<div class="field"><label>Fees / commission</label><input id="f_fees" type="number" step="any" value="' + (trade.fees != null ? trade.fees : 0) + '"></div>' +
      '<div class="field"><label>Risk amount ($) <span class="hint">for R-multiple</span></label><input id="f_risk" type="number" step="any" value="' + (trade.riskAmount != null ? trade.riskAmount : '') + '"></div>' +
      '<div class="field"><label>Playbook / Setup</label><select id="f_setup">' + pbOpts + '</select></div>' +
      '<div class="field"><label>Emotion</label><select id="f_emo">' + emoOpts + '</select></div>' +
      '<div class="field"><label>Execution rating</label><select id="f_rating"><option value="">—</option>' + ratingOpts + '</select></div>' +
      '<div class="field"><label>Live P&L preview</label><input id="f_pnl" disabled value="—" style="font-weight:700"></div>'
    });
    form.appendChild(grid);

    var mistakeField = el('div', { class: 'field field--full', style: 'margin-top:14px' });
    mistakeField.appendChild(el('label', { text: 'Mistakes / rule breaks' }));
    var ms = mistakeSelector(trade.mistakes || []);
    mistakeField.appendChild(ms.node);
    form.appendChild(mistakeField);

    var notesField = el('div', { class: 'field field--full', style: 'margin-top:14px',
      html: '<label>Notes</label><textarea id="f_notes" placeholder="What was the thesis? What happened?">' + U.esc(trade.notes || '') + '</textarea>' });
    form.appendChild(notesField);

    function recalcPreview() {
      var v = collect(false);
      if (v && isFinite(v.entry) && isFinite(v.exit) && isFinite(v.quantity)) {
        var p = C.pnlOf(v);
        var inp = form.querySelector('#f_pnl');
        inp.value = U.money(p, { showPlus: true });
        inp.style.color = p > 0 ? 'var(--green)' : p < 0 ? 'var(--red)' : 'var(--text)';
      }
    }
    ['#f_entry', '#f_exit', '#f_qty', '#f_fees', '#f_side'].forEach(function (sel) {
      form.querySelector(sel).addEventListener('input', recalcPreview);
      form.querySelector(sel).addEventListener('change', recalcPreview);
    });

    function collect(strict) {
      var g = function (id) { return form.querySelector(id); };
      var obj = {
        accountId: g('#f_acc').value,
        symbol: g('#f_sym').value.trim().toUpperCase(),
        date: g('#f_date').value,
        time: g('#f_time').value,
        side: g('#f_side').value,
        quantity: parseFloat(g('#f_qty').value),
        entry: parseFloat(g('#f_entry').value),
        exit: parseFloat(g('#f_exit').value),
        fees: parseFloat(g('#f_fees').value) || 0,
        riskAmount: g('#f_risk').value === '' ? null : parseFloat(g('#f_risk').value),
        setup: g('#f_setup').value,
        emotion: g('#f_emo').value,
        rating: g('#f_rating').value ? parseInt(g('#f_rating').value, 10) : null,
        mistakes: ms.get(),
        notes: g('#f_notes').value.trim()
      };
      if (strict) {
        if (!obj.symbol) { UI.toast('Symbol is required', 'err'); return null; }
        if (!isFinite(obj.entry) || !isFinite(obj.exit) || !isFinite(obj.quantity)) { UI.toast('Entry, exit and quantity are required', 'err'); return null; }
      }
      return obj;
    }

    var m = UI.modal({
      title: isEdit ? 'Edit Trade' : 'Add Trade', wide: true, body: form,
      footer: [
        el('button', { class: 'btn btn--ghost', text: 'Cancel', onclick: function () { m.close(); } }),
        el('button', { class: 'btn btn--primary', text: isEdit ? 'Save changes' : 'Add trade', onclick: function () {
          var v = collect(true); if (!v) return;
          if (isEdit) { Store.update('trades', trade.id, v); UI.toast('Trade updated', 'ok'); }
          else { Store.add('trades', v); UI.toast('Trade added', 'ok'); }
          m.close(); rerender();
        } })
      ]
    });
    recalcPreview();
  }

  /* ============================================================
     PLANNING
     ============================================================ */
  function renderPlanning(mount, ctx) {
    var st = Store.getState();
    var plans = st.plans.filter(function (p) { return ctx.accountId === 'all' || p.accountId === ctx.accountId; });

    var head = el('div', { class: 'section-head', html: '<div><h2>Trade Planning</h2><p class="section-sub">Define your idea, risk and rules <strong>before</strong> you click buy. Then grade yourself.</p></div>' });
    head.appendChild(el('button', { class: 'btn btn--primary', text: '+ New Plan', onclick: function () { openPlanForm(); } }));
    mount.appendChild(head);

    if (!plans.length) { mount.appendChild(UI.emptyState('◎', 'No trade plans yet', 'Plan your next setup so you trade the plan, not the emotion.')); return; }

    var order = { planned: 0, executed: 1, skipped: 2 };
    plans.sort(function (a, b) { return (order[a.status] - order[b.status]) || (new Date(b.createdAt) - new Date(a.createdAt)); });

    var grid = el('div', { class: 'cards-row--2 grid' });
    plans.forEach(function (p) { grid.appendChild(planCard(p)); });
    mount.appendChild(grid);
  }

  function planCard(p) {
    var entry = parseNum(p.entryZone), stop = parseNum(p.stop), target = parseNum(p.target);
    var rr = (isFinite(entry) && isFinite(stop) && isFinite(target) && Math.abs(entry - stop) > 0)
      ? Math.abs(target - entry) / Math.abs(entry - stop) : null;
    var done = (p.rules || []).filter(function (r) { return r.checked; }).length;
    var total = (p.rules || []).length;
    var statusBadge = p.status === 'executed' ? '<span class="badge badge--win">Executed</span>'
      : p.status === 'skipped' ? '<span class="badge badge--neutral">Skipped</span>'
      : '<span class="badge badge--violet">Planned</span>';

    var card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'flex-between', html:
      '<div><span style="font-size:18px;font-weight:700">' + U.esc(p.symbol) + '</span> ' +
      (p.bias === 'short' ? UI.sideBadge('short') : UI.sideBadge('long')) + '</div>' + statusBadge }));
    if (p.playbook) card.appendChild(el('div', { class: 'muted', style: 'font-size:12px;margin-top:2px', text: '📘 ' + p.playbook }));

    card.appendChild(el('dl', { class: 'kvs mt-16', html:
      '<dt>Entry</dt><dd>' + U.esc(p.entryZone || '—') + '</dd>' +
      '<dt>Stop</dt><dd class="neg">' + U.esc(p.stop || '—') + '</dd>' +
      '<dt>Target</dt><dd class="pos">' + U.esc(p.target || '—') + '</dd>' +
      '<dt>Size</dt><dd>' + U.esc(p.size || '—') + '</dd>' +
      '<dt>Reward : Risk</dt><dd class="' + (rr && rr >= 1 ? 'pos' : 'muted') + '">' + (rr ? U.num(rr, 2) + ' : 1' : '—') + '</dd>'
    }));

    if (total) {
      card.appendChild(el('div', { class: 'mt-16', html: '<div class="flex-between" style="font-size:12px;margin-bottom:6px"><span class="faint">Checklist</span><span class="faint">' + done + '/' + total + '</span></div><div class="progress"><span style="width:' + (total ? (done / total * 100) : 0) + '%"></span></div>' }));
      var checks = el('div', { class: 'checks mt-8' });
      (p.rules || []).forEach(function (r, idx) {
        var lbl = el('label', { class: 'check' + (r.checked ? ' check--done' : '') });
        var cb = el('input', { type: 'checkbox' }); cb.checked = !!r.checked;
        cb.addEventListener('change', function () {
          p.rules[idx].checked = cb.checked;
          Store.update('plans', p.id, { rules: p.rules });
          rerender();
        });
        lbl.appendChild(cb); lbl.appendChild(el('span', { text: r.text }));
        checks.appendChild(lbl);
      });
      card.appendChild(checks);
    }

    if (p.rationale) card.appendChild(el('p', { class: 'muted mt-16', style: 'font-size:13px', text: '“' + p.rationale + '”' }));

    var actions = el('div', { class: 'flex gap-8 mt-16', style: 'flex-wrap:wrap' });
    if (p.status === 'planned') {
      actions.appendChild(el('button', { class: 'btn btn--primary btn--sm', text: '↳ Log as trade', onclick: function () { planToTrade(p); } }));
      actions.appendChild(el('button', { class: 'btn btn--ghost btn--sm', text: 'Mark skipped', onclick: function () { Store.update('plans', p.id, { status: 'skipped' }); UI.toast('Plan skipped', 'ok'); rerender(); } }));
    }
    actions.appendChild(el('button', { class: 'btn btn--ghost btn--sm', text: 'Edit', onclick: function () { openPlanForm(p); } }));
    actions.appendChild(el('button', { class: 'btn btn--danger-ghost btn--sm', text: 'Delete', onclick: function () {
      UI.confirm({ title: 'Delete plan?', message: p.symbol + ' plan will be removed.', danger: true, okText: 'Delete', onConfirm: function () { Store.remove('plans', p.id); rerender(); } });
    } }));
    card.appendChild(actions);
    return card;
  }

  function planToTrade(p) {
    openTradeForm({
      accountId: p.accountId, symbol: p.symbol, side: p.bias === 'short' ? 'short' : 'long',
      setup: p.playbook || '', entry: parseNum(p.entryZone) || undefined, exit: parseNum(p.target) || undefined
    });
    Store.update('plans', p.id, { status: 'executed' });
  }

  function openPlanForm(plan) {
    var st = Store.getState();
    var isEdit = !!plan; plan = plan || {};
    var rules = (plan.rules || []).slice();
    var form = el('div');
    var accOpts = st.accounts.map(function (a) { return '<option value="' + a.id + '"' + (plan.accountId === a.id ? ' selected' : '') + '>' + U.esc(a.name) + '</option>'; }).join('');
    var pbOpts = ['<option value="">— none —</option>'].concat(st.playbooks.map(function (pb) {
      return '<option value="' + U.esc(pb.name) + '"' + (plan.playbook === pb.name ? ' selected' : '') + '>' + U.esc(pb.name) + '</option>';
    })).join('');

    form.appendChild(el('div', { class: 'form-grid', html:
      '<div class="field"><label>Account</label><select id="p_acc">' + accOpts + '</select></div>' +
      '<div class="field"><label>Symbol</label><input id="p_sym" value="' + U.esc(plan.symbol || '') + '" placeholder="e.g. NQ"></div>' +
      '<div class="field"><label>Bias</label><select id="p_bias"><option value="long"' + (plan.bias !== 'short' ? ' selected' : '') + '>▲ Long</option><option value="short"' + (plan.bias === 'short' ? ' selected' : '') + '>▼ Short</option></select></div>' +
      '<div class="field"><label>Playbook</label><select id="p_pb">' + pbOpts + '</select></div>' +
      '<div class="field"><label>Entry zone</label><input id="p_entry" value="' + U.esc(plan.entryZone || '') + '" placeholder="e.g. 18,520 - 18,540"></div>' +
      '<div class="field"><label>Stop</label><input id="p_stop" value="' + U.esc(plan.stop || '') + '" placeholder="e.g. 18,470"></div>' +
      '<div class="field"><label>Target</label><input id="p_target" value="' + U.esc(plan.target || '') + '" placeholder="e.g. 18,640"></div>' +
      '<div class="field"><label>Position size</label><input id="p_size" value="' + U.esc(plan.size || '') + '" placeholder="e.g. 2 contracts"></div>'
    }));

    var rationale = el('div', { class: 'field field--full', style: 'margin-top:14px', html: '<label>Rationale / thesis</label><textarea id="p_rationale" placeholder="Why this trade? What is your edge?">' + U.esc(plan.rationale || '') + '</textarea>' });
    form.appendChild(rationale);

    var rulesField = el('div', { class: 'field field--full', style: 'margin-top:14px' });
    rulesField.appendChild(el('label', { text: 'Pre-trade checklist' }));
    var rulesList = el('div', { class: 'checks' });
    function paintRules() {
      rulesList.innerHTML = '';
      rules.forEach(function (r, i) {
        var rowEl = el('div', { class: 'field-inline', style: 'align-items:center' });
        var inp = el('input', { class: 'search', style: 'flex:1', value: r.text, placeholder: 'Rule…' });
        inp.addEventListener('input', function () { rules[i].text = inp.value; });
        rowEl.appendChild(inp);
        rowEl.appendChild(el('button', { type: 'button', class: 'btn btn--danger-ghost btn--sm', text: '✕', onclick: function () { rules.splice(i, 1); paintRules(); } }));
        rulesList.appendChild(rowEl);
      });
    }
    rulesField.appendChild(rulesList);
    rulesField.appendChild(el('button', { type: 'button', class: 'btn btn--ghost btn--sm mt-8', text: '+ Add rule', onclick: function () { rules.push({ text: '', checked: false }); paintRules(); } }));
    form.appendChild(rulesField);
    paintRules();

    var m = UI.modal({
      title: isEdit ? 'Edit Plan' : 'New Trade Plan', wide: true, body: form,
      footer: [
        el('button', { class: 'btn btn--ghost', text: 'Cancel', onclick: function () { m.close(); } }),
        el('button', { class: 'btn btn--primary', text: isEdit ? 'Save plan' : 'Create plan', onclick: function () {
          var g = function (id) { return form.querySelector(id); };
          var sym = g('#p_sym').value.trim().toUpperCase();
          if (!sym) { UI.toast('Symbol is required', 'err'); return; }
          var obj = {
            accountId: g('#p_acc').value, symbol: sym, bias: g('#p_bias').value,
            playbook: g('#p_pb').value, entryZone: g('#p_entry').value.trim(), stop: g('#p_stop').value.trim(),
            target: g('#p_target').value.trim(), size: g('#p_size').value.trim(),
            rationale: g('#p_rationale').value.trim(),
            rules: rules.filter(function (r) { return r.text.trim(); }).map(function (r) { return { text: r.text.trim(), checked: !!r.checked }; })
          };
          if (isEdit) { Store.update('plans', plan.id, obj); UI.toast('Plan updated', 'ok'); }
          else { obj.createdAt = U.todayISO(); obj.status = 'planned'; Store.add('plans', obj); UI.toast('Plan created', 'ok'); }
          m.close(); rerender();
        } })
      ]
    });
  }

  /* ============================================================
     PLAYBOOKS
     ============================================================ */
  function renderPlaybooks(mount, ctx) {
    var st = Store.getState();
    var head = el('div', { class: 'section-head', html: '<div><h2>Playbooks</h2><p class="section-sub">Your strategies and their rules. See which ones actually make money.</p></div>' });
    head.appendChild(el('button', { class: 'btn btn--primary', text: '+ New Playbook', onclick: function () { openPlaybookForm(); } }));
    mount.appendChild(head);

    if (!st.playbooks.length) { mount.appendChild(UI.emptyState('📘', 'No playbooks yet', 'Create a strategy and define the rules that give you an edge.')); return; }

    var allTrades = Store.getTrades(ctx);
    var grid = el('div', { class: 'cards-row--2 grid' });
    st.playbooks.forEach(function (pb) {
      var trades = allTrades.filter(function (t) { return t.setup === pb.name; });
      var s = C.computeStats(trades);
      var pf = s.profitFactor === Infinity ? '∞' : U.num(s.profitFactor, 2);
      var card = el('div', { class: 'card' });
      card.appendChild(el('div', { class: 'flex-between', html:
        '<div><span style="font-size:17px;font-weight:700">' + U.esc(pb.name) + '</span> <span class="badge badge--violet">' + U.esc(pb.market || 'Any') + '</span></div>' }));
      if (pb.description) card.appendChild(el('p', { class: 'muted', style: 'font-size:13px;margin:8px 0 0', text: pb.description }));

      var statRow = el('div', { class: 'cards-row', style: 'grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px' });
      statRow.appendChild(miniStat('Net P&L', U.moneyShort(s.netPnl), U.signClass(s.netPnl)));
      statRow.appendChild(miniStat('Win rate', s.total ? U.pct(s.winRate) : '—'));
      statRow.appendChild(miniStat('Profit factor', s.total ? pf : '—'));
      statRow.appendChild(miniStat('Trades', String(s.total)));
      card.appendChild(statRow);

      if ((pb.rules || []).length) {
        var rl = el('ul', { class: 'list-clean mt-16', style: 'font-size:13px' });
        pb.rules.forEach(function (r) { rl.appendChild(el('li', { style: 'padding:3px 0;color:var(--text-dim)', html: '<span style="color:var(--violet)">✓</span> ' + U.esc(r) })); });
        card.appendChild(rl);
      }

      var actions = el('div', { class: 'flex gap-8 mt-16' });
      actions.appendChild(el('button', { class: 'btn btn--ghost btn--sm', text: 'Edit', onclick: function () { openPlaybookForm(pb); } }));
      actions.appendChild(el('button', { class: 'btn btn--danger-ghost btn--sm', text: 'Delete', onclick: function () {
        UI.confirm({ title: 'Delete playbook?', message: '“' + pb.name + '” will be removed. Trades keep their setup label.', danger: true, okText: 'Delete', onConfirm: function () { Store.remove('playbooks', pb.id); rerender(); } });
      } }));
      card.appendChild(actions);
      grid.appendChild(card);
    });
    mount.appendChild(grid);
  }

  function miniStat(label, value, cls) {
    return el('div', { class: 'card card--pad-sm', style: 'padding:10px', html:
      '<div class="stat__label" style="font-size:10px">' + U.esc(label) + '</div><div style="font-size:16px;font-weight:700" class="' + (cls || '') + '">' + value + '</div>' });
  }

  function openPlaybookForm(pb) {
    var isEdit = !!pb; pb = pb || {};
    var rules = (pb.rules || []).slice();
    var form = el('div');
    form.appendChild(el('div', { class: 'form-grid', html:
      '<div class="field"><label>Name</label><input id="pb_name" value="' + U.esc(pb.name || '') + '" placeholder="e.g. VWAP Reclaim"></div>' +
      '<div class="field"><label>Market</label><input id="pb_market" value="' + U.esc(pb.market || '') + '" placeholder="e.g. Futures, Stocks, FX"></div>'
    }));
    form.appendChild(el('div', { class: 'field field--full', style: 'margin-top:14px', html: '<label>Description</label><textarea id="pb_desc" placeholder="What is the edge / when do you take it?">' + U.esc(pb.description || '') + '</textarea>' }));

    var rulesField = el('div', { class: 'field field--full', style: 'margin-top:14px' });
    rulesField.appendChild(el('label', { text: 'Rules' }));
    var rulesList = el('div', { class: 'checks' });
    function paint() {
      rulesList.innerHTML = '';
      rules.forEach(function (r, i) {
        var rowEl = el('div', { class: 'field-inline', style: 'align-items:center' });
        var inp = el('input', { class: 'search', style: 'flex:1', value: r, placeholder: 'Rule…' });
        inp.addEventListener('input', function () { rules[i] = inp.value; });
        rowEl.appendChild(inp);
        rowEl.appendChild(el('button', { type: 'button', class: 'btn btn--danger-ghost btn--sm', text: '✕', onclick: function () { rules.splice(i, 1); paint(); } }));
        rulesList.appendChild(rowEl);
      });
    }
    rulesField.appendChild(rulesList);
    rulesField.appendChild(el('button', { type: 'button', class: 'btn btn--ghost btn--sm mt-8', text: '+ Add rule', onclick: function () { rules.push(''); paint(); } }));
    form.appendChild(rulesField);
    paint();

    var m = UI.modal({
      title: isEdit ? 'Edit Playbook' : 'New Playbook', wide: true, body: form,
      footer: [
        el('button', { class: 'btn btn--ghost', text: 'Cancel', onclick: function () { m.close(); } }),
        el('button', { class: 'btn btn--primary', text: isEdit ? 'Save' : 'Create', onclick: function () {
          var name = form.querySelector('#pb_name').value.trim();
          if (!name) { UI.toast('Name is required', 'err'); return; }
          var obj = { name: name, market: form.querySelector('#pb_market').value.trim(), description: form.querySelector('#pb_desc').value.trim(),
            rules: rules.map(function (r) { return r.trim(); }).filter(Boolean) };
          if (isEdit) { Store.update('playbooks', pb.id, obj); UI.toast('Playbook updated', 'ok'); }
          else { Store.add('playbooks', obj); UI.toast('Playbook created', 'ok'); }
          m.close(); rerender();
        } })
      ]
    });
  }

  /* ============================================================
     REPORTS
     ============================================================ */
  function renderReports(mount, ctx) {
    var trades = Store.getTrades(ctx);
    mount.appendChild(el('div', { class: 'section-head', html: '<div><h2>Reports & Analytics</h2><p class="section-sub">Find your edges and your leaks. Where, when and what are you good at?</p></div>' }));
    if (!trades.length) { mount.appendChild(UI.emptyState('📈', 'Nothing to report yet', 'Add some trades to unlock the analytics.')); return; }

    function chartCard(title, sub) {
      var card = el('div', { class: 'card' });
      card.appendChild(el('div', { html: '<p class="card__title mb-0">' + U.esc(title) + '</p>' + (sub ? '<p class="section-sub" style="margin:2px 0 0">' + U.esc(sub) + '</p>' : '') }));
      var box = el('div', { class: 'chart-box chart-box--sm mt-16' });
      var cv = el('canvas'); box.appendChild(cv); card.appendChild(box);
      return { card: card, canvas: cv };
    }

    var grid = el('div', { class: 'cards-row--2 grid' });

    // Day of week
    var dow = C.groupSum(trades, function (t) { return new Date(t.date + 'T00:00:00').getDay(); });
    var dowMap = {}; dow.forEach(function (g) { dowMap[g.key] = g.pnl; });
    var dowOrder = [1, 2, 3, 4, 5, 0, 6];
    var c1 = chartCard('Net P&L by Day of Week', 'Which days carry your week?');
    grid.appendChild(c1.card);

    // Hour of day
    var hour = C.groupSum(trades, function (t) { return (t.time || '00:00').split(':')[0]; });
    hour.sort(function (a, b) { return parseInt(a.key) - parseInt(b.key); });
    var c2 = chartCard('Net P&L by Hour', 'Your most and least profitable times.');
    grid.appendChild(c2.card);

    // By symbol
    var sym = C.groupSum(trades, function (t) { return t.symbol; }).sort(function (a, b) { return b.pnl - a.pnl; }).slice(0, 10);
    var c3 = chartCard('Net P&L by Symbol', 'Top instruments by profit.');
    grid.appendChild(c3.card);

    // By setup
    var setup = C.groupSum(trades, function (t) { return t.setup || 'Untagged'; }).sort(function (a, b) { return b.pnl - a.pnl; });
    var c4 = chartCard('Net P&L by Playbook', 'Which strategies pay?');
    grid.appendChild(c4.card);

    // Win rate by setup
    var c5 = chartCard('Win Rate by Playbook', '% of winners per strategy.');
    grid.appendChild(c5.card);

    // Long vs short
    var c6 = chartCard('Long vs Short', 'Net P&L by direction.');
    grid.appendChild(c6.card);

    mount.appendChild(grid);

    Charts.bars(c1.canvas, { labels: dowOrder.map(function (d) { return U.dowName(d); }), data: dowOrder.map(function (d) { return dowMap[d] || 0; }) });
    Charts.bars(c2.canvas, { labels: hour.map(function (g) { return U.hourLabel(g.key); }), data: hour.map(function (g) { return g.pnl; }) });
    Charts.bars(c3.canvas, { labels: sym.map(function (g) { return g.key; }), data: sym.map(function (g) { return g.pnl; }), horizontal: true });
    Charts.bars(c4.canvas, { labels: setup.map(function (g) { return g.key; }), data: setup.map(function (g) { return g.pnl; }), horizontal: true });
    Charts.bars(c5.canvas, { labels: setup.map(function (g) { return g.key; }), data: setup.map(function (g) { return g.count ? Math.round((g.wins / (g.wins + g.losses || 1)) * 100) : 0; }), horizontal: true, fmt: 'pct', singleColor: '#7c5cff' });
    var longs = trades.filter(function (t) { return t.side !== 'short'; });
    var shorts = trades.filter(function (t) { return t.side === 'short'; });
    Charts.bars(c6.canvas, { labels: ['Long', 'Short'], data: [C.computeStats(longs).netPnl, C.computeStats(shorts).netPnl] });
  }

  /* ============================================================
     JOURNAL & COURSE CORRECTION
     ============================================================ */
  function renderJournal(mount, ctx) {
    var st = Store.getState();
    var trades = Store.getTrades(ctx);

    mount.appendChild(el('div', { class: 'section-head', html: '<div><h2>Journal & Course Correction</h2><p class="section-sub">Review what went wrong, what it cost you, and the fix.</p></div>' }));

    // ----- Course correction block -----
    var disc = C.disciplineScore(trades);
    var mistakes = C.mistakeCost(trades);

    var topGrid = el('div', { class: 'grid', style: 'grid-template-columns: 1fr 2fr; gap:16px' });

    var scoreCard = el('div', { class: 'card' });
    scoreCard.appendChild(el('p', { class: 'card__title', text: 'Discipline Score' }));
    var scoreColor = disc.score >= 80 ? 'var(--green)' : disc.score >= 60 ? 'var(--amber)' : 'var(--red)';
    scoreCard.appendChild(el('div', { class: 'score-ring', html:
      '<div class="score-ring__num" style="color:' + scoreColor + '">' + disc.score + '<span style="font-size:18px;color:var(--text-faint)">%</span></div>' +
      '<div class="muted" style="font-size:13px">' + disc.clean + ' of ' + disc.total + ' trades<br>followed the rules (no mistakes tagged)</div>' }));
    scoreCard.appendChild(el('div', { class: 'progress mt-16', html: '<span style="width:' + disc.score + '%;background:' + scoreColor + '"></span>' }));
    var mc = C.computeStats(trades);
    var cleanTrades = trades.filter(function (t) { return !(t.mistakes && t.mistakes.length); });
    var dirtyTrades = trades.filter(function (t) { return t.mistakes && t.mistakes.length; });
    scoreCard.appendChild(el('dl', { class: 'kvs mt-16', html:
      '<dt>P&L on clean trades</dt><dd class="' + U.signClass(C.computeStats(cleanTrades).netPnl) + '">' + U.money(C.computeStats(cleanTrades).netPnl, { showPlus: true }) + '</dd>' +
      '<dt>P&L on rule-breaks</dt><dd class="' + U.signClass(C.computeStats(dirtyTrades).netPnl) + '">' + U.money(C.computeStats(dirtyTrades).netPnl, { showPlus: true }) + '</dd>'
    }));
    topGrid.appendChild(scoreCard);

    var mistCard = el('div', { class: 'card' });
    mistCard.appendChild(el('p', { class: 'card__title', text: 'What Your Mistakes Cost You' }));
    if (!mistakes.length) {
      mistCard.appendChild(el('p', { class: 'muted', text: 'No mistakes tagged in this range. Tag mistakes on your trades to see their impact here.' }));
    } else {
      var box = el('div', { class: 'chart-box chart-box--sm' });
      var cv = el('canvas'); box.appendChild(cv); mistCard.appendChild(box);
      var tbl = el('table', { class: 'tbl', style: 'min-width:auto;margin-top:8px' });
      tbl.innerHTML = '<thead><tr><th>Mistake</th><th>Count</th><th>P&L impact</th></tr></thead>';
      var tb = el('tbody');
      mistakes.forEach(function (mst) {
        tb.appendChild(el('tr', { html: '<td>' + U.esc(mst.key) + '</td><td class="num">' + mst.count + '</td><td class="num ' + U.signClass(mst.pnl) + '">' + U.money(mst.pnl, { showPlus: true }) + '</td>' }));
      });
      tbl.appendChild(tb); mistCard.appendChild(tbl);
    }
    topGrid.appendChild(mistCard);
    mount.appendChild(topGrid);

    // ----- Daily journal -----
    var head2 = el('div', { class: 'section-head mt-24', html: '<div><h2 style="font-size:16px">Daily Journal</h2><p class="section-sub">Pre-market plan, post-market review and the lesson.</p></div>' });
    head2.appendChild(el('button', { class: 'btn btn--primary', text: '+ New Entry', onclick: function () { openJournalForm(); } }));
    mount.appendChild(head2);

    var entries = st.journal.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    if (!entries.length) { mount.appendChild(UI.emptyState('✎', 'No journal entries', 'Write your first daily review.')); }
    else {
      var list = el('div', { class: 'grid', style: 'gap:12px' });
      entries.forEach(function (j) { list.appendChild(journalCard(j)); });
      mount.appendChild(list);
    }

    if (mistakes.length && Charts.available()) {
      Charts.bars(mistCard.querySelector('canvas'), { labels: mistakes.map(function (m) { return m.key; }), data: mistakes.map(function (m) { return m.pnl; }), horizontal: true });
    }
  }

  function journalCard(j) {
    var card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'flex-between', html:
      '<div><strong>' + U.fmtDate(j.date) + '</strong>' + (j.mood ? ' <span class="badge badge--violet">' + U.esc(j.mood) + '</span>' : '') + '</div>' }));
    var body = el('div', { class: 'grid', style: 'grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:12px' });
    body.appendChild(jSection('Pre-market plan', j.premarket));
    body.appendChild(jSection('Review', j.review));
    body.appendChild(jSection('Lesson', j.lessons));
    card.appendChild(body);
    var actions = el('div', { class: 'flex gap-8 mt-16' });
    actions.appendChild(el('button', { class: 'btn btn--ghost btn--sm', text: 'Edit', onclick: function () { openJournalForm(j); } }));
    actions.appendChild(el('button', { class: 'btn btn--danger-ghost btn--sm', text: 'Delete', onclick: function () {
      UI.confirm({ title: 'Delete entry?', danger: true, okText: 'Delete', message: U.fmtDate(j.date) + ' entry will be removed.', onConfirm: function () { Store.remove('journal', j.id); rerender(); } });
    } }));
    card.appendChild(actions);
    return card;
  }
  function jSection(label, text) {
    return el('div', { html: '<div class="stat__label" style="font-size:10px;margin-bottom:4px">' + U.esc(label) + '</div><div style="font-size:13px;color:' + (text ? 'var(--text-dim)' : 'var(--text-faint)') + '">' + (text ? U.esc(text) : '—') + '</div>' });
  }

  function openJournalForm(j) {
    var isEdit = !!j; j = j || {};
    var moodOpts = ['<option value="">—</option>'].concat(['Focused', 'Calm', 'Confident', 'Anxious', 'Frustrated', 'Tired', 'Excited'].map(function (m) {
      return '<option' + (j.mood === m ? ' selected' : '') + '>' + m + '</option>';
    })).join('');
    var form = el('div');
    form.appendChild(el('div', { class: 'form-grid', html:
      '<div class="field"><label>Date</label><input id="j_date" type="date" value="' + U.esc(j.date || U.todayISO()) + '"></div>' +
      '<div class="field"><label>Mood</label><select id="j_mood">' + moodOpts + '</select></div>'
    }));
    form.appendChild(el('div', { class: 'field field--full', style: 'margin-top:14px', html: '<label>Pre-market plan</label><textarea id="j_pre" placeholder="Bias, levels, news, max trades/loss…">' + U.esc(j.premarket || '') + '</textarea>' }));
    form.appendChild(el('div', { class: 'field field--full', style: 'margin-top:14px', html: '<label>Post-market review</label><textarea id="j_rev" placeholder="What happened? Did you follow the plan?">' + U.esc(j.review || '') + '</textarea>' }));
    form.appendChild(el('div', { class: 'field field--full', style: 'margin-top:14px', html: '<label>Lesson / course correction</label><textarea id="j_les" placeholder="One thing to do differently next session.">' + U.esc(j.lessons || '') + '</textarea>' }));

    var m = UI.modal({
      title: isEdit ? 'Edit Journal Entry' : 'New Journal Entry', wide: true, body: form,
      footer: [
        el('button', { class: 'btn btn--ghost', text: 'Cancel', onclick: function () { m.close(); } }),
        el('button', { class: 'btn btn--primary', text: isEdit ? 'Save' : 'Add entry', onclick: function () {
          var obj = {
            date: form.querySelector('#j_date').value, mood: form.querySelector('#j_mood').value,
            premarket: form.querySelector('#j_pre').value.trim(), review: form.querySelector('#j_rev').value.trim(), lessons: form.querySelector('#j_les').value.trim()
          };
          if (isEdit) { Store.update('journal', j.id, obj); UI.toast('Entry updated', 'ok'); }
          else { Store.add('journal', obj); UI.toast('Entry added', 'ok'); }
          m.close(); rerender();
        } })
      ]
    });
  }

  /* ============================================================
     Dispatcher
     ============================================================ */
  var routes = {
    dashboard: renderDashboard, trades: renderTrades, planning: renderPlanning,
    playbooks: renderPlaybooks, reports: renderReports, journal: renderJournal
  };

  Views.render = function (route, mount, ctx) {
    Views._ctx = ctx;
    mount.innerHTML = '';
    (routes[route] || renderDashboard)(mount, ctx);
  };
  Views.openTradeForm = openTradeForm;

  global.Views = Views;
})(window);
