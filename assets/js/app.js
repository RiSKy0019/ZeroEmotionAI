/* ============================================================
   app.js — shell, routing, polished sidebar + topbar, modals
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, Store = window.Store;
  var useState = React.useState, useEffect = React.useEffect;

  /* ---- SVG icon set (inline, no external deps) ---- */
  var ICONS = {
    dashboard: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg>',
    trades:    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14l4-5 4 3 4-7"/><circle cx="17" cy="5" r="1.5" fill="currentColor" stroke="none"/></svg>',
    reports:   '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 13V10M10 13V7M13 13V9"/></svg>',
    insights:  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/></svg>',
    notebook:  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="12" height="16" rx="2"/><path d="M4 6h12M4 10h8M4 14h6"/><path d="M2 6h2M2 10h2M2 14h2"/></svg>',
    playbooks: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12v12H4z" rx="1.5"/><path d="M8 4v12M8 8h8M8 12h8"/></svg>',
    journal:   '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5l2-3z"/><path d="M8 8h5M8 11h5M8 14h3"/></svg>',
    export:    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v10M6 9l4 4 4-4"/><path d="M4 15h12"/></svg>',
    import:    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13V3M6 7l4-4 4 4"/><path d="M4 15h12"/></svg>',
    reset:     '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10a6 6 0 116 6"/><path d="M4 6v4h4"/></svg>',
    sun:       '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="3.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"/></svg>',
    moon:      '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M17 13.6A7 7 0 117 3a5.5 5.5 0 0010 10.6z"/></svg>',
    menu:      '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 5h14M3 10h14M3 15h14"/></svg>',
    gear:      '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="2.5"/><path d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M5.1 5.1l1.1 1.1M13.8 13.8l1.1 1.1M5.1 14.9l1.1-1.1M13.8 6.2l1.1-1.1"/></svg>',
    plus:      '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 4v12M4 10h12"/></svg>',
    weekly:    '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M7 2v2M13 2v2M3 8h14"/><path d="M7 12h2M11 12h2M7 15h2"/></svg>',
    chat:      '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h14a1 1 0 011 1v8a1 1 0 01-1 1H7l-4 2V5a1 1 0 011-1z"/><path d="M7 8h6M7 11h4"/></svg>',
    propfirmimport: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="16" height="14" rx="2"/><path d="M10 7v6M7 11l3 2 3-2M6 7h8"/></svg>',
    calculator: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="12" height="16" rx="2"/><path d="M7 5h6M7 9h.01M10 9h.01M13 9h.01M7 12h.01M10 12h.01M13 12h.01M7 15h3"/></svg>',
    goal: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="3.2"/><circle cx="10" cy="10" r="0.6" fill="currentColor" stroke="none"/></svg>',
  };
  function Icon(props) {
    return h('span', { className: window.cx('inline-flex items-center justify-center shrink-0', props.className), style: { width: props.size || 20, height: props.size || 20 }, dangerouslySetInnerHTML: { __html: ICONS[props.name] || '' } });
  }

  var NAV = [
    ['dashboard', 'dashboard', 'Dashboard'],
    ['trades',    'trades',    'Trades'],
    ['reports',   'reports',   'Reports'],
    ['insights',  'insights',  'AI Insights'],
    ['chat',      'insights',  'AI Chat'],
    ['weekly',    'weekly',    'Weekly Summary'],
    ['notebook',  'notebook',  'Notebook'],
    ['playbooks', 'playbooks', 'Playbooks'],
    ['journal',   'journal',   'Journal'],
    ['propfirm',       'reports',   'Prop Firm Tracker'],
    ['propfirmimport', 'import',    'Prop Firm Import'],
    ['calculator',     'calculator','Position Calculator'],
    ['goals',          'goal',      'Goals & Targets']
  ];
  var TITLES = { dashboard: 'Dashboard', trades: 'Trades', reports: 'Reports & Analytics', insights: 'AI Insights', chat: 'AI Chat', weekly: 'Weekly Summary', notebook: 'Notebook', playbooks: 'Playbooks', journal: 'Journal & Review', propfirm: 'Prop Firm Tracker', propfirmimport: 'Prop Firm Import Hub', calculator: 'Position-Size & Risk Calculator', goals: 'Goals & Targets' };


  function readHash() { var r = (location.hash || '').replace('#', ''); return TITLES[r] ? r : 'dashboard'; }

  function App() {
    var state = window.useStore();
    var theme = window.useTheme();
    var currency = window.useCurrency();
    var routeS = useState(readHash()); var route = routeS[0];
    var accS = useState('all'); var rangeS = useState('all');
    var sidebarS = useState(false);
    var hoverS = useState(false);
    var modalS = useState({ type: null, trade: null }); var modal = modalS[0];

    useEffect(function () {
      function onHash() { routeS[1](readHash()); }
      window.addEventListener('hashchange', onHash);
      return function () { window.removeEventListener('hashchange', onHash); };
    }, []);

    function go(r) { if (location.hash !== '#' + r) location.hash = r; else routeS[1](r); sidebarS[1](false); }
    var ctx = { accountId: accS[0], range: rangeS[0] };
    function openTradeForm(trade) { modalS[1]({ type: 'trade', trade: trade || null }); }
    function openCsv()         { modalS[1]({ type: 'csv',      trade: null }); }
    function openTradingView() { modalS[1]({ type: 'tv',       trade: null }); }
    function openCurrency()    { modalS[1]({ type: 'currency', trade: null }); }
    function openAccounts()    { modalS[1]({ type: 'accounts', trade: null }); }
    function closeModal()      { modalS[1]({ type: null,       trade: null }); }

    var viewProps = { state: state, ctx: ctx, go: go,
      onAddTrade: function () { openTradeForm(); }, onEditTrade: openTradeForm,
      openTradeForm: openTradeForm, openCsv: openCsv, openTradingView: openTradingView };
    var View = resolveView(route);

    return h('div', { className: 'flex min-h-screen bg-[#f7f7f7] dark:bg-ink-950' },
      sidebarS[0] ? h('div', { className: 'fixed inset-0 bg-black/50 z-40 lg:hidden', onClick: function () { sidebarS[1](false); } }) : null,
      h(Sidebar, { route: route, go: go, mobileOpen: sidebarS[0], hover: hoverS[0],
        onHover: function (v) { hoverS[1](v); } }),
      h('div', { className: 'hidden lg:block w-[68px] shrink-0' }),
      h('div', { className: 'flex-1 min-w-0 flex flex-col' },
        h(TopBar, { title: TITLES[route], state: state, ctx: ctx, theme: theme,
          curCode: window.Currency.get().code,
          onMenu: function () { sidebarS[1](!sidebarS[0]); },
          onAccount: function (v) { accS[1](v); },
          onRange:   function (v) { rangeS[1](v); },
          onAdd: function () { openTradeForm(); },
          onOpenRates: openCurrency, onManageAccounts: openAccounts }),
        h('main', { className: 'flex-1 p-4 sm:p-6 max-w-[1520px] w-full mx-auto' }, h(View, viewProps))),
      modal.type === 'trade'    ? h(window.Views.TradeForm,        { trade: modal.trade, onClose: closeModal }) : null,
      modal.type === 'csv'      ? h(window.Views.ImportCsv,        { ctx: ctx, onClose: closeModal }) : null,
      modal.type === 'tv'       ? h(window.Views.ImportTradingView, { ctx: ctx, onClose: closeModal }) : null,
      modal.type === 'currency' ? h(CurrencySettings,              { onClose: closeModal }) : null,
      modal.type === 'accounts' ? h(AccountsModal,                 { onClose: closeModal, currentAccountId: accS[0], onAccount: function (v) { accS[1](v); } }) : null,
      h(UI.ToastHost, null)
    );
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* Resolve a route ('propfirmimport') to a registered view, tolerant of
     casing. cap() only uppercases the first letter, so camelCase view names
     like 'PropfirmImport' would never match 'Propfirmimport'. Match
     case-insensitively against the registered keys, then fall back to
     Dashboard. This makes routing immune to view-registration casing. */
  function resolveView(route) {
    var V = window.Views || {};
    if (V[cap(route)]) return V[cap(route)];
    var want = String(route).toLowerCase();
    var keys = Object.keys(V);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === want) return V[keys[i]];
    }
    return V.Dashboard;
  }


  /* ---- Light Sidebar ---- */
  function Sidebar(props) {
    var expanded = props.hover || props.mobileOpen;
    return h('aside', {
      onMouseEnter: function () { props.onHover(true); },
      onMouseLeave: function () { props.onHover(false); },
      className: window.cx(
        'fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden',
        'transition-[width,transform] duration-200 ease-out',
        props.mobileOpen ? 'w-60 translate-x-0' : 'w-60 -translate-x-full',
        'lg:translate-x-0', expanded ? 'lg:w-60' : 'lg:w-[68px]'
      ),
      style: {
        background: '#ffffff',
        borderRight: '1px solid #e8e8e8',
        boxShadow: expanded ? '4px 0 16px rgba(0,0,0,0.06)' : '2px 0 6px rgba(0,0,0,0.03)'
      }},
      /* brand mark */
      h('div', { style: { display:'flex', alignItems:'center', gap:'12px', padding:'20px 16px 16px', borderBottom:'1px solid #f1f5f9' } },
        h('div', { className: 'w-9 h-9 shrink-0 rounded-xl grid place-items-center' },
          h(Icon, { name: 'lightning', style: { color: '#fff' }, size: 18 })),
        h('div', { className: window.cx('transition-opacity duration-150 whitespace-nowrap overflow-hidden', expanded ? 'opacity-100' : 'opacity-0') },
          h('div', { style: { fontFamily: 'Urbanist, Inter, sans-serif', fontWeight: 800, fontSize: '15px', letterSpacing: '-0.01em', color: '#1b1b1b' } }, 'ZeroEmotionAI'),
          h('div', { style: { fontSize: '11px', marginTop: '2px', color: '#94a3b8' } }, 'Plan \u00b7 Review \u00b7 Improve'))),
      /* nav items */
      h('nav', { style: { display:'flex', flexDirection:'column', gap:'2px', flex:1, padding:'12px 8px' } },
        NAV.map(function (n) {
          var active = props.route === n[0];
          return h('button', {
            key: n[0], title: n[2],
            onClick: function () { props.go(n[0]); },
            style: Object.assign({
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 12px', borderRadius: '999px',
              fontSize: '13px', fontWeight: 600, textAlign: 'left',
              width: '100%', cursor: 'pointer', border: 'none',
              transition: 'background 0.15s, color 0.15s'
            }, active
              ? { background: '#1b1b1b', color: '#fff' }
              : { background: 'transparent', color: '#666' })
          },
            h(Icon, { name: n[1], size: 18, style: { flexShrink: 0, color: active ? '#00E096' : '#aaa' } }),
            h('span', { className: window.cx('whitespace-nowrap transition-opacity duration-150 sidebar-item-label', expanded ? 'opacity-100' : 'opacity-0') }, n[2]),
            active ? h('span', { className: window.cx('ml-auto shrink-0 transition-opacity', expanded ? 'opacity-100' : 'opacity-0'), style: { width:'5px', height:'5px', borderRadius:'50%', background:'#00E096' } }) : null
          );
        })),
      /* data tools */
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
        try { var data = JSON.parse(rd.result); if (!Array.isArray(data.trades)) throw new Error('Invalid backup'); Store.replaceAll(data); window.toast('Data imported', 'ok'); }
        catch (err) { window.toast('Import failed: ' + err.message, 'err'); }
        e.target.value = '';
      };
      rd.readAsText(file);
    }
    function reset() { if (window.confirm('Reset to sample data? Export first to keep your data.')) { Store.reset(); window.toast('Reset done', 'ok'); } }
    var rowStyle = { display:'flex', alignItems:'center', gap:'12px', padding:'8px 12px', borderRadius:'999px', fontSize:'12px', fontWeight:600, color:'#888', cursor:'pointer', border:'none', background:'transparent', width:'100%', transition:'background 0.15s, color 0.15s' };
    var lbl = function (t) { return h('span', { className: window.cx('whitespace-nowrap sidebar-item-label transition-opacity duration-150', expanded ? 'opacity-100' : 'opacity-0') }, t); };
    return h('div', { style: { padding:'8px 8px 12px', borderTop:'1px solid #f1f5f9', display:'flex', flexDirection:'column', gap:'2px' } },
      h('button', { style: rowStyle, onClick: exportData, title: 'Export data',
        onMouseEnter: function(e){ e.currentTarget.style.background='#f5f5f5'; e.currentTarget.style.color='#1b1b1b'; },
        onMouseLeave: function(e){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#888'; } },
        h(Icon, { name: 'export', size: 16, style:{ flexShrink:0, color:'#94a3b8' } }), lbl('Export data')),
      h('label', { style: Object.assign({}, rowStyle, { cursor:'pointer' }), title: 'Import data',
        onMouseEnter: function(e){ e.currentTarget.style.background='#f5f5f5'; e.currentTarget.style.color='#1b1b1b'; },
        onMouseLeave: function(e){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#888'; } },
        h(Icon, { name: 'import', size: 16, style:{ flexShrink:0, color:'#94a3b8' } }), lbl('Import data'),
        h('input', { type: 'file', accept: 'application/json', onChange: importData, className: 'hidden' })),
      h('button', { style: rowStyle, onClick: reset, title: 'Reset / reseed',
        onMouseEnter: function(e){ e.currentTarget.style.background='#fff0f0'; e.currentTarget.style.color='#f6465d'; },
        onMouseLeave: function(e){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#888'; } },
        h(Icon, { name: 'reset', size: 16, style:{ flexShrink:0, color:'#94a3b8' } }), lbl('Reset / reseed'))
    );
  }


  /* ---- Polished TopBar ---- */
  /* ---- Light TopBar (always white, immune to dark mode) ---- */
  var TB = {
    /* base styles applied inline so dark mode cannot override */
    header: { background: '#ffffff', borderBottom: '1px solid #e8e8e8', position: 'sticky', top: 0, zIndex: 30,
              display: 'flex', alignItems: 'center', gap: '12px', padding: '0 24px', height: '56px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
    title:  { fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em', color: '#1e293b', margin: 0 },
    btn:    { display: 'grid', placeItems: 'center', width: '30px', height: '30px', borderRadius: '8px',
              background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', transition: 'background 0.15s' },
    select: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px',
              fontSize: '12px', color: '#334155', outline: 'none', fontFamily: 'inherit' },
    label:  { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8',
              fontWeight: 600, marginBottom: '2px' },
    addBtn: { background: 'linear-gradient(135deg,#7c5cff,#6b4cf0)', color: '#fff', border: 'none',
              borderRadius: '10px', padding: '8px 14px', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 4px 12px rgba(124,92,255,0.30)', whiteSpace: 'nowrap' }
  };
  function tbCol(label, children) {
    return h('div', { style: { display:'flex', flexDirection:'column', gap:'2px' } },
      h('span', { style: TB.label }, label), children);
  }
  function TopBar(props) {
    var validAcc = props.ctx.accountId === 'all' || props.state.accounts.some(function (a) { return a.id === props.ctx.accountId; });
    return h('header', { style: TB.header },
      h('button', { style: Object.assign({}, TB.btn, { display: 'grid' }), onClick: props.onMenu,
        className: 'lg:hidden' }, h(Icon, { name: 'menu', size: 18 })),
      h('h1', { style: TB.title }, props.title),
      h('div', { style: { marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' } },
        /* account */
        h('div', { className: 'hidden sm:flex', style: { display: 'flex', alignItems: 'center', gap: '4px' } },
          tbCol('Account',
            h('div', { style: { display:'flex', gap:'4px' } },
              h('select', { style: TB.select, value: validAcc ? props.ctx.accountId : 'all',
                onChange: function (e) { props.onAccount(e.target.value); } },
                h('option', { value: 'all' }, 'All accounts'),
                props.state.accounts.map(function (a) { return h('option', { key: a.id, value: a.id }, a.name); })),
              h('button', { style: TB.btn, title: 'Manage accounts', onClick: props.onManageAccounts },
                h(Icon, { name: 'gear', size: 14 }))))),
        /* range */
        h('div', { className: 'hidden sm:flex' },
          tbCol('Range',
            h('select', { style: TB.select, value: props.ctx.range,
              onChange: function (e) { props.onRange(e.target.value); } },
              h('option', { value: 'all' }, 'All time'),
              h('option', { value: 'ytd' }, 'Year to date'),
              h('option', { value: '30' }, 'Last 30 days'),
              h('option', { value: '7' }, 'Last 7 days')))),
        /* currency */
        h('div', { className: 'hidden sm:flex', style: { display: 'flex', alignItems: 'center', gap: '4px' } },
          tbCol('Currency',
            h('div', { style: { display:'flex', gap:'4px' } },
              h('select', { style: TB.select, value: props.curCode,
                onChange: function (e) { window.Currency.set(e.target.value); } },
                window.Currency.codes.map(function (c) { return h('option', { key: c, value: c }, window.Currency.meta[c].symbol + ' ' + c); })),
              h('button', { style: TB.btn, title: 'Exchange rates', onClick: props.onOpenRates },
                h(Icon, { name: 'gear', size: 14 }))))),
        /* Add Trade */
        h('button', { style: TB.addBtn, onClick: props.onAdd },
          h(Icon, { name: 'plus', size: 14, style: { color: '#fff' } }),
          h('span', { className: 'hidden sm:inline' }, 'Add Trade')),
        /* theme toggle */
        h('button', { style: TB.btn, title: 'Toggle theme', onClick: function () { window.Theme.toggle(); } },
          h(Icon, { name: props.theme === 'light' ? 'sun' : 'moon', size: 16 }))
      )
    );
  }


  /* ---- Currency Settings Modal ---- */
  function CurrencySettings(props) {
    window.useCurrency();
    var rates = window.Currency.getRates();
    var active = window.Currency.get().code;
    return h(UI.Modal, { title: 'Currency & Exchange Rates', onClose: props.onClose,
      footer: [
        h(UI.Button, { key: 'r', variant: 'ghost', onClick: function () { window.Currency.resetRates(); window.toast('Rates reset to defaults', 'ok'); } }, 'Reset rates'),
        h(UI.Button, { key: 'd', variant: 'primary', onClick: props.onClose }, 'Done')
      ]},
      h('p', { className: 'text-sm text-slate-500 dark:text-slate-400 mb-1' },
        'Trades are stored in ', h('strong', null, 'USD'), ' and converted for display only. Underlying data never changes.'),
      h('p', { className: 'text-xs text-slate-400 mb-4' }, 'Set each rate as units per 1 USD (manual — no live feed).'),
      h('div', { className: 'space-y-2' },
        window.Currency.codes.map(function (code) {
          var meta = window.Currency.meta[code];
          var isActive = code === active;
          return h('div', { key: code, className: window.cx('flex items-center gap-3 rounded-xl px-3.5 py-2.5 border trans-colors',
              isActive ? 'border-brand/50 bg-brand/5' : 'border-slate-200 dark:border-ink-700') },
            h('div', { className: 'w-20 font-semibold text-sm' }, meta.symbol + ' ' + code),
            code === 'USD'
              ? h('div', { className: 'text-sm text-slate-400' }, 'Base currency (1.00)')
              : h('div', { className: 'flex items-center gap-2 flex-1' },
                  h('span', { className: 'text-xs text-slate-400 whitespace-nowrap' }, '1 USD ='),
                  h(UI.Input, { type: 'number', step: 'any', className: 'w-28 py-1.5 text-sm',
                    defaultValue: rates[code],
                    onChange: function (e) { window.Currency.setRate(code, e.target.value); } }),
                  h('span', { className: 'text-xs text-slate-400' }, code)));
        })));
  }

  /* ---- Accounts Modal ---- */
  function AccountsModal(props) {
    window.useStore();
    var C = Store.calc;
    var state = Store.getState();
    var editS = useState(null);
    var draftS = useState({ name: '', broker: '', startingBalance: '' }); var draft = draftS[0];
    var addS   = useState({ name: '', broker: '', startingBalance: '' }); var add   = addS[0];
    function kv(k, v) { var o = {}; o[k] = v; return o; }
    function setDraft(k, v) { draftS[1](Object.assign({}, draft, kv(k, v))); }
    function setAdd(k, v)   { addS[1](Object.assign({}, add, kv(k, v))); }
    function startEdit(a)   { editS[1](a.id); draftS[1]({ name: a.name, broker: a.broker || '', startingBalance: a.startingBalance }); }
    function saveEdit(id) {
      var name = String(draft.name || '').trim(); if (!name) { window.toast('Name is required', 'err'); return; }
      Store.update('accounts', id, { name: name, broker: draft.broker.trim(), startingBalance: parseFloat(draft.startingBalance) || 0 });
      editS[1](null); window.toast('Account updated', 'ok');
    }
    function del(a) {
      if (state.accounts.length <= 1) { window.toast('Keep at least one account', 'err'); return; }
      var n = state.trades.filter(function (t) { return t.accountId === a.id; }).length;
      if (window.confirm('Delete "' + a.name + '"' + (n ? ' and its ' + n + ' trade(s)' : '') + '?')) {
        Store.removeAccount(a.id);
        if (props.currentAccountId === a.id) props.onAccount('all');
        window.toast('Account deleted', 'ok');
      }
    }
    function addAccount() {
      var name = add.name.trim(); if (!name) { window.toast('Name is required', 'err'); return; }
      var acc = Store.add('accounts', { name: name, broker: add.broker.trim(), startingBalance: parseFloat(add.startingBalance) || 0 });
      addS[1]({ name: '', broker: '', startingBalance: '' });
      props.onAccount(acc.id);
      window.toast('"' + name + '" account added', 'ok');
    }
    return h(UI.Modal, { title: 'Accounts', wide: true, onClose: props.onClose,
      footer: [h(UI.Button, { key: 'd', variant: 'primary', onClick: props.onClose }, 'Done')] },
      h('p', { className: 'text-sm text-[#989898] mb-4' },
        'Each account has its own trades, balance and stats. Pick one in the top bar to focus, or ', h('strong', null, 'All accounts'), ' for the combined view.'),
      h('div', { className: 'space-y-2 mb-5' },
        state.accounts.map(function (a) {
          var trades = state.trades.filter(function (t) { return t.accountId === a.id; });
          var s = C.stats(trades);
          if (editS[0] === a.id) {
            return h('div', { key: a.id, className: 'card-base p-3 border-brand/40' },
              h('div', { className: 'grid grid-cols-1 sm:grid-cols-3 gap-2' },
                h(UI.Input, { value: draft.name, placeholder: 'Account name', onChange: function (e) { setDraft('name', e.target.value); } }),
                h(UI.Input, { value: draft.broker, placeholder: 'Broker', onChange: function (e) { setDraft('broker', e.target.value); } }),
                h(UI.Input, { type: 'number', value: draft.startingBalance, placeholder: 'Starting balance', onChange: function (e) { setDraft('startingBalance', e.target.value); } })),
              h('div', { className: 'flex gap-2 mt-2 justify-end' },
                h(UI.Button, { variant: 'ghost', size: 'sm', onClick: function () { editS[1](null); } }, 'Cancel'),
                h(UI.Button, { variant: 'primary', size: 'sm', onClick: function () { saveEdit(a.id); } }, 'Save')));
          }
          return h('div', { key: a.id, className: 'card-base p-3.5 flex items-center gap-3 flex-wrap' },
            h('div', { className: 'flex-1 min-w-[160px]' },
              h('div', { className: 'font-semibold text-sm text-[#f5f5f5]' }, a.name,
                a.broker ? h('span', { className: 'text-xs text-slate-400 font-normal ml-2' }, a.broker) : null),
              h('div', { className: 'text-xs text-slate-400 mt-0.5' },
                'Start ' + Fmt.money(a.startingBalance) + ' · ' + trades.length + ' trade' + (trades.length === 1 ? '' : 's'))),
            h('div', { className: window.cx('font-bold text-sm', s.netPnl >= 0 ? 'pnl-pos' : 'pnl-neg') }, Fmt.money(s.netPnl, { plus: true })),
            h('div', { className: 'flex gap-1.5' },
              h(UI.Button, { variant: 'ghost', size: 'sm', onClick: function () { startEdit(a); } }, 'Edit'),
              h(UI.Button, { variant: 'dangerGhost', size: 'sm', onClick: function () { del(a); } }, 'Delete')));
        })),
      h('div', { className: 'card-base p-4' },
        h('div', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5' }, 'Add account'),
        h('div', { className: 'grid grid-cols-1 sm:grid-cols-4 gap-2' },
          h(UI.Input, { value: add.name, placeholder: 'Account name', onChange: function (e) { setAdd('name', e.target.value); } }),
          h(UI.Input, { value: add.broker, placeholder: 'Broker (optional)', onChange: function (e) { setAdd('broker', e.target.value); } }),
          h(UI.Input, { type: 'number', value: add.startingBalance, placeholder: 'Starting balance', onChange: function (e) { setAdd('startingBalance', e.target.value); } }),
          h(UI.Button, { variant: 'primary', onClick: addAccount }, '+ Add'))));
  }

  /* ---- Mount ---- */
  window.App = App;
  var root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(h(App, null));
})();
