/* ============================================================
   view.propfirm-import.js — Prop Firm Import Hub (Views.PropfirmImport)
   Guided per-firm CSV import with step-by-step instructions,
   auto-detection, live preview, and one-click import.
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, C = window.Store.calc, Store = window.Store;
  var useState = React.useState, useMemo = React.useMemo, useEffect = React.useEffect;

  var FIRMS = window.PFImport.FIRMS;
  var FIRM_ORDER = ['topstep', 'apex', 'ftmo', 'tradeovate', 'earn2trade', 'lucid'];

  /* ── Firm selector card ── */
  function FirmCard(props) {
    var firm = props.firm;
    var active = props.active;
    return h('button', {
      onClick: function () { props.onSelect(firm.id); },
      className: window.cx(
        'flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all cursor-pointer w-full text-center',
        active
          ? 'border-[#00E096] bg-[rgba(0,224,150,0.07)] shadow-glow-sm'
          : 'border-slate-200 dark:border-ink-600 hover:border-[#00E096]/50 bg-white dark:bg-ink-800 hover:bg-[rgba(0,224,150,0.03)]'
      )},
      h('span', { className: 'text-3xl' }, firm.emoji),
      h('span', { className: window.cx('text-[13px] font-bold', active ? 'text-[#00B67A]' : 'text-slate-700 dark:text-slate-200') }, firm.name),
      active ? h('span', { className: 'text-[10px] font-semibold text-[#00B67A] bg-[rgba(0,224,150,0.12)] px-2 py-0.5 rounded-full' }, 'Selected') : null
    );
  }

  /* ── Numbered step instruction ── */
  function Step(props) {
    return h('div', { className: 'flex gap-3 items-start' },
      h('div', { className: 'w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white', style: { background: '#00B67A' } }, props.num),
      h('p', { className: 'text-sm text-slate-600 dark:text-slate-300 leading-relaxed' }, props.text)
    );
  }

  /* ── Main view ── */
  function PropfirmImport(props) {
    var state = props.state, ctx = props.ctx;

    var firmId    = useState(null);
    var csvText   = useState('');
    var importing = useState(false);
    var fileRef   = React.useRef(null);

    var selectedFirm = firmId[0] ? FIRMS[firmId[0]] : null;

    /* account for the import */
    var defAcc = (ctx.accountId && ctx.accountId !== 'all')
      ? ctx.accountId
      : (state.accounts[0] || {}).id;
    var accId = useState(defAcc);

    /* parse whenever text or firm changes */
    var parsed = useMemo(function () {
      var text = csvText[0].trim();
      if (!text) return null;
      return window.PFImport.parse(text, firmId[0], accId[0]);
    }, [csvText[0], firmId[0], accId[0]]);

    /* auto-detect firm from headers when file is loaded */
    useEffect(function () {
      if (!csvText[0].trim()) return;
      var detected = window.PFImport.detectFirm(window.PFImport._parseCSV(csvText[0]));
      if (detected && !firmId[0]) firmId[1](detected);
    }, [csvText[0]]);

    function onFile(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var rd = new FileReader();
      rd.onload = function () { csvText[1](rd.result); };
      rd.readAsText(file);
      e.target.value = '';
    }

    function doImport() {
      if (!parsed || !parsed.recognized || !parsed.trades.length) return;
      importing[1](true);
      parsed.trades.forEach(function (t) { t.accountId = accId[0]; Store.add('trades', t); });
      window.toast('Imported ' + parsed.trades.length + ' trade' + (parsed.trades.length > 1 ? 's' : '') + ' from ' + (selectedFirm ? selectedFirm.name : 'prop firm'), 'ok');
      csvText[1]('');
      importing[1](false);
    }

    var n = parsed && parsed.trades ? parsed.trades.length : 0;
    var canImport = parsed && parsed.recognized && n > 0;

    return h('div', { className: 'space-y-6 animate-fade-in' },
      /* ── Header ── */
      h(UI.SectionHead, {
        title: 'Prop Firm Import Hub',
        sub: 'Import your trades from any major prop firm using their CSV export. Step-by-step guidance included for each firm.'
      }),

      /* ── Important notice ── */
      h('div', { className: 'rounded-xl border border-[rgba(0,224,150,0.3)] bg-[rgba(0,224,150,0.05)] p-4 flex gap-3' },
        h('span', { className: 'text-xl flex-shrink-0' }, 'ℹ️'),
        h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' },
          h('strong', { className: 'text-slate-800 dark:text-slate-100' }, 'How this works: '),
          'We guide you to export a CSV directly from your prop firm\'s dashboard. Your credentials never leave your browser — you log in to the prop firm yourself, download the file, and upload it here. This is the same approach TradeZella uses as a CSV fallback for all firms.'
        )
      ),

      /* ── Step 1: Pick a firm ── */
      h(UI.Card, { className: 'p-5' },
        h('div', { className: 'flex items-center gap-2 mb-4' },
          h('div', { className: 'w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0', style: { background: '#1b1b1b' } }, '1'),
          h('h3', { className: 'font-bold text-[15px]' }, 'Select your prop firm')),
        h('div', { className: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3' },
          FIRM_ORDER.map(function (fid) {
            return h(FirmCard, { key: fid, firm: FIRMS[fid], active: firmId[0] === fid, onSelect: function (id) { firmId[1](id); } });
          }))
      ),

      /* ── Step 2: Export instructions ── */
      selectedFirm ? h(UI.Card, { className: 'p-5' },
        h('div', { className: 'flex items-center gap-2 mb-4' },
          h('div', { className: 'w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0', style: { background: '#1b1b1b' } }, '2'),
          h('h3', { className: 'font-bold text-[15px]' }, 'Export from ', selectedFirm.emoji + ' ' + selectedFirm.name)),
        h('div', { className: 'space-y-3 mb-4' },
          selectedFirm.instructions.map(function (inst, i) {
            return h(Step, { key: i, num: i + 1, text: inst });
          })),
        h('div', { className: 'rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-ink-700 px-4 py-3 text-xs text-slate-500 dark:text-slate-400' },
          h('strong', null, 'Expected columns: '),
          selectedFirm.sampleHeaders.join(', ')
        )
      ) : null,

      /* ── Step 3: Upload ── */
      h(UI.Card, { className: 'p-5' },
        h('div', { className: 'flex items-center gap-2 mb-4' },
          h('div', { className: 'w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0', style: { background: '#1b1b1b' } }, '3'),
          h('h3', { className: 'font-bold text-[15px]' }, 'Upload or paste your CSV')),

        /* account + firm selectors */
        h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4' },
          h(UI.Field, { label: 'Import into account' },
            h(UI.Select, { value: accId[0], onChange: function (e) { accId[1](e.target.value); } },
              state.accounts.map(function (a) { return h('option', { key: a.id, value: a.id }, a.name); }))),
          h(UI.Field, { label: 'Firm (override auto-detect)' },
            h(UI.Select, { value: firmId[0] || '', onChange: function (e) { firmId[1](e.target.value || null); } },
              h('option', { value: '' }, '— Auto-detect —'),
              FIRM_ORDER.map(function (fid) {
                var f = FIRMS[fid];
                return h('option', { key: fid, value: fid }, f.emoji + ' ' + f.name);
              })))),

        /* file upload drop zone */
        h('label', {
          className: 'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 dark:border-ink-600 hover:border-[#00E096]/60 bg-slate-50 dark:bg-ink-900 p-8 cursor-pointer transition-all mb-3 group',
          htmlFor: 'pf-file-input'
        },
          h('div', { className: 'text-4xl group-hover:scale-110 transition-transform' }, '📁'),
          h('div', { className: 'text-center' },
            h('p', { className: 'font-semibold text-sm text-slate-700 dark:text-slate-200' }, 'Click to upload CSV'),
            h('p', { className: 'text-xs text-slate-400 mt-1' }, 'or drag and drop your exported file here')),
          h('input', { id: 'pf-file-input', type: 'file', accept: '.csv,text/csv', onChange: onFile, className: 'hidden', ref: fileRef })),

        /* paste fallback */
        h(UI.Field, { label: '…or paste CSV rows directly', full: true },
          h(UI.Textarea, {
            value: csvText[0],
            placeholder: 'Paste the contents of your exported CSV here (first row = headers)…',
            className: 'font-mono text-xs min-h-[100px]',
            onChange: function (e) { csvText[1](e.target.value); }
          })),

        csvText[0].trim() ? h('button', {
          className: 'mt-2 text-xs text-loss font-semibold hover:underline',
          onClick: function () { csvText[1](''); }
        }, '× Clear') : null
      ),

      /* ── Preview + import ── */
      csvText[0].trim() ? h(UI.Card, { className: 'p-5' },
        h('div', { className: 'flex items-center gap-2 mb-4' },
          h('div', { className: 'w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0', style: { background: '#1b1b1b' } }, '4'),
          h('h3', { className: 'font-bold text-[15px]' }, 'Review & import')),

        !parsed ? h('div', { className: 'text-slate-400 text-sm' }, 'Parsing…') :
        !parsed.recognized ? h('div', { className: 'rounded-xl border border-dashed border-loss/40 bg-loss/5 p-4 text-sm' },
          h('p', { className: 'font-semibold text-loss mb-1' }, '⚠️ Couldn\'t recognise this CSV format'),
          h('p', { className: 'text-slate-500 dark:text-slate-400 mb-2' }, 'Make sure you selected the correct firm and exported from the right section. The detected columns were:'),
          parsed.headers && parsed.headers.length
            ? h('p', { className: 'font-mono text-xs text-slate-400 bg-slate-100 dark:bg-ink-800 rounded-lg p-2' }, parsed.headers.join(', '))
            : null,
          h('p', { className: 'text-xs text-slate-400 mt-2' }, 'Try selecting a different firm above or use ⤓ Import CSV for a generic import.')
        ) :
        h('div', { className: 'space-y-4' },
          /* summary */
          h('div', { className: 'flex gap-3 flex-wrap' },
            h('div', { className: 'card-base px-4 py-2 flex items-center gap-2' },
              h('span', { className: 'text-xl' }, (parsed.firmId && FIRMS[parsed.firmId]) ? FIRMS[parsed.firmId].emoji : '📊'),
              h('span', { className: 'font-semibold text-sm' }, (parsed.firmId && FIRMS[parsed.firmId]) ? FIRMS[parsed.firmId].name : 'Auto-detected')),
            h('div', { className: 'card-base px-4 py-2 flex items-center gap-2' },
              h('span', { className: 'text-xl pnl-pos' }, '✓'),
              h('span', { className: 'font-bold text-sm pnl-pos' }, n + ' trade' + (n === 1 ? '' : 's') + ' ready')),
            parsed.invalid ? h('div', { className: 'card-base px-4 py-2 flex items-center gap-2' },
              h('span', { className: 'text-xl text-loss' }, '⚠'),
              h('span', { className: 'font-semibold text-sm text-loss' }, parsed.invalid + ' skipped (incomplete rows)')) : null
          ),

          /* preview table */
          n > 0 ? h('div', { className: 'overflow-x-auto' },
            h('table', { className: 'tz-table' },
              h('thead', null, h('tr', null,
                ['Date', 'Symbol', 'Side', 'Qty', 'Entry', 'Exit', 'P&L'].map(function (c) {
                  return h('th', { key: c }, c);
                }))),
              h('tbody', null, parsed.trades.slice(0, 10).map(function (t, i) {
                var p = C.pnlOf(t);
                return h('tr', { key: i },
                  h('td', null, t.date),
                  h('td', { className: 'font-semibold' }, t.symbol),
                  h('td', null, h('span', { className: t.side === 'short' ? 'badge badge-short' : 'badge badge-long' }, t.side === 'short' ? '▼ Short' : '▲ Long')),
                  h('td', { className: 'num' }, Fmt.num(t.quantity)),
                  h('td', { className: 'num' }, isFinite(t.entry) ? Fmt.num(t.entry, 2) : '—'),
                  h('td', { className: 'num' }, isFinite(t.exit) ? Fmt.num(t.exit, 2) : '—'),
                  h('td', { className: window.cx('num font-bold', p >= 0 ? 'pnl-pos' : 'pnl-neg') }, Fmt.money(p, { plus: true }))
                );
              })),
              n > 10 ? h('tfoot', null, h('tr', null,
                h('td', { colSpan: 7, className: 'py-2 px-3 text-xs text-slate-400 text-center' },
                  '+ ' + (n - 10) + ' more trades not shown in preview'))) : null
            )) : null,

          /* import button */
          h('div', { className: 'flex items-center justify-between flex-wrap gap-3' },
            h('div', { className: 'text-xs text-slate-400' },
              'Importing into: ',
              h('strong', { className: 'text-slate-700 dark:text-slate-200' },
                (state.accounts.find(function (a) { return a.id === accId[0]; }) || {}).name || 'Unknown')),
            h('button', {
              disabled: !canImport || importing[0],
              onClick: doImport,
              className: window.cx(
                'tz-btn',
                canImport && !importing[0] ? 'tz-btn-primary' : 'tz-btn-ghost opacity-50 cursor-not-allowed'
              )
            }, importing[0] ? '⏳ Importing…' : '⬇ Import ' + n + ' trade' + (n === 1 ? '' : 's'))
          )
        )
      ) : null,

      /* ── Footer note ── */
      h('p', { className: 'text-xs text-center text-slate-400 pb-2' },
        'Your login credentials are never required or stored. You export the CSV yourself from the prop firm\'s website, then upload it here. All data stays in your browser.'
      )
    );
  }

  window.Views = window.Views || {};
  // Router resolves views via cap(route) which only uppercases the first letter,
  // so route 'propfirmimport' -> 'Propfirmimport'. Register under that exact key
  // (and keep the camelCase alias) so the section renders instead of falling back
  // to the Dashboard.
  window.Views.Propfirmimport = PropfirmImport;
  window.Views.PropfirmImport = PropfirmImport;
})();
