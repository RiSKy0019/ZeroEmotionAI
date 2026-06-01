/* ============================================================
   cloud.js — optional Supabase cloud sync (window.Cloud)
   Local-first: the app always works offline on localStorage.
   If the user pastes their own free Supabase URL + anon key,
   this enables email/password login and syncs the whole app
   state to a per-user row (newest-wins). No secrets are shipped
   in the code — the user supplies their own project.
   ============================================================ */
(function () {
  'use strict';
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
  var CFG_KEY = 'zea.cloud.cfg';

  var client = null, session = null, started = false, sdkPromise = null, pushTimer = null;
  var listeners = [];
  var st = { configured: false, signedIn: false, email: null, lastSync: null, syncing: false, error: null, busy: false };

  function getConfig() { try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (e) { return null; } }
  function isConfigured() { return !!getConfig(); }
  function emit() { var snap = Object.assign({}, st); listeners.forEach(function (fn) { try { fn(snap); } catch (e) {} }); }
  function setStatus(p) { Object.assign(st, p); emit(); }
  function onChange(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; }

  function setConfig(url, key) {
    if (url && key) localStorage.setItem(CFG_KEY, JSON.stringify({ url: String(url).trim(), key: String(key).trim() }));
    else localStorage.removeItem(CFG_KEY);
    client = null; session = null;
    setStatus({ configured: !!(url && key), signedIn: false, email: null, error: null });
    if (url && key) init();
  }

  function loadSDK() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = SDK_URL; s.async = true;
      s.onload = resolve; s.onerror = function () { reject(new Error('SDK load failed')); };
      document.head.appendChild(s);
    });
    return sdkPromise;
  }
  function getClient() {
    var cfg = getConfig(); if (!cfg) return null;
    if (client) return client;
    if (!window.supabase || !window.supabase.createClient) return null;
    client = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'zea.sb.auth' } });
    return client;
  }

  function init() {
    var cfg = getConfig();
    setStatus({ configured: !!cfg });
    if (!cfg) return Promise.resolve();
    return loadSDK().then(function () {
      var c = getClient(); if (!c) return;
      return c.auth.getSession().then(function (res) {
        session = res.data && res.data.session;
        if (session) { setStatus({ signedIn: true, email: session.user.email, error: null }); startSync(); pullThenPush(); }
        else setStatus({ signedIn: false, email: null });
        c.auth.onAuthStateChange(function (_evt, sess) {
          session = sess;
          if (sess) setStatus({ signedIn: true, email: sess.user.email });
          else setStatus({ signedIn: false, email: null });
        });
      });
    }).catch(function () { setStatus({ error: 'Could not reach Supabase (offline or wrong URL/key). The app still works locally.' }); });
  }

  function startSync() {
    if (started) return; started = true;
    if (window.Store && window.Store.subscribe) window.Store.subscribe(function () { schedulePush(); });
  }
  function schedulePush() { if (!session) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); }

  function push() {
    var c = getClient(); if (!c || !session) return Promise.resolve();
    var state = window.Store.getState();
    setStatus({ syncing: true });
    return c.from('app_state').upsert({ user_id: session.user.id, data: state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .then(function (res) {
        if (res.error) setStatus({ syncing: false, error: 'Sync failed: ' + res.error.message });
        else setStatus({ syncing: false, lastSync: Date.now(), error: null });
      }, function () { setStatus({ syncing: false, error: 'Sync failed (offline?)' }); });
  }
  function pull() {
    var c = getClient(); if (!c || !session) return Promise.resolve(null);
    return c.from('app_state').select('data, updated_at').eq('user_id', session.user.id).maybeSingle()
      .then(function (res) { if (res.error) { setStatus({ error: 'Pull failed: ' + res.error.message }); return null; } return res.data; });
  }
  function pullThenPush() {
    return pull().then(function (remote) {
      if (remote && remote.data) {
        var local = window.Store.getState();
        var localT = (local.meta && local.meta.updatedAt) || 0;
        var remoteT = (remote.data.meta && remote.data.meta.updatedAt) || Date.parse(remote.updated_at) || 0;
        if (remoteT > localT) {
          window.Store.replaceAll(remote.data);
          setStatus({ lastSync: Date.now() });
          if (window.toast) window.toast('Loaded your data from the cloud', 'ok');
          return;
        }
      }
      return push();
    }).catch(function () {});
  }

  function signUp(email, pw) { var c = getClient(); if (!c) return Promise.reject(new Error('Not configured')); setStatus({ busy: true, error: null }); return c.auth.signUp({ email: email, password: pw }).then(function (res) { setStatus({ busy: false }); if (res.error) setStatus({ error: res.error.message }); return res; }, function (e) { setStatus({ busy: false, error: 'Sign-up failed' }); throw e; }); }
  function signIn(email, pw) { var c = getClient(); if (!c) return Promise.reject(new Error('Not configured')); setStatus({ busy: true, error: null }); return c.auth.signInWithPassword({ email: email, password: pw }).then(function (res) { setStatus({ busy: false }); if (res.error) { setStatus({ error: res.error.message }); } else { session = res.data.session; setStatus({ signedIn: true, email: email, error: null }); startSync(); pullThenPush(); } return res; }, function (e) { setStatus({ busy: false, error: 'Sign-in failed' }); throw e; }); }
  function signOut() { var c = getClient(); if (!c) return Promise.resolve(); return c.auth.signOut().then(function () { session = null; setStatus({ signedIn: false, email: null }); }); }
  function syncNow() { return session ? pullThenPush() : Promise.resolve(); }

  window.Cloud = { getConfig: getConfig, setConfig: setConfig, isConfigured: isConfigured, init: init,
    status: function () { return Object.assign({}, st); }, onChange: onChange,
    signUp: signUp, signIn: signIn, signOut: signOut, syncNow: syncNow };

  // React hook for views
  window.useCloud = function () {
    var s = React.useState(Object.assign({}, st));
    React.useEffect(function () { return onChange(function (ns) { s[1](ns); }); }, []);
    return s[0];
  };

  // auto-init (restore session + start sync) once the DOM is ready
  function boot() { try { init(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
})();
