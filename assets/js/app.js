/* ============================================================
   app.js — bootstrap, routing, topbar wiring (global `App`)
   ============================================================ */
(function (global) {
  'use strict';

  var TITLES = {
    dashboard: 'Dashboard', trades: 'Trades', planning: 'Planning',
    playbooks: 'Playbooks', reports: 'Reports & Analytics', journal: 'Journal & Review'
  };

  var current = { route: 'dashboard', accountId: 'all', range: 'all' };

  function ctx() { return { accountId: current.accountId, range: current.range }; }

  function setActiveNav() {
    document.querySelectorAll('.nav__item').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-route') === current.route);
    });
    document.getElementById('pageTitle').textContent = TITLES[current.route] || 'Dashboard';
  }

  function render() {
    var mount = document.getElementById('view');
    setActiveNav();
    try {
      Views.render(current.route, mount, ctx());
    } catch (e) {
      console.error('Render error', e);
      mount.innerHTML = '<div class="empty"><div class="empty__icon">⚠️</div>Something went wrong rendering this view.<br><span class="faint">' + (e && e.message ? e.message : '') + '</span></div>';
    }
    mount.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function go(route) {
    current.route = route;
    if (location.hash !== '#' + route) location.hash = route;
    render();
    closeSidebar();
  }

  function populateAccounts() {
    var sel = document.getElementById('accountSelect');
    var st = Store.getState();
    var opts = ['<option value="all">All accounts</option>'];
    st.accounts.forEach(function (a) { opts.push('<option value="' + a.id + '">' + escapeHtml(a.name) + '</option>'); });
    sel.innerHTML = opts.join('');
    sel.value = current.accountId;
  }
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function openSidebar() { document.getElementById('sidebar').classList.add('open'); }
  function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); }

  /* ---------- theme ---------- */
  var THEME_KEY = 'edgeJournal.theme';
  function getTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { return 'dark'; }
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    var btn = document.getElementById('themeToggle');
    if (btn) {
      btn.textContent = t === 'light' ? '☀️' : '🌙';
      btn.title = t === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
    }
  }
  function toggleTheme() {
    applyTheme(getTheme() === 'light' ? 'dark' : 'light');
    render(); // repaint charts with the new theme colours
  }

  function bind() {
    // nav
    document.getElementById('nav').addEventListener('click', function (e) {
      var item = e.target.closest('.nav__item');
      if (!item) return;
      e.preventDefault();
      go(item.getAttribute('data-route'));
    });

    // topbar controls
    document.getElementById('accountSelect').addEventListener('change', function (e) { current.accountId = e.target.value; render(); });
    document.getElementById('rangeSelect').addEventListener('change', function (e) { current.range = e.target.value; render(); });
    document.getElementById('addTradeBtn').addEventListener('click', function () { Views.openTradeForm(); });
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // mobile menu
    document.getElementById('menuToggle').addEventListener('click', function () {
      document.getElementById('sidebar').classList.toggle('open');
    });
    document.getElementById('view').addEventListener('click', closeSidebar);

    // export / import / reset
    document.getElementById('exportBtn').addEventListener('click', function () {
      U.download('zeroemotionai-backup-' + U.todayISO() + '.json', JSON.stringify(Store.getState(), null, 2));
      UI.toast('Backup downloaded', 'ok');
    });
    document.getElementById('importInput').addEventListener('change', function (e) {
      var file = e.target.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.trades)) throw new Error('Not a valid ZeroEmotionAI backup');
          Store.replaceAll(data);
          current.accountId = 'all';
          populateAccounts();
          render();
          UI.toast('Data imported', 'ok');
        } catch (err) { UI.toast('Import failed: ' + err.message, 'err'); }
        e.target.value = '';
      };
      reader.readAsText(file);
    });
    document.getElementById('resetBtn').addEventListener('click', function () {
      UI.confirm({
        title: 'Reset everything?', danger: true, okText: 'Reset & reseed',
        message: 'This wipes your current data and reloads the sample dataset. Export a backup first if you want to keep it.',
        onConfirm: function () {
          Store.reset(global.seedState);
          current.accountId = 'all'; current.range = 'all';
          document.getElementById('rangeSelect').value = 'all';
          populateAccounts();
          render();
          UI.toast('Reset to sample data', 'ok');
        }
      });
    });

    // hash routing (back/forward)
    window.addEventListener('hashchange', function () {
      var r = location.hash.replace('#', '');
      if (TITLES[r] && r !== current.route) { current.route = r; render(); }
    });
  }

  function init() {
    Store.init(global.seedState);
    populateAccounts();
    bind();
    applyTheme(getTheme()); // sync the toggle icon with the already-applied theme
    var r = location.hash.replace('#', '');
    if (TITLES[r]) current.route = r;
    render();
  }

  global.App = { rerender: render, go: go, getCtx: ctx };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
