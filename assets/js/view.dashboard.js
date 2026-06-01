/* ============================================================
   view.dashboard.js — polished Dashboard (Views.Dashboard)
   TradeZella-style layout with Open Positions panel
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, C = window.Store.calc;
  var useState = React.useState, useMemo = React.useMemo;

  function startBal(state, ctx) {
    if (ctx.accountId && ctx.accountId !== 'all') {
      var a = state.accounts.find(function (x) { return x.id === ctx.accountId; });
      return a ? a.startingBalance : 0;
    }
    return state.accounts.reduce(function (s, a) { return s + (a.startingBalance || 0); }, 0);
  }

  function pnlCls(n) { return n > 0 ? 'pnl-pos' : n < 0 ? 'pnl-neg' : 'pnl-zero'; }

  /* ---- Gauge (semicircle) drawn with SVG — no Chart.js needed ---- */
  function SvgGauge(props) {
    var pct = Math.max(0, Math.min(100, props.value || 0));
    var r = 36, cx2 = 44, cy2 = 44;
    var circ = Math.PI * r;
    var filled = (pct / 100) * circ;
    var color = props.color || '#7c5cff';
    return h('svg', { width: 88, height: 48, viewBox: '0 0 88 48' },
      h('path', { d: 'M8 44 A36 36 0 0 1 80 44', fill: 'none', stroke: '#e8eaef', strokeWidth: 8, strokeLinecap: 'round', className: 'dark:hidden' }),
      h('path', { d: 'M8 44 A36 36 0 0 1 80 44', fill: 'none', stroke: '#1e1e2d', strokeWidth: 8, strokeLinecap: 'round', className: 'hidden dark:block' }),
      h('path', { d: 'M8 44 A36 36 0 0 1 80 44', fill: 'none', stroke: color, strokeWidth: 8, strokeLinecap: 'round',
        strokeDasharray: filled + ' ' + circ, style: { transition: 'stroke-dasharray .5s ease' } }));
  }

  /* ---- Win/Loss arc gauge ---- */
  function WinLossGauge(props) {
    var wins = props.wins || 0, losses = props.losses || 0, be = props.be || 0;
    var total = wins + losses + be || 1;
    var r = 36; var circ = Math.PI * r;
    var wPct = wins / total, lPct = losses / total;
    var wFill = wPct * circ, lFill = lPct * circ;
    return h('svg', { width: 88, height: 52, viewBox: '0 0 88 52' },
      h('path', { d: 'M8 44 A36 36 0 0 1 80 44', fill: 'none', stroke: '#e8eaef', strokeWidth: 8, strokeLinecap: 'butt', className: 'dark:hidden' }),
      h('path', { d: 'M8 44 A36 36 0 0 1 80 44', fill: 'none', stroke: '#1e1e2d', strokeWidth: 8, strokeLinecap: 'butt', className: 'hidden dark:block' }),
      h('path', { d: 'M8 44 A36 36 0 0 1 80 44', fill: 'none', stroke: '#0ecb81', strokeWidth: 8, strokeLinecap: 'butt',
        strokeDasharray: wFill + ' ' + (circ - wFill) }),
      h('path', { d: 'M8 44 A36 36 0 0 1 80 44', fill: 'none', stroke: '#f6465d', strokeWidth: 8, strokeLinecap: 'butt',
        strokeDasharray: '0 ' + wFill + ' ' + lFill + ' ' + (circ - wFill - lFill) }));
  }

  /* ---- Stat row helper ---- */
  function kv(label, value, cls) {
    return h('div', { className: 'flex items-center justify-between py-1.5' },
      h('span', { className: 'text-[13px] text-slate-500 dark:text-slate-400' }, label),
      h('span', { className: window.cx('text-[13px] font-semibold tabular-nums', cls || '') }, value));
  }


  function Dashboard(props) {
    var state = props.state, ctx = props.ctx;
    var trades = useMemo(function () { return window.Store.getTrades(ctx); }, [state, ctx.accountId, ctx.range]);
    var s = useMemo(function () { return C.stats(trades); }, [trades]);

    if (!trades.length) {
      return h(UI.Empty, { icon: '📊', title: 'No trades yet',
        sub: 'Add your first trade manually, or import via CSV or TradingView.',
        action: h('button', { className: 'tz-btn tz-btn-primary', onClick: props.onAddTrade }, '+ Add Trade') });
    }

    var sb = startBal(state, ctx);
    var eq = C.equityCurve(trades, sb);
    var dd = C.maxDrawdown(trades, sb);
    var edge = C.edgeScore(trades, sb);
    var strk = C.streaks(trades);
    var pf = s.profitFactor === Infinity ? '∞' : Fmt.num(s.profitFactor, 2);
    var ratio = s.avgLoss > 0 ? s.avgWin / s.avgLoss : 0;
    var daily = C.dailyPnl(trades);
    var dayKeys = Object.keys(daily).sort();
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    var lastDate = trades.slice().sort(function (a, b) { return C.timeKey(b) - C.timeKey(a); })[0].date;

    return h('div', { className: 'space-y-5 animate-fade-in' },
      /* greeting */
      h('div', { className: 'flex items-center justify-between flex-wrap gap-2' },
        h('div', null,
          h('h2', { className: 'text-xl font-bold' }, greet + ' 👋'),
          h('p', { className: 'text-sm text-slate-400 dark:text-slate-500 mt-0.5' },
            s.total + ' trades · last activity ' + Fmt.date(lastDate))),
        h('button', { className: 'tz-btn tz-btn-ghost text-xs hidden sm:flex', onClick: function () { props.go('reports'); } },
          'View full reports →')),

      /* ── top stat cards ─────────────────────────────── */
      h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4' },
        NetPnlCard(s), WinRateCard(s), AvgWinLossCard(s, ratio), PfCard(s, pf), StreakCard(strk)),

      /* ── drawdown warning ───────────────────────────── */
      dd.pct > 50 ? h('div', { className: 'rounded-xl border border-loss/40 bg-loss/5 px-4 py-3 flex items-center gap-3 text-sm' },
        h('span', { className: 'text-xl' }, '\u26a0\ufe0f'),
        h('div', null,
          h('strong', { className: 'pnl-neg' }, 'Drawdown warning: '),
          'You are ' + Fmt.pct(dd.pct) + ' into max drawdown (' + Fmt.money(dd.amount) + '). Consider reducing size.')) : null,

      /* ── daily guardrail breach (from Goals settings) ── */
      (function () {
        var breaches = window.evaluateGuardrails ? window.evaluateGuardrails(trades) : null;
        return breaches ? h('div', { className: 'rounded-xl border border-loss/50 bg-loss/10 px-4 py-3 flex items-start gap-3 text-sm' },
          h('span', { className: 'text-xl' }, '\ud83d\uded1'),
          h('div', null,
            h('strong', { className: 'pnl-neg' }, 'Risk guardrail: '),
            breaches.join(' · '), '. ',
            h('button', { className: 'underline font-semibold', onClick: function () { props.go('goals'); } }, 'Review goals'))) : null;
      })(),

      /* ── equity + edge score ────────────────────────── */
      h('div', { className: 'grid grid-cols-1 xl:grid-cols-3 gap-4' },        h(UI.Card, { className: 'p-5 xl:col-span-2' },
          h('div', { className: 'flex items-center justify-between mb-3' },
            h('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400' }, 'Daily Net Cumulative P&L'),
            h('span', { className: 'text-xs text-slate-400' }, ctx.accountId === 'all' ? 'All accounts' : (state.accounts.find(function (a) { return a.id === ctx.accountId; }) || {}).name)),
          h(window.Charts.Line, { labels: eq.map(function (p, i) { return i === 0 ? 'Start' : Fmt.dateShort(p.label); }), data: eq.map(function (p) { return p.value; }), height: 280 })),
        EdgeScoreCard(edge)),

      /* ── calendar + weekly stats ────────────────────── */
      h(Calendar, { trades: trades, go: props.go }),

      /* ── net daily P&L + recent + open positions ────── */
      h('div', { className: 'grid grid-cols-1 xl:grid-cols-3 gap-4' },
        h(UI.Card, { className: 'p-5 xl:col-span-2' },
          h('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3' }, 'Net Daily P&L'),
          h(window.Charts.Bars, { labels: dayKeys.slice(-30).map(function (k) { return Fmt.dateShort(k); }), data: dayKeys.slice(-30).map(function (k) { return daily[k].pnl; }), height: 240 })),
        h(UI.Card, { className: 'p-5' },
          h('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3' }, 'Key Metrics'),
          h('div', { className: 'space-y-0.5' },
            kv('Profit factor', pf, pf >= '1' ? 'pnl-pos' : 'pnl-neg'),
            kv('Win rate', Fmt.pct(s.winRate), s.winRate >= 50 ? 'pnl-pos' : 'pnl-neg'),
            kv('Avg R', s.avgR != null ? Fmt.num(s.avgR, 2) + 'R' : '—', s.avgR != null ? pnlCls(s.avgR) : ''),
            kv('Expectancy', Fmt.money(s.expectancy, { plus: true }), pnlCls(s.expectancy)),
            kv('Max drawdown', '-' + Fmt.money(dd.amount), 'pnl-neg'),
            kv('Drawdown %', Fmt.pct(dd.pct), 'pnl-neg'),
            kv('Best trade', Fmt.money(s.largestWin, { plus: true }), 'pnl-pos'),
            kv('Worst trade', Fmt.money(s.largestLoss), 'pnl-neg'),
            kv('Total fees', Fmt.money(s.fees)),
            kv('Win streak', String(s.winStreak), 'pnl-pos'),
            kv('Loss streak', String(s.lossStreak), 'pnl-neg')))),

      /* ── recent trades + open positions ─────────────── */
      h('div', { className: 'grid grid-cols-1 xl:grid-cols-2 gap-4' },
        h(RecentTradesPanel, { trades: trades, onEdit: props.onEditTrade, go: props.go }),
        h(OpenPositionsPanel, { trades: trades, onEdit: props.onEditTrade }))
    );
  }


  /* ---- Stat card widgets ---- */
  function NetPnlCard(s) {
    return h(UI.Card, { className: 'p-5' },
      h('div', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1' },
        'Net P&L', h('span', { className: 'ml-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-ink-700 text-[10px] font-semibold' }, s.total)),
      h('div', { className: window.cx('stat-value', pnlCls(s.netPnl)) }, Fmt.money(s.netPnl, { plus: true })),
      h('div', { className: 'text-xs text-slate-400 mt-1.5 space-y-0.5' },
        h('span', { className: 'text-profit' }, '+' + Fmt.moneyShort(s.grossWin)),
        h('span', { className: 'mx-1 text-slate-300 dark:text-slate-600' }, '/'),
        h('span', { className: 'text-loss' }, '-' + Fmt.moneyShort(s.grossLoss))));
  }

  function WinRateCard(s) {
    return h(UI.Card, { className: 'p-5' },
      h('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1' }, 'Trade Win %'),
      h('div', { className: 'flex items-end justify-between gap-2' },
        h('div', null,
          h('div', { className: 'stat-value' }, Fmt.pct(s.winRate, 2)),
          h('div', { className: 'flex gap-2 mt-1 text-[11px] font-semibold' },
            h('span', { className: 'pnl-pos' }, s.wins + 'W'),
            h('span', { className: 'text-slate-400' }, s.be + 'BE'),
            h('span', { className: 'pnl-neg' }, s.losses + 'L'))),
        h(WinLossGauge, { wins: s.wins, losses: s.losses, be: s.be })));
  }

  function AvgWinLossCard(s, ratio) {
    var total = s.avgWin + s.avgLoss || 1;
    var wpct = (s.avgWin / total) * 100;
    return h(UI.Card, { className: 'p-5' },
      h('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1' }, 'Avg Win / Loss'),
      h('div', { className: 'stat-value' }, ratio ? Fmt.num(ratio, 2) : '—'),
      h('div', { className: 'flex h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-ink-700 mt-3' },
        h('div', { style: { width: wpct + '%', background: '#0ecb81' } }),
        h('div', { style: { width: (100 - wpct) + '%', background: '#f6465d' } })),
      h('div', { className: 'flex justify-between text-[11px] font-semibold mt-1' },
        h('span', { className: 'pnl-pos' }, Fmt.money(s.avgWin)),
        h('span', { className: 'pnl-neg' }, '-' + Fmt.money(s.avgLoss).slice(1))));
  }

  function PfCard(s, pf) {
    var segs = [{ value: s.grossWin, color: '#0ecb81' }, { value: s.grossLoss, color: '#f6465d' }];
    return h(UI.Card, { className: 'p-5' },
      h('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1' }, 'Profit Factor'),
      h('div', { className: 'flex items-end justify-between gap-2' },
        h('div', { className: window.cx('stat-value', s.profitFactor >= 1 ? 'pnl-pos' : 'pnl-neg') }, pf),
        h(SvgGauge, { value: s.grossLoss ? Math.min(100, (s.grossWin / (s.grossWin + s.grossLoss)) * 100) : 0, color: '#0ecb81' })));
  }

  function StreakCard(strk) {
    function col(label, st) {
      var pos = st.sign >= 0;
      return h('div', { className: 'flex flex-col items-center gap-0.5' },
        h('div', { className: window.cx('text-2xl font-extrabold tabular-nums', st.current === 0 ? 'text-slate-400' : pos ? 'pnl-pos' : 'pnl-neg') },
          (st.current > 0 && pos ? '▲' : st.current > 0 ? '▼' : '') + st.current),
        h('div', { className: 'text-[10px] uppercase tracking-wide text-slate-400 font-semibold' }, label),
        h('div', { className: 'text-[10px] text-slate-400' }, 'best ' + st.longest));
    }
    return h(UI.Card, { className: 'p-5' },
      h('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3' }, 'Current Streak'),
      h('div', { className: 'flex gap-6 justify-center' }, col('Days', strk.day), col('Trades', strk.trade)));
  }

  function EdgeScoreCard(edge) {
    var color = edge.score >= 75 ? '#0ecb81' : edge.score >= 50 ? '#f0a32a' : '#f6465d';
    return h(UI.Card, { className: 'p-5' },
      h('div', { className: 'flex items-center justify-between mb-1' },
        h('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400' }, 'Edge Score'),
        h('span', { className: 'cursor-help text-slate-400 text-xs', title: 'Composite 0-100 across win %, profit factor, avg win/loss, recovery, consistency and max drawdown' }, 'ⓘ')),
      h(window.Charts.Radar, { labels: ['Win %', 'Profit F.', 'W/L Ratio', 'Recovery', 'Consistency', 'Drawdown'],
        data: [edge.parts.winRate, edge.parts.profitFactor, edge.parts.avgWinLoss, edge.parts.recovery, edge.parts.consistency, edge.parts.drawdown], height: 220 }),
      h('div', { className: 'flex items-center justify-between mt-2' },
        h('div', null,
          h('span', { className: 'text-3xl font-extrabold', style: { color: color } }, Fmt.num(edge.score, 1)),
          h('span', { className: 'text-sm text-slate-400 ml-1' }, '/ 100')),
        h('span', { className: 'text-xs font-semibold', style: { color: color } },
          edge.score >= 75 ? '⬆ Strong' : edge.score >= 50 ? '→ Developing' : '⬇ Needs work')),
      h('div', { className: 'h-2 rounded-full mt-2 relative overflow-hidden', style: { background: 'linear-gradient(90deg,#f6465d,#f0a32a 50%,#0ecb81)' } },
        h('div', { className: 'absolute inset-y-0 bg-white/25 rounded-full', style: { left: Math.max(0, Math.min(96, edge.score)) + '%', width: '4%' } })));
  }


  /* ---- Calendar with weekly stats ---- */
  function Calendar(props) {
    var daily = useMemo(function () { return C.dailyPnl(props.trades); }, [props.trades]);
    var streakMap = useMemo(function () { return C.calendarStreakMap(props.trades); }, [props.trades]);
    var cumData = useMemo(function () { return C.intradayCumPnl(props.trades); }, [props.trades]);
    var keys = Object.keys(daily).sort();
    var lastIso = keys.length ? keys[keys.length - 1] : Fmt.todayISO();
    var ld = new Date(lastIso + 'T00:00:00');
    var cur = useState({ y: ld.getFullYear(), m: ld.getMonth() });
    var c = cur[0], setC = cur[1];
    function step(d) { var m = c.m + d, y = c.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } setC({ y: y, m: m }); }
    function isoOf(day) { return c.y + '-' + String(c.m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0'); }
    var monthName = new Date(c.y, c.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    var monthTotal = 0, monthDays = 0;
    Object.keys(daily).forEach(function (d) {
      var dt = new Date(d + 'T00:00:00');
      if (dt.getFullYear() === c.y && dt.getMonth() === c.m) { monthTotal += daily[d].pnl; monthDays++; }
    });
    var first = new Date(c.y, c.m, 1), startDow = first.getDay(), daysInMonth = new Date(c.y, c.m + 1, 0).getDate();
    var weeks = [], cur2 = [];
    for (var i = 0; i < startDow; i++) cur2.push(null);
    for (var day = 1; day <= daysInMonth; day++) {
      cur2.push(day);
      if (cur2.length === 7) { weeks.push(cur2); cur2 = []; }
    }
    if (cur2.length) { while (cur2.length < 7) cur2.push(null); weeks.push(cur2); }

    return h(UI.Card, { className: 'p-5' },
      h('div', { className: 'flex items-center justify-between mb-4 flex-wrap gap-2' },
        h('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400' }, 'Daily P&L Calendar'),
        h('div', { className: 'flex items-center gap-2.5' },
          h('span', { className: window.cx('font-bold text-sm', monthTotal >= 0 ? 'pnl-pos' : 'pnl-neg') },
            Fmt.money(monthTotal, { plus: true }) + ' · ' + monthDays + ' days'),
          h('button', { className: 'tz-btn tz-btn-ghost tz-btn-sm', onClick: function () { step(-1); } }, '‹'),
          h('span', { className: 'text-sm font-semibold min-w-[130px] text-center' }, monthName),
          h('button', { className: 'tz-btn tz-btn-ghost tz-btn-sm', onClick: function () { step(1); } }, '›'))),
      h('div', { className: 'flex flex-col lg:flex-row gap-3' },
        h('div', { className: 'flex-1' },
          h('div', { className: 'grid grid-cols-7 gap-1 mb-1' },
            ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function (d) {
              return h('div', { key: d, className: 'text-[10px] font-semibold text-slate-400 text-center uppercase tracking-wide pb-1' }, d);
            })),
          h('div', { className: 'grid grid-cols-7 gap-1' },
            weeks.reduce(function (cells, w) {
              w.forEach(function (day) {
                if (day == null) { cells.push(h('div', { key: 'e' + cells.length })); return; }
                var iso = isoOf(day), info = streakMap[iso];
                var bg;
                if (info) {
                  if (info.streak >= 3 && info.streakDir === 1)  bg = 'bg-[#00B67A]/20 border-[#00B67A]/50';
                  else if (info.streak === 2 && info.streakDir === 1)  bg = 'bg-[#00B67A]/10 border-[#00B67A]/30';
                  else if (info.streak === 1 && info.streakDir === 1)  bg = 'bg-profit/10 border-profit/25';
                  else if (info.streak >= 3 && info.streakDir === -1) bg = 'bg-[#f6465d]/20 border-[#f6465d]/50';
                  else if (info.streak === 2 && info.streakDir === -1) bg = 'bg-[#f6465d]/10 border-[#f6465d]/30';
                  else if (info.streak === 1 && info.streakDir === -1) bg = 'bg-loss/10 border-loss/25';
                  else bg = 'bg-slate-50 dark:bg-ink-800 border-slate-200 dark:border-ink-700';
                } else {
                  bg = 'bg-slate-50 dark:bg-ink-800 border-slate-200 dark:border-ink-700';
                }
                var cumPts = cumData[iso] && cumData[iso].points;
                var cumVal = cumPts && cumPts.length ? cumPts[cumPts.length - 1].cum : null;
                cells.push(h('div', { key: iso, title: 'Click to open journal for this day',
                  className: 'rounded-lg border min-h-[62px] p-1.5 flex flex-col cursor-pointer hover:border-brand/40 ' + bg,
                  onClick: function() { if (props.go) props.go('journal'); } },
                  h('div', { className: 'text-[11px] text-slate-400 font-medium' }, day),
                  info ? h('div', { className: window.cx('text-[12px] font-bold mt-0.5', info.pnl >= 0 ? 'pnl-pos' : 'pnl-neg') }, Fmt.moneyShort(info.pnl)) : null,
                  cumVal != null ? h('div', { className: 'text-[10px] text-slate-400 mt-0.5' }, 'cum ' + Fmt.moneyShort(cumVal)) : null,
                  info ? h('div', { className: 'text-[10px] text-slate-400 mt-auto' }, info.count + (info.count > 1 ? 't' : 't')) : null));
              });
              return cells;
            }, []))),
        h('div', { className: 'lg:w-32 grid grid-cols-2 lg:grid-cols-1 gap-2' },
          weeks.map(function (w, i) {
            var sum = 0, cnt = 0;
            w.forEach(function (day) { if (day && daily[isoOf(day)]) { sum += daily[isoOf(day)].pnl; cnt++; } });
            return h('div', { key: i, className: 'rounded-xl border border-slate-200 dark:border-ink-700 bg-slate-50 dark:bg-ink-800 p-2.5' },
              h('div', { className: 'text-[10px] font-semibold uppercase tracking-wide text-slate-400' }, 'Wk ' + (i + 1)),
              h('div', { className: window.cx('text-sm font-bold', sum > 0 ? 'pnl-pos' : sum < 0 ? 'pnl-neg' : 'text-slate-400') },
                cnt ? Fmt.moneyShort(sum) : '—'),
              h('div', { className: 'text-[10px] text-slate-400' }, cnt + (cnt === 1 ? ' day' : ' days')));
          }))));
  }

  /* ---- Recent Trades panel ---- */
  function RecentTradesPanel(props) {
    var recent = props.trades.slice().sort(function (a, b) { return C.timeKey(b) - C.timeKey(a); }).slice(0, 8);
    return h(UI.Card, { className: 'p-5' },
      h('div', { className: 'flex items-center justify-between mb-3' },
        h('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400' }, 'Recent Trades'),
        h('button', { className: 'tz-btn tz-btn-ghost tz-btn-sm', onClick: function () { props.go('trades'); } }, 'View all →')),
      h('div', { className: 'overflow-x-auto' },
        h('table', { className: 'tz-table' },
          h('thead', null, h('tr', null,
            ['Date', 'Symbol', 'Side', 'P&L', 'R', 'Result'].map(function (c) { return h('th', { key: c }, c); }))),
          h('tbody', null, recent.map(function (t) {
            var p = C.pnlOf(t), r = C.rOf(t);
            return h('tr', { key: t.id, className: 'cursor-pointer', onClick: function () { props.onEdit(t); } },
              h('td', null, Fmt.dateShort(t.date), ' ', h('span', { className: 'text-slate-400 text-[11px]' }, t.time || '')),
              h('td', { className: 'font-semibold' }, t.symbol),
              h('td', null, h('span', { className: t.side === 'short' ? 'badge badge-short' : 'badge badge-long' },
                t.side === 'short' ? '▼ Short' : '▲ Long')),
              h('td', { className: 'num font-semibold ' + (p >= 0 ? 'pnl-pos' : 'pnl-neg') }, Fmt.money(p, { plus: true })),
              h('td', { className: 'num ' + (r == null ? 'text-slate-400' : r >= 0 ? 'pnl-pos' : 'pnl-neg') },
                r == null ? '—' : Fmt.num(r, 2) + 'R'),
              h('td', null, h('span', { className: C.resultOf(t) === 'win' ? 'badge badge-win' : C.resultOf(t) === 'loss' ? 'badge badge-loss' : 'badge badge-be' },
                C.resultOf(t) === 'win' ? 'Win' : C.resultOf(t) === 'loss' ? 'Loss' : 'B/E')));
          })))));
  }

  /* ---- Open Positions panel (simulated from trades lacking a close) ---- */
  function OpenPositionsPanel(props) {
    var open = useMemo(function () {
      return props.trades.filter(function (t) { return t.isOpen; })
        .sort(function (a, b) { return C.timeKey(b) - C.timeKey(a); });
    }, [props.trades]);

    return h(UI.Card, { className: 'p-5' },
      h('div', { className: 'flex items-center justify-between mb-3' },
        h('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400' }, 'Open Positions'),
        h('span', { className: window.cx('text-xs font-semibold px-2 py-0.5 rounded-full', open.length ? 'badge badge-brand' : 'badge badge-be') },
          open.length ? open.length + ' open' : 'None')),
      open.length === 0
        ? h('div', { className: 'text-center py-10 text-slate-400' },
            h('div', { className: 'text-3xl mb-2 opacity-40' }, '📭'),
            h('div', { className: 'text-sm' }, 'No open positions'),
            h('div', { className: 'text-xs mt-1 text-slate-400' }, 'Mark a trade as open with the "Open position" toggle when adding it.'))
        : h('div', { className: 'overflow-x-auto' },
            h('table', { className: 'tz-table' },
              h('thead', null, h('tr', null,
                ['Open Date', 'Symbol', 'Side', 'Entry', 'Qty', 'Running P&L'].map(function (c) { return h('th', { key: c }, c); }))),
              h('tbody', null, open.map(function (t) {
                var runP = C.pnlOf(t);
                return h('tr', { key: t.id, className: 'cursor-pointer', onClick: function () { props.onEdit(t); } },
                  h('td', null, Fmt.dateShort(t.date)),
                  h('td', { className: 'font-semibold' }, t.symbol),
                  h('td', null, h('span', { className: t.side === 'short' ? 'badge badge-short' : 'badge badge-long' },
                    t.side === 'short' ? '▼ Short' : '▲ Long')),
                  h('td', { className: 'num' }, Fmt.num(t.entry, 2)),
                  h('td', { className: 'num' }, Fmt.num(t.quantity)),
                  h('td', { className: 'num font-semibold ' + (runP >= 0 ? 'pnl-pos' : 'pnl-neg') }, Fmt.money(runP, { plus: true })));
              })))));
  }

  window.Views = window.Views || {};
  window.Views.Dashboard = Dashboard;
})();
