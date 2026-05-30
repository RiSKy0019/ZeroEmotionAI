/* ============================================================
   view.insights.js — Advanced AI Insights screen (Views.Insights)
   Shows findings with priority scoring, expandable detail panels,
   category filters, and a discipline progress tracker.
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, C = window.Store.calc;
  var useMemo = React.useMemo, useState = React.useState;

  var KIND_META = {
    leak:     { label: 'Leak',     accent: '#f6465d', bg: 'bg-loss/8 dark:bg-loss/5',     border: 'border-l-loss',    badge: 'badge badge-loss' },
    strength: { label: 'Strength', accent: '#0ecb81', bg: 'bg-profit/8 dark:bg-profit/5', border: 'border-l-profit',  badge: 'badge badge-win'  },
    info:     { label: 'Info',     accent: '#7c5cff', bg: 'bg-brand/5',                    border: 'border-l-brand',   badge: 'badge badge-brand'}
  };

  /* ---- priority label ---- */
  function priorityLabel(p) {
    if (p <= 0) return null;
    if (p >= 600) return { label: 'Critical', cls: 'bg-loss text-white' };
    if (p >= 350) return { label: 'High',     cls: 'bg-warn text-white' };
    if (p >= 150) return { label: 'Medium',   cls: 'badge badge-brand' };
    return { label: 'Low', cls: 'badge badge-be' };
  }

  /* ---- single insight card ---- */
  function InsightCard(props) {
    var item = props.item;
    var expanded = useState(false);
    var m = KIND_META[item.kind] || KIND_META.info;
    var pl = priorityLabel(item.priority || 0);
    var hasDetail = item.detail && item.detail.length > 0;

    return h('div', { className: 'card-base border-l-4 ' + m.border + ' ' + m.bg + ' overflow-hidden animate-fade-in' },
      h('div', { className: 'p-4' },
        /* header row */
        h('div', { className: 'flex items-start justify-between gap-3 mb-1' },
          h('div', { className: 'flex items-center gap-2.5 flex-1 min-w-0' },
            h('span', { className: 'text-xl leading-none shrink-0' }, item.icon),
            h('div', { className: 'font-semibold text-[14px] leading-snug' }, item.title)),
          h('div', { className: 'flex items-center gap-1.5 shrink-0' },
            pl ? h('span', { className: window.cx('text-[10px] font-bold px-2 py-0.5 rounded-full', pl.cls) }, pl.label) : null,
            h('span', { className: m.badge }, m.label))),
        /* main text */
        h('p', { className: 'text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-1 ml-[30px]' }, item.text),
        /* expand toggle */
        hasDetail ? h('button', {
          className: 'ml-[30px] mt-2 text-xs font-semibold text-brand-400 hover:text-brand flex items-center gap-1 trans-colors',
          onClick: function () { expanded[1](!expanded[0]); }
        }, expanded[0] ? '▲ Hide action plan' : '▼ Show action plan') : null),
      /* detail panel */
      hasDetail && expanded[0] ? h('div', { className: 'border-t border-slate-100 dark:border-ink-700 bg-white/60 dark:bg-ink-800/60 px-4 py-3 ml-0' },
        h('div', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2' }, '🎯 Action plan'),
        h('ul', { className: 'space-y-1.5' },
          item.detail.map(function (d, i) {
            return h('li', { key: i, className: 'flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300' },
              h('span', { className: 'text-brand-400 font-bold shrink-0 mt-0.5' }, (i + 1) + '.'),
              h('span', null, d));
          }))) : null
    );
  }

  /* ---- section header ---- */
  function SectionHeader(props) {
    return h('div', { className: 'flex items-center gap-2.5 mt-2 mb-3' },
      h('div', { className: 'h-px flex-1 bg-slate-200 dark:bg-ink-700' }),
      h('span', { className: window.cx('text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border', props.cls) }, props.label + ' (' + props.count + ')'),
      h('div', { className: 'h-px flex-1 bg-slate-200 dark:bg-ink-700' }));
  }

  /* ---- main view ---- */
  function Insights(props) {
    var state = props.state, ctx = props.ctx;
    var filter = useState('all');
    var trades = useMemo(function () { return window.Store.getTrades(ctx); }, [state, ctx.accountId, ctx.range]);
    var items = useMemo(function () { return window.Insights.generate(trades); }, [trades]);
    var disc = useMemo(function () { return C.disciplineScore(trades); }, [trades]);

    if (!trades.length) {
      return h('div', { className: 'space-y-4 animate-fade-in' },
        h(UI.SectionHead, { title: 'AI Insights', sub: 'Advanced statistical analysis of your trading behaviour.' }),
        h(UI.Empty, { icon: '💡', title: 'Not enough data yet',
          sub: 'Log at least 5 trades to unlock insights. The more trades you log, the more specific and accurate the findings become.',
          action: h('button', { className: 'tz-btn tz-btn-primary', onClick: props.onAddTrade }, '+ Add Trade') }));
    }

    var snapshot  = items.filter(function (i) { return i.title === 'Performance snapshot'; });
    var leaks     = items.filter(function (i) { return i.kind === 'leak'; });
    var strengths = items.filter(function (i) { return i.kind === 'strength'; });
    var info      = items.filter(function (i) { return i.kind === 'info' && i.title !== 'Performance snapshot'; });
    var f = filter[0];
    var showing = f === 'leaks' ? leaks : f === 'strengths' ? strengths : f === 'info' ? info : leaks.concat(strengths).concat(info);

    /* fix rate: how many of the top leaks have had their mistakes fully eliminated */
    var totalLeakCost = leaks.reduce(function (s, l) { return s + (l.priority || 0); }, 0);
    var discColor = disc.score >= 80 ? '#0ecb81' : disc.score >= 55 ? '#f0a32a' : '#f6465d';

    return h('div', { className: 'space-y-5 animate-fade-in' },
      h(UI.SectionHead, { title: 'AI Insights',
        sub: 'Statistical analysis of your ' + trades.length + ' trades. Every finding is computed locally from your data — no AI key required.' }),

      /* ── summary strip ── */
      h('div', { className: 'grid grid-cols-2 sm:grid-cols-4 gap-3' },
        summaryCard('🔴 Leaks found', leaks.length, 'pnl-neg'),
        summaryCard('🟢 Strengths', strengths.length, 'pnl-pos'),
        summaryCard('🛡️ Discipline', disc.score + '%', disc.score >= 75 ? 'pnl-pos' : disc.score >= 55 ? '' : 'pnl-neg'),
        summaryCard('📊 Trades analysed', trades.length, '')),

      /* ── discipline progress bar ── */
      h('div', { className: 'card-base p-4' },
        h('div', { className: 'flex items-center justify-between mb-2 flex-wrap gap-2' },
          h('div', { className: 'flex items-center gap-2' },
            h('span', { className: 'text-xs font-bold uppercase tracking-wider text-slate-400' }, 'Rule discipline'),
            h('span', { className: 'cursor-help text-slate-400 text-xs', title: '% of trades with no mistakes tagged' }, 'ⓘ')),
          h('div', { className: 'flex items-center gap-3' },
            h('span', { className: 'text-2xl font-extrabold', style: { color: discColor } }, disc.score + '%'),
            h('span', { className: 'text-sm text-slate-400' }, disc.clean + ' of ' + disc.total + ' trades clean'))),
        h('div', { className: 'h-3 rounded-full bg-slate-100 dark:bg-ink-700 overflow-hidden' },
          h('div', { className: 'h-full rounded-full trans', style: { width: disc.score + '%', background: discColor } })),
        h('div', { className: 'flex justify-between text-[11px] text-slate-400 mt-1.5' },
          h('span', null, '0% — trading blind'),
          h('span', null, '100% — perfect discipline'))),

      /* ── fix-this-first banner (top leak only if critical) ── */
      leaks.length > 0 && leaks[0].priority >= 300 ? h('div', { className: 'card-base p-4 border border-loss/30 bg-loss/5' },
        h('div', { className: 'flex items-center gap-2 mb-1' },
          h('span', { className: 'text-lg' }, '🎯'),
          h('span', { className: 'text-xs font-bold uppercase tracking-wider text-loss' }, 'Fix this first — highest impact')),
        h('div', { className: 'font-bold text-[15px] ml-7' }, leaks[0].title),
        h('div', { className: 'text-sm text-slate-600 dark:text-slate-300 mt-0.5 ml-7' }, leaks[0].text),
        leaks[0].detail && leaks[0].detail.length ? h('div', { className: 'mt-2 ml-7 text-xs text-slate-400' },
          '→ ' + leaks[0].detail[0]) : null) : null,

      /* ── snapshot card ── */
      snapshot.length ? h(InsightCard, { key: 'snap', item: snapshot[0] }) : null,

      /* ── category filter tabs ── */
      h('div', { className: 'flex gap-2 flex-wrap' },
        [['all','All findings'], ['leaks','🔴 Leaks'], ['strengths','🟢 Strengths'], ['info','ℹ️ Info']].map(function (x) {
          return h('button', { key: x[0], onClick: function () { filter[1](x[0]); },
            className: window.cx('tz-btn tz-btn-sm border trans-colors',
              f === x[0] ? 'tz-btn-primary border-transparent' : 'tz-btn-ghost') }, x[1]);
        })),

      /* ── findings ── */
      showing.length === 0 ? h('div', { className: 'text-center py-10 text-slate-400 text-sm' }, 'No findings in this category yet.') :
      h('div', { className: 'space-y-3' },
        f === 'all' ? h('div', null,
          leaks.length ? h('div', null, h(SectionHeader, { label: 'Leaks to fix', count: leaks.length, cls: 'border-loss/40 text-loss bg-loss/5' }), h('div', { className: 'space-y-2.5' }, leaks.map(function (it, i) { return h(InsightCard, { key: 'l' + i, item: it }); }))) : null,
          strengths.length ? h('div', { className: 'mt-4' }, h(SectionHeader, { label: "What's working", count: strengths.length, cls: 'border-profit/40 text-profit bg-profit/5' }), h('div', { className: 'space-y-2.5' }, strengths.map(function (it, i) { return h(InsightCard, { key: 's' + i, item: it }); }))) : null,
          info.length ? h('div', { className: 'mt-4' }, h(SectionHeader, { label: 'Good to know', count: info.length, cls: 'border-brand/40 text-brand-400 bg-brand/5' }), h('div', { className: 'space-y-2.5' }, info.map(function (it, i) { return h(InsightCard, { key: 'i' + i, item: it }); }))) : null)
        : h('div', { className: 'space-y-2.5' }, showing.map(function (it, i) { return h(InsightCard, { key: i, item: it }); }))),

      h('p', { className: 'text-xs text-slate-400 text-center pt-2' },
        'All insights computed locally from your trades. No AI key or internet required. Updates automatically when you add or edit trades.')
    );
  }

  function summaryCard(label, value, cls) {
    return h(UI.Card, { className: 'p-4' },
      h('div', { className: 'text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1' }, label),
      h('div', { className: window.cx('text-2xl font-extrabold', cls) }, value));
  }

  window.Views = window.Views || {};
  window.Views.Insights = Insights;
})();
