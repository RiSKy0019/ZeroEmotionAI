/* ============================================================
   view.playbooks.js — strategies + per-strategy stats (Views.Playbooks)
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, C = window.Store.calc, Store = window.Store;
  var useState = React.useState, useMemo = React.useMemo;

  function Playbooks(props) {
    var state = props.state, ctx = props.ctx;
    var editing = useState(null); // null = closed, {} = new, {..} = edit
    var trades = useMemo(function () { return Store.getTrades(ctx); }, [state, ctx.accountId, ctx.range]);

    return h('div', { className: 'space-y-4 animate-fade-in' },
      h(UI.SectionHead, { title: 'Playbooks', sub: 'Your strategies and their rules — and which ones actually make money.',
        right: [h(UI.Button, { key: 'n', variant: 'primary', onClick: function () { editing[1]({}); } }, '+ New Playbook')] }),
      state.playbooks.length === 0
        ? h(UI.Empty, { icon: '📘', title: 'No playbooks yet', sub: 'Create a strategy and define the rules that give you an edge.',
            action: h(UI.Button, { variant: 'primary', onClick: function () { editing[1]({}); } }, '+ New Playbook') })
        : h('div', { className: 'grid grid-cols-1 lg:grid-cols-2 gap-4' },
            state.playbooks.map(function (pb) { return h(PlaybookCard, { key: pb.id, pb: pb, trades: trades, onEdit: function () { editing[1](pb); } }); })),
      editing[0] ? h(PlaybookForm, { pb: editing[0].id ? editing[0] : null, onClose: function () { editing[1](null); } }) : null
    );
  }

  function mini(label, value, color) {
    return h('div', { className: 'rounded-xl p-2.5 bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-ink-600' },
      h('div', { className: 'text-[10px] uppercase tracking-wide text-slate-400 font-semibold' }, label),
      h('div', { className: window.cx('text-base font-bold', color) }, value));
  }

  function PlaybookCard(props) {
    var pb = props.pb;
    var trades = props.trades.filter(function (t) { return t.setup === pb.name; });
    var s = C.stats(trades);
    var pf = s.profitFactor === Infinity ? '∞' : Fmt.num(s.profitFactor, 2);
    return h(UI.Card, { className: 'p-4' },
      h('div', { className: 'flex items-start justify-between gap-2' },
        h('div', null, h('span', { className: 'text-base font-bold' }, pb.name), ' ', h(UI.Pill, { className: 'bg-brand/15 text-brand-400 border-brand/30' }, pb.market || 'Any'))),
      pb.description ? h('p', { className: 'text-sm text-slate-500 dark:text-slate-400 mt-2' }, pb.description) : null,
      h('div', { className: 'grid grid-cols-4 gap-2 mt-3.5' },
        mini('Net P&L', Fmt.moneyShort(s.netPnl), Fmt.signColor(s.netPnl)),
        mini('Win rate', s.total ? Fmt.pct(s.winRate) : '—'),
        mini('Profit factor', s.total ? pf : '—'),
        mini('Trades', String(s.total))),
      (pb.rules && pb.rules.length) ? h('ul', { className: 'mt-3.5 space-y-1 text-sm' },
        pb.rules.map(function (r, i) { return h('li', { key: i, className: 'text-slate-500 dark:text-slate-300' }, h('span', { className: 'text-brand-400 mr-1.5' }, '✓'), r); })) : null,
      h('div', { className: 'flex gap-2 mt-3.5' },
        h(UI.Button, { variant: 'ghost', size: 'sm', onClick: props.onEdit }, 'Edit'),
        h(UI.Button, { variant: 'dangerGhost', size: 'sm', onClick: function () {
          if (window.confirm('Delete playbook "' + pb.name + '"? Trades keep their setup label.')) { Store.remove('playbooks', pb.id); window.toast('Playbook deleted', 'ok'); }
        } }, 'Delete'))
    );
  }

  function PlaybookForm(props) {
    var isEdit = !!props.pb;
    var init = props.pb || { name: '', market: '', description: '', rules: [] };
    var fs = useState({ name: init.name, market: init.market, description: init.description, rules: (init.rules || []).slice() });
    var form = fs[0], setForm = fs[1];
    function set(k, v) { setForm(function (c) { var n = Object.assign({}, c); n[k] = v; return n; }); }
    function setRule(i, v) { setForm(function (c) { var r = c.rules.slice(); r[i] = v; return Object.assign({}, c, { rules: r }); }); }
    function addRule() { setForm(function (c) { return Object.assign({}, c, { rules: c.rules.concat(['']) }); }); }
    function delRule(i) { setForm(function (c) { return Object.assign({}, c, { rules: c.rules.filter(function (_, j) { return j !== i; }) }); }); }

    function save() {
      var name = String(form.name || '').trim();
      if (!name) { window.toast('Name is required', 'err'); return; }
      var obj = { name: name, market: String(form.market || '').trim(), description: String(form.description || '').trim(),
        rules: form.rules.map(function (r) { return String(r).trim(); }).filter(Boolean) };
      if (isEdit) { Store.update('playbooks', props.pb.id, obj); window.toast('Playbook updated', 'ok'); }
      else { Store.add('playbooks', obj); window.toast('Playbook created', 'ok'); }
      props.onClose();
    }
    var footer = [h(UI.Button, { key: 'c', variant: 'ghost', onClick: props.onClose }, 'Cancel'), h(UI.Button, { key: 's', variant: 'primary', onClick: save }, isEdit ? 'Save' : 'Create')];

    return h(UI.Modal, { title: isEdit ? 'Edit Playbook' : 'New Playbook', wide: true, onClose: props.onClose, footer: footer },
      h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3.5' },
        h(UI.Field, { label: 'Name' }, h(UI.Input, { value: form.name, placeholder: 'e.g. VWAP Reclaim', onChange: function (e) { set('name', e.target.value); } })),
        h(UI.Field, { label: 'Market' }, h(UI.Input, { value: form.market, placeholder: 'e.g. Futures, Stocks, FX', onChange: function (e) { set('market', e.target.value); } }))),
      h('div', { className: 'mt-3.5' }, h(UI.Field, { label: 'Description', full: true }, h(UI.Textarea, { value: form.description, placeholder: 'What is the edge / when do you take it?', onChange: function (e) { set('description', e.target.value); } }))),
      h('div', { className: 'mt-3.5' }, h(UI.Field, { label: 'Rules', full: true },
        h('div', { className: 'space-y-2' },
          form.rules.map(function (r, i) {
            return h('div', { key: i, className: 'flex gap-2 items-center' },
              h(UI.Input, { value: r, placeholder: 'Rule…', onChange: function (e) { setRule(i, e.target.value); } }),
              h(UI.Button, { variant: 'dangerGhost', size: 'sm', onClick: function () { delRule(i); } }, '✕'));
          }),
          h(UI.Button, { variant: 'ghost', size: 'sm', onClick: addRule }, '+ Add rule'))))
    );
  }

  window.Views = window.Views || {};
  window.Views.Playbooks = Playbooks;
})();
