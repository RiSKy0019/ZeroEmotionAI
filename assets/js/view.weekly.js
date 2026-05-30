/* ============================================================
   view.weekly.js — Weekly Performance Summary (Views.Weekly)
   A digest-style view: week-by-week breakdown, best/worst weeks,
   consistency heatmap, and actionable week-over-week trends.
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, C = window.Store.calc;
  var useState = React.useState, useMemo = React.useMemo;

  function getWeekKey(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var day = d.getDay();
    var mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return mon.getFullYear() + '-' + String(mon.getMonth() + 1).padStart(2, '0') + '-' + String(mon.getDate()).padStart(2, '0');
  }

  function buildWeeks(trades) {
    var map = {};
    trades.forEach(function (t) {
      var wk = getWeekKey(t.date);
      if (!map[wk]) map[wk] = [];
      map[wk].push(t);
    });
    return Object.keys(map).sort().map(function (wk) {
      var wt = map[wk];
      var s = C.stats(wt);
      var daily = C.dailyPnl(wt);
      var days = Object.keys(daily).length;
      var best = wt.reduce(function (m, t) { return C.pnlOf(t) > C.pnlOf(m) ? t : m; }, wt[0]);
      var worst = wt.reduce(function (m, t) { return C.pnlOf(t) < C.pnlOf(m) ? t : m; }, wt[0]);
      return { week: wk, trades: wt, stats: s, days: days, bestTrade: best, worstTrade: worst };
    });
  }

  function pnlCls(n) { return n > 0 ? 'pnl-pos' : n < 0 ? 'pnl-neg' : 'pnl-zero'; }

  function Weekly(props) {
    var state = props.state, ctx = props.ctx;
    var trades = useMemo(function () { return window.Store.getTrades(ctx); }, [state, ctx.accountId, ctx.range]);

    if (!trades.length) {
      return h(UI.Empty, { icon: '📆', title: 'No trades to summarise', sub: 'Add trades to see your week-by-week performance.' });
    }

    var weeks = useMemo(function () { return buildWeeks(trades); }, [trades]);
    var pageS = useState(0); var page = pageS[0];
    var WEEKS_PER_PAGE = 8;
    var totalPages = Math.ceil(weeks.length / WEEKS_PER_PAGE);
    var visible = weeks.slice().reverse().slice(page * WEEKS_PER_PAGE, (page + 1) * WEEKS_PER_PAGE);

    /* summary stats across all weeks */
    var greenWeeks = weeks.filter(function (w) { return w.stats.netPnl > 0; }).length;
    var redWeeks   = weeks.filter(function (w) { return w.stats.netPnl < 0; }).length;
    var bestWeek   = weeks.reduce(function (m, w) { return w.stats.netPnl > m.stats.netPnl ? w : m; }, weeks[0]);
    var worstWeek  = weeks.reduce(function (m, w) { return w.stats.netPnl < m.stats.netPnl ? w : m; }, weeks[0]);
    var avgNetPnl  = weeks.reduce(function (s, w) { return s + w.stats.netPnl; }, 0) / weeks.length;
    var avgWinRate = weeks.reduce(function (s, w) { return s + w.stats.winRate; }, 0) / weeks.length;

    /* trend: is the last 4 weeks better than the prior 4? */
    var trend = null;
    if (weeks.length >= 8) {
      var recent = weeks.slice(-4).reduce(function (s, w) { return s + w.stats.netPnl; }, 0);
      var prior  = weeks.slice(-8, -4).reduce(function (s, w) { return s + w.stats.netPnl; }, 0);
      trend = recent - prior;
    }

    return h('div', { className: 'space-y-5 animate-fade-in' },
      h(UI.SectionHead, { title: 'Weekly Summary', sub: 'Week-by-week performance digest across ' + weeks.length + ' week' + (weeks.length === 1 ? '' : 's') + '.' }),

      /* ── summary strip ── */
      h('div', { className: 'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3' },
        miniCard('Weeks tracked', String(weeks.length)),
        miniCard('Green weeks', String(greenWeeks), 'pnl-pos'),
        miniCard('Red weeks', String(redWeeks), 'pnl-neg'),
        miniCard('Avg P&L / week', Fmt.money(avgNetPnl, { plus: true }), pnlCls(avgNetPnl)),
        miniCard('Avg win rate', Fmt.pct(avgWinRate), avgWinRate >= 50 ? 'pnl-pos' : 'pnl-neg'),
        trend != null
          ? miniCard('Recent trend (4w)', Fmt.money(trend, { plus: true }), pnlCls(trend))
          : miniCard('Best week P&L', Fmt.money(bestWeek.stats.netPnl, { plus: true }), 'pnl-pos')),

      /* ── best / worst weeks ── */
      h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
        weekHighlight('🏆 Best week', bestWeek, true),
        weekHighlight('📉 Worst week', worstWeek, false)),

      /* ── P&L chart over weeks ── */
      h(UI.Card, { className: 'p-5' },
        h('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3' }, 'Weekly Net P&L'),
        h(window.Charts.Bars, {
          labels: weeks.map(function (w) { return Fmt.dateShort(w.week); }),
          data:   weeks.map(function (w) { return w.stats.netPnl; }),
          height: 240 })),

      /* ── week-by-week table ── */
      h(UI.Card, { className: 'p-5' },
        h('div', { className: 'flex items-center justify-between mb-3 flex-wrap gap-2' },
          h('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400' }, 'Week by Week'),
          totalPages > 1 ? h('div', { className: 'flex items-center gap-2' },
            h('button', { className: 'tz-btn tz-btn-ghost tz-btn-sm', disabled: page === 0, onClick: function () { pageS[1](page - 1); } }, '‹'),
            h('span', { className: 'text-xs text-slate-400' }, (page + 1) + ' / ' + totalPages),
            h('button', { className: 'tz-btn tz-btn-ghost tz-btn-sm', disabled: page >= totalPages - 1, onClick: function () { pageS[1](page + 1); } }, '›')) : null),
        h('div', { className: 'overflow-x-auto' },
          h('table', { className: 'tz-table' },
            h('thead', null, h('tr', null,
              ['Week of', 'Trades', 'Days', 'Win rate', 'Net P&L', 'Avg P&L/trade', 'Best trade', 'Worst trade'].map(function (c) {
                return h('th', { key: c }, c);
              }))),
            h('tbody', null, visible.map(function (w) {
              var s = w.stats;
              var bp = C.pnlOf(w.bestTrade), wp2 = C.pnlOf(w.worstTrade);
              var rowCls = s.netPnl > 0 ? 'bg-profit/[0.03]' : s.netPnl < 0 ? 'bg-loss/[0.03]' : '';
              return h('tr', { key: w.week, className: rowCls },
                h('td', { className: 'font-semibold' }, Fmt.date(w.week)),
                h('td', { className: 'num' }, s.total),
                h('td', { className: 'num' }, w.days),
                h('td', { className: 'num ' + (s.winRate >= 50 ? 'pnl-pos' : 'pnl-neg') }, Fmt.pct(s.winRate)),
                h('td', { className: 'num font-bold ' + pnlCls(s.netPnl) }, Fmt.money(s.netPnl, { plus: true })),
                h('td', { className: 'num ' + pnlCls(s.expectancy) }, Fmt.money(s.expectancy, { plus: true })),
                h('td', { className: 'num pnl-pos' }, Fmt.money(bp, { plus: true })),
                h('td', { className: 'num pnl-neg' }, Fmt.money(wp2, { plus: true })));
            }))))
      )
      ,
      h(MonthlyComparison, { trades: trades })
    );
  }

  function MonthlyComparison(props) {
    var byMonth = {};
    props.trades.forEach(function(t) {
      var m = t.date.slice(0,7);
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(t);
    });
    var months = Object.keys(byMonth).sort();
    if (months.length < 2) return null;
    var data = months.map(function(m) { return C.stats(byMonth[m]).netPnl; });
    var recent = months.slice(-3);
    return h(UI.Card, { className: 'p-5' },
      h('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3' }, 'Monthly Performance'),
      h(window.Charts.Bars, { labels: months, data: data, height: 220 }),
      recent.length >= 2 ? h('div', { className: 'flex gap-3 mt-3 flex-wrap' },
        recent.slice(1).map(function(m, i) {
          var cur = C.stats(byMonth[m]).netPnl;
          var prev = C.stats(byMonth[recent[i]]).netPnl;
          var chg = cur - prev;
          return h('div', { key: m, className: 'card-base p-3 flex-1 min-w-[120px]' },
            h('div', { className: 'text-xs text-slate-400' }, m),
            h('div', { className: 'font-bold text-sm ' + (cur>=0?'pnl-pos':'pnl-neg') }, Fmt.money(cur,{plus:true})),
            h('div', { className: 'text-xs ' + (chg>=0?'pnl-pos':'pnl-neg') }, (chg>=0?'+':'') + Fmt.moneyShort(chg) + ' vs prev'));
        })) : null);
  }

  function miniCard(label, value, cls) {
    return h(UI.Card, { className: 'p-3.5' },
      h('div', { className: 'text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1' }, label),
      h('div', { className: window.cx('text-lg font-extrabold', cls || '') }, value));
  }

  function weekHighlight(label, w, isGood) {
    var s = w.stats;
    return h(UI.Card, { className: 'p-5' },
      h('div', { className: 'flex items-start justify-between mb-2' },
        h('div', null,
          h('div', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400' }, label),
          h('div', { className: 'font-bold text-sm mt-0.5' }, 'Week of ' + Fmt.date(w.week))),
        h('div', { className: window.cx('stat-value', isGood ? 'pnl-pos' : 'pnl-neg') }, Fmt.money(s.netPnl, { plus: true }))),
      h('div', { className: 'grid grid-cols-3 gap-3 mt-3' },
        h('div', null,
          h('div', { className: 'text-[10px] text-slate-400 font-semibold uppercase tracking-wide' }, 'Trades'),
          h('div', { className: 'font-bold text-sm mt-0.5' }, s.total)),
        h('div', null,
          h('div', { className: 'text-[10px] text-slate-400 font-semibold uppercase tracking-wide' }, 'Win rate'),
          h('div', { className: window.cx('font-bold text-sm mt-0.5', s.winRate >= 50 ? 'pnl-pos' : 'pnl-neg') }, Fmt.pct(s.winRate))),
        h('div', null,
          h('div', { className: 'text-[10px] text-slate-400 font-semibold uppercase tracking-wide' }, 'Prof. factor'),
          h('div', { className: window.cx('font-bold text-sm mt-0.5', s.profitFactor >= 1 ? 'pnl-pos' : 'pnl-neg') },
            s.profitFactor === Infinity ? '∞' : Fmt.num(s.profitFactor, 2)))));
  }

  window.Views = window.Views || {};
  window.Views.Weekly = Weekly;
})();
