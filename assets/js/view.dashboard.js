/* ============================================================
   view.dashboard.js — overview (window.Views.Dashboard)
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
    var pf = s.profitFactor === Infinity ? '∞' : Fmt.num(s.profitFactor, 2);
    var best = trades.reduce(function (m, t) { return C.pnlOf(t) > C.pnlOf(m) ? t : m; }, trades[0]);
    var worst = trades.reduce(function (m, t) { return C.pnlOf(t) < C.pnlOf(m) ? t : m; }, trades[0]);

    var labels = eq.map(function (p, i) { return i === 0 ? 'Start' : Fmt.dateShort(p.label); });
    var values = eq.map(function (p) { return p.value; });

    return h('div', { className: 'space-y-4 animate-fade-in' },
      // stat cards
      h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4' },
        h(UI.StatCard, { label: 'Net P&L', value: Fmt.money(s.netPnl, { plus: true }), color: Fmt.signColor(s.netPnl),
          sub: 'Gross +' + Fmt.moneyShort(s.grossWin) + ' / -' + Fmt.moneyShort(s.grossLoss) + ' · fees ' + Fmt.money(s.fees) }),
        h(UI.StatCard, { label: 'Win Rate', value: Fmt.pct(s.winRate), barPct: s.winRate, barColor: '#16c784',
          sub: s.wins + 'W · ' + s.losses + 'L' + (s.be ? ' · ' + s.be + ' B/E' : '') }),
        h(UI.StatCard, { label: 'Profit Factor', value: pf, color: s.profitFactor >= 1 ? 'text-profit' : 'text-loss',
          hint: 'Gross profit ÷ gross loss', sub: 'Avg win ' + Fmt.money(s.avgWin) + ' · avg loss ' + Fmt.money(s.avgLoss) }),
        h(UI.StatCard, { label: 'Expectancy', value: Fmt.money(s.expectancy, { plus: true }), color: Fmt.signColor(s.expectancy),
          sub: (s.avgR != null ? 'Avg ' + Fmt.num(s.avgR, 2) + 'R' : 'Add risk $ for R') + ' · per trade' })
      ),
      // equity + side panel
      h('div', { className: 'grid grid-cols-1 lg:grid-cols-3 gap-4' },
        h(UI.Card, { className: 'p-4 lg:col-span-2' },
          h('div', { className: 'flex items-center justify-between mb-3' },
            h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, 'Equity Curve'),
            h(UI.Pill, null, ctx.accountId === 'all' ? 'All accounts' : (state.accounts.find(function (a) { return a.id === ctx.accountId; }) || {}).name)),
          h(window.Charts.Line, { labels: labels, data: values, height: 300 })),
        h(UI.Card, { className: 'p-4' },
          h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2' }, 'Win / Loss'),
          h(window.Charts.Doughnut, { labels: ['Wins', 'Losses', 'Break-even'], data: [s.wins, s.losses, s.be], height: 200 }),
          h('dl', { className: 'mt-4 text-sm space-y-1.5' },
            kv('Max drawdown', h('span', { className: 'text-loss font-semibold' }, '-' + Fmt.money(dd.amount).slice(1) + ' (' + Fmt.pct(dd.pct) + ')')),
            kv('Best trade', h('span', { className: 'text-profit font-semibold' }, Fmt.money(C.pnlOf(best), { plus: true }) + ' ' + best.symbol)),
            kv('Worst trade', h('span', { className: 'text-loss font-semibold' }, Fmt.money(C.pnlOf(worst), { plus: true }) + ' ' + worst.symbol)),
            kv('Max win streak', h('span', { className: 'font-semibold' }, s.winStreak)),
            kv('Max loss streak', h('span', { className: 'font-semibold' }, s.lossStreak))))
      ),
      // calendar
      h(Calendar, { trades: trades }),
      // recent trades
      h(UI.Card, { className: 'p-4' },
        h('div', { className: 'flex items-center justify-between mb-3' },
          h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, 'Recent Trades'),
          h(UI.Button, { variant: 'ghost', size: 'sm', onClick: function () { props.go('trades'); } }, 'View all')),
        h(RecentTrades, { trades: trades.slice().sort(function (a, b) { return C.timeKey(b) - C.timeKey(a); }).slice(0, 8), onEdit: props.onEditTrade }))
    );
  }

  function kv(k, v) { return h('div', { className: 'flex items-center justify-between' }, h('dt', { className: 'text-slate-400' }, k), h('dd', { className: 'm-0' }, v)); }

  function RecentTrades(props) {
    return h('div', { className: 'overflow-x-auto' },
      h('table', { className: 'w-full text-sm min-w-[640px]' },
        h('thead', null, h('tr', { className: 'text-left text-[11px] uppercase tracking-wide text-slate-400' },
          ['Date', 'Symbol', 'Side', 'Setup', 'P&L', 'R', 'Result'].map(function (c) { return h('th', { key: c, className: 'py-2 font-semibold' }, c); }))),
        h('tbody', null, props.trades.map(function (t) {
          var p = C.pnlOf(t), r = C.rOf(t);
          return h('tr', { key: t.id, onClick: function () { props.onEdit(t); },
            className: 'border-t border-slate-100 dark:border-ink-700 hover:bg-slate-50 dark:hover:bg-ink-700/60 cursor-pointer' },
            h('td', { className: 'py-2.5' }, Fmt.dateShort(t.date), ' ', h('span', { className: 'text-slate-400' }, t.time || '')),
            h('td', { className: 'font-semibold' }, t.symbol),
            h('td', null, h(UI.SideBadge, { side: t.side })),
            h('td', { className: 'text-slate-400' }, t.setup || '—'),
            h('td', { className: window.cx('font-semibold', Fmt.signColor(p)) }, Fmt.money(p, { plus: true })),
            h('td', { className: r == null ? 'text-slate-400' : Fmt.signColor(r) }, r == null ? '—' : Fmt.num(r, 2) + 'R'),
            h('td', null, h(UI.ResultBadge, { result: C.resultOf(t) })));
        })))
    );
  }

  function Calendar(props) {
    var daily = useMemo(function () { return C.dailyPnl(props.trades); }, [props.trades]);
    var keys = Object.keys(daily).sort();
    var lastIso = keys.length ? keys[keys.length - 1] : Fmt.todayISO();
    var ld = new Date(lastIso + 'T00:00:00');
    var cur = useState({ y: ld.getFullYear(), m: ld.getMonth() });
    var c = cur[0], setC = cur[1];

    function step(d) {
      var m = c.m + d, y = c.y;
      if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
      setC({ y: y, m: m });
    }

    var monthName = new Date(c.y, c.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    var monthTotal = 0, monthDays = 0;
    Object.keys(daily).forEach(function (d) { var dt = new Date(d + 'T00:00:00'); if (dt.getFullYear() === c.y && dt.getMonth() === c.m) { monthTotal += daily[d].pnl; monthDays++; } });

    var first = new Date(c.y, c.m, 1), startDow = first.getDay(), days = new Date(c.y, c.m + 1, 0).getDate();
    var cells = [];
    for (var i = 0; i < startDow; i++) cells.push(h('div', { key: 'e' + i }));
    for (var day = 1; day <= days; day++) {
      var dIso = c.y + '-' + String(c.m + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
      var info = daily[dIso];
      var tone = info ? (info.pnl >= 0 ? 'bg-profit/10 border-profit/30' : 'bg-loss/10 border-loss/30') : 'bg-slate-50 dark:bg-ink-750 border-slate-200 dark:border-ink-600';
      cells.push(h('div', { key: dIso, className: window.cx('rounded-xl min-h-[74px] p-2 border flex flex-col gap-1', tone) },
        h('div', { className: 'text-[11px] text-slate-400' }, day),
        info ? h('div', { className: window.cx('text-sm font-bold', info.pnl >= 0 ? 'text-profit' : 'text-loss') }, Fmt.moneyShort(info.pnl)) : null,
        info ? h('div', { className: 'text-[10px] text-slate-400 mt-auto' }, info.count + (info.count > 1 ? ' trades' : ' trade')) : null));
    }

    return h(UI.Card, { className: 'p-4' },
      h('div', { className: 'flex items-center justify-between mb-3.5 flex-wrap gap-2' },
        h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, 'Daily P&L Calendar'),
        h('div', { className: 'flex items-center gap-2' },
          h('span', { className: window.cx('font-bold text-sm mr-1', monthTotal >= 0 ? 'text-profit' : 'text-loss') }, Fmt.money(monthTotal, { plus: true }) + ' · ' + monthDays + ' days'),
          h(UI.Button, { variant: 'ghost', size: 'sm', onClick: function () { step(-1); } }, '‹'),
          h(UI.Pill, null, monthName),
          h(UI.Button, { variant: 'ghost', size: 'sm', onClick: function () { step(1); } }, '›'))),
      h('div', { className: 'grid grid-cols-7 gap-1.5 mb-1.5' },
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(function (d) { return h('div', { key: d, className: 'text-[11px] text-slate-400 text-center uppercase tracking-wide' }, d); })),
      h('div', { className: 'grid grid-cols-7 gap-1.5' }, cells)
    );
  }

  window.Views = window.Views || {};
  window.Views.Dashboard = Dashboard;
})();
