/* ============================================================
   store.js — persistence, React store hook, and trade math
   window.Store  : data API + calc namespace
   window.useStore() : React hook returning current state
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'zea.state.v1';
  var listeners = [];
  var state = loadOrSeed();

  function uid(p) { return (p || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }

  function loadOrSeed() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.trades)) return ensure(parsed);
      }
    } catch (e) {}
    return ensure(window.seedState ? window.seedState(uid) : empty());
  }
  function empty() {
    return { meta: { v: 1, createdAt: new Date().toISOString() },
      accounts: [{ id: uid('acc'), name: 'Main Account', broker: 'Manual', startingBalance: 25000 }],
      trades: [], playbooks: [], journal: [] };
  }
  function ensure(s) {
    ['accounts', 'trades', 'playbooks', 'journal'].forEach(function (k) { if (!Array.isArray(s[k])) s[k] = []; });
    if (!s.meta) s.meta = { v: 1, createdAt: new Date().toISOString() };
    return s;
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('persist failed', e); } }
  function notify() { listeners.forEach(function (fn) { fn(); }); }
  function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; }
  function getState() { return state; }

  // produce a new top-level state object so React detects the change
  function commit(next) { state = next; persist(); notify(); }
  function withArr(key, arr) { var n = Object.assign({}, state); n[key] = arr; return n; }

  /* ---------- CRUD ---------- */
  function add(coll, obj) { obj.id = obj.id || uid(coll.slice(0, 3)); commit(withArr(coll, state[coll].concat([obj]))); return obj; }
  function update(coll, id, patch) {
    commit(withArr(coll, state[coll].map(function (x) { return x.id === id ? Object.assign({}, x, patch) : x; })));
  }
  function remove(coll, id) { commit(withArr(coll, state[coll].filter(function (x) { return x.id !== id; }))); }

  // Deleting an account also removes its trades (keeps data consistent).
  function removeAccount(id) {
    var n = Object.assign({}, state);
    n.accounts = state.accounts.filter(function (a) { return a.id !== id; });
    n.trades = state.trades.filter(function (t) { return t.accountId !== id; });
    commit(n);
  }

  function reset() { commit(ensure(window.seedState ? window.seedState(uid) : empty())); }
  function clearAll() {
    var n = empty(); n.accounts = state.accounts; commit(n);
  }
  function replaceAll(data) { commit(ensure(data)); }

  /* ---------- queries ---------- */
  function getTrades(opts) {
    opts = opts || {};
    var list = state.trades.slice();
    if (opts.accountId && opts.accountId !== 'all') list = list.filter(function (t) { return t.accountId === opts.accountId; });
    if (opts.range && opts.range !== 'all') {
      var cut = rangeCutoff(opts.range);
      list = list.filter(function (t) { return new Date(t.date + 'T00:00:00') >= cut; });
    }
    list.sort(function (a, b) { return timeKey(a) - timeKey(b); });
    return list;
  }
  function rangeCutoff(range) {
    var now = new Date();
    if (range === 'ytd') return new Date(now.getFullYear(), 0, 1);
    var n = parseInt(range, 10);
    if (!isNaN(n)) { var d = new Date(); d.setDate(d.getDate() - n); return d; }
    return new Date(0);
  }
  function timeKey(t) { return new Date((t.date || '1970-01-01') + 'T' + (t.time || '00:00') + ':00').getTime(); }

  function allTags() {
    var set = {};
    state.trades.forEach(function (t) { (t.tags || []).forEach(function (x) { set[x] = 1; }); });
    return Object.keys(set).sort();
  }
  function allMistakes() {
    var set = {};
    state.trades.forEach(function (t) { (t.mistakes || []).forEach(function (x) { set[x] = 1; }); });
    return Object.keys(set).sort();
  }

  /* ============================================================
     Calculations
     ============================================================ */
  function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function pnlOf(t) {
    if (t.pnlOverride !== undefined && t.pnlOverride !== null && t.pnlOverride !== '') return r2(Number(t.pnlOverride));
    var dir = t.side === 'short' ? -1 : 1;
    var mult = Number(t.multiplier) || 1; // contract point value; 1 for stocks/crypto/forex
    return r2((t.exit - t.entry) * t.quantity * mult * dir - (t.fees || 0));
  }
  function rOf(t) { var risk = Number(t.riskAmount) || 0; return risk > 0 ? r2(pnlOf(t) / risk) : null; }
  function resultOf(t) { var p = pnlOf(t); return p > 0 ? 'win' : p < 0 ? 'loss' : 'be'; }

  function stats(trades) {
    var s = { total: trades.length, wins: 0, losses: 0, be: 0, netPnl: 0, grossWin: 0, grossLoss: 0, fees: 0,
      winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0, expectancy: 0, avgR: null, largestWin: 0, largestLoss: 0,
      winStreak: 0, lossStreak: 0, avgWinR: null, avgLossR: null };
    var rVals = [], rWin = [], rLoss = [], cw = 0, cl = 0;
    trades.forEach(function (t) {
      var p = pnlOf(t); s.netPnl += p; s.fees += (t.fees || 0);
      if (p > 0) { s.wins++; s.grossWin += p; s.largestWin = Math.max(s.largestWin, p); cw++; cl = 0; }
      else if (p < 0) { s.losses++; s.grossLoss += Math.abs(p); s.largestLoss = Math.min(s.largestLoss, p); cl++; cw = 0; }
      else { cw = 0; cl = 0; s.be++; }
      s.winStreak = Math.max(s.winStreak, cw); s.lossStreak = Math.max(s.lossStreak, cl);
      var r = rOf(t); if (r !== null) { rVals.push(r); if (p > 0) rWin.push(r); else if (p < 0) rLoss.push(r); }
    });
    var decided = s.wins + s.losses;
    s.winRate = decided ? (s.wins / decided) * 100 : 0;
    s.profitFactor = s.grossLoss ? s.grossWin / s.grossLoss : (s.grossWin ? Infinity : 0);
    s.avgWin = s.wins ? s.grossWin / s.wins : 0;
    s.avgLoss = s.losses ? s.grossLoss / s.losses : 0;
    s.expectancy = s.total ? s.netPnl / s.total : 0;
    if (rVals.length) s.avgR = avg(rVals);
    if (rWin.length) s.avgWinR = avg(rWin);
    if (rLoss.length) s.avgLossR = avg(rLoss);
    s.netPnl = r2(s.netPnl); s.grossWin = r2(s.grossWin); s.grossLoss = r2(s.grossLoss); s.fees = r2(s.fees);
    return s;
  }
  function avg(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }

  function equityCurve(trades, startBal) {
    var bal = Number(startBal) || 0, pts = [{ label: 'Start', value: r2(bal) }];
    trades.forEach(function (t) { bal += pnlOf(t); pts.push({ label: t.date, value: r2(bal) }); });
    return pts;
  }
  function maxDrawdown(trades, startBal) {
    var bal = Number(startBal) || 0, peak = bal, mdd = 0, mddPct = 0;
    trades.forEach(function (t) { bal += pnlOf(t); if (bal > peak) peak = bal; var dd = peak - bal; if (dd > mdd) { mdd = dd; mddPct = peak ? dd / peak * 100 : 0; } });
    return { amount: r2(mdd), pct: r2(mddPct) };
  }
  function groupSum(trades, keyFn) {
    var map = {};
    trades.forEach(function (t) {
      var k = keyFn(t); if (k === null || k === undefined || k === '') return;
      if (Array.isArray(k)) { k.forEach(function (kk) { bump(map, kk, t); }); }
      else bump(map, k, t);
    });
    return Object.keys(map).map(function (k) { var o = map[k]; o.pnl = r2(o.pnl); o.winRate = (o.wins + o.losses) ? o.wins / (o.wins + o.losses) * 100 : 0; return o; });
  }
  function bump(map, k, t) {
    if (!map[k]) map[k] = { key: String(k), pnl: 0, count: 0, wins: 0, losses: 0 };
    var p = pnlOf(t); map[k].pnl += p; map[k].count++; if (p > 0) map[k].wins++; else if (p < 0) map[k].losses++;
  }
  function dailyPnl(trades) {
    var map = {};
    trades.forEach(function (t) { if (!map[t.date]) map[t.date] = { pnl: 0, count: 0 }; map[t.date].pnl += pnlOf(t); map[t.date].count++; });
    Object.keys(map).forEach(function (d) { map[d].pnl = r2(map[d].pnl); });
    return map;
  }
  function rDistribution(trades) {
    var buckets = [
      { key: '≤ -2R', min: -Infinity, max: -2 }, { key: '-2R to -1R', min: -2, max: -1 },
      { key: '-1R to 0', min: -1, max: 0 }, { key: '0 to 1R', min: 0, max: 1 },
      { key: '1R to 2R', min: 1, max: 2 }, { key: '2R to 3R', min: 2, max: 3 }, { key: '≥ 3R', min: 3, max: Infinity }
    ];
    var counts = buckets.map(function (b) { return { key: b.key, count: 0 }; });
    trades.forEach(function (t) {
      var r = rOf(t); if (r === null) return;
      for (var i = 0; i < buckets.length; i++) { if (r > buckets[i].min && r <= buckets[i].max) { counts[i].count++; break; } if (r === 0 && buckets[i].key === '-1R to 0') { counts[i].count++; break; } }
    });
    return counts;
  }
  function disciplineScore(trades) {
    if (!trades.length) return { score: 0, clean: 0, total: 0 };
    var clean = trades.filter(function (t) { return !(t.mistakes && t.mistakes.length); }).length;
    return { score: Math.round(clean / trades.length * 100), clean: clean, total: trades.length };
  }
  function mistakeCost(trades) {
    var map = {};
    trades.forEach(function (t) { (t.mistakes || []).forEach(function (m) { if (!map[m]) map[m] = { key: m, pnl: 0, count: 0 }; map[m].pnl += pnlOf(t); map[m].count++; }); });
    return Object.keys(map).map(function (k) { var o = map[k]; o.pnl = r2(o.pnl); return o; }).sort(function (a, b) { return a.pnl - b.pnl; });
  }

  window.Store = {
    uid: uid, subscribe: subscribe, getState: getState,
    add: add, update: update, remove: remove, removeAccount: removeAccount, reset: reset, clearAll: clearAll, replaceAll: replaceAll,
    getTrades: getTrades, allTags: allTags, allMistakes: allMistakes,
    calc: { r2: r2, pnlOf: pnlOf, rOf: rOf, resultOf: resultOf, stats: stats, equityCurve: equityCurve,
      maxDrawdown: maxDrawdown, groupSum: groupSum, dailyPnl: dailyPnl, rDistribution: rDistribution,
      disciplineScore: disciplineScore, mistakeCost: mistakeCost, timeKey: timeKey }
  };

  window.useStore = function () {
    return React.useSyncExternalStore(subscribe, getState, getState);
  };
})();
