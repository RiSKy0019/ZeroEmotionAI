/* ============================================================
   app.js — shell, routing, top bar, modal manager, mount
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, Store = window.Store;
  var useState = React.useState, useEffect = React.useEffect;

  var NAV = [
    ['dashboard', '▦', 'Dashboard'], ['trades', '▤', 'Trades'], ['reports', '📈', 'Reports'],
    ['playbooks', '📘', 'Playbooks'], ['journal', '✎', 'Journal & Review']
  ];
  var TITLES = { dashboard: 'Dashboard', trades: 'Trades', reports: 'Reports & Analytics', playbooks: 'Playbooks', journal: 'Journal & Review' };

  function readHash() { var r = (location.hash || '').replace('#', ''); return TITLES[r] ? r : 'dashboard'; }

  function App() {
    var state = window.useStore();
    var theme = window.useTheme();
    var routeS = useState(readHash()); var route = routeS[0];
    var accS = useState('all'); var rangeS = useState('all');
    var sidebarS = useState(false); // mobile open
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
    function closeModal() { modalS[1]({ type: null, trade: null }); }

    var viewProps = { state: state, ctx: ctx, go: go, onAddTrade: function () { openTradeForm(); }, onEditTrade: openTradeForm, openTradeForm: openTradeForm, openCsv: openCsv };
    var View = window.Views[cap(route)] || window.Views.Dashboard;

    return h('div', { className: 'flex min-h-screen' },
      // sidebar
      sidebarS[0] ? h('div', { className: 'fixed inset-0 bg-black/40 z-40 lg:hidden', onClick: function () { sidebarS[1](false); } }) : null,
      h(Sidebar, { route: route, go: go, open: sidebarS[0] }),
      // main
      h('div', { className: 'flex-1 min-w-0 flex flex-col' },
        h(TopBar, { title: TITLES[route], state: state, ctx: ctx, theme: theme,
          onMenu: function () { sidebarS[1](!sidebarS[0]); },
          onAccount: function (v) { accS[1](v); }, onRange: function (v) { rangeS[1](v); },
          onAdd: function () { openTradeForm(); } }),
        h('main', { className: 'p-4 sm:p-6 max-w-[1500px] w-full mx-auto' }, h(View, viewProps))),
      // modals
      modal.type === 'trade' ? h(window.Views.TradeForm, { trade: modal.trade, onClose: closeModal }) : null,
      modal.type === 'csv' ? h(window.Views.ImportCsv, { ctx: ctx, onClose: closeModal }) : null,
      h(UI.ToastHost, null)
    );
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function Sidebar(props) {
    return h('aside', { className: window.cx(
      'w-60 shrink-0 border-r border-slate-200 dark:border-ink-600 bg-gradient-to-b from-white to-slate-50 dark:from-ink-850 dark:to-ink-950 p-4 flex flex-col',
      'fixed inset-y-0 left-0 z-50 transition-transform lg:static lg:translate-x-0',
      props.open ? 'translate-x-0' : '-translate-x-full') },
      h('div', { className: 'flex items-center gap-3 px-1.5 pb-5' },
        h('div', { className: 'w-10 h-10 rounded-xl grid place-items-center text-xl bg-gradient-to-br from-brand to-accentpink shadow-glow' }, '⚡'),
        h('div', null,
          h('div', { className: 'font-bold tracking-tight leading-tight' }, 'ZeroEmotionAI'),
          h('div', { className: 'text-[11px] text-slate-400' }, 'Plan · Review · Improve'))),
      h('nav', { className: 'flex flex-col gap-1 flex-1' },
        NAV.map(function (n) {
          var active = props.route === n[0];
          return h('button', { key: n[0], onClick: function () { props.go(n[0]); },
            className: window.cx('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition',
              active ? 'bg-brand/15 text-slate-900 dark:text-white ring-1 ring-brand/40' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-ink-700') },
            h('span', { className: 'w-5 text-center opacity-90' }, n[1]), n[2]);
        })),
      h(DataTools, null)
    );
  }

  function DataTools() {
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
    return h('div', { className: 'pt-3.5 border-t border-slate-200 dark:border-ink-600 flex flex-col gap-2' },
      h(UI.Button, { variant: 'ghost', className: 'w-full', onClick: exportData }, '⭳ Export data'),
      h('label', { className: 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition px-3.5 py-2 text-[13px] bg-transparent border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-ink-700 cursor-pointer w-full' },
        '⭱ Import data', h('input', { type: 'file', accept: 'application/json', onChange: importData, className: 'hidden' })),
      h(UI.Button, { variant: 'dangerGhost', className: 'w-full', onClick: reset }, '⟲ Reset / reseed'));
  }

  function TopBar(props) {
    return h('header', { className: 'sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-ink-600 bg-white/80 dark:bg-ink-950/80 backdrop-blur' },
      h('button', { className: 'lg:hidden text-2xl px-1', onClick: props.onMenu, 'aria-label': 'Menu' }, '☰'),
      h('div', { className: 'text-lg sm:text-xl font-bold' }, props.title),
      h('div', { className: 'ml-auto flex items-end gap-2.5' },
        h('div', { className: 'flex flex-col gap-1' },
          h('span', { className: 'text-[10px] uppercase tracking-wide text-slate-400 hidden sm:block' }, 'Account'),
          h(UI.Select, { className: 'min-w-[110px] py-1.5', value: props.ctx.accountId, onChange: function (e) { props.onAccount(e.target.value); } },
            h('option', { value: 'all' }, 'All accounts'),
            props.state.accounts.map(function (a) { return h('option', { key: a.id, value: a.id }, a.name); }))),
        h('div', { className: 'flex flex-col gap-1' },
          h('span', { className: 'text-[10px] uppercase tracking-wide text-slate-400 hidden sm:block' }, 'Range'),
          h(UI.Select, { className: 'min-w-[100px] py-1.5', value: props.ctx.range, onChange: function (e) { props.onRange(e.target.value); } },
            h('option', { value: 'all' }, 'All time'), h('option', { value: 'ytd' }, 'Year to date'),
            h('option', { value: '30' }, 'Last 30 days'), h('option', { value: '7' }, 'Last 7 days'))),
        h(UI.Button, { variant: 'primary', className: 'whitespace-nowrap', onClick: props.onAdd }, '+ Add Trade'),
        h('button', { className: 'text-xl px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-ink-700', title: 'Toggle theme', onClick: function () { window.Theme.toggle(); } }, props.theme === 'light' ? '☀️' : '🌙'))
    );
  }

  // mount
  var root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(h(App, null));
})();
