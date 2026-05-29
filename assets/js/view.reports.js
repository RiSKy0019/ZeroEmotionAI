/* ============================================================
   view.reports.js — analytics report library (Views.Reports)
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, C = window.Store.calc, Store = window.Store;
  var useState = React.useState, useMemo = React.useMemo;

  function ChartCard(props) {
    return h(UI.Card, { className: 'p-4' },
      h('div', { className: 'mb-2' },
        h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, props.title),
        props.sub ? h('p', { className: 'text-xs text-slate-400 mt-0.5' }, props.sub) : null),
      props.empty ? h('div', { className: 'h-[220px] grid place-items-center text-slate-400 text-sm' }, props.empty) : props.children);
  }

  function byDow(trades) {
    var g = C.groupSum(trades, function (t) { return new Date(t.date + 'T00:00:00').getDay(); });
    var map = {}; g.forEach(function (x) { map[x.key] = x; });
    var order = [1, 2, 3, 4, 5, 0, 6];
    return order.map(function (d) { return { key: Fmt.dow(d), o: map[d] || { pnl: 0, count: 0, wins: 0, losses: 0, winRate: 0 } }; });
  }

  function Reports(props) {
    var state = props.state, ctx = props.ctx;
    var trades = useMemo(function () { return Store.getTrades(ctx); }, [state, ctx.accountId, ctx.range]);
    var tab = useState('time'); var t = tab[0];

    if (!trades.length) return h(UI.Empty, { icon: '📈', title: 'Nothing to report yet', sub: 'Add some trades to unlock the analytics.' });

    var tabs = [['time', '🕒 Time'], ['instruments', '💹 Instruments'], ['strategy', '📘 Strategy'], ['behavior', '🧠 Behavior'], ['risk', '🛡️ Risk & Quality']];

    return h('div', { className: 'space-y-4 animate-fade-in' },
      h(UI.SectionHead, { title: 'Reports & Analytics', sub: 'Find your edges and your leaks across ' + trades.length + ' trades.' }),
      h('div', { className: 'flex gap-2 overflow-x-auto no-scrollbar pb-1' },
        tabs.map(function (x) {
          return h('button', { key: x[0], onClick: function () { tab[1](x[0]); },
            className: window.cx('px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap border transition',
              t === x[0] ? 'bg-brand text-white border-brand shadow-glow' : 'bg-white dark:bg-ink-800 border-slate-200 dark:border-ink-600 text-slate-500 dark:text-slate-300 hover:border-brand/40') }, x[1]);
        })),
      t === 'time' ? TimeTab(trades) :
      t === 'instruments' ? InstrumentsTab(trades) :
      t === 'strategy' ? StrategyTab(trades) :
      t === 'behavior' ? BehaviorTab(trades) : RiskTab(trades, state, ctx)
    );
  }

  function grid(children) { return h('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-4' }, children); }

  function TimeTab(trades) {
    var dow = byDow(trades);
    var hour = C.groupSum(trades, function (t) { return (t.time || '00:00').split(':')[0]; }).sort(function (a, b) { return parseInt(a.key) - parseInt(b.key); });
    var month = C.groupSum(trades, function (t) { return t.date.slice(0, 7); }).sort(function (a, b) { return a.key < b.key ? -1 : 1; });
    var cum = C.equityCurve(trades, 0);
    return grid([
      h(ChartCard, { key: 1, title: 'Net P&L by Day of Week', sub: 'Which days carry your week?' },
        h(window.Charts.Bars, { labels: dow.map(function (x) { return x.key; }), data: dow.map(function (x) { return x.o.pnl; }), height: 240 })),
      h(ChartCard, { key: 2, title: 'Win Rate by Day of Week', sub: '% winners per day.' },
        h(window.Charts.Bars, { labels: dow.map(function (x) { return x.key; }), data: dow.map(function (x) { return Math.round(x.o.winRate); }), fmt: 'pct', color: 'brand', height: 240 })),
      h(ChartCard, { key: 3, title: 'Net P&L by Hour', sub: 'Your most and least profitable times.' },
        h(window.Charts.Bars, { labels: hour.map(function (x) { return Fmt.hourLabel(x.key); }), data: hour.map(function (x) { return x.pnl; }), height: 240 })),
      h(ChartCard, { key: 4, title: 'Net P&L by Month' },
        h(window.Charts.Bars, { labels: month.map(function (x) { return x.key; }), data: month.map(function (x) { return x.pnl; }), height: 240 })),
      h(ChartCard, { key: 5, title: 'Cumulative P&L', sub: 'Running total over the period.' },
        h(window.Charts.Line, { labels: cum.map(function (p, i) { return i === 0 ? 'Start' : Fmt.dateShort(p.label); }), data: cum.map(function (p) { return p.value; }), height: 240 })),
      h(ChartCard, { key: 6, title: 'Trades per Hour', sub: 'Where your activity concentrates.' },
        h(window.Charts.Bars, { labels: hour.map(function (x) { return Fmt.hourLabel(x.key); }), data: hour.map(function (x) { return x.count; }), fmt: 'plain', color: '#9b7bff', height: 240 }))
    ]);
  }

  function InstrumentsTab(trades) {
    var sym = C.groupSum(trades, function (t) { return t.symbol; }).sort(function (a, b) { return b.pnl - a.pnl; });
    var symTop = sym.slice(0, 12);
    var longs = trades.filter(function (t) { return t.side !== 'short'; });
    var shorts = trades.filter(function (t) { return t.side === 'short'; });
    return grid([
      h(ChartCard, { key: 1, title: 'Net P&L by Symbol', sub: 'Top instruments by profit.' },
        h(window.Charts.Bars, { labels: symTop.map(function (x) { return x.key; }), data: symTop.map(function (x) { return x.pnl; }), horizontal: true, height: Math.max(240, symTop.length * 28) })),
      h(ChartCard, { key: 2, title: 'Win Rate by Symbol' },
        h(window.Charts.Bars, { labels: symTop.map(function (x) { return x.key; }), data: symTop.map(function (x) { return Math.round(x.winRate); }), fmt: 'pct', color: 'brand', horizontal: true, height: Math.max(240, symTop.length * 28) })),
      h(ChartCard, { key: 3, title: 'Long vs Short — Net P&L' },
        h(window.Charts.Bars, { labels: ['Long', 'Short'], data: [C.stats(longs).netPnl, C.stats(shorts).netPnl], height: 240 })),
      h(ChartCard, { key: 4, title: 'Long vs Short — Win Rate' },
        h(window.Charts.Bars, { labels: ['Long', 'Short'], data: [Math.round(C.stats(longs).winRate), Math.round(C.stats(shorts).winRate)], fmt: 'pct', color: 'brand', height: 240 })),
      h(ChartCard, { key: 5, title: 'Trade Count by Symbol' },
        h(window.Charts.Bars, { labels: symTop.map(function (x) { return x.key; }), data: symTop.map(function (x) { return x.count; }), fmt: 'plain', color: '#9b7bff', horizontal: true, height: Math.max(240, symTop.length * 28) }))
    ]);
  }

  function StrategyTab(trades) {
    var setup = C.groupSum(trades, function (t) { return t.setup || 'Untagged'; }).sort(function (a, b) { return b.pnl - a.pnl; });
    var tags = C.groupSum(trades, function (t) { return (t.tags && t.tags.length) ? t.tags : null; }).sort(function (a, b) { return b.pnl - a.pnl; });
    return grid([
      h(ChartCard, { key: 1, title: 'Net P&L by Playbook', sub: 'Which strategies pay?' },
        h(window.Charts.Bars, { labels: setup.map(function (x) { return x.key; }), data: setup.map(function (x) { return x.pnl; }), horizontal: true, height: Math.max(240, setup.length * 30) })),
      h(ChartCard, { key: 2, title: 'Win Rate by Playbook' },
        h(window.Charts.Bars, { labels: setup.map(function (x) { return x.key; }), data: setup.map(function (x) { return Math.round(x.winRate); }), fmt: 'pct', color: 'brand', horizontal: true, height: Math.max(240, setup.length * 30) })),
      h(ChartCard, { key: 3, title: 'Net P&L by Tag', sub: 'Context tags ranked by profit.', empty: tags.length ? null : 'No tags yet — add tags to your trades.' },
        tags.length ? h(window.Charts.Bars, { labels: tags.map(function (x) { return x.key; }), data: tags.map(function (x) { return x.pnl; }), horizontal: true, height: Math.max(240, tags.length * 28) }) : null),
      h(ChartCard, { key: 4, title: 'Trades by Playbook' },
        h(window.Charts.Bars, { labels: setup.map(function (x) { return x.key; }), data: setup.map(function (x) { return x.count; }), fmt: 'plain', color: '#9b7bff', horizontal: true, height: Math.max(240, setup.length * 30) }))
    ]);
  }

  function BehaviorTab(trades) {
    var emo = C.groupSum(trades, function (t) { return t.emotion || 'Unlogged'; }).sort(function (a, b) { return b.pnl - a.pnl; });
    var rating = C.groupSum(trades, function (t) { return t.rating ? '★'.repeat(t.rating) : 'Unrated'; });
    rating.sort(function (a, b) { return a.key.length - b.key.length; });
    var mistakes = C.mistakeCost(trades);
    return grid([
      h(ChartCard, { key: 1, title: 'Net P&L by Emotion', sub: 'How your state affects results.' },
        h(window.Charts.Bars, { labels: emo.map(function (x) { return x.key; }), data: emo.map(function (x) { return x.pnl; }), horizontal: true, height: Math.max(240, emo.length * 30) })),
      h(ChartCard, { key: 2, title: 'Net P&L by Execution Rating', sub: 'Do well-executed trades pay more?' },
        h(window.Charts.Bars, { labels: rating.map(function (x) { return x.key; }), data: rating.map(function (x) { return x.pnl; }), height: 240 })),
      h(ChartCard, { key: 3, title: 'Mistake Cost', sub: 'Total P&L on trades carrying each mistake.', empty: mistakes.length ? null : 'No mistakes tagged — nice.' },
        mistakes.length ? h(window.Charts.Bars, { labels: mistakes.map(function (x) { return x.key; }), data: mistakes.map(function (x) { return x.pnl; }), horizontal: true, height: Math.max(240, mistakes.length * 30) }) : null),
      h(ChartCard, { key: 4, title: 'Win Rate by Emotion' },
        h(window.Charts.Bars, { labels: emo.map(function (x) { return x.key; }), data: emo.map(function (x) { return Math.round(x.winRate); }), fmt: 'pct', color: 'brand', horizontal: true, height: Math.max(240, emo.length * 30) }))
    ]);
  }

  function RiskTab(trades, state, ctx) {
    var rdist = C.rDistribution(trades);
    var s = C.stats(trades);
    var hasR = rdist.some(function (b) { return b.count > 0; });
    var startBal = (ctx.accountId && ctx.accountId !== 'all')
      ? ((state.accounts.find(function (a) { return a.id === ctx.accountId; }) || {}).startingBalance || 0)
      : state.accounts.reduce(function (x, a) { return x + (a.startingBalance || 0); }, 0);
    var dd = C.maxDrawdown(trades, startBal);
    return h('div', { className: 'space-y-4' },
      h('div', { className: 'grid grid-cols-2 lg:grid-cols-4 gap-4' },
        h(UI.StatCard, { label: 'Avg Win', value: Fmt.money(s.avgWin), color: 'text-profit' }),
        h(UI.StatCard, { label: 'Avg Loss', value: Fmt.money(-s.avgLoss), color: 'text-loss' }),
        h(UI.StatCard, { label: 'Avg R', value: s.avgR != null ? Fmt.num(s.avgR, 2) + 'R' : '—', sub: s.avgWinR != null ? 'Win ' + Fmt.num(s.avgWinR, 2) + 'R · Loss ' + Fmt.num(s.avgLossR, 2) + 'R' : 'Add risk $' }),
        h(UI.StatCard, { label: 'Max Drawdown', value: '-' + Fmt.money(dd.amount).slice(1), color: 'text-loss', sub: Fmt.pct(dd.pct) })),
      grid([
        h(ChartCard, { key: 1, title: 'R-Multiple Distribution', sub: 'Shape of your returns in R.', empty: hasR ? null : 'Add a risk amount to trades to see R.' },
          hasR ? h(window.Charts.Bars, { labels: rdist.map(function (b) { return b.key; }), data: rdist.map(function (b) { return b.count; }), fmt: 'plain', color: 'brand', height: 240 }) : null),
        h(ChartCard, { key: 2, title: 'Outcome Split' },
          h(window.Charts.Doughnut, { labels: ['Wins', 'Losses', 'Break-even'], data: [s.wins, s.losses, s.be], height: 240 }))
      ]));
  }

  window.Views = window.Views || {};
  window.Views.Reports = Reports;
})();
