/* ============================================================
   charts.js — React wrappers around Chart.js (window.Charts)
   Theme-aware; degrades to a message if the CDN is blocked.
   ============================================================ */
(function () {
  'use strict';
  var h = window.h;
  var FONT = 'Inter, sans-serif';

  function palette(theme) {
    var dark = theme !== 'light';
    return {
      grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)',
      tick: dark ? '#8a8aa0' : '#64748b',
      tipBg: dark ? '#1a1a26' : '#ffffff',
      tipText: dark ? '#f3f3f7' : '#0f172a',
      tipBody: dark ? '#cfcfe0' : '#475569',
      border: dark ? '#2f2f40' : '#e2e8f0',
      panel: dark ? '#15151f' : '#ffffff',
      green: '#16c784', red: '#ea3943', brand: '#7c5cff'
    };
  }
  function tip(p) {
    return { backgroundColor: p.tipBg, borderColor: p.border, borderWidth: 1, titleColor: p.tipText,
      bodyColor: p.tipBody, padding: 10, cornerRadius: 8, titleFont: { family: FONT }, bodyFont: { family: FONT } };
  }
  function rgba(hex, a) {
    var m = String(hex).match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return 'rgba(124,92,255,' + a + ')';
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')';
  }

  function Fallback(props) {
    return h('div', { className: 'grid place-items-center text-center text-slate-400 text-sm p-6',
      style: { height: (props.height || 260) + 'px' } },
      'Charts need an internet connection (Chart.js CDN). Everything else works offline.');
  }

  function useChart(build, deps, height) {
    var ref = React.useRef(null);
    React.useEffect(function () {
      if (!window.Chart || !ref.current) return;
      var inst;
      try { inst = build(ref.current); } catch (e) { console.error('chart build failed', e); }
      return function () { if (inst) inst.destroy(); };
    }, deps);
    return ref;
  }

  // value formatting that follows the active display currency
  function tickFmt(v, fmt) {
    if (fmt === 'pct') return v + '%';
    if (fmt === 'plain') return Number(v).toLocaleString('en-US');
    return window.Fmt.moneyShort(v);
  }
  function tipFmt(v, fmt) {
    if (fmt === 'pct') return '  ' + Number(v).toFixed(1) + '%';
    if (fmt === 'plain') return '  ' + Number(v).toLocaleString('en-US');
    return '  ' + window.Fmt.money(v);
  }

  function baseScales(p, opts) {
    opts = opts || {};
    var valueAxis = opts.horizontal ? 'x' : 'y';
    var fmt = opts.fmt || 'money';
    var s = {
      x: { grid: { color: p.grid, drawTicks: false }, ticks: { color: p.tick, font: { family: FONT, size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, border: { display: false } },
      y: { grid: { color: p.grid, drawTicks: false }, ticks: { color: p.tick, font: { family: FONT, size: 11 } }, border: { display: false } }
    };
    s[valueAxis].ticks.callback = function (v) { return tickFmt(v, fmt); };
    return s;
  }

  function Line(props) {
    var theme = window.useTheme();
    var currency = window.useCurrency();
    var height = props.height || 280;
    if (!window.Chart) return h(Fallback, { height: height });
    var p = palette(theme);
    var color = props.color || p.brand;
    var ref = useChart(function (canvas) {
      var ctx = canvas.getContext('2d');
      var grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, rgba(color, 0.30)); grad.addColorStop(1, rgba(color, 0.01));
      return new window.Chart(canvas, {
        type: 'line',
        data: { labels: props.labels, datasets: [{ data: props.data, borderColor: color, backgroundColor: grad, fill: true, tension: 0.25, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: color }] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' },
          plugins: { legend: { display: false }, tooltip: Object.assign(tip(p), { callbacks: { label: function (c) { return tipFmt(c.parsed.y, 'money'); } } }) },
          scales: baseScales(p, { fmt: 'money' }) }
      });
    }, [JSON.stringify(props.labels), JSON.stringify(props.data), theme, color, currency], height);
    return h('div', { className: 'chart-host', style: { height: height + 'px' } }, h('canvas', { ref: ref }));
  }

  function Bars(props) {
    var theme = window.useTheme();
    var currency = window.useCurrency();
    var height = props.height || 260;
    if (!window.Chart) return h(Fallback, { height: height });
    var p = palette(theme);
    var ref = useChart(function (canvas) {
      var colors = props.data.map(function (v) { return props.color ? (props.color === 'brand' ? p.brand : props.color) : (v >= 0 ? p.green : p.red); });
      return new window.Chart(canvas, {
        type: 'bar',
        data: { labels: props.labels, datasets: [{ data: props.data, backgroundColor: colors, borderRadius: 6, borderSkipped: false, maxBarThickness: 44 }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: props.horizontal ? 'y' : 'x',
          plugins: { legend: { display: false }, tooltip: Object.assign(tip(p), { callbacks: { label: function (c) {
            return tipFmt(props.horizontal ? c.parsed.x : c.parsed.y, props.fmt);
          } } }) },
          scales: baseScales(p, { horizontal: props.horizontal, fmt: props.fmt }) }
      });
    }, [JSON.stringify(props.labels), JSON.stringify(props.data), theme, props.horizontal, props.fmt, props.color, currency], height);
    return h('div', { className: 'chart-host', style: { height: height + 'px' } }, h('canvas', { ref: ref }));
  }

  function Doughnut(props) {
    var theme = window.useTheme();
    var height = props.height || 240;
    if (!window.Chart) return h(Fallback, { height: height });
    var p = palette(theme);
    var ref = useChart(function (canvas) {
      return new window.Chart(canvas, {
        type: 'doughnut',
        data: { labels: props.labels, datasets: [{ data: props.data, backgroundColor: props.colors || [p.green, p.red, '#7a7a8a'], borderColor: p.panel, borderWidth: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%',
          plugins: { legend: { display: true, position: 'bottom', labels: { color: p.tipBody, font: { family: FONT, size: 12 }, padding: 14, usePointStyle: true } }, tooltip: tip(p) } }
      });
    }, [JSON.stringify(props.labels), JSON.stringify(props.data), theme], height);
    return h('div', { className: 'chart-host', style: { height: height + 'px' } }, h('canvas', { ref: ref }));
  }

  function Radar(props) {
    var theme = window.useTheme();
    var height = props.height || 260;
    if (!window.Chart) return h(Fallback, { height: height });
    var p = palette(theme);
    var ref = useChart(function (canvas) {
      return new window.Chart(canvas, {
        type: 'radar',
        data: { labels: props.labels, datasets: [{ data: props.data, backgroundColor: rgba(p.brand, 0.22), borderColor: p.brand, borderWidth: 2, pointBackgroundColor: p.brand, pointRadius: 3, pointHoverRadius: 5 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: Object.assign(tip(p), { callbacks: { label: function (c) { return '  ' + Math.round(c.parsed.r) + ' / 100'; } } }) },
          scales: { r: { min: 0, max: 100, beginAtZero: true,
            grid: { color: p.grid }, angleLines: { color: p.grid },
            ticks: { display: false, stepSize: 25, backdropColor: 'transparent' },
            pointLabels: { color: p.tick, font: { family: FONT, size: 11 } } } }
        }
      });
    }, [JSON.stringify(props.labels), JSON.stringify(props.data), theme], height);
    return h('div', { className: 'chart-host', style: { height: height + 'px' } }, h('canvas', { ref: ref }));
  }

  // Semicircle gauge: segments = [{value, color}]; optional remainder fills to `total`.
  function Gauge(props) {
    var theme = window.useTheme();
    var currency = window.useCurrency();
    var height = props.height || 130;
    if (!window.Chart) return h(Fallback, { height: height });
    var p = palette(theme);
    var ref = useChart(function (canvas) {
      var segs = props.segments && props.segments.length ? props.segments : [{ value: 1, color: p.brand }];
      var data = segs.map(function (s) { return s.value; });
      var colors = segs.map(function (s) { return s.color; });
      var sum = data.reduce(function (a, b) { return a + b; }, 0);
      if (props.total && props.total > sum) { data.push(props.total - sum); colors.push(theme === 'light' ? '#e8eaf2' : '#262633'); }
      if (sum === 0 && !props.total) { data.push(1); colors.push(theme === 'light' ? '#e8eaf2' : '#262633'); }
      return new window.Chart(canvas, {
        type: 'doughnut',
        data: { datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '72%', rotation: -90, circumference: 180,
          plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: 300 } }
      });
    }, [JSON.stringify(props.segments), props.total, theme, currency], height);
    return h('div', { className: 'chart-host', style: { height: height + 'px' } }, h('canvas', { ref: ref }));
  }

  window.Charts = { Line: Line, Bars: Bars, Doughnut: Doughnut, Radar: Radar, Gauge: Gauge };
})();
