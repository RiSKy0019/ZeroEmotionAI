/* ============================================================
   store.js — data layer, persistence & trade math
   Exposes a global `Store` plus pure calc helpers.
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'edgeJournal.v1';
  var state = null;
  var listeners = [];

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return null;
  }

  function persist() {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not persist state', e);
    }
  }

  function emit() {
    persist();
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { console.error(e); } });
  }

  /* ---------------- init ---------------- */
  function init(seedFn) {
    state = load();
    if (!state || !state.meta) {
      state = (typeof seedFn === 'function') ? seedFn(uid) : emptyState();
      persist();
    }
    // safety: ensure arrays exist
    ['accounts', 'trades', 'plans', 'playbooks', 'journal'].forEach(function (k) {
      if (!Array.isArray(state[k])) state[k] = [];
    });
    return state;
  }

  function emptyState() {
    return {
      meta: { version: 1, createdAt: new Date().toISOString() },
      accounts: [{ id: uid('acc'), name: 'Main Account', broker: 'Manual', startingBalance: 25000 }],
      trades: [], plans: [], playbooks: [], journal: []
    };
  }

  function reset(seedFn) {
    state = (typeof seedFn === 'function') ? seedFn(uid) : emptyState();
    emit();
    return state;
  }

  function replaceAll(newState) {
    state = newState;
    ['accounts', 'trades', 'plans', 'playbooks', 'journal'].forEach(function (k) {
      if (!Array.isArray(state[k])) state[k] = [];
    });
    if (!state.meta) state.meta = { version: 1, createdAt: new Date().toISOString() };
    emit();
  }

  function subscribe(fn) { listeners.push(fn); }
  function getState() { return state; }

  /* ---------------- CRUD ---------------- */
  function add(collection, obj) {
    obj.id = obj.id || uid(collection.slice(0, 3));
    state[collection].push(obj);
    emit();
    return obj;
  }
  function update(collection, id, patch) {
    var item = state[collection].find(function (x) { return x.id === id; });
    if (item) { Object.assign(item, patch); emit(); }
    return item;
  }
  function remove(collection, id) {
    state[collection] = state[collection].filter(function (x) { return x.id !== id; });
    emit();
  }
  function find(collection, id) {
    return state[collection].find(function (x) { return x.id === id; });
  }

  /* ---------------- Filtering ---------------- */
  // opts: { accountId: 'all'|id, range: 'all'|'ytd'|'30'|'7' }
  function getTrades(opts) {
    opts = opts || {};
    var list = state.trades.slice();
    if (opts.accountId && opts.accountId !== 'all') {
      list = list.filter(function (t) { return t.accountId === opts.accountId; });
    }
    if (opts.range && opts.range !== 'all') {
      var cutoff = rangeCutoff(opts.range);
      list = list.filter(function (t) { return new Date(t.date) >= cutoff; });
    }
    list.sort(function (a, b) { return tradeTimeKey(a) - tradeTimeKey(b); });
    return list;
  }

  function rangeCutoff(range) {
    var now = new Date();
    if (range === 'ytd') return new Date(now.getFullYear(), 0, 1);
    var days = parseInt(range, 10);
    if (!isNaN(days)) { var d = new Date(); d.setDate(d.getDate() - days); return d; }
    return new Date(0);
  }

  function tradeTimeKey(t) {
    return new Date((t.date || '1970-01-01') + 'T' + (t.time || '00:00') + ':00').getTime();
  }

  /* ============================================================
     Pure calculation helpers (also exported on Store.calc)
     ============================================================ */
  function pnlOf(t) {
    var dir = t.side === 'short' ? -1 : 1;
    var gross = (t.exit - t.entry) * t.quantity * dir;
    return round2(gross - (t.fees || 0));
  }
  function rOf(t) {
    var risk = Number(t.riskAmount) || 0;
    if (risk <= 0) return null;
    return round2(pnlOf(t) / risk);
  }
  function resultOf(t) {
    var p = pnlOf(t);
    if (p > 0) return 'win';
    if (p < 0) return 'loss';
    return 'be';
  }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  function computeStats(trades) {
    var s = {
      total: trades.length, wins: 0, losses: 0, be: 0,
      netPnl: 0, grossWin: 0, grossLoss: 0, fees: 0,
      winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0,
      expectancy: 0, avgR: null, largestWin: 0, largestLoss: 0,
      avgHoldWin: 0, winStreak: 0, lossStreak: 0
    };
    var rVals = [];
    var curWin = 0, curLoss = 0;
    trades.forEach(function (t) {
      var p = pnlOf(t);
      s.netPnl += p;
      s.fees += (t.fees || 0);
      if (p > 0) { s.wins++; s.grossWin += p; s.largestWin = Math.max(s.largestWin, p); curWin++; curLoss = 0; }
      else if (p < 0) { s.losses++; s.grossLoss += Math.abs(p); s.largestLoss = Math.min(s.largestLoss, p); curLoss++; curWin = 0; }
      else { s.be++; curWin = 0; curLoss = 0; }
      s.winStreak = Math.max(s.winStreak, curWin);
      s.lossStreak = Math.max(s.lossStreak, curLoss);
      var r = rOf(t);
      if (r !== null) rVals.push(r);
    });
    var decided = s.wins + s.losses;
    s.winRate = decided ? (s.wins / decided) * 100 : 0;
    s.profitFactor = s.grossLoss ? s.grossWin / s.grossLoss : (s.grossWin ? Infinity : 0);
    s.avgWin = s.wins ? s.grossWin / s.wins : 0;
    s.avgLoss = s.losses ? s.grossLoss / s.losses : 0;
    // expectancy per trade in $
    s.expectancy = s.total ? s.netPnl / s.total : 0;
    if (rVals.length) s.avgR = rVals.reduce(function (a, b) { return a + b; }, 0) / rVals.length;
    s.netPnl = round2(s.netPnl);
    s.grossWin = round2(s.grossWin);
    s.grossLoss = round2(s.grossLoss);
    return s;
  }

  // Cumulative equity over time
  function equityCurve(trades, startingBalance) {
    var bal = Number(startingBalance) || 0;
    var pts = [{ label: 'Start', value: round2(bal) }];
    trades.forEach(function (t, i) {
      bal += pnlOf(t);
      pts.push({ label: (t.date || '') + ' ' + (t.symbol || ''), value: round2(bal), idx: i + 1 });
    });
    return pts;
  }

  function maxDrawdown(trades, startingBalance) {
    var bal = Number(startingBalance) || 0;
    var peak = bal, maxDD = 0, maxDDpct = 0;
    trades.forEach(function (t) {
      bal += pnlOf(t);
      if (bal > peak) peak = bal;
      var dd = peak - bal;
      if (dd > maxDD) { maxDD = dd; maxDDpct = peak ? (dd / peak) * 100 : 0; }
    });
    return { amount: round2(maxDD), pct: round2(maxDDpct) };
  }

  // Group trades and sum pnl. keyFn returns string bucket.
  function groupSum(trades, keyFn) {
    var map = {};
    trades.forEach(function (t) {
      var k = keyFn(t);
      if (k === null || k === undefined || k === '') return;
      if (!map[k]) map[k] = { key: k, pnl: 0, count: 0, wins: 0, losses: 0 };
      map[k].pnl += pnlOf(t);
      map[k].count++;
      var p = pnlOf(t);
      if (p > 0) map[k].wins++; else if (p < 0) map[k].losses++;
    });
    return Object.keys(map).map(function (k) { var o = map[k]; o.pnl = round2(o.pnl); return o; });
  }

  // P&L per calendar day -> { 'YYYY-MM-DD': {pnl, count} }
  function dailyPnl(trades) {
    var map = {};
    trades.forEach(function (t) {
      var d = t.date;
      if (!map[d]) map[d] = { pnl: 0, count: 0 };
      map[d].pnl += pnlOf(t);
      map[d].count++;
    });
    Object.keys(map).forEach(function (d) { map[d].pnl = round2(map[d].pnl); });
    return map;
  }

  function mistakeCost(trades) {
    var map = {};
    trades.forEach(function (t) {
      (t.mistakes || []).forEach(function (m) {
        if (!map[m]) map[m] = { key: m, pnl: 0, count: 0 };
        map[m].pnl += pnlOf(t);
        map[m].count++;
      });
    });
    return Object.keys(map).map(function (k) { var o = map[k]; o.pnl = round2(o.pnl); return o; })
      .sort(function (a, b) { return a.pnl - b.pnl; });
  }

  // Discipline score: % of decided trades with no mistakes, blended with plan-following.
  function disciplineScore(trades) {
    if (!trades.length) return { score: 0, clean: 0, total: 0 };
    var clean = trades.filter(function (t) { return !(t.mistakes && t.mistakes.length); }).length;
    var score = Math.round((clean / trades.length) * 100);
    return { score: score, clean: clean, total: trades.length };
  }

  global.Store = {
    init: init, reset: reset, replaceAll: replaceAll, getState: getState, subscribe: subscribe,
    uid: uid,
    add: add, update: update, remove: remove, find: find,
    getTrades: getTrades,
    calc: {
      pnlOf: pnlOf, rOf: rOf, resultOf: resultOf, round2: round2,
      computeStats: computeStats, equityCurve: equityCurve, maxDrawdown: maxDrawdown,
      groupSum: groupSum, dailyPnl: dailyPnl, mistakeCost: mistakeCost, disciplineScore: disciplineScore,
      tradeTimeKey: tradeTimeKey
    }
  };
})(window);
