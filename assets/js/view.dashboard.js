/* ============================================================
   view.dashboard.js — overview (window.Views.Dashboard)
   TradeZella-style layout: stat widgets, win% gauge, avg win/loss bar,
   profit-factor ring, current streak, cumulative P&L, Edge Score radar,
   calendar with weekly stats, net daily P&L bars, recent trades.
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, C = window.Store.calc;
  var useState = React.useState, useMemo = React.useMemo;

  function startingBalance(state, ctx) {
    if (ctx.accountId && ctx.accountId !== 'all') {
      var a = state.accounts.find(function (x) { return x.id === ctx.accountId; });
      return a ? a.startingBalance : 0;
    }
    return state.accounts.reduce(function (s, a) { return s + (a.startingBalance || 0); }, 0);
  }
  function cardTitle(t, extra) {
    return h('div', { className: 'flex items-center justify-between mb-1' },
      h('span', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, t), extra || null);
  }

  function Dashboard(props) {
    var state = props.state, ctx = props.ctx;
    var trades = useMemo(function () { return window.Store.getTrades(ctx); }, [state, ctx.accountId, ctx.range]);
    var s = useMemo(function () { return C.stats(trades); }, [trades]);

    if (!trades.length) {
      return h(UI.Empty, { icon: '📊', title: 'No trades in this range yet',
        sub: 'Add a trade or widen the date range to see your analytics.',
        action: h(UI.Button, { variant: 'primary', onClick: props.onAddTrade }, '+ Add Trade') });
    }

    var startBal = startingBalance(state, ctx);
    var eq = C.equityCurve(trades, startBal);
    var dd = C.maxDrawdown(trades, startBal);
    var edge = C.edgeScore(trades, startBal);
    var strk = C.streaks(trades);
    var pf = s.profitFactor === Infinity ? '∞' : Fmt.num(s.profitFactor, 2);
    var ratio = s.avgLoss > 0 ? s.avgWin / s.avgLoss : 0;
    var lastDate = trades.slice().sort(function (a, b) { return C.timeKey(b) - C.timeKey(a); })[0].date;
    var hour = new Date().getHours();
    var greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    return h('div', { className: 'space-y-4 animate-fade-in' },
      // meta strip
      h('div', { className: 'flex items-center justify-between flex-wrap gap-2' },
        h('div', { className: 'text-lg font-bold' }, greet + ' 👋'),
        h('div', { className: 'text-xs text-slate-400' }, s.total + ' trades \u00B7 last activity ' + Fmt.date(lastDate))),

      // ---- top widgets ----
      h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4' },
        NetPnlCard(s),
        WinRateCard(s),
        AvgWinLossCard(s, ratio),
        ProfitFactorCard(s, pf),
        StreakCard(strk)
      ),

      // ---- cumulative P&L + Edge Score ----
      h('div', { className: 'grid grid-cols-1 xl:grid-cols-3 gap-4' },
        h(UI.Card, { className: 'p-4 xl:col-span-2' },
          cardTitle('Daily Net Cumulative P&L', h(UI.Pill, null, ctx.accountId === 'all' ? 'All accounts' : (state.accounts.find(function (a) { return a.id === ctx.accountId; }) || {}).name)),
          h(window.Charts.Line, { labels: eq.map(function (p, i) { return i === 0 ? 'Start' : Fmt.dateShort(p.label); }), data: eq.map(function (p) { return p.value; }), height: 280 })),
        EdgeScoreCard(edge)
      ),

      // ---- calendar + weekly ----
      h(Calendar, { trades: trades }),

      // ---- net daily P&L + recent ----
      h('div', { className: 'grid grid-cols-1 xl:grid-cols-2 gap-4' },
        NetDailyCard(trades),
        h(UI.Card, { className: 'p-4' },
          h('div', { className: 'flex items-center justify-between mb-3' },
            h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, 'Recent Trades'),
            h(UI.Button, { variant: 'ghost', size: 'sm', onClick: function () { props.go('trades'); } }, 'View all')),
          h(RecentTrades, { trades: trades.slice().sort(function (a, b) { return C.timeKey(b) - C.timeKey(a); }).slice(0, 7), onEdit: props.onEditTrade })))
    );
  }

  /* ---------------- widgets ---------------- */
  function NetPnlCard(s) {
    return h(UI.Card, { className: 'p-4' },
      cardTitle('Net P&L', h('span', { className: 'text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-ink-700 text-slate-400' }, s.total)),
      h('div', { className: window.cx('text-2xl font-extrabold tracking-tight', Fmt.signColor(s.netPnl)) }, Fmt.money(s.netPnl, { plus: true })),
      h('div', { className: 'text-xs text-slate-400 mt-1' }, 'Gross +' + Fmt.moneyShort(s.grossWin) + ' / -' + Fmt.moneyShort(s.grossLoss)));
  }

  function WinRateCard(s) {
    var segs = [{ value: s.wins, color: '#16c784' }, { value: s.be, color: '#4aa8ff' }, { value: s.losses, color: '#ea3943' }];
    return h(UI.Card, { className: 'p-4' },
      cardTitle('Trade win %'),
      h('div', { className: 'flex items-center justify-between gap-2' },
        h('div', null,
          h('div', { className: 'text-2xl font-extrabold tracking-tight' }, Fmt.pct(s.winRate, 2)),
          h('div', { className: 'flex gap-2 mt-1 text-[11px] font-semibold' },
            h('span', { className: 'text-profit' }, s.wins, 'W'),
            h('span', { className: 'text-blue' , style: { color: '#4aa8ff' } }, s.be, 'BE'),
            h('span', { className: 'text-loss' }, s.losses, 'L'))),
        h('div', { className: 'w-[120px] -mb-6' }, h(window.Charts.Gauge, { segments: segs, total: s.total, height: 80 }))));
  }

  function AvgWinLossCard(s, ratio) {
    var total = s.avgWin + s.avgLoss;
    var winPct = total > 0 ? (s.avgWin / total) * 100 : 50;
    return h(UI.Card, { className: 'p-4' },
      cardTitle('Avg win/loss trade', h('span', { className: 'cursor-help opacity-60 text-slate-400', title: 'Average winning trade size vs average losing trade size' }, 'ⓘ')),
      h('div', { className: 'text-2xl font-extrabold tracking-tight' }, ratio ? Fmt.num(ratio, 2) : '—'),
      h('div', { className: 'flex h-1.5 rounded overflow-hidden mt-3 bg-slate-100 dark:bg-ink-700' },
        h('span', { style: { width: winPct + '%', background: '#16c784' } }),
        h('span', { style: { width: (100 - winPct) + '%', background: '#ea3943' } })),
      h('div', { className: 'flex justify-between text-[11px] font-semibold mt-1.5' },
        h('span', { className: 'text-profit' }, Fmt.money(s.avgWin)),
        h('span', { className: 'text-loss' }, '-' + Fmt.money(s.avgLoss).replace(/^[-]/, ''))));
  }

  function ProfitFactorCard(s, pf) {
    var segs = [{ value: s.grossWin, color: '#16c784' }, { value: s.grossLoss, color: '#ea3943' }];
    return h(UI.Card, { className: 'p-4' },
      cardTitle('Profit factor', h('span', { className: 'cursor-help opacity-60 text-slate-400', title: 'Gross profit ÷ gross loss' }, 'ⓘ')),
      h('div', { className: 'flex items-center justify-between gap-2' },
        h('div', { className: window.cx('text-2xl font-extrabold tracking-tight', s.profitFactor >= 1 ? 'text-profit' : 'text-loss') }, pf),
        h('div', { className: 'w-[64px]' }, h(window.Charts.Gauge, { segments: segs, full: true, height: 64 }))));
  }

  function StreakCard(strk) {
    function col(label, st) {
      var pos = st.sign >= 0;
      return h('div', { className: 'flex flex-col gap-0.5' },
        h('span', { className: 'text-[10px] uppercase tracking-wide text-slate-400 font-semibold' }, label),
        h('span', { className: window.cx('text-xl font-extrabold', st.current === 0 ? 'text-slate-400' : pos ? 'text-profit' : 'text-loss') }, (st.current > 0 ? (pos ? '\u25B2 ' : '\u25BC ') : '') + st.current),
        h('span', { className: 'text-[10px] text-slate-400' }, 'best ' + st.longest));
    }
    return h(UI.Card, { className: 'p-4' },
      cardTitle('Current streak'),
      h('div', { className: 'flex gap-6 mt-1' }, col('Days', strk.day), col('Trades', strk.trade)));
  }

  function EdgeScoreCard(edge) {
    var parts = edge.parts;
    var color = edge.score >= 75 ? '#16c784' : edge.score >= 50 ? '#f0a32a' : '#ea3943';
    return h(UI.Card, { className: 'p-4' },
      h('div', { className: 'flex items-center justify-between mb-1' },
        h('span', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, 'Edge Score'),
        h('span', { className: 'cursor-help opacity-60 text-slate-400', title: 'Composite 0-100 score across win %, profit factor, avg win/loss, recovery factor, consistency and max drawdown' }, 'ⓘ')),
      h(window.Charts.Radar, { labels: ['Win %', 'Profit factor', 'Avg win/loss', 'Recovery', 'Consistency', 'Max drawdown'],
        data: [parts.winRate, parts.profitFactor, parts.avgWinLoss, parts.recovery, parts.consistency, parts.drawdown], height: 240 }),
      h('div', { className: 'flex items-center justify-between mt-2' },
        h('div', null, h('span', { className: 'text-3xl font-extrabold', style: { color: color } }, Fmt.num(edge.score, 1)),
          h('span', { className: 'text-sm text-slate-400' }, ' / 100')),
        h('span', { className: 'text-xs text-slate-400' }, edge.score >= 75 ? 'Strong' : edge.score >= 50 ? 'Developing' : 'Needs work')),
      h('div', { className: 'h-2 rounded-full mt-2', style: { background: 'linear-gradient(90deg,#ea3943,#f0a32a,#16c784)', position: 'relative' } },
        h('div', { style: { position: 'absolute', top: '-3px', left: 'calc(' + Math.max(0, Math.min(100, edge.score)) + '% - 4px)', width: '8px', height: '8px', borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 2px ' + color } })));
  }

  function NetDailyCard(trades) {
    var daily = C.dailyPnl(trades);
    var keys = Object.keys(daily).sort().slice(-30);
    return h(UI.Card, { className: 'p-4' },
      cardTitle('Net Daily P&L', h(UI.Pill, null, 'last ' + keys.length + ' days')),
      h(window.Charts.Bars, { labels: keys.map(function (k) { return Fmt.dateShort(k); }), data: keys.map(function (k) { return daily[k].pnl; }), height: 280 }));
  }

  function RecentTrades(props) {
    return h('div', { className: 'overflow-x-auto' },
      h('table', { className: 'w-full text-sm min-w-[560px]' },
        h('thead', null, h('tr', { className: 'text-left text-[11px] uppercase tracking-wide text-slate-400' },
          ['Date', 'Symbol', 'Side', 'P&L', 'R', 'Result'].map(function (c) { return h('th', { key: c, className: 'py-2 font-semibold' }, c); }))),
        h('tbody', null, props.trades.map(function (t) {
          var p = C.pnlOf(t), r = C.rOf(t);
          return h('tr', { key: t.id, onClick: function () { props.onEdit(t); },
            className: 'border-t border-slate-100 dark:border-ink-700 hover:bg-slate-50 dark:hover:bg-ink-700/60 cursor-pointer' },
            h('td', { className: 'py-2.5' }, Fmt.dateShort(t.date), ' ', h('span', { className: 'text-slate-400' }, t.time || '')),
            h('td', { className: 'font-semibold' }, t.symbol),
            h('td', null, h(UI.SideBadge, { side: t.side })),
            h('td', { className: window.cx('font-semibold', Fmt.signColor(p)) }, Fmt.money(p, { plus: true })),
            h('td', { className: r == null ? 'text-slate-400' : Fmt.signColor(r) }, r == null ? '—' : Fmt.num(r, 2) + 'R'),
            h('td', null, h(UI.ResultBadge, { result: C.resultOf(t) })));
        })))
    );
  }

  /* ---------------- calendar with weekly stats ---------------- */
  function Calendar(props) {
    var daily = useMemo(function () { return C.dailyPnl(props.trades); }, [props.trades]);
    var keys = Object.keys(daily).sort();
    var lastIso = keys.length ? keys[keys.length - 1] : Fmt.todayISO();
    var ld = new Date(lastIso + 'T00:00:00');
    var cur = useState({ y: ld.getFullYear(), m: ld.getMonth() });
    var c = cur[0], setC = cur[1];

    function step(d) { var m = c.m + d, y = c.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } setC({ y: y, m: m }); }
    function isoOf(day) { return c.y + '-' + String(c.m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0'); }

    var monthName = new Date(c.y, c.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    var monthTotal = 0, monthDays = 0;
    Object.keys(daily).forEach(function (d) { var dt = new Date(d + 'T00:00:00'); if (dt.getFullYear() === c.y && dt.getMonth() === c.m) { monthTotal += daily[d].pnl; monthDays++; } });

    var first = new Date(c.y, c.m, 1), startDow = first.getDay(), days = new Date(c.y, c.m + 1, 0).getDate();
    // build week rows for the weekly-stats column
    var weeks = [], cur2 = [];
    for (var i = 0; i < startDow; i++) cur2.push(null);
    for (var day = 1; day <= days; day++) { cur2.push(day); if (cur2.length === 7) { weeks.push(cur2); cur2 = []; } }
    if (cur2.length) { while (cur2.length < 7) cur2.push(null); weeks.push(cur2); }

    var cells = [];
    weeks.forEach(function (w) {
      w.forEach(function (day, idx) {
        if (day == null) { cells.push(h('div', { key: 'e' + idx + Math.random() })); return; }
        var info = daily[isoOf(day)];
        var tone = info ? (info.pnl >= 0 ? 'bg-profit/10 border-profit/30' : 'bg-loss/10 border-loss/30') : 'bg-slate-50 dark:bg-ink-750 border-slate-200 dark:border-ink-600';
        cells.push(h('div', { key: isoOf(day), className: window.cx('rounded-xl min-h-[64px] p-2 border flex flex-col gap-0.5', tone) },
          h('div', { className: 'text-[11px] text-slate-400' }, day),
          info ? h('div', { className: window.cx('text-[13px] font-bold', info.pnl >= 0 ? 'text-profit' : 'text-loss') }, Fmt.moneyShort(info.pnl)) : null,
          info ? h('div', { className: 'text-[10px] text-slate-400 mt-auto' }, info.count + (info.count > 1 ? ' trades' : ' trade')) : null));
      });
    });

    var weeklyCol = weeks.map(function (w, i) {
      var sum = 0, cnt = 0;
      w.forEach(function (day) { if (day != null && daily[isoOf(day)]) { sum += daily[isoOf(day)].pnl; cnt++; } });
      return h('div', { key: i, className: 'rounded-xl border border-slate-200 dark:border-ink-600 p-2.5 bg-slate-50 dark:bg-ink-750' },
        h('div', { className: 'text-[11px] text-slate-400 font-semibold' }, 'Week ' + (i + 1)),
        h('div', { className: window.cx('text-sm font-bold', sum > 0 ? 'text-profit' : sum < 0 ? 'text-loss' : 'text-slate-400') }, sum === 0 && cnt === 0 ? '—' : Fmt.moneyShort(sum)),
        h('div', { className: 'text-[10px] text-slate-400' }, cnt + (cnt === 1 ? ' day' : ' days')));
    });

    return h(UI.Card, { className: 'p-4' },
      h('div', { className: 'flex items-center justify-between mb-3.5 flex-wrap gap-2' },
        h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, 'Daily P&L Calendar'),
        h('div', { className: 'flex items-center gap-2' },
          h('span', { className: window.cx('font-bold text-sm mr-1', monthTotal >= 0 ? 'text-profit' : 'text-loss') }, Fmt.money(monthTotal, { plus: true }) + ' \u00B7 ' + monthDays + ' days'),
          h(UI.Button, { variant: 'ghost', size: 'sm', onClick: function () { step(-1); } }, '\u2039'),
          h(UI.Pill, null, monthName),
          h(UI.Button, { variant: 'ghost', size: 'sm', onClick: function () { step(1); } }, '\u203A'))),
      h('div', { className: 'flex flex-col lg:flex-row gap-3' },
        h('div', { className: 'flex-1' },
          h('div', { className: 'grid grid-cols-7 gap-1.5 mb-1.5' },
            ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function (d) { return h('div', { key: d, className: 'text-[11px] text-slate-400 text-center uppercase tracking-wide' }, d); })),
          h('div', { className: 'grid grid-cols-7 gap-1.5' }, cells)),
        h('div', { className: 'lg:w-36 grid grid-cols-2 lg:grid-cols-1 gap-2' }, weeklyCol))
    );
  }

  window.Views = window.Views || {};
  window.Views.Dashboard = Dashboard;
})();
