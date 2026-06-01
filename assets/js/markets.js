/* ============================================================
   markets.js — live market data + TradingView chart (window.Markets)
   - TVChart: embeds the free TradingView Advanced Chart widget
     (real candles) for any symbol; theme-aware, degrades gracefully.
   - fetchQuote(s): optional live quotes via the user's free Finnhub
     API key (stored in settings). Runs in the visitor's browser only.
   ============================================================ */
(function () {
  'use strict';
  var h = window.h;
  var useEffect = React.useEffect, useRef = React.useRef, useState = React.useState;

  /* ---- load TradingView's tv.js once ---- */
  var tvPromise = null;
  function loadTV() {
    if (window.TradingView) return Promise.resolve();
    if (tvPromise) return tvPromise;
    tvPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://s3.tradingview.com/tv.js';
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('TradingView failed to load')); };
      document.head.appendChild(s);
    });
    return tvPromise;
  }

  /* ---- Reusable real-candle chart ---- */
  var seq = 0;
  function TVChart(props) {
    var theme = window.useTheme ? window.useTheme() : 'dark';
    var idRef = useRef('tvchart_' + (++seq));
    var hostRef = useRef(null);
    var errS = useState(false); var err = errS[0];
    var symbol = props.symbol || 'SPY';
    var height = props.height || 420;

    useEffect(function () {
      var cancelled = false;
      loadTV().then(function () {
        if (cancelled || !hostRef.current || !window.TradingView) return;
        hostRef.current.innerHTML = '';
        try {
          new window.TradingView.widget({
            container_id: idRef.current,
            symbol: symbol,
            interval: props.interval || 'D',
            timezone: 'Etc/UTC',
            theme: theme === 'light' ? 'light' : 'dark',
            style: '1', locale: 'en', autosize: true,
            hide_side_toolbar: true, allow_symbol_change: true, withdateranges: true,
            backgroundColor: theme === 'light' ? '#ffffff' : '#0a0a0a'
          });
        } catch (e) { if (!cancelled) errS[1](true); }
      }).catch(function () { if (!cancelled) errS[1](true); });
      return function () { cancelled = true; };
    }, [symbol, theme, props.interval]);

    if (err) return h('div', { className: 'grid place-items-center text-center text-slate-400 text-sm rounded-xl border border-slate-200 dark:border-ink-700', style: { height: height + 'px' } },
      'Live chart needs an internet connection (TradingView CDN).');
    return h('div', { className: 'rounded-xl overflow-hidden border border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-950', style: { height: height + 'px' } },
      h('div', { id: idRef.current, ref: hostRef, style: { height: '100%', width: '100%' } }));
  }

  /* ---- Optional live quotes via Finnhub (free key) ---- */
  function fetchQuote(symbol, key) {
    if (!key || !symbol) return Promise.resolve(null);
    var url = 'https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(symbol) + '&token=' + encodeURIComponent(key);
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); }).then(function (j) {
      if (j && typeof j.c === 'number' && j.c > 0) return { price: j.c, change: j.d, changePct: j.dp, high: j.h, low: j.l, open: j.o, prevClose: j.pc };
      return null;
    }).catch(function () { return null; });
  }
  function fetchQuotes(symbols, key) {
    return Promise.all(symbols.map(function (s) { return fetchQuote(s, key).then(function (q) { return { symbol: s, quote: q }; }); }));
  }

  window.Markets = { loadTV: loadTV, TVChart: TVChart, fetchQuote: fetchQuote, fetchQuotes: fetchQuotes };
})();
