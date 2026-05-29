/* ============================================================
   charts.js — Chart.js wrappers with graceful fallback (global `Charts`)
   ============================================================ */
(function (global) {
  'use strict';

  var GRID = 'rgba(255,255,255,0.06)';
  var TICK = '#8a8aa0';
  var FONT = "Inter, sans-serif";
  var VIOLET = '#7c5cff';
  var GREEN = '#16c784';
  var RED = '#ea3943';

  function available() { return !!global.Chart; }

  function fallback(canvas, msg) {
    var box = canvas.parentNode;
    if (!box) return;
    canvas.style.display = 'none';
    var note = document.createElement('div');
    note.style.cssText = 'height:100%;display:grid;place-items:center;color:#6f6f85;font-size:13px;text-align:center;padding:20px;';
    note.textContent = msg || 'Charts need an internet connection (Chart.js CDN). The rest of the app works offline.';
    box.appendChild(note);
  }

  function killExisting(canvas) {
    if (global.Chart && global.Chart.getChart) {
      var ex = global.Chart.getChart(canvas);
      if (ex) ex.destroy();
    }
  }

  function baseOpts(extra) {
    var o = {
      responsive: true, maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c1c28', borderColor: '#2f2f40', borderWidth: 1,
          titleColor: '#f3f3f7', bodyColor: '#cfcfe0', padding: 10, cornerRadius: 8,
          titleFont: { family: FONT }, bodyFont: { family: FONT }
        }
      },
      scales: {
        x: { grid: { color: GRID, drawTicks: false }, ticks: { color: TICK, font: { family: FONT, size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, border: { display: false } },
        y: { grid: { color: GRID, drawTicks: false }, ticks: { color: TICK, font: { family: FONT, size: 11 } }, border: { display: false } }
      }
    };
    return Object.assign(o, extra || {});
  }

  function line(canvas, cfg) {
    if (!available()) return fallback(canvas);
    killExisting(canvas);
    var ctx = canvas.getContext('2d');
    var grad = ctx.createLinearGradient(0, 0, 0, canvas.height || 280);
    grad.addColorStop(0, 'rgba(124,92,255,0.35)');
    grad.addColorStop(1, 'rgba(124,92,255,0.01)');
    return new global.Chart(canvas, {
      type: 'line',
      data: {
        labels: cfg.labels,
        datasets: [{
          data: cfg.data,
          borderColor: cfg.color || VIOLET,
          backgroundColor: grad,
          fill: true, tension: 0.25, borderWidth: 2,
          pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: cfg.color || VIOLET
        }]
      },
      options: baseOpts({
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c1c28', borderColor: '#2f2f40', borderWidth: 1,
            titleColor: '#f3f3f7', bodyColor: '#cfcfe0', padding: 10, cornerRadius: 8,
            callbacks: { label: function (c) { return '  $' + Number(c.parsed.y).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } }
          }
        }
      })
    });
  }

  function bars(canvas, cfg) {
    if (!available()) return fallback(canvas);
    killExisting(canvas);
    var colors = cfg.data.map(function (v) {
      if (cfg.singleColor) return cfg.singleColor;
      return v >= 0 ? GREEN : RED;
    });
    return new global.Chart(canvas, {
      type: 'bar',
      data: {
        labels: cfg.labels,
        datasets: [{
          data: cfg.data,
          backgroundColor: colors,
          borderRadius: 6, borderSkipped: false, maxBarThickness: 46
        }]
      },
      options: baseOpts({
        indexAxis: cfg.horizontal ? 'y' : 'x',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1c1c28', borderColor: '#2f2f40', borderWidth: 1,
            titleColor: '#f3f3f7', bodyColor: '#cfcfe0', padding: 10, cornerRadius: 8,
            callbacks: {
              label: function (c) {
                var v = cfg.horizontal ? c.parsed.x : c.parsed.y;
                if (cfg.fmt === 'pct') return '  ' + Number(v).toFixed(1) + '%';
                if (cfg.fmt === 'plain') return '  ' + Number(v).toLocaleString('en-US');
                return '  $' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              }
            }
          }
        }
      })
    });
  }

  function doughnut(canvas, cfg) {
    if (!available()) return fallback(canvas);
    killExisting(canvas);
    return new global.Chart(canvas, {
      type: 'doughnut',
      data: { labels: cfg.labels, datasets: [{ data: cfg.data, backgroundColor: cfg.colors || [GREEN, RED, '#3a3a4a'], borderColor: '#16161f', borderWidth: 3 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: '#cfcfe0', font: { family: FONT, size: 12 }, padding: 14, usePointStyle: true } },
          tooltip: { backgroundColor: '#1c1c28', borderColor: '#2f2f40', borderWidth: 1, titleColor: '#f3f3f7', bodyColor: '#cfcfe0', padding: 10, cornerRadius: 8 }
        }
      }
    });
  }

  global.Charts = { line: line, bars: bars, doughnut: doughnut, available: available };
})(window);
