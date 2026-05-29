/* ============================================================
   view.journal.js — review + course correction + daily notes (Views.Journal)
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, C = window.Store.calc, Store = window.Store;
  var useState = React.useState, useMemo = React.useMemo;

  var MOODS = ['Focused', 'Calm', 'Confident', 'Anxious', 'Frustrated', 'Tired', 'Excited'];

  function Journal(props) {
    var state = props.state, ctx = props.ctx;
    var editing = useState(null);
    var trades = useMemo(function () { return Store.getTrades(ctx); }, [state, ctx.accountId, ctx.range]);
    var disc = C.disciplineScore(trades);
    var mistakes = C.mistakeCost(trades);
    var clean = trades.filter(function (t) { return !(t.mistakes && t.mistakes.length); });
    var dirty = trades.filter(function (t) { return t.mistakes && t.mistakes.length; });
    var scoreColor = disc.score >= 80 ? '#16c784' : disc.score >= 60 ? '#f0a32a' : '#ea3943';

    var entries = state.journal.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

    return h('div', { className: 'space-y-4 animate-fade-in' },
      h(UI.SectionHead, { title: 'Journal & Review', sub: 'What went wrong, what it cost you, and the fix.' }),
      h('div', { className: 'grid grid-cols-1 lg:grid-cols-3 gap-4' },
        h(UI.Card, { className: 'p-4' },
          h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, 'Discipline Score'),
          h('div', { className: 'flex items-center gap-4 mt-2' },
            h('div', { className: 'text-5xl font-extrabold', style: { color: scoreColor } }, disc.score, h('span', { className: 'text-lg text-slate-400' }, '%')),
            h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, disc.clean + ' of ' + disc.total, h('br'), 'trades followed the rules')),
          h('div', { className: 'mt-3' }, h(UI.Progress, { value: disc.score, color: scoreColor })),
          h('dl', { className: 'mt-4 text-sm space-y-1.5' },
            row('P&L on clean trades', Fmt.money(C.stats(clean).netPnl, { plus: true }), Fmt.signColor(C.stats(clean).netPnl)),
            row('P&L on rule-breaks', Fmt.money(C.stats(dirty).netPnl, { plus: true }), Fmt.signColor(C.stats(dirty).netPnl)))),
        h(UI.Card, { className: 'p-4 lg:col-span-2' },
          h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2' }, 'What Your Mistakes Cost You'),
          mistakes.length === 0
            ? h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'No mistakes tagged in this range. Tag mistakes on your trades to see their impact here.')
            : h('div', null,
                h(window.Charts.Bars, { labels: mistakes.map(function (m) { return m.key; }), data: mistakes.map(function (m) { return m.pnl; }), horizontal: true, height: Math.max(180, mistakes.length * 30) }),
                h('div', { className: 'overflow-x-auto mt-3' }, h('table', { className: 'w-full text-sm' },
                  h('thead', null, h('tr', { className: 'text-left text-[11px] uppercase tracking-wide text-slate-400' },
                    h('th', { className: 'py-1.5 font-semibold' }, 'Mistake'), h('th', { className: 'py-1.5 font-semibold text-right' }, 'Count'), h('th', { className: 'py-1.5 font-semibold text-right' }, 'P&L impact'))),
                  h('tbody', null, mistakes.map(function (m) {
                    return h('tr', { key: m.key, className: 'border-t border-slate-100 dark:border-ink-700' },
                      h('td', { className: 'py-1.5' }, m.key), h('td', { className: 'py-1.5 text-right' }, m.count),
                      h('td', { className: window.cx('py-1.5 text-right font-semibold', Fmt.signColor(m.pnl)) }, Fmt.money(m.pnl, { plus: true })));
                  })))))
        )),
      h('div', { className: 'flex items-center justify-between mt-2' },
        h('h3', { className: 'text-base font-bold' }, 'Daily Journal'),
        h(UI.Button, { variant: 'primary', onClick: function () { editing[1]({}); } }, '+ New Entry')),
      entries.length === 0
        ? h(UI.Empty, { icon: '✎', title: 'No journal entries', sub: 'Write your first daily review.' })
        : h('div', { className: 'space-y-3' }, entries.map(function (j) { return h(EntryCard, { key: j.id, entry: j, onEdit: function () { editing[1](j); } }); })),
      editing[0] ? h(EntryForm, { entry: editing[0].id ? editing[0] : null, onClose: function () { editing[1](null); } }) : null
    );
  }
  function row(k, v, color) { return h('div', { className: 'flex items-center justify-between' }, h('dt', { className: 'text-slate-400' }, k), h('dd', { className: window.cx('m-0 font-semibold', color) }, v)); }

  function EntryCard(props) {
    var j = props.entry;
    return h(UI.Card, { className: 'p-4' },
      h('div', { className: 'flex items-center justify-between' },
        h('div', null, h('strong', null, Fmt.date(j.date)), j.mood ? h(UI.Pill, { className: 'ml-2 bg-brand/15 text-brand-400 border-brand/30' }, j.mood) : null)),
      h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4 mt-3' },
        section('Pre-market plan', j.premarket), section('Review', j.review), section('Lesson', j.lessons)),
      h('div', { className: 'flex gap-2 mt-3.5' },
        h(UI.Button, { variant: 'ghost', size: 'sm', onClick: props.onEdit }, 'Edit'),
        h(UI.Button, { variant: 'dangerGhost', size: 'sm', onClick: function () {
          if (window.confirm('Delete the ' + Fmt.date(j.date) + ' entry?')) { Store.remove('journal', j.id); window.toast('Entry deleted', 'ok'); }
        } }, 'Delete')));
  }
  function section(label, text) {
    return h('div', null,
      h('div', { className: 'text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1' }, label),
      h('div', { className: window.cx('text-sm whitespace-pre-wrap', text ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400') }, text || '—'));
  }

  function EntryForm(props) {
    var isEdit = !!props.entry;
    var init = props.entry || { date: Fmt.todayISO(), mood: '', premarket: '', review: '', lessons: '' };
    var fs = useState(Object.assign({}, init)); var form = fs[0], setForm = fs[1];
    function set(k, v) { setForm(function (c) { var n = Object.assign({}, c); n[k] = v; return n; }); }
    function save() {
      var obj = { date: form.date, mood: form.mood, premarket: String(form.premarket || '').trim(), review: String(form.review || '').trim(), lessons: String(form.lessons || '').trim() };
      if (isEdit) { Store.update('journal', props.entry.id, obj); window.toast('Entry updated', 'ok'); }
      else { Store.add('journal', obj); window.toast('Entry added', 'ok'); }
      props.onClose();
    }
    var footer = [h(UI.Button, { key: 'c', variant: 'ghost', onClick: props.onClose }, 'Cancel'), h(UI.Button, { key: 's', variant: 'primary', onClick: save }, isEdit ? 'Save' : 'Add entry')];
    return h(UI.Modal, { title: isEdit ? 'Edit Journal Entry' : 'New Journal Entry', wide: true, onClose: props.onClose, footer: footer },
      h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3.5' },
        h(UI.Field, { label: 'Date' }, h(UI.Input, { type: 'date', value: form.date, onChange: function (e) { set('date', e.target.value); } })),
        h(UI.Field, { label: 'Mood' }, h(UI.Select, { value: form.mood, onChange: function (e) { set('mood', e.target.value); } },
          h('option', { value: '' }, '—'), MOODS.map(function (m) { return h('option', { key: m, value: m }, m); })))),
      h('div', { className: 'mt-3.5' }, h(UI.Field, { label: 'Pre-market plan', full: true }, h(UI.Textarea, { value: form.premarket, placeholder: 'Bias, levels, news, max trades/loss…', onChange: function (e) { set('premarket', e.target.value); } }))),
      h('div', { className: 'mt-3.5' }, h(UI.Field, { label: 'Post-market review', full: true }, h(UI.Textarea, { value: form.review, placeholder: 'What happened? Did you follow the plan?', onChange: function (e) { set('review', e.target.value); } }))),
      h('div', { className: 'mt-3.5' }, h(UI.Field, { label: 'Lesson / course correction', full: true }, h(UI.Textarea, { value: form.lessons, placeholder: 'One thing to do differently next session.', onChange: function (e) { set('lessons', e.target.value); } })))
    );
  }

  window.Views = window.Views || {};
  window.Views.Journal = Journal;
})();
