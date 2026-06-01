/* ============================================================
   view.watchlist.js — Watchlist & Markets (Views.Watchlist)
   Symbols with bias / levels / notes / price alerts, optional live
   quotes (Finnhub key), and an embedded TradingView real-candle chart.
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, Store = window.Store;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef, useMemo = React.useMemo;

  var BIAS = [['long', '▲ Long'], ['short', '▼ Short'], ['neutral', '• Neutral']];

  function Watchlist(props) {
    var state = props.state || Store.getState();
    var settings = Store.getSettings();
    var list = state.watchlist || [];

    var keyS = useState(settings.finnhubKey || '');
    var draft = useState({ symbol: '', bias: 'long', alert: '', note: '' }); var d = draft[0];
    var sel = useState(list[0] ? (list[0].tvSymbol || list[0].symbol) : 'SPY'); var selSym = sel[0];
    var quotes = useState({}); var qmap = quotes[0];
    var loading = useState(false);
    var auto = useState(false);
    var triggered = useRef({});

    function setD(k, v) { var o = {}; o[k] = v; draft[1](Object.assign({}, d, o)); }
    function addSym() {
      var sym = String(d.symbol || '').trim().toUpperCase(); if (!sym) { window.toast('Enter a symbol', 'err'); return; }
      Store.add('watchlist', { symbol: sym, tvSymbol: sym, bias: d.bias, alert: d.alert === '' ? null : parseFloat(d.alert), note: String(d.note || '').trim() });
      draft[1]({ symbol: '', bias: 'long', alert: '', note: '' });
      window.toast(sym + ' added to watchlist', 'ok');
    }
    function saveKey() { Store.setSetting('finnhubKey', keyS[0].trim()); window.toast(keyS[0].trim() ? 'API key saved' : 'API key cleared', 'ok'); if (keyS[0].trim()) refresh(); }

    function refresh() {
      var key = (Store.getSettings().finnhubKey || '').trim();
      if (!key || !list.length || !window.Markets) return;
      loading[1](true);
      window.Markets.fetchQuotes(list.map(function (w) { return w.symbol; }), key).then(function (res) {
        var m = {}; res.forEach(function (r) { if (r.quote) m[r.symbol] = r.quote; });
        quotes[1](m); loading[1](false); checkAlerts(m);
      });
    }
    function checkAlerts(m) {
      list.forEach(function (w) {
        if (w.alert == null || !m[w.symbol]) return;
        var price = m[w.symbol].price;
        var hit = w.bias === 'short' ? price <= w.alert : price >= w.alert;
        if (hit && !triggered.current[w.id]) {
          triggered.current[w.id] = true;
          var msg = w.symbol + ' hit alert ' + Fmt.num(w.alert, 2) + ' (now ' + Fmt.num(price, 2) + ')';
          window.toast('🔔 ' + msg, 'ok');
          if (window.Notification && Notification.permission === 'granted') { try { new Notification('ZeroEmotionAI alert', { body: msg }); } catch (e) {} }
        } else if (!hit) { triggered.current[w.id] = false; }
      });
    }
    function enableNotifs() {
      if (!window.Notification) { window.toast('Notifications not supported', 'err'); return; }
      Notification.requestPermission().then(function (p) { window.toast(p === 'granted' ? 'Desktop alerts enabled' : 'Alerts permission ' + p, p === 'granted' ? 'ok' : 'err'); });
    }

    // initial + auto refresh
    useEffect(function () { refresh(); }, [list.length]);
    useEffect(function () {
      if (!auto[0]) return;
      var id = setInterval(refresh, 30000);
      return function () { clearInterval(id); };
    }, [auto[0], list.length]);

    var hasKey = !!(settings.finnhubKey || '').trim();

    return h('div', { className: 'space-y-5 animate-fade-in' },
      h(UI.SectionHead, { title: 'Watchlist & Markets',
        sub: 'Track symbols with your bias, key levels and price alerts — with live charts.',
        right: [
          h(UI.Button, { key: 'n', variant: 'ghost', size: 'sm', onClick: enableNotifs }, '🔔 Enable alerts'),
          h(UI.Button, { key: 'r', variant: 'ghost', size: 'sm', onClick: refresh, disabled: !hasKey || loading[0] }, loading[0] ? 'Refreshing…' : '↻ Refresh quotes')
        ] }),

      /* add + settings */
      h(UI.Card, { className: 'p-5' },
        h('div', { className: 'grid grid-cols-2 sm:grid-cols-5 gap-3 items-end' },
          h(UI.Field, { label: 'Symbol' }, h(UI.Input, { value: d.symbol, placeholder: 'AAPL, BINANCE:BTCUSDT', onChange: function (e) { setD('symbol', e.target.value); }, onKeyDown: function (e) { if (e.key === 'Enter') addSym(); } })),
          h(UI.Field, { label: 'Bias' }, h(UI.Select, { value: d.bias, onChange: function (e) { setD('bias', e.target.value); } }, BIAS.map(function (b) { return h('option', { key: b[0], value: b[0] }, b[1]); }))),
          h(UI.Field, { label: 'Alert price' }, h(UI.Input, { type: 'number', step: 'any', value: d.alert, onChange: function (e) { setD('alert', e.target.value); } })),
          h(UI.Field, { label: 'Note' }, h(UI.Input, { value: d.note, placeholder: 'Thesis / level', onChange: function (e) { setD('note', e.target.value); } })),
          h(UI.Button, { variant: 'primary', onClick: addSym }, '+ Add')),
        h('div', { className: 'mt-4 pt-4 border-t border-slate-100 dark:border-ink-700 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end' },
          h(UI.Field, { label: 'Finnhub API key', hint: '— free, for live quotes (optional)' },
            h(UI.Input, { value: keyS[0], placeholder: 'paste your free finnhub.io key', onChange: function (e) { keyS[1](e.target.value); } })),
          h(UI.Button, { variant: 'ghost', onClick: saveKey }, 'Save key'),
          h('label', { className: 'flex items-center gap-2 text-sm text-slate-500' },
            h('input', { type: 'checkbox', checked: auto[0], onChange: function (e) { auto[1](e.target.checked); }, disabled: !hasKey }),
            'Auto-refresh every 30s')),
        !hasKey ? h('p', { className: 'text-[11px] text-slate-400 mt-2' }, 'No key? The watchlist still works as a manual plan with bias, levels and notes. Live prices/alerts need a free Finnhub key.') : null),

      /* table */
      list.length === 0
        ? h(UI.Empty, { icon: '👁️', title: 'Your watchlist is empty', sub: 'Add the symbols you are stalking for tomorrow.' })
        : h(UI.Card, { className: 'overflow-hidden' }, h('div', { className: 'overflow-x-auto' },
            h('table', { className: 'w-full text-sm min-w-[720px]' },
              h('thead', null, h('tr', { className: 'text-left text-[11px] uppercase tracking-wide text-slate-400 bg-slate-50 dark:bg-ink-750' },
                ['Symbol', 'Bias', 'Last', 'Chg %', 'Alert', 'Note', ''].map(function (c) { return h('th', { key: c, className: 'py-2.5 px-3 font-semibold' }, c); }))),
              h('tbody', null, list.map(function (w) {
                var q = qmap[w.symbol];
                var biasCls = w.bias === 'short' ? 'badge badge-short' : w.bias === 'neutral' ? 'badge badge-be' : 'badge badge-long';
                var biasTxt = w.bias === 'short' ? '▼ Short' : w.bias === 'neutral' ? '• Neutral' : '▲ Long';
                return h('tr', { key: w.id, className: 'border-t border-slate-100 dark:border-ink-700 hover:bg-slate-50 dark:hover:bg-ink-700/60 cursor-pointer', onClick: function () { sel[1](w.tvSymbol || w.symbol); } },
                  h('td', { className: 'py-2.5 px-3 font-semibold' }, w.symbol),
                  h('td', { className: 'px-3' }, h('span', { className: biasCls }, biasTxt)),
                  h('td', { className: 'px-3 text-right tabular-nums' }, q ? Fmt.num(q.price, 2) : '—'),
                  h('td', { className: window.cx('px-3 text-right tabular-nums font-semibold', q ? (q.changePct >= 0 ? 'pnl-pos' : 'pnl-neg') : 'text-slate-400') }, q ? (q.changePct >= 0 ? '+' : '') + Fmt.num(q.changePct, 2) + '%' : '—'),
                  h('td', { className: 'px-3 text-right tabular-nums' }, w.alert != null ? Fmt.num(w.alert, 2) : '—'),
                  h('td', { className: 'px-3 text-slate-400 max-w-[220px] truncate' }, w.note || '—'),
                  h('td', { className: 'px-3 whitespace-nowrap text-right' },
                    h('button', { className: 'text-brand-400 font-semibold text-xs px-1.5 py-1 rounded hover:bg-brand/10', onClick: function (e) { e.stopPropagation(); sel[1](w.tvSymbol || w.symbol); } }, 'Chart'),
                    h('button', { className: 'text-loss font-semibold text-xs px-1.5 py-1 rounded hover:bg-loss/10', onClick: function (e) { e.stopPropagation(); Store.remove('watchlist', w.id); window.toast('Removed', 'ok'); } }, 'Remove')));
              }))))),

      /* chart */
      h(UI.Card, { className: 'p-4' },
        h('div', { className: 'flex items-center justify-between mb-3 flex-wrap gap-2' },
          h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, 'Live chart — ' + selSym),
          h(UI.Input, { className: 'w-48 py-1 text-sm', value: selSym, onChange: function (e) { sel[1](e.target.value); }, placeholder: 'Symbol' })),
        window.Markets ? h(window.Markets.TVChart, { symbol: selSym, height: 440 })
          : h('div', { className: 'text-slate-400 text-sm p-6 text-center' }, 'Chart module unavailable.'))
    );
  }

  window.Views = window.Views || {};
  window.Views.Watchlist = Watchlist;
})();
