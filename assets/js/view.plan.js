/* ============================================================
   view.plan.js — Daily Plan & Pre-market Checklist (Views.Plan)
   A reusable routine checklist + a per-day trading plan
   (bias, focus, risk budget, notes) with completion tracking.
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, Store = window.Store;
  var useState = React.useState, useEffect = React.useEffect;

  var DEFAULT_CHECKLIST = [
    'Reviewed economic calendar & news',
    'Marked key support / resistance levels',
    'Defined my market bias',
    'Set daily risk budget & max trades',
    'Picked A+ setups from the watchlist',
    'Checked higher-timeframe trend',
    'Mind clear — no revenge / FOMO'
  ];
  function getChecklist() { var c = Store.getSettings().checklist; return Array.isArray(c) && c.length ? c : DEFAULT_CHECKLIST; }
  var BIAS = [['', '— pick —'], ['bullish', '▲ Bullish'], ['bearish', '▼ Bearish'], ['neutral', '• Neutral / range']];

  function Plan(props) {
    var state = props.state || Store.getState();
    var plans = state.plans || [];
    var checklist = getChecklist();

    var dateS = useState(Fmt.todayISO()); var date = dateS[0];
    var blank = { date: date, bias: '', focus: '', maxRisk: '', maxTrades: '', notes: '', done: {} };
    var formS = useState(blank); var form = formS[0];
    function set(k, v) { formS[1](Object.assign({}, form, (function () { var o = {}; o[k] = v; return o; })())); }
    function toggle(item) { var dn = Object.assign({}, form.done); dn[item] = !dn[item]; set('done', dn); }

    // load the plan for the selected date
    useEffect(function () {
      var p = plans.find(function (x) { return x.date === date; });
      formS[1](p ? Object.assign({ done: {} }, p) : { date: date, bias: '', focus: '', maxRisk: '', maxTrades: '', notes: '', done: {} });
    }, [date, plans.length]);

    function save() {
      var existing = (Store.getState().plans || []).find(function (x) { return x.date === form.date; });
      var obj = { date: form.date, bias: form.bias, focus: form.focus, maxRisk: form.maxRisk, maxTrades: form.maxTrades, notes: form.notes, done: form.done || {} };
      if (existing) Store.update('plans', existing.id, obj); else Store.add('plans', obj);
      // also push risk limits into Goals settings so the dashboard guardrail picks them up
      if (form.maxRisk !== '' || form.maxTrades !== '') {
        var goals = Object.assign({}, Store.getSettings().goals || {});
        if (form.maxTrades !== '') goals.maxTradesPerDay = form.maxTrades;
        Store.setSetting('goals', goals);
      }
      window.toast('Plan saved for ' + Fmt.date(form.date), 'ok');
    }

    var doneCount = checklist.filter(function (it) { return form.done && form.done[it]; }).length;
    var pct = checklist.length ? Math.round(doneCount / checklist.length * 100) : 0;

    return h('div', { className: 'space-y-5 animate-fade-in max-w-4xl' },
      h(UI.SectionHead, { title: 'Daily Plan & Pre-market Checklist',
        sub: 'Win before the open. Run your routine, set your bias and risk budget for the day.',
        right: [h(UI.Button, { key: 's', variant: 'primary', onClick: save }, 'Save plan')] }),

      h('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-4' },
        /* plan */
        h(UI.Card, { className: 'p-5' },
          h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-3' }, 'Today\u2019s plan'),
          h('div', { className: 'grid grid-cols-2 gap-3' },
            h(UI.Field, { label: 'Date' }, h(UI.Input, { type: 'date', value: date, onChange: function (e) { dateS[1](e.target.value); } })),
            h(UI.Field, { label: 'Market bias' }, h(UI.Select, { value: form.bias, onChange: function (e) { set('bias', e.target.value); } }, BIAS.map(function (b) { return h('option', { key: b[0], value: b[0] }, b[1]); }))),
            h(UI.Field, { label: 'Max risk today ($)' }, h(UI.Input, { type: 'number', step: 'any', value: form.maxRisk, onChange: function (e) { set('maxRisk', e.target.value); } })),
            h(UI.Field, { label: 'Max trades today' }, h(UI.Input, { type: 'number', step: '1', value: form.maxTrades, onChange: function (e) { set('maxTrades', e.target.value); } }))),
          h('div', { className: 'mt-3' }, h(UI.Field, { label: 'Focus / watchlist', full: true }, h(UI.Input, { value: form.focus, placeholder: 'e.g. NQ longs above 18500, AAPL earnings fade', onChange: function (e) { set('focus', e.target.value); } }))),
          h('div', { className: 'mt-3' }, h(UI.Field, { label: 'Game plan & notes', full: true }, h(UI.Textarea, { value: form.notes, placeholder: 'If/then scenarios, levels, what would invalidate the bias…', onChange: function (e) { set('notes', e.target.value); } })))),

        /* checklist */
        h(UI.Card, { className: 'p-5' },
          h('div', { className: 'flex items-center justify-between mb-3' },
            h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, 'Pre-market routine'),
            h('span', { className: window.cx('text-sm font-bold', pct === 100 ? 'text-profit' : '') }, doneCount + ' / ' + checklist.length)),
          h(UI.Progress, { value: pct, color: pct === 100 ? '#0ecb81' : '#7c5cff' }),
          h('div', { className: 'mt-3 space-y-1.5' },
            checklist.map(function (item, i) {
              var on = !!(form.done && form.done[item]);
              return h('label', { key: i, className: window.cx('flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer border', on ? 'border-profit/40 bg-profit/5' : 'border-slate-200 dark:border-ink-700 hover:bg-slate-50 dark:hover:bg-ink-800') },
                h('input', { type: 'checkbox', checked: on, onChange: function () { toggle(item); } }),
                h('span', { className: window.cx('text-sm', on ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200') }, item));
            })),
          h(ChecklistEditor, null))),

      /* recent plans */
      plans.length ? h(UI.Card, { className: 'p-5' },
        h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2' }, 'Recent plans'),
        h('div', { className: 'overflow-x-auto' }, h('table', { className: 'w-full text-sm min-w-[560px]' },
          h('thead', null, h('tr', { className: 'text-left text-[11px] uppercase tracking-wide text-slate-400' },
            ['Date', 'Bias', 'Focus', 'Routine', ''].map(function (c) { return h('th', { key: c, className: 'py-1.5 pr-3 font-semibold' }, c); }))),
          h('tbody', null, plans.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 12).map(function (p) {
            var dc = checklist.filter(function (it) { return p.done && p.done[it]; }).length;
            return h('tr', { key: p.id, className: 'border-t border-slate-100 dark:border-ink-700' },
              h('td', { className: 'py-1.5 pr-3 font-semibold cursor-pointer text-brand-400', onClick: function () { dateS[1](p.date); } }, Fmt.dateShort(p.date)),
              h('td', { className: 'pr-3' }, p.bias || '—'),
              h('td', { className: 'pr-3 text-slate-400 max-w-[260px] truncate' }, p.focus || '—'),
              h('td', { className: 'pr-3' }, dc + '/' + checklist.length),
              h('td', { className: 'pr-3 text-right' }, h('button', { className: 'text-loss text-xs font-semibold px-1.5 py-1 rounded hover:bg-loss/10', onClick: function () { if (window.confirm('Delete plan for ' + Fmt.date(p.date) + '?')) Store.remove('plans', p.id); } }, 'Delete')));
          }))))) : null
    );
  }

  /* ---- editable checklist template ---- */
  function ChecklistEditor() {
    var open = useState(false);
    var nv = useState('');
    var items = getChecklist();
    function add() { var v = nv[0].trim(); if (!v) return; Store.setSetting('checklist', items.concat([v])); nv[1](''); }
    function del(i) { Store.setSetting('checklist', items.filter(function (_, j) { return j !== i; })); }
    if (!open[0]) return h('button', { className: 'text-xs text-brand-400 font-semibold hover:underline mt-3', onClick: function () { open[1](true); } }, '✎ Edit routine items');
    return h('div', { className: 'mt-3 pt-3 border-t border-slate-100 dark:border-ink-700' },
      h('div', { className: 'flex items-center justify-between mb-2' },
        h('span', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, 'Edit routine items'),
        h('button', { className: 'text-xs text-slate-400 hover:underline', onClick: function () { open[1](false); } }, 'Done')),
      h('div', { className: 'space-y-1.5 mb-2' }, items.map(function (it, i) {
        return h('div', { key: i, className: 'flex items-center gap-2 text-sm' },
          h('span', { className: 'flex-1 text-slate-600 dark:text-slate-300' }, it),
          h('button', { className: 'text-loss text-xs font-semibold px-1.5 rounded hover:bg-loss/10', onClick: function () { del(i); } }, '✕'));
      })),
      h('div', { className: 'flex gap-2' },
        h(UI.Input, { value: nv[0], placeholder: 'Add a routine step…', onChange: function (e) { nv[1](e.target.value); }, onKeyDown: function (e) { if (e.key === 'Enter') add(); } }),
        h(UI.Button, { variant: 'ghost', size: 'sm', onClick: add }, 'Add')));
  }

  window.Views = window.Views || {};
  window.Views.Plan = Plan;
})();
