/* ============================================================
   view.reports.js — full analytics report library (Views.Reports)
   Tabs: Overview · Time · Instruments · Strategy · Behavior · Risk
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, C = window.Store.calc, Store = window.Store;
  var useState = React.useState, useMemo = React.useMemo;

  /* ---- shared helpers ---- */
  function pf(s) { return s.profitFactor === Infinity ? '∞' : Fmt.num(s.profitFactor, 2); }
  function ChartCard(props) {
    return h(UI.Card, { className: 'p-4' },
      h('div', { className: 'mb-2' },
        h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, props.title),
        props.sub ? h('p', { className: 'text-xs text-slate-400 mt-0.5' }, props.sub) : null),
      props.empty ? h('div', { className: 'h-[220px] grid place-items-center text-slate-400 text-sm' }, props.empty) : props.children);
  }
  function grid2(children) { return h('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-4' }, children); }
  function byDow(trades) {
    var g = C.groupSum(trades, function (t) { return new Date(t.date + 'T00:00:00').getDay(); });
    var map = {}; g.forEach(function (x) { map[x.key] = x; });
    return [1,2,3,4,5,0,6].map(function (d) { return { key: Fmt.dow(d), o: map[d] || { pnl:0, count:0, wins:0, losses:0, winRate:0 } }; });
  }
  function startBal(state, ctx) {
    if (ctx.accountId && ctx.accountId !== 'all') {
      var a = state.accounts.find(function (x) { return x.id === ctx.accountId; });
      return a ? a.startingBalance : 0;
    }
    return state.accounts.reduce(function (sum, a) { return sum + (a.startingBalance || 0); }, 0);
  }


  /* ---- main Reports component ---- */
  function Reports(props) {
    var state = props.state, ctx = props.ctx;
    var trades = useMemo(function () { return Store.getTrades(ctx); }, [state, ctx.accountId, ctx.range]);
    var tab = useState('overview'); var t = tab[0];
    if (!trades.length) return h(UI.Empty, { icon: '📈', title: 'Nothing to report yet', sub: 'Add some trades to unlock the analytics.' });
    var TABS = [['overview','📊 Overview'],['time','🕒 Time'],['instruments','💹 Instruments'],['strategy','📘 Strategy'],['behavior','🧠 Behavior'],['risk','🛡️ Risk']];
    return h('div', { className: 'space-y-4 animate-fade-in' },
      h(UI.SectionHead, { title: 'Reports & Analytics', sub: 'Find your edges and your leaks across ' + trades.length + ' trades.',
        right: [h(UI.Button, { key: 'print', variant: 'ghost', size: 'sm', onClick: function() { window.print(); } }, '\ud83d\udda8 Print / PDF')] }),
      h('div', { className: 'flex gap-2 overflow-x-auto no-scrollbar pb-1' },
        TABS.map(function (x) {
          return h('button', { key: x[0], onClick: function () { tab[1](x[0]); },
            className: window.cx('px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap border transition',
              t === x[0] ? 'bg-brand text-white border-brand shadow-glow' : 'bg-white dark:bg-ink-800 border-slate-200 dark:border-ink-600 text-slate-500 dark:text-slate-300 hover:border-brand/40') }, x[1]);
        })),
      t === 'overview'     ? OverviewTab(trades, state, ctx) :
      t === 'time'         ? TimeTab(trades) :
      t === 'instruments'  ? InstrumentsTab(trades) :
      t === 'strategy'     ? StrategyTab(trades) :
      t === 'behavior'     ? BehaviorTab(trades) :
                             RiskTab(trades, state, ctx));
  }


  /* ================================================================
     OVERVIEW TAB — big stats table + equity + key metrics
     ================================================================ */
  function OverviewTab(trades, state, ctx) {
    var s = C.stats(trades);
    var sb = startBal(state, ctx);
    var dd = C.maxDrawdown(trades, sb);
    var eq = C.equityCurve(trades, sb);
    var edge = C.edgeScore(trades, sb);
    var disc = C.disciplineScore(trades);
    var daily = C.dailyPnl(trades);
    var days = Object.keys(daily);
    var greenDays = days.filter(function (d) { return daily[d].pnl > 0; }).length;
    var redDays = days.filter(function (d) { return daily[d].pnl < 0; }).length;
    var avgPerDay = days.length ? s.netPnl / days.length : 0;
    var largestDayWin = days.reduce(function (m, d) { return daily[d].pnl > m ? daily[d].pnl : m; }, 0);
    var largestDayLoss = days.reduce(function (m, d) { return daily[d].pnl < m ? daily[d].pnl : m; }, 0);
    var ratio = s.avgLoss > 0 ? s.avgWin / s.avgLoss : 0;

    function statRow(label, value, colorClass, hint) {
      return h('div', { className: 'flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-ink-700 last:border-0' },
        h('div', { className: 'flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300' },
          label, hint ? h('span', { className: 'cursor-help text-slate-400 text-xs', title: hint }, 'ⓘ') : null),
        h('div', { className: window.cx('text-sm font-bold', colorClass || '') }, value));
    }

    return h('div', { className: 'space-y-4' },
      /* top mini-metrics */
      h('div', { className: 'grid grid-cols-2 sm:grid-cols-4 gap-3' },
        mini('Edge Score', Fmt.num(edge.score, 1) + ' / 100', edge.score >= 75 ? 'text-profit' : edge.score >= 50 ? '' : 'text-loss'),
        mini('Discipline', disc.score + '%', disc.score >= 80 ? 'text-profit' : disc.score >= 60 ? '' : 'text-loss'),
        mini('Green days', greenDays + ' / ' + days.length, 'text-profit'),
        mini('Avg per day', Fmt.money(avgPerDay, { plus: true }), Fmt.signColor(avgPerDay))),
      /* two-column: stats tables */
      h('div', { className: 'grid grid-cols-1 xl:grid-cols-2 gap-4' },
        /* P&L stats */
        h(UI.Card, { className: 'p-4' },
          h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1' }, 'P&L breakdown'),
          statRow('Net P&L', Fmt.money(s.netPnl, { plus: true }), Fmt.signColor(s.netPnl)),
          statRow('Gross profit', Fmt.money(s.grossWin), 'text-profit'),
          statRow('Gross loss', '-' + Fmt.money(s.grossLoss), 'text-loss'),
          statRow('Total fees', Fmt.money(s.fees)),
          statRow('Avg P&L / trade', Fmt.money(s.expectancy, { plus: true }), Fmt.signColor(s.expectancy), 'Net P&L ÷ number of trades'),
          statRow('Avg P&L / day', Fmt.money(avgPerDay, { plus: true }), Fmt.signColor(avgPerDay)),
          statRow('Best day', Fmt.money(largestDayWin), 'text-profit'),
          statRow('Worst day', Fmt.money(largestDayLoss), 'text-loss')),
        /* performance stats */
        h(UI.Card, { className: 'p-4' },
          h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1' }, 'Performance metrics'),
          statRow('Total trades', String(s.total)),
          statRow('Win / loss / B/E', s.wins + ' / ' + s.losses + ' / ' + s.be),
          statRow('Win rate', Fmt.pct(s.winRate), s.winRate >= 50 ? 'text-profit' : 'text-loss'),
          statRow('Profit factor', pf(s), s.profitFactor >= 1 ? 'text-profit' : 'text-loss', 'Gross profit ÷ gross loss'),
          statRow('Avg win', Fmt.money(s.avgWin), 'text-profit'),
          statRow('Avg loss', '-' + Fmt.money(s.avgLoss), 'text-loss'),
          statRow('Win/loss ratio', ratio ? Fmt.num(ratio, 2) + 'x' : '—', ratio >= 1 ? 'text-profit' : 'text-loss'),
          statRow('Max drawdown', '-' + Fmt.money(dd.amount) + ' (' + Fmt.pct(dd.pct) + ')', 'text-loss'),
          statRow('Avg R', s.avgR != null ? Fmt.num(s.avgR, 2) + 'R' : '—', s.avgR != null ? Fmt.signColor(s.avgR) : ''),
          statRow('Win streak', String(s.winStreak), 'text-profit'),
          statRow('Loss streak', String(s.lossStreak), 'text-loss'))),
      /* equity curve */
      h(UI.Card, { className: 'p-4' },
        h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2' }, 'Equity curve'),
        h(window.Charts.Line, {
          labels: eq.map(function (p, i) { return i === 0 ? 'Start' : Fmt.dateShort(p.label); }),
          data: eq.map(function (p) { return p.value; }), height: 280 })));
  }
  function mini(label, value, color) {
    return h(UI.Card, { className: 'p-3.5' },
      h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, label),
      h('div', { className: window.cx('text-xl font-extrabold mt-0.5', color) }, value));
  }


  /* ================================================================
     TIME TAB
     ================================================================ */
  function TimeTab(trades) {
    var dow = byDow(trades);
    var hour = C.groupSum(trades, function (t) { return (t.time || '00:00').split(':')[0]; }).sort(function (a, b) { return parseInt(a.key) - parseInt(b.key); });
    var month = C.groupSum(trades, function (t) { return t.date.slice(0, 7); }).sort(function (a, b) { return a.key < b.key ? -1 : 1; });
    var daily = C.dailyPnl(trades);
    var dayKeys = Object.keys(daily).sort();
    return h('div', { className: 'space-y-4' },
      grid2([
        h(ChartCard, { key: 'd1', title: 'Net P&L by Day of Week', sub: 'Which days carry your week?' },
          h(window.Charts.Bars, { labels: dow.map(function (x) { return x.key; }), data: dow.map(function (x) { return x.o.pnl; }), height: 240 })),
        h(ChartCard, { key: 'd2', title: 'Win Rate by Day of Week' },
          h(window.Charts.Bars, { labels: dow.map(function (x) { return x.key; }), data: dow.map(function (x) { return Math.round(x.o.winRate); }), fmt: 'pct', color: 'brand', height: 240 })),
        h(ChartCard, { key: 'd3', title: 'Trades per Day of Week' },
          h(window.Charts.Bars, { labels: dow.map(function (x) { return x.key; }), data: dow.map(function (x) { return x.o.count; }), fmt: 'plain', color: '#9b7bff', height: 240 })),
        h(ChartCard, { key: 'd4', title: 'Net P&L by Hour', sub: 'Most and least profitable times.' },
          h(window.Charts.Bars, { labels: hour.map(function (x) { return Fmt.hourLabel(x.key); }), data: hour.map(function (x) { return x.pnl; }), height: 240 })),
        h(ChartCard, { key: 'd5', title: 'Win Rate by Hour' },
          h(window.Charts.Bars, { labels: hour.map(function (x) { return Fmt.hourLabel(x.key); }), data: hour.map(function (x) { return Math.round(x.winRate); }), fmt: 'pct', color: 'brand', height: 240 })),
        h(ChartCard, { key: 'd6', title: 'Net P&L by Month' },
          h(window.Charts.Bars, { labels: month.map(function (x) { return x.key; }), data: month.map(function (x) { return x.pnl; }), height: 240 })),
        h(ChartCard, { key: 'd7', title: 'Net Daily P&L', sub: 'Every trading day as a bar.' },
          h(window.Charts.Bars, { labels: dayKeys.map(function (k) { return Fmt.dateShort(k); }), data: dayKeys.map(function (k) { return daily[k].pnl; }), height: 260 })),
        h(ChartCard, { key: 'd8', title: 'Trades per Hour' },
          h(window.Charts.Bars, { labels: hour.map(function (x) { return Fmt.hourLabel(x.key); }), data: hour.map(function (x) { return x.count; }), fmt: 'plain', color: '#9b7bff', height: 240 }))
      ]));
  }

  /* ================================================================
     INSTRUMENTS TAB
     ================================================================ */
  function InstrumentsTab(trades) {
    var sym = C.groupSum(trades, function (t) { return t.symbol; }).sort(function (a, b) { return b.pnl - a.pnl; });
    var symTop = sym.slice(0, 14);
    var longs = trades.filter(function (t) { return t.side !== 'short'; });
    var shorts = trades.filter(function (t) { return t.side === 'short'; });
    var ls = C.stats(longs), ss = C.stats(shorts);
    return h('div', { className: 'space-y-4' },
      /* direction summary */
      h('div', { className: 'grid grid-cols-2 sm:grid-cols-4 gap-3' },
        mini('Long P&L', Fmt.money(ls.netPnl, { plus: true }), Fmt.signColor(ls.netPnl)),
        mini('Long win %', Fmt.pct(ls.winRate), ls.winRate >= 50 ? 'text-profit' : 'text-loss'),
        mini('Short P&L', Fmt.money(ss.netPnl, { plus: true }), Fmt.signColor(ss.netPnl)),
        mini('Short win %', Fmt.pct(ss.winRate), ss.winRate >= 50 ? 'text-profit' : 'text-loss')),
      grid2([
        h(ChartCard, { key: 'i1', title: 'Net P&L by Symbol' },
          h(window.Charts.Bars, { labels: symTop.map(function (x) { return x.key; }), data: symTop.map(function (x) { return x.pnl; }), horizontal: true, height: Math.max(240, symTop.length * 28) })),
        h(ChartCard, { key: 'i2', title: 'Win Rate by Symbol' },
          h(window.Charts.Bars, { labels: symTop.map(function (x) { return x.key; }), data: symTop.map(function (x) { return Math.round(x.winRate); }), fmt: 'pct', color: 'brand', horizontal: true, height: Math.max(240, symTop.length * 28) })),
        h(ChartCard, { key: 'i3', title: 'Long vs Short — Net P&L' },
          h(window.Charts.Bars, { labels: ['Long', 'Short'], data: [ls.netPnl, ss.netPnl], height: 240 })),
        h(ChartCard, { key: 'i4', title: 'Long vs Short — Win Rate' },
          h(window.Charts.Bars, { labels: ['Long', 'Short'], data: [Math.round(ls.winRate), Math.round(ss.winRate)], fmt: 'pct', color: 'brand', height: 240 })),
        h(ChartCard, { key: 'i5', title: 'Trade Count by Symbol' },
          h(window.Charts.Bars, { labels: symTop.map(function (x) { return x.key; }), data: symTop.map(function (x) { return x.count; }), fmt: 'plain', color: '#9b7bff', horizontal: true, height: Math.max(240, symTop.length * 28) })),
        h(ChartCard, { key: 'i6', title: 'Profit Factor by Symbol', empty: symTop.length < 2 ? 'Need 2+ symbols.' : null },
          symTop.length >= 2 ? h(window.Charts.Bars, { labels: symTop.map(function (x) { return x.key; }), data: symTop.map(function (x) { return x.wins + x.losses > 0 ? Math.min(5, x.wins / (x.losses || 1)) : 0; }), fmt: 'plain', color: 'brand', horizontal: true, height: Math.max(240, symTop.length * 28) }) : null)
      ]),
      /* per-symbol table */
      h(UI.Card, { className: 'p-4' },
        h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2' }, 'Symbol breakdown'),
        h('div', { className: 'overflow-x-auto' },
          h('table', { className: 'w-full text-sm min-w-[640px]' },
            h('thead', null, h('tr', { className: 'text-left text-[11px] uppercase tracking-wide text-slate-400' },
              ['Symbol','Trades','Win rate','Net P&L','Avg win','Avg loss','Profit factor'].map(function (c) { return h('th', { key: c, className: 'py-2 pr-4 font-semibold' }, c); }))),
            h('tbody', null, symTop.map(function (x) {
              var ts = trades.filter(function (t) { return t.symbol === x.key; });
              var st = C.stats(ts);
              return h('tr', { key: x.key, className: 'border-t border-slate-100 dark:border-ink-700' },
                h('td', { className: 'py-2 pr-4 font-semibold' }, x.key),
                h('td', { className: 'pr-4' }, x.count),
                h('td', { className: 'pr-4 ' + (x.winRate >= 50 ? 'text-profit' : 'text-loss') }, Fmt.pct(x.winRate)),
                h('td', { className: 'pr-4 font-semibold ' + Fmt.signColor(x.pnl) }, Fmt.money(x.pnl, { plus: true })),
                h('td', { className: 'pr-4 text-profit' }, Fmt.money(st.avgWin)),
                h('td', { className: 'pr-4 text-loss' }, '-' + Fmt.money(st.avgLoss)),
                h('td', { className: 'pr-4 ' + (st.profitFactor >= 1 ? 'text-profit' : 'text-loss') }, pf(st)));
            }))))));
  }


  /* ================================================================
     STRATEGY TAB
     ================================================================ */
  function StrategyTab(trades) {
    var setup = C.groupSum(trades, function (t) { return t.setup || 'Untagged'; }).sort(function (a, b) { return b.pnl - a.pnl; });
    var tags = C.groupSum(trades, function (t) { return (t.tags && t.tags.length) ? t.tags : null; }).sort(function (a, b) { return b.pnl - a.pnl; });
    return h('div', { className: 'space-y-4' },
      grid2([
        h(ChartCard, { key: 's1', title: 'Net P&L by Playbook', sub: 'Which setups pay?' },
          h(window.Charts.Bars, { labels: setup.map(function (x) { return x.key; }), data: setup.map(function (x) { return x.pnl; }), horizontal: true, height: Math.max(240, setup.length * 30) })),
        h(ChartCard, { key: 's2', title: 'Win Rate by Playbook' },
          h(window.Charts.Bars, { labels: setup.map(function (x) { return x.key; }), data: setup.map(function (x) { return Math.round(x.winRate); }), fmt: 'pct', color: 'brand', horizontal: true, height: Math.max(240, setup.length * 30) })),
        h(ChartCard, { key: 's3', title: 'Trade Count by Playbook' },
          h(window.Charts.Bars, { labels: setup.map(function (x) { return x.key; }), data: setup.map(function (x) { return x.count; }), fmt: 'plain', color: '#9b7bff', horizontal: true, height: Math.max(240, setup.length * 30) })),
        h(ChartCard, { key: 's4', title: 'Net P&L by Tag', empty: tags.length ? null : 'No tags yet — add tags to your trades.' },
          tags.length ? h(window.Charts.Bars, { labels: tags.map(function (x) { return x.key; }), data: tags.map(function (x) { return x.pnl; }), horizontal: true, height: Math.max(240, tags.length * 28) }) : null)
      ]),
      /* playbook table */
      h(UI.Card, { className: 'p-4' },
        h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2' }, 'Playbook breakdown'),
        h('div', { className: 'overflow-x-auto' },
          h('table', { className: 'w-full text-sm min-w-[640px]' },
            h('thead', null, h('tr', { className: 'text-left text-[11px] uppercase tracking-wide text-slate-400' },
              ['Playbook','Trades','Win rate','Net P&L','Avg win','Avg loss','Profit factor'].map(function (c) { return h('th', { key: c, className: 'py-2 pr-4 font-semibold' }, c); }))),
            h('tbody', null, setup.map(function (x) {
              var ts = trades.filter(function (t) { return (t.setup || 'Untagged') === x.key; });
              var st = C.stats(ts);
              return h('tr', { key: x.key, className: 'border-t border-slate-100 dark:border-ink-700' },
                h('td', { className: 'py-2 pr-4 font-semibold' }, x.key),
                h('td', { className: 'pr-4' }, x.count),
                h('td', { className: 'pr-4 ' + (x.winRate >= 50 ? 'text-profit' : 'text-loss') }, Fmt.pct(x.winRate)),
                h('td', { className: 'pr-4 font-semibold ' + Fmt.signColor(x.pnl) }, Fmt.money(x.pnl, { plus: true })),
                h('td', { className: 'pr-4 text-profit' }, Fmt.money(st.avgWin)),
                h('td', { className: 'pr-4 text-loss' }, '-' + Fmt.money(st.avgLoss)),
                h('td', { className: 'pr-4 ' + (st.profitFactor >= 1 ? 'text-profit' : 'text-loss') }, pf(st)));
            }))))));
  }

  /* ================================================================
     BEHAVIOR TAB
     ================================================================ */
  function BehaviorTab(trades) {
    var emo = C.groupSum(trades, function (t) { return t.emotion || 'Unlogged'; }).sort(function (a, b) { return b.pnl - a.pnl; });
    var rating = C.groupSum(trades, function (t) { return t.rating ? '★'.repeat(t.rating) : 'Unrated'; });
    rating.sort(function (a, b) { return a.key.length - b.key.length; });
    var mistakes = C.mistakeCost(trades);
    var disc = C.disciplineScore(trades);
    var scoreColor = disc.score >= 80 ? '#16c784' : disc.score >= 60 ? '#f0a32a' : '#ea3943';
    return h('div', { className: 'space-y-4' },
      /* discipline banner */
      h(UI.Card, { className: 'p-4' },
        h('div', { className: 'flex items-center gap-6 flex-wrap' },
          h('div', null,
            h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1' }, 'Discipline score'),
            h('div', { className: 'flex items-end gap-1' },
              h('span', { className: 'text-4xl font-extrabold', style: { color: scoreColor } }, disc.score),
              h('span', { className: 'text-slate-400 mb-1' }, '%')),
            h('div', { className: 'text-xs text-slate-400 mt-0.5' }, disc.clean + ' of ' + disc.total + ' trades without mistakes')),
          h('div', { className: 'flex-1 min-w-[200px]' }, h(UI.Progress, { value: disc.score, color: scoreColor })))),
      grid2([
        h(ChartCard, { key: 'b1', title: 'Net P&L by Emotion' },
          h(window.Charts.Bars, { labels: emo.map(function (x) { return x.key; }), data: emo.map(function (x) { return x.pnl; }), horizontal: true, height: Math.max(240, emo.length * 30) })),
        h(ChartCard, { key: 'b2', title: 'Win Rate by Emotion' },
          h(window.Charts.Bars, { labels: emo.map(function (x) { return x.key; }), data: emo.map(function (x) { return Math.round(x.winRate); }), fmt: 'pct', color: 'brand', horizontal: true, height: Math.max(240, emo.length * 30) })),
        h(ChartCard, { key: 'b3', title: 'Net P&L by Execution Rating' },
          h(window.Charts.Bars, { labels: rating.map(function (x) { return x.key; }), data: rating.map(function (x) { return x.pnl; }), height: 240 })),
        h(ChartCard, { key: 'b4', title: 'Mistake cost', sub: 'Total P&L on trades carrying each mistake.', empty: mistakes.length ? null : 'No mistakes tagged — nice.' },
          mistakes.length ? h(window.Charts.Bars, { labels: mistakes.map(function (x) { return x.key; }), data: mistakes.map(function (x) { return x.pnl; }), horizontal: true, height: Math.max(240, mistakes.length * 30) }) : null)
      ]),
      /* mistake table */
      mistakes.length ? h(UI.Card, { className: 'p-4' },
        h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2' }, 'Mistake breakdown'),
        h('div', { className: 'overflow-x-auto' },
          h('table', { className: 'w-full text-sm min-w-[460px]' },
            h('thead', null, h('tr', { className: 'text-left text-[11px] uppercase tracking-wide text-slate-400' },
              ['Mistake','Count','Total cost','Avg cost per trade'].map(function (c) { return h('th', { key: c, className: 'py-2 pr-4 font-semibold' }, c); }))),
            h('tbody', null, mistakes.map(function (m) {
              return h('tr', { key: m.key, className: 'border-t border-slate-100 dark:border-ink-700' },
                h('td', { className: 'py-2 pr-4 font-semibold' }, m.key),
                h('td', { className: 'pr-4' }, m.count),
                h('td', { className: 'pr-4 ' + Fmt.signColor(m.pnl) }, Fmt.money(m.pnl, { plus: true })),
                h('td', { className: 'pr-4 ' + Fmt.signColor(m.pnl / m.count) }, Fmt.money(m.pnl / m.count, { plus: true })));
            }))))) : null);
  }

  /* ================================================================
     RISK TAB
     ================================================================ */
  function RiskTab(trades, state, ctx) {
    var s = C.stats(trades);
    var sb = startBal(state, ctx);
    var dd = C.maxDrawdown(trades, sb);
    var rdist = C.rDistribution(trades);
    var hasR = rdist.some(function (b) { return b.count > 0; });
    var withRisk = trades.filter(function (t) { return Number(t.riskAmount) > 0; });
    var recovery = C.recoveryFactor ? C.recoveryFactor(trades, sb) : null;
    return h('div', { className: 'space-y-4' },
      /* key risk metrics strip */
      h('div', { className: 'grid grid-cols-2 sm:grid-cols-4 gap-3' },
        mini('Avg win', Fmt.money(s.avgWin), 'text-profit'),
        mini('Avg loss', '-' + Fmt.money(s.avgLoss), 'text-loss'),
        mini('Max drawdown', '-' + Fmt.money(dd.amount) + ' (' + Fmt.pct(dd.pct) + ')', 'text-loss'),
        mini('Recovery factor', recovery != null ? (recovery === Infinity ? '∞' : Fmt.num(recovery, 2)) : '—', recovery != null && recovery > 0 ? 'text-profit' : '')),
      grid2([
        h(ChartCard, { key: 'r1', title: 'R-Multiple Distribution', sub: 'Shape of your returns in R.', empty: hasR ? null : 'Add a risk amount to trades to see R-multiple distribution.' },
          hasR ? h(window.Charts.Bars, { labels: rdist.map(function (b) { return b.key; }), data: rdist.map(function (b) { return b.count; }), fmt: 'plain', color: 'brand', height: 240 }) : null),
        h(ChartCard, { key: 'r2', title: 'Win / Loss / Break-even split' },
          h(window.Charts.Doughnut, { labels: ['Wins', 'Losses', 'Break-even'], data: [s.wins, s.losses, s.be], height: 240 })),
        h(ChartCard, { key: 'r3', title: 'Avg R per playbook', empty: hasR ? null : 'Add risk amounts to trades to unlock this.' },
          hasR ? h(window.Charts.Bars, {
            labels: C.groupSum(withRisk, function (t) { return t.setup || 'Untagged'; }).map(function (g) { return g.key; }),
            data: C.groupSum(withRisk, function (t) { return t.setup || 'Untagged'; }).map(function (g) {
              var ts = withRisk.filter(function (t) { return (t.setup || 'Untagged') === g.key; });
              var rs = ts.map(function (t) { return C.rOf(t); }).filter(function (r) { return r !== null; });
              return rs.length ? rs.reduce(function (a, b) { return a + b; }, 0) / rs.length : 0;
            }), fmt: 'plain', horizontal: true, height: 240 }) : null),
        h(ChartCard, { key: 'r4', title: 'Long vs short risk / reward' },
          h(window.Charts.Bars, {
            labels: ['Long avg win', 'Long avg loss', 'Short avg win', 'Short avg loss'],
            data: [C.stats(trades.filter(function (t) { return t.side !== 'short'; })).avgWin,
                   -C.stats(trades.filter(function (t) { return t.side !== 'short'; })).avgLoss,
                   C.stats(trades.filter(function (t) { return t.side === 'short'; })).avgWin,
                   -C.stats(trades.filter(function (t) { return t.side === 'short'; })).avgLoss],
            height: 240 }))
      ]));
  }

  window.Views = window.Views || {};
  window.Views.Reports = Reports;
})();
