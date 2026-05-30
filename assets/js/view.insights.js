/* ============================================================
   view.insights.js — AI Insights screen (window.Views.Insights)
   Renders statistical findings grouped into leaks / strengths / info.
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, C = window.Store.calc;
  var useMemo = React.useMemo;

  function byWeight(a, b) { return (b.weight || 0) - (a.weight || 0); }

  function InsightCard(props) {
    var k = props.item.kind;
    var border = k === 'leak' ? 'border-l-loss' : k === 'strength' ? 'border-l-profit' : 'border-l-brand';
    return h('div', { className: window.cx('bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 border-l-4 rounded-xl p-4 flex gap-3', border) },
      h('div', { className: 'text-xl leading-none mt-0.5' }, props.item.icon),
      h('div', null,
        h('div', { className: 'font-semibold text-sm' }, props.item.title),
        h('div', { className: 'text-sm text-slate-500 dark:text-slate-400 mt-0.5' }, props.item.text)));
  }

  function Insights(props) {
    var state = props.state, ctx = props.ctx;
    var trades = useMemo(function () { return window.Store.getTrades(ctx); }, [state, ctx.accountId, ctx.range]);
    var items = useMemo(function () { return window.Insights.generate(trades); }, [trades]);

    var leaks = items.filter(function (i) { return i.kind === 'leak'; }).sort(byWeight);
    var strengths = items.filter(function (i) { return i.kind === 'strength'; }).sort(byWeight);
    var info = items.filter(function (i) { return i.kind === 'info'; });

    var head = h(UI.SectionHead, { title: 'AI Insights', sub: 'Plain-English findings generated from your trade data — your leaks, your edges, and what to fix first.' });

    if (trades.length < 5) {
      return h('div', { className: 'space-y-4 animate-fade-in' }, head,
        h(UI.Empty, { icon: '\uD83D\uDCA1', title: 'Not enough data yet', sub: 'Log at least 5 trades (manually or via CSV / TradingView import) to unlock insights.',
          action: h(UI.Button, { variant: 'primary', onClick: props.onAddTrade }, '+ Add Trade') }));
    }

    function section(title, list, tone) {
      if (!list.length) return null;
      return h('div', null,
        h('div', { className: 'flex items-center gap-2 mb-2 mt-2' },
          h('h3', { className: 'text-sm font-bold' }, title),
          h('span', { className: window.cx('text-[11px] px-1.5 py-0.5 rounded-full font-semibold', tone) }, list.length)),
        h('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-3' }, list.map(function (it, i) { return h(InsightCard, { key: i, item: it }); })));
    }

    // top focus banner = biggest leak
    var focus = leaks[0];

    return h('div', { className: 'space-y-4 animate-fade-in' },
      head,
      // summary strip
      h('div', { className: 'grid grid-cols-3 gap-3' },
        summaryCard('Leaks to fix', leaks.length, 'text-loss'),
        summaryCard("What's working", strengths.length, 'text-profit'),
        summaryCard('Trades analysed', trades.length, '')),
      focus ? h(UI.Card, { className: 'p-4 border-l-4 border-l-loss' },
        h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1' }, '\uD83C\uDFAF Fix this first'),
        h('div', { className: 'font-semibold' }, focus.icon + ' ' + focus.title),
        h('div', { className: 'text-sm text-slate-500 dark:text-slate-400 mt-0.5' }, focus.text)) : null,
      section('Leaks to fix', leaks, 'bg-loss/15 text-loss'),
      section("What's working", strengths, 'bg-profit/15 text-profit'),
      section('Good to know', info, 'bg-brand/15 text-brand-400'),
      h('p', { className: 'text-xs text-slate-400 pt-2' }, 'Insights are computed locally from your trades — no AI key or internet required. They update with your account, date range and filters.')
    );
  }

  function summaryCard(label, value, color) {
    return h(UI.Card, { className: 'p-4' },
      h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, label),
      h('div', { className: window.cx('text-2xl font-extrabold', color) }, value));
  }

  window.Views = window.Views || {};
  window.Views.Insights = Insights;
})();
