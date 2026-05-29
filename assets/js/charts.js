/* ============================================================
   charts.js — Chart.js wrappers with graceful fallback (global `Charts`)
   Colours are read from CSS variables so charts follow the active theme.
   ============================================================ */
(function (global) {
  'use strict';

  var FONT = 'Inter, sans-serif';

  function cssVar(name, fallbackVal) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      return (v && v.trim()) || fallbackVal;
    } catch (e) { return fallbackVal; }
  }
  function theme() {
    return {
      grid: cssVar('--chart-grid', 'rgba(255,255,255,0.06)'),
      tick: cssVar('--chart-tick', '#8a8aa0'),
      tipBg: cssVar('--chart-tip-bg', '#1c1c28'),
      tipText: cssVar('--chart-tip-text', '#f3f3f7'),
      tipBody: cssVar('--chart-tip-body', '#cfcfe0'),
      panel: cssVar('--panel', '#16161f'),
      green: cssVar('--green', '#16c784'),
      red: cssVar('--red', '#ea3943'),
      violet: cssVar('--violet', '#7c5cff')
    };
  }

  function available() { return !!global.Chart; }

  function fallback(canvas, msg) {
    var box = canvas.parentNode;
    if (!box) return;
    canvas.style.display = 'none';
    var note = document.createElement('div');
    note.style.cssText = 'height:100%;display:grid;place-items:center;color:var(--text-faint);font-size:13px;text-align:center;padding:20px;';
    note.textContent = msg || 'Charts need an internet connection (Chart.js CDN). The rest of the app works offline.';
    box.appendChild(note);
  }

  function killExisting(canvas) {
    if (global.Chart && global.Chart.getChart) {
      var ex = global.Chart.getChart(canvas);
      if (ex) ex.destroy();
    }
  }

  function tooltipCfg(t, extraCallbacks) {
    return Object.assign({
      backgroundColor: t.tipBg, borderColor: cssVar('--border-2', '#2f2f40'), borderWidth: 1,
      titleColor: t.tipText, bodyColor: t.tipBody, padding: 10, cornerRadius: 8,
      titleFont: { family: FONT }, bodyFont: { family: FONT }
    }, extraCallbacks || {});
  }

  function baseOpts(t, extra) {
    var o = {
      responsive: true, maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: { legend: { display: false }, tooltip: tooltipCfg(t) },
      scales: {
        x: { grid: { color: t.grid, drawTicks: false }, ticks: { color: t.tick, font: { family: FONT, size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, border: { display: false } },
        y: { grid: { color: t.grid, drawTicks: false }, ticks: { color: t.tick, font: { family: FONT, size: 11 } }, border: { display: false } }
      }
    };
    return Object.assign(o, extra || {});
  }

  function hexToRgba(hex, a) {
    var m = String(hex).trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return 'rgba(124,92,255,' + a + ')';
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')';
  }

  function line(canvas, cfg) {
    if (!available()) return fallback(canvas);
    killExisting(canvas);
    var t = theme();
    var color = cfg.color || t.violet;
    var ctx = canvas.getContext('2d');
    var grad = ctx.createLinearGradient(0, 0, 0, canvas.height || 280);
    grad.addColorStop(0, hexToRgba(color, 0.32));
    grad.addColorStop(1, hexToRgba(color, 0.01));
    return new global.Chart(canvas, {
      type: 'line',
      data: {
        labels: cfg.labels,
        datasets: [{
          data: cfg.data, borderColor: color, backgroundColor: grad,
          fill: true, tension: 0.25, borderWidth: 2,
          pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: color
        }]
      },
      options: baseOpts(t, {
        plugins: {
          legend: { display: false },
          tooltip: tooltipCfg(t, { callbacks: { label: function (c) { return '  $' + Number(c.parsed.y).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } } })
        }
      })
    });
  }

  function bars(canvas, cfg) {
    if (!available()) return fallback(canvas);
    killExisting(canvas);
    var t = theme();
    var colors = cfg.data.map(function (v) {
      if (cfg.singleColor) return cfg.singleColor === 'violet' ? t.violet : cfg.singleColor;
      return v >= 0 ? t.green : t.red;
    });
    return new global.Chart(canvas, {
      type: 'bar',
      data: { labels: cfg.labels, datasets: [{ data: cfg.data, backgroundColor: colors, borderRadius: 6, borderSkipped: false, maxBarThickness: 46 }] },
      options: baseOpts(t, {
        indexAxis: cfg.horizontal ? 'y' : 'x',
        plugins: {
          legend: { display: false },
          tooltip: tooltipCfg(t, {
            callbacks: {
              label: function (c) {
                var v = cfg.horizontal ? c.parsed.x : c.parsed.y;
                if (cfg.fmt === 'pct') return '  ' + Number(v).toFixed(1) + '%';
                if (cfg.fmt === 'plain') return '  ' + Number(v).toLocaleString('en-US');
                return '  $' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              }
            }
          })
        }
      })
    });
  }

  function doughnut(canvas, cfg) {
    if (!available()) return fallback(canvas);
    killExisting(canvas);
    var t = theme();
    return new global.Chart(canvas, {
      type: 'doughnut',
      data: { labels: cfg.labels, datasets: [{ data: cfg.data, backgroundColor: cfg.colors || [t.green, t.red, '#7a7a8a'], borderColor: t.panel, borderWidth: 3 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: t.tipBody, font: { family: FONT, size: 12 }, padding: 14, usePointStyle: true } },
          tooltip: tooltipCfg(t)
        }
      }
    });
  }

  global.Charts = { line: line, bars: bars, doughnut: doughnut, available: available };
})(window);
