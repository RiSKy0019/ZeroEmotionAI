/* ============================================================
   app.js — shell, routing, top bar, modal manager, mount
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, Store = window.Store;
  var useState = React.useState, useEffect = React.useEffect;

  var NAV = [
    ['dashboard', '▦', 'Dashboard'], ['trades', '▤', 'Trades'], ['reports', '📈', 'Reports'],
    ['insights', '✨', 'AI Insights'], ['notebook', '📓', 'Notebook'], ['playbooks', '📘', 'Playbooks'], ['journal', '✎', 'Journal & Review']
  ];
  var TITLES = { dashboard: 'Dashboard', trades: 'Trades', reports: 'Reports & Analytics', insights: 'AI Insights', notebook: 'Notebook', playbooks: 'Playbooks', journal: 'Journal & Review' };

  function readHash() { var r = (location.hash || '').replace('#', ''); return TITLES[r] ? r : 'dashboard'; }

  function App() {
    var state = window.useStore();
    var theme = window.useTheme();
    var currency = window.useCurrency();
    var routeS = useState(readHash()); var route = routeS[0];
    var accS = useState('all'); var rangeS = useState('all');
    var sidebarS = useState(false); // mobile drawer open
    var hoverS = useState(false);   // desktop rail hover-expand
    var modalS = useState({ type: null, trade: null }); var modal = modalS[0];

    useEffect(function () {
      function onHash() { routeS[1](readHash()); }
      window.addEventListener('hashchange', onHash);
      return function () { window.removeEventListener('hashchange', onHash); };
    }, []);

    function go(r) { if (location.hash !== '#' + r) location.hash = r; else routeS[1](r); sidebarS[1](false); }
    var ctx = { accountId: accS[0], range: rangeS[0] };
    function openTradeForm(trade) { modalS[1]({ type: 'trade', trade: trade || null }); }
    function openCsv() { modalS[1]({ type: 'csv', trade: null }); }
    function openTradingView() { modalS[1]({ type: 'tv', trade: null }); }
    function openCurrency() { modalS[1]({ type: 'currency', trade: null }); }
    function openAccounts() { modalS[1]({ type: 'accounts', trade: null }); }
    function closeModal() { modalS[1]({ type: null, trade: null }); }

    var viewProps = { state: state, ctx: ctx, go: go, onAddTrade: function () { openTradeForm(); }, onEditTrade: openTradeForm, openTradeForm: openTradeForm, openCsv: openCsv, openTradingView: openTradingView };
    var View = window.Views[cap(route)] || window.Views.Dashboard;

    return h('div', { className: 'flex min-h-screen' },
      // mobile backdrop
      sidebarS[0] ? h('div', { className: 'fixed inset-0 bg-black/40 z-40 lg:hidden', onClick: function () { sidebarS[1](false); } }) : null,
      h(Sidebar, { route: route, go: go, mobileOpen: sidebarS[0], hover: hoverS[0],
        onHover: function (v) { hoverS[1](v); }, closeMobile: function () { sidebarS[1](false); } }),
      // desktop spacer so content sits beside the collapsed rail (the rail overlays when expanded)
      h('div', { className: 'hidden lg:block w-16 shrink-0' }),
      // main
      h('div', { className: 'flex-1 min-w-0 flex flex-col' },
        h(TopBar, { title: TITLES[route], state: state, ctx: ctx, theme: theme, curCode: window.Currency.get().code,
          onMenu: function () { sidebarS[1](!sidebarS[0]); },
          onAccount: function (v) { accS[1](v); }, onRange: function (v) { rangeS[1](v); },
          onAdd: function () { openTradeForm(); }, onOpenRates: openCurrency, onManageAccounts: openAccounts }),
        h('main', { className: 'p-4 sm:p-6 max-w-[1500px] w-full mx-auto' }, h(View, viewProps))),
      // modals
      modal.type === 'trade' ? h(window.Views.TradeForm, { trade: modal.trade, onClose: closeModal }) : null,
      modal.type === 'csv' ? h(window.Views.ImportCsv, { ctx: ctx, onClose: closeModal }) : null,
      modal.type === 'tv' ? h(window.Views.ImportTradingView, { ctx: ctx, onClose: closeModal }) : null,
      modal.type === 'currency' ? h(CurrencySettings, { onClose: closeModal }) : null,
      modal.type === 'accounts' ? h(AccountsModal, { onClose: closeModal, currentAccountId: accS[0], onAccount: function (v) { accS[1](v); } }) : null,
      h(UI.ToastHost, null)
    );
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function Sidebar(props) {
    var expanded = props.hover || props.mobileOpen;
    return h('aside', {
      onMouseEnter: function () { props.onHover(true); },
      onMouseLeave: function () { props.onHover(false); },
      className: window.cx(
        'fixed inset-y-0 left-0 z-50 flex flex-col p-3 overflow-hidden border-r border-slate-200 dark:border-ink-600 bg-gradient-to-b from-white to-slate-50 dark:from-ink-850 dark:to-ink-950',
        'transition-[width,transform] duration-200 ease-out shadow-card lg:shadow-none',
        // mobile drawer
        props.mobileOpen ? 'w-60 translate-x-0' : 'w-60 -translate-x-full',
        // desktop: always visible; slim rail that widens on hover
        'lg:translate-x-0', expanded ? 'lg:w-60' : 'lg:w-[68px]') },
      // brand
      h('div', { className: 'flex items-center gap-3 px-1 pb-5 h-10' },
        h('div', { className: 'w-10 h-10 shrink-0 rounded-xl grid place-items-center text-xl bg-gradient-to-br from-brand to-accentpink shadow-glow' }, '⚡'),
        h('div', { className: window.cx('whitespace-nowrap transition-opacity duration-150', expanded ? 'opacity-100' : 'opacity-0 lg:opacity-0') },
          h('div', { className: 'font-bold tracking-tight leading-tight' }, 'ZeroEmotionAI'),
          h('div', { className: 'text-[11px] text-slate-400' }, 'Plan · Review · Improve'))),
      // nav
      h('nav', { className: 'flex flex-col gap-1 flex-1' },
        NAV.map(function (n) {
          var active = props.route === n[0];
          return h('button', { key: n[0], onClick: function () { props.go(n[0]); }, title: n[2],
            className: window.cx('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition',
              active ? 'bg-brand/15 text-slate-900 dark:text-white ring-1 ring-brand/40' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-700') },
            h('span', { className: 'w-6 text-center text-base shrink-0' }, n[1]),
            h('span', { className: window.cx('whitespace-nowrap transition-opacity duration-150', expanded ? 'opacity-100' : 'opacity-0') }, n[2]));
        })),
      h(DataTools, { expanded: expanded })
    );
  }

  function DataTools(props) {
    var expanded = props.expanded;
    function exportData() { Fmt.download('zeroemotionai-backup-' + Fmt.todayISO() + '.json', JSON.stringify(Store.getState(), null, 2)); window.toast('Backup downloaded', 'ok'); }
    function importData(e) {
      var file = e.target.files && e.target.files[0]; if (!file) return;
      var rd = new FileReader();
      rd.onload = function () {
        try { var data = JSON.parse(rd.result); if (!data || !Array.isArray(data.trades)) throw new Error('Not a valid backup'); Store.replaceAll(data); window.toast('Data imported', 'ok'); }
        catch (err) { window.toast('Import failed: ' + err.message, 'err'); }
        e.target.value = '';
      };
      rd.readAsText(file);
    }
    function reset() { if (window.confirm('Reset everything and reload the sample data? Export a backup first if you want to keep your data.')) { Store.reset(); window.toast('Reset to sample data', 'ok'); } }
    var rowCls = 'flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-ink-700 transition cursor-pointer w-full whitespace-nowrap';
    var lbl = function (t) { return h('span', { className: window.cx('transition-opacity duration-150', expanded ? 'opacity-100' : 'opacity-0') }, t); };
    return h('div', { className: 'pt-3 mt-1 border-t border-slate-200 dark:border-ink-600 flex flex-col gap-1' },
      h('button', { className: rowCls, onClick: exportData, title: 'Export data' }, h('span', { className: 'w-6 text-center shrink-0' }, '⭳'), lbl('Export data')),
      h('label', { className: rowCls, title: 'Import data' }, h('span', { className: 'w-6 text-center shrink-0' }, '⭱'), lbl('Import data'),
        h('input', { type: 'file', accept: 'application/json', onChange: importData, className: 'hidden' })),
      h('button', { className: window.cx(rowCls, 'text-loss hover:bg-loss/10'), onClick: reset, title: 'Reset / reseed' }, h('span', { className: 'w-6 text-center shrink-0' }, '⟲'), lbl('Reset')));
  }

  function TopBar(props) {
    return h('header', { className: 'sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-ink-600 bg-white/80 dark:bg-ink-950/80 backdrop-blur' },
      h('button', { className: 'lg:hidden text-2xl px-1', onClick: props.onMenu, 'aria-label': 'Menu' }, '☰'),
      h('div', { className: 'text-lg sm:text-xl font-bold' }, props.title),
      h('div', { className: 'ml-auto flex items-end gap-2.5' },
        h('div', { className: 'flex flex-col gap-1' },
          h('span', { className: 'text-[10px] uppercase tracking-wide text-slate-400 hidden sm:block' }, 'Account'),
          h('div', { className: 'flex items-center gap-1' },
            h(UI.Select, { className: 'min-w-[110px] py-1.5', value: (props.ctx.accountId !== 'all' && !props.state.accounts.some(function (a) { return a.id === props.ctx.accountId; })) ? 'all' : props.ctx.accountId, onChange: function (e) { props.onAccount(e.target.value); } },
              h('option', { value: 'all' }, 'All accounts'),
              props.state.accounts.map(function (a) { return h('option', { key: a.id, value: a.id }, a.name); })),
            h('button', { className: 'text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm px-1.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700', title: 'Add / manage accounts', onClick: props.onManageAccounts }, '\u2699'))),
        h('div', { className: 'flex flex-col gap-1' },
          h('span', { className: 'text-[10px] uppercase tracking-wide text-slate-400 hidden sm:block' }, 'Range'),
          h(UI.Select, { className: 'min-w-[100px] py-1.5', value: props.ctx.range, onChange: function (e) { props.onRange(e.target.value); } },
            h('option', { value: 'all' }, 'All time'), h('option', { value: 'ytd' }, 'Year to date'),
            h('option', { value: '30' }, 'Last 30 days'), h('option', { value: '7' }, 'Last 7 days'))),
        h('div', { className: 'flex flex-col gap-1' },
          h('span', { className: 'text-[10px] uppercase tracking-wide text-slate-400 hidden sm:block' }, 'Currency'),
          h('div', { className: 'flex items-center gap-1' },
            h(UI.Select, { className: 'min-w-[82px] py-1.5', value: props.curCode, onChange: function (e) { window.Currency.set(e.target.value); } },
              window.Currency.codes.map(function (c) { return h('option', { key: c, value: c }, window.Currency.meta[c].symbol + ' ' + c); })),
            h('button', { className: 'text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm px-1.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700', title: 'Edit exchange rates', onClick: props.onOpenRates }, '\u2699'))),
        h(UI.Button, { variant: 'primary', className: 'whitespace-nowrap', onClick: props.onAdd }, '+ Add Trade'),
        h('button', { className: 'text-xl px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700', title: 'Toggle theme', onClick: function () { window.Theme.toggle(); } }, props.theme === 'light' ? '☀️' : '🌙'))
    );
  }

  function CurrencySettings(props) {
    window.useCurrency(); // re-render on rate change
    var rates = window.Currency.getRates();
    var active = window.Currency.get().code;
    return h(UI.Modal, { title: 'Currency & exchange rates', onClose: props.onClose,
      footer: [
        h(UI.Button, { key: 'r', variant: 'ghost', onClick: function () { window.Currency.resetRates(); window.toast('Rates reset to defaults', 'ok'); } }, 'Reset rates'),
        h(UI.Button, { key: 'd', variant: 'primary', onClick: props.onClose }, 'Done')
      ] },
      h('p', { className: 'text-sm text-slate-500 dark:text-slate-400 mb-1' }, 'Trades are stored in ', h('strong', null, 'USD'), ' and converted for display only — the underlying values never change.'),
      h('p', { className: 'text-xs text-slate-400 mb-4' }, 'Rates are manual (no live feed). Set each rate to how many units equal 1 USD, then pick your currency in the top bar.'),
      h('div', { className: 'space-y-2' },
        window.Currency.codes.map(function (code) {
          var meta = window.Currency.meta[code];
          return h('div', { key: code, className: window.cx('flex items-center gap-3 rounded-xl px-3 py-2 border', code === active ? 'border-brand/40 bg-brand/5' : 'border-slate-200 dark:border-ink-600') },
            h('div', { className: 'w-24 font-semibold' }, meta.symbol + ' ' + code),
            code === 'USD'
              ? h('div', { className: 'text-sm text-slate-400' }, 'base currency (1.00)')
              : h('div', { className: 'flex items-center gap-2' },
                  h('span', { className: 'text-xs text-slate-400' }, '1 USD ='),
                  h(UI.Input, { type: 'number', step: 'any', className: 'w-32', defaultValue: rates[code],
                    onChange: function (e) { window.Currency.setRate(code, e.target.value); } }),
                  h('span', { className: 'text-xs text-slate-400' }, code)));
        })));
  }

  function AccountsModal(props) {
    window.useStore(); // re-render on store changes
    var C = window.Store.calc, Fmt = window.Fmt;
    var state = window.Store.getState();
    var editS = useState(null); var editId = editS[0];
    var draftS = useState({ name: '', broker: '', startingBalance: '' }); var draft = draftS[0];
    var addS = useState({ name: '', broker: '', startingBalance: '' }); var add = addS[0];

    function setDraft(k, v) { draftS[1](Object.assign({}, draft, kv(k, v))); }
    function setAdd(k, v) { addS[1](Object.assign({}, add, kv(k, v))); }
    function kv(k, v) { var o = {}; o[k] = v; return o; }

    function startEdit(a) { editS[1](a.id); draftS[1]({ name: a.name, broker: a.broker || '', startingBalance: a.startingBalance }); }
    function saveEdit(id) {
      var name = String(draft.name || '').trim(); if (!name) { window.toast('Account name is required', 'err'); return; }
      window.Store.update('accounts', id, { name: name, broker: String(draft.broker || '').trim(), startingBalance: parseFloat(draft.startingBalance) || 0 });
      editS[1](null); window.toast('Account updated', 'ok');
    }
    function del(a) {
      if (state.accounts.length <= 1) { window.toast('Keep at least one account', 'err'); return; }
      var n = state.trades.filter(function (t) { return t.accountId === a.id; }).length;
      var msg = n ? ('Delete "' + a.name + '" and its ' + n + ' trade' + (n > 1 ? 's' : '') + '? This cannot be undone.') : ('Delete "' + a.name + '"?');
      if (window.confirm(msg)) {
        window.Store.removeAccount(a.id);
        if (props.currentAccountId === a.id) props.onAccount('all');
        window.toast('Account deleted', 'ok');
      }
    }
    function addAccount() {
      var name = String(add.name || '').trim(); if (!name) { window.toast('Account name is required', 'err'); return; }
      var acc = window.Store.add('accounts', { name: name, broker: String(add.broker || '').trim(), startingBalance: parseFloat(add.startingBalance) || 0 });
      addS[1]({ name: '', broker: '', startingBalance: '' });
      props.onAccount(acc.id);
      window.toast('Account "' + name + '" added', 'ok');
    }

    var INP = 'w-full bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-ink-600 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-brand';

    return h(UI.Modal, { title: 'Accounts', wide: true, onClose: props.onClose,
      footer: [h(UI.Button, { key: 'd', variant: 'primary', onClick: props.onClose }, 'Done')] },
      h('p', { className: 'text-sm text-slate-500 dark:text-slate-400 mb-3' }, 'Each account keeps its own trades, starting balance and stats. Pick a single account in the top bar to focus on it, or ', h('strong', null, 'All accounts'), ' to see everything combined.'),
      h('div', { className: 'space-y-2' },
        state.accounts.map(function (a) {
          var trades = state.trades.filter(function (t) { return t.accountId === a.id; });
          var s = C.stats(trades);
          if (editId === a.id) {
            return h('div', { key: a.id, className: 'rounded-xl border border-brand/40 bg-brand/5 p-3' },
              h('div', { className: 'grid grid-cols-1 sm:grid-cols-3 gap-2' },
                h('input', { className: INP, value: draft.name, placeholder: 'Account name', onChange: function (e) { setDraft('name', e.target.value); } }),
                h('input', { className: INP, value: draft.broker, placeholder: 'Broker (optional)', onChange: function (e) { setDraft('broker', e.target.value); } }),
                h('input', { className: INP, type: 'number', step: 'any', value: draft.startingBalance, placeholder: 'Starting balance', onChange: function (e) { setDraft('startingBalance', e.target.value); } })),
              h('div', { className: 'flex gap-2 mt-2 justify-end' },
                h(UI.Button, { variant: 'ghost', size: 'sm', onClick: function () { editS[1](null); } }, 'Cancel'),
                h(UI.Button, { variant: 'primary', size: 'sm', onClick: function () { saveEdit(a.id); } }, 'Save')));
          }
          return h('div', { key: a.id, className: 'flex items-center gap-3 rounded-xl border border-slate-200 dark:border-ink-600 px-3 py-2.5 flex-wrap' },
            h('div', { className: 'flex-1 min-w-[160px]' },
              h('div', { className: 'font-semibold' }, a.name, a.broker ? h('span', { className: 'text-xs text-slate-400 font-normal ml-2' }, a.broker) : null),
              h('div', { className: 'text-xs text-slate-400 mt-0.5' }, 'Start ', Fmt.money(a.startingBalance), ' \u00B7 ', trades.length, ' trade' + (trades.length === 1 ? '' : 's'))),
            h('div', { className: window.cx('text-right font-semibold', Fmt.signColor(s.netPnl)) }, Fmt.money(s.netPnl, { plus: true })),
            h('div', { className: 'flex gap-1.5' },
              h(UI.Button, { variant: 'ghost', size: 'sm', onClick: function () { startEdit(a); } }, 'Edit'),
              h(UI.Button, { variant: 'dangerGhost', size: 'sm', onClick: function () { del(a); } }, 'Delete')));
        })),
      h('div', { className: 'mt-4 pt-4 border-t border-slate-200 dark:border-ink-600' },
        h('div', { className: 'text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2' }, 'Add account'),
        h('div', { className: 'grid grid-cols-1 sm:grid-cols-4 gap-2' },
          h('input', { className: INP, value: add.name, placeholder: 'Account name', onChange: function (e) { setAdd('name', e.target.value); } }),
          h('input', { className: INP, value: add.broker, placeholder: 'Broker (optional)', onChange: function (e) { setAdd('broker', e.target.value); } }),
          h('input', { className: INP, type: 'number', step: 'any', value: add.startingBalance, placeholder: 'Starting balance', onChange: function (e) { setAdd('startingBalance', e.target.value); } }),
          h(UI.Button, { variant: 'primary', onClick: addAccount }, '+ Add account')))
    );
  }

  // mount
  var root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(h(App, null));
})();
