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
      trades: [], playbooks: [], journal: [], notes: [], watchlist: [], plans: [], settings: {} };
  }
  function ensure(s) {
    ['accounts', 'trades', 'playbooks', 'journal', 'notes', 'watchlist', 'plans'].forEach(function (k) { if (!Array.isArray(s[k])) s[k] = []; });
    if (!s.meta) s.meta = { v: 1, createdAt: new Date().toISOString() };
    if (!s.settings || typeof s.settings !== 'object') s.settings = {};
    return s;
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('persist failed', e); } }
  function notify() { listeners.forEach(function (fn) { fn(); }); }
  function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; }
  function getState() { return state; }

  // produce a new top-level state object so React detects the change
  function commit(next) {
    if (next && next.meta) next.meta = Object.assign({}, next.meta, { updatedAt: Date.now() });
    state = next; persist(); notify();
  }
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

  function setSetting(key, val) {
    var n = Object.assign({}, state);
    n.settings = Object.assign({}, state.settings || {});
    n.settings[key] = val;
    commit(n);
  }

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
  function rOf(t) { var risk = riskBasis(t); return risk > 0 ? r2(pnlOf(t) / risk) : null; }
  // Dollar risk used as the basis for R-multiples: explicit riskAmount wins,
  // otherwise derive it from a planned stop (|entry-stop| * qty * multiplier).
  function riskBasis(t) {
    var ra = Number(t.riskAmount) || 0;
    if (ra > 0) return ra;
    if (t.stop != null && t.stop !== '' && isFinite(Number(t.stop)) && isFinite(t.entry)) {
      var dist = Math.abs(t.entry - Number(t.stop));
      var risk = dist * (Number(t.quantity) || 0) * (Number(t.multiplier) || 1);
      return risk > 0 ? r2(risk) : 0;
    }
    return 0;
  }
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
  function clamp(n) { return Math.max(0, Math.min(100, n)); }

  function recoveryFactor(trades, startBal) {
    var dd = maxDrawdown(trades, startBal).amount;
    var net = stats(trades).netPnl;
    return dd > 0 ? net / dd : (net > 0 ? Infinity : 0);
  }
  // How evenly profit is spread across winning days (0 = one day carried everything, 100 = perfectly even)
  function consistency(trades) {
    var daily = dailyPnl(trades);
    var profits = Object.keys(daily).map(function (k) { return daily[k].pnl; }).filter(function (p) { return p > 0; });
    var total = profits.reduce(function (a, b) { return a + b; }, 0);
    if (total <= 0 || profits.length === 0) return 0;
    var best = Math.max.apply(null, profits);
    return clamp((1 - best / total) * 100);
  }
  // Composite 0-100 score across 6 normalized components (TradeZella-style "Zella Score")
  function edgeScore(trades, startBal) {
    var empty = { score: 0, parts: { winRate: 0, profitFactor: 0, avgWinLoss: 0, recovery: 0, consistency: 0, drawdown: 0 } };
    if (!trades.length) return empty;
    var s = stats(trades);
    var pWin = clamp(s.winRate);
    var pPf = s.profitFactor === Infinity ? 100 : clamp(s.profitFactor / 3 * 100);
    var ratio = s.avgLoss > 0 ? s.avgWin / s.avgLoss : (s.avgWin > 0 ? 99 : 0);
    var pWl = clamp(ratio / 2.5 * 100);
    var rf = recoveryFactor(trades, startBal);
    var pRf = rf === Infinity ? 100 : clamp(rf / 3 * 100);
    var pCons = consistency(trades);
    var pDd = clamp(100 - Math.min(100, maxDrawdown(trades, startBal).pct * 2));
    var parts = { winRate: Math.round(pWin), profitFactor: Math.round(pPf), avgWinLoss: Math.round(pWl), recovery: Math.round(pRf), consistency: Math.round(pCons), drawdown: Math.round(pDd) };
    var score = (pWin + pPf + pWl + pRf + pCons + pDd) / 6;
    return { score: Math.round(score * 100) / 100, parts: parts };
  }
  // Current win/loss streaks by trade and by trading day, plus longest win streaks
  function streaks(trades) {
    var sorted = trades.slice().sort(function (a, b) { return timeKey(a) - timeKey(b); });
    var curT = 0, signT = 0, i;
    for (i = sorted.length - 1; i >= 0; i--) {
      var p = pnlOf(sorted[i]);
      if (p === 0) { if (curT === 0) continue; else break; }
      var sg = p > 0 ? 1 : -1;
      if (curT === 0) { signT = sg; curT = 1; } else if (sg === signT) curT++; else break;
    }
    var daily = dailyPnl(trades), days = Object.keys(daily).sort();
    var curD = 0, signD = 0;
    for (i = days.length - 1; i >= 0; i--) {
      var dp = daily[days[i]].pnl;
      if (dp === 0) { if (curD === 0) continue; else break; }
      var sd = dp > 0 ? 1 : -1;
      if (curD === 0) { signD = sd; curD = 1; } else if (sd === signD) curD++; else break;
    }
    var longestDayWin = 0, rd = 0;
    days.forEach(function (d) { if (daily[d].pnl > 0) { rd++; longestDayWin = Math.max(longestDayWin, rd); } else rd = 0; });
    return { trade: { current: curT, sign: signT, longest: stats(trades).winStreak }, day: { current: curD, sign: signD, longest: longestDayWin } };
  }

  /* ── New helpers ── */

  // Hold time in minutes from entry date+time to close date+time
  function holdMinutes(t) {
    if (!t.closeDate && !t.closeTime) return null;
    var open  = new Date((t.date      || '1970-01-01') + 'T' + (t.time      || '00:00') + ':00').getTime();
    var close = new Date((t.closeDate || t.date)       + 'T' + (t.closeTime || t.time || '00:00') + ':00').getTime();
    var mins = (close - open) / 60000;
    return mins > 0 ? Math.round(mins) : null;
  }

  // % of trading days where net P&L >= threshold (for prop-firm consistency rule)
  function consistencyRule(trades, threshold) {
    threshold = threshold || 200;
    var d = dailyPnl(trades);
    var days = Object.keys(d);
    if (!days.length) return { score: 0, green: 0, total: 0 };
    var green = days.filter(function (k) { return d[k].pnl >= threshold; }).length;
    return { score: Math.round(green / days.length * 100), green: green, total: days.length };
  }

  // Running cumulative P&L within each trading day (for intraday overlay)
  function intradayCumPnl(trades) {
    var byDay = {};
    trades.slice().sort(function (a, b) { return timeKey(a) - timeKey(b); }).forEach(function (t) {
      if (!byDay[t.date]) byDay[t.date] = { cum: 0, points: [] };
      byDay[t.date].cum += pnlOf(t);
      byDay[t.date].points.push({ time: t.time || '00:00', cum: r2(byDay[t.date].cum), pnl: pnlOf(t) });
    });
    return byDay;
  }

  // Setup win-rate over time (split into N equal chunks, return [{label, winRate}])
  function setupWinRateOverTime(trades, setupName, chunks) {
    chunks = chunks || 5;
    var ts = trades.filter(function (t) { return t.setup === setupName; })
                   .sort(function (a, b) { return timeKey(a) - timeKey(b); });
    if (ts.length < chunks) return null;
    var sz = Math.floor(ts.length / chunks);
    var out = [];
    for (var i = 0; i < chunks; i++) {
      var slice = ts.slice(i * sz, (i + 1) * sz);
      var s = stats(slice);
      out.push({ label: slice[0] ? slice[0].date.slice(0, 7) : ('P' + (i + 1)), winRate: r2(s.winRate) });
    }
    return out;
  }

  // Map each date to a streak bucket for heatmap colouring
  // Returns { 'YYYY-MM-DD': { pnl, count, streak: 1|2|3, streakDir: 1|-1 } }
  function calendarStreakMap(trades) {
    var d = dailyPnl(trades);
    var days = Object.keys(d).sort();
    var result = {};
    var cur = 0, dir = 0;
    days.forEach(function (day) {
      var p = d[day].pnl;
      var nd = p > 0 ? 1 : p < 0 ? -1 : 0;
      if (nd !== 0 && nd === dir) cur = Math.min(cur + 1, 3);
      else if (nd !== 0) { cur = 1; dir = nd; }
      else cur = 0;
      result[day] = { pnl: d[day].pnl, count: d[day].count, streak: cur, streakDir: dir };
    });
    return result;
  }

  /* ============================================================
     Tier 1-3 pro analytics: planned/realized R, MFE/MAE excursion,
     advanced risk metrics, holding-time buckets, underwater curve,
     benchmark, and fee breakdown.
     ============================================================ */

  // signed favorable price move (positive = in your favor) for a given price
  function favMove(t, price) { var dir = t.side === 'short' ? -1 : 1; return (Number(price) - t.entry) * dir; }
  function mult(t) { return Number(t.multiplier) || 1; }

  // Planned reward:risk from stop & target prices (e.g. 2.5 means 2.5:1)
  function plannedRR(t) {
    if (t.stop == null || t.stop === '' || t.target == null || t.target === '' || !isFinite(t.entry)) return null;
    var risk = Math.abs(t.entry - Number(t.stop));
    var reward = Math.abs(Number(t.target) - t.entry);
    return risk > 0 ? r2(reward / risk) : null;
  }

  // Maximum Favorable Excursion in $ (>=0): how far price went your way (best price = t.mfe)
  function mfeValue(t) {
    if (t.mfe == null || t.mfe === '' || !isFinite(Number(t.mfe)) || !isFinite(t.entry)) return null;
    return r2(Math.max(0, favMove(t, t.mfe)) * (Number(t.quantity) || 0) * mult(t));
  }
  // Maximum Adverse Excursion in $ (>=0 = heat taken): worst price = t.mae
  function maeValue(t) {
    if (t.mae == null || t.mae === '' || !isFinite(Number(t.mae)) || !isFinite(t.entry)) return null;
    return r2(Math.max(0, -favMove(t, t.mae)) * (Number(t.quantity) || 0) * mult(t));
  }
  function mfeR(t) { var v = mfeValue(t), rb = riskBasis(t); return v != null && rb > 0 ? r2(v / rb) : null; }
  function maeR(t) { var v = maeValue(t), rb = riskBasis(t); return v != null && rb > 0 ? r2(v / rb) : null; }
  // Exit efficiency %: how much of the max favorable move you captured at exit
  function exitEfficiency(t) {
    if (t.mfe == null || t.mfe === '' || !isFinite(t.exit) || !isFinite(t.entry)) return null;
    var maxFav = favMove(t, t.mfe), captured = favMove(t, t.exit);
    if (maxFav <= 0) return null;
    return r2(Math.max(0, Math.min(1.2, captured / maxFav)) * 100);
  }
  function excursionStats(trades) {
    var effs = [], mfes = [], maes = [], maeWin = [], maeLoss = [];
    trades.forEach(function (t) {
      var e = exitEfficiency(t); if (e != null) effs.push(e);
      var fr = mfeR(t); if (fr != null) mfes.push(fr);
      var mr = maeR(t); if (mr != null) { maes.push(mr); var p = pnlOf(t); if (p > 0) maeWin.push(mr); else if (p < 0) maeLoss.push(mr); }
    });
    return {
      count: Math.max(effs.length, mfes.length, maes.length),
      avgEfficiency: effs.length ? r2(avg(effs)) : null,
      avgMfeR: mfes.length ? r2(avg(mfes)) : null,
      avgMaeR: maes.length ? r2(avg(maes)) : null,
      avgMaeWin: maeWin.length ? r2(avg(maeWin)) : null,
      avgMaeLoss: maeLoss.length ? r2(avg(maeLoss)) : null
    };
  }

  // Seeded PRNG so risk-of-ruin is stable across re-renders
  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  // Probability of blowing the account, via seeded resampling of historical per-trade P&L
  function riskOfRuin(pnls, startBal) {
    var cap = Number(startBal) || 0;
    if (cap <= 0 || !pnls.length) return null;
    var sum = pnls.reduce(function (a, b) { return a + b; }, 0);
    var rnd = mulberry32(pnls.length * 1000 + Math.round(sum));
    var sims = 3000, horizon = Math.max(100, pnls.length * 3), ruin = 0;
    for (var i = 0; i < sims; i++) {
      var bal = cap;
      for (var j = 0; j < horizon; j++) { bal += pnls[Math.floor(rnd() * pnls.length)]; if (bal <= 0) { ruin++; break; } }
    }
    return r2(ruin / sims * 100);
  }
  // Sharpe/Sortino (per-trade), SQN (Van Tharp), Kelly %, std dev, risk of ruin
  function advancedRisk(trades, startBal) {
    var res = { sharpe: null, sortino: null, sqn: null, stdev: null, kelly: null, riskOfRuin: null, expectancyR: null, sampleR: 0 };
    if (!trades.length) return res;
    var pnls = trades.map(pnlOf);
    var n = pnls.length, mean = avg(pnls);
    var variance = pnls.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (n > 1 ? n - 1 : 1);
    var sd = Math.sqrt(variance);
    res.stdev = r2(sd);
    res.sharpe = sd > 0 ? r2(mean / sd) : null;
    var downSq = pnls.filter(function (x) { return x < 0; }).map(function (x) { return x * x; });
    var dDev = downSq.length ? Math.sqrt(downSq.reduce(function (a, b) { return a + b; }, 0) / n) : 0;
    res.sortino = dDev > 0 ? r2(mean / dDev) : (mean > 0 ? Infinity : null);
    var rs = trades.map(rOf).filter(function (r) { return r !== null; });
    res.sampleR = rs.length;
    if (rs.length > 1) {
      var rm = avg(rs);
      var rvar = rs.reduce(function (a, b) { return a + (b - rm) * (b - rm); }, 0) / (rs.length - 1);
      var rsd = Math.sqrt(rvar);
      res.expectancyR = r2(rm);
      res.sqn = rsd > 0 ? r2(Math.sqrt(rs.length) * rm / rsd) : null;
    }
    var s = stats(trades);
    var W = s.winRate / 100, b = s.avgLoss > 0 ? s.avgWin / s.avgLoss : 0;
    res.kelly = b > 0 ? r2((W - (1 - W) / b) * 100) : null;
    res.riskOfRuin = riskOfRuin(pnls, startBal);
    return res;
  }

  // Group P&L by holding-duration bucket (scalp -> swing)
  function holdBuckets(trades) {
    var defs = [['< 5 min', 0, 5], ['5\u201330 min', 5, 30], ['30 min\u20132 h', 30, 120], ['2 h\u20131 day', 120, 1440], ['> 1 day', 1440, Infinity]];
    var out = defs.map(function (d) { return { key: d[0], pnl: 0, count: 0, wins: 0, losses: 0 }; });
    var unknown = { key: 'Unknown', pnl: 0, count: 0, wins: 0, losses: 0 };
    trades.forEach(function (t) {
      var m = holdMinutes(t), p = pnlOf(t), b = null;
      if (m == null) b = unknown;
      else { for (var i = 0; i < defs.length; i++) { if (m >= defs[i][1] && m < defs[i][2]) { b = out[i]; break; } } if (!b) b = out[out.length - 1]; }
      b.pnl += p; b.count++; if (p > 0) b.wins++; else if (p < 0) b.losses++;
    });
    out.forEach(function (o) { o.pnl = r2(o.pnl); o.winRate = (o.wins + o.losses) ? o.wins / (o.wins + o.losses) * 100 : 0; });
    if (unknown.count) { unknown.pnl = r2(unknown.pnl); unknown.winRate = (unknown.wins + unknown.losses) ? unknown.wins / (unknown.wins + unknown.losses) * 100 : 0; out.push(unknown); }
    return out;
  }

  // Underwater curve: distance below running peak after each trade (values <= 0)
  function drawdownSeries(trades, startBal) {
    var bal = Number(startBal) || 0, peak = bal, out = [{ label: 'Start', value: 0 }];
    trades.forEach(function (t) { bal += pnlOf(t); if (bal > peak) peak = bal; out.push({ label: t.date, value: r2(bal - peak) }); });
    return out;
  }

  // Buy-and-hold benchmark curve at a constant annual % over the trade date span
  function benchmarkCurve(trades, startBal, annualPct) {
    var bal = Number(startBal) || 0, rate = Number(annualPct) || 0;
    var pts = [{ label: 'Start', value: r2(bal) }];
    if (!trades.length) return pts;
    var t0 = new Date((trades[0].date || '1970-01-01') + 'T00:00:00').getTime();
    trades.forEach(function (t) {
      var ti = new Date((t.date || '1970-01-01') + 'T00:00:00').getTime();
      var days = Math.max(0, (ti - t0) / 86400000);
      pts.push({ label: t.date, value: r2(bal * Math.pow(1 + rate / 100, days / 365)) });
    });
    return pts;
  }

  // Commission/swap/other split for one trade, and aggregate fee stats
  function feeBreakdown(t) {
    var comm = Number(t.commission) || 0, swap = Number(t.swap) || 0, total = Number(t.fees) || 0;
    return { commission: r2(comm), swap: r2(swap), other: r2(Math.max(0, total - comm - swap)), total: r2(total) };
  }
  function feeStats(trades) {
    var comm = 0, swap = 0, other = 0, total = 0, gross = 0;
    trades.forEach(function (t) {
      var b = feeBreakdown(t); comm += b.commission; swap += b.swap; other += b.other; total += b.total;
      var dir = t.side === 'short' ? -1 : 1, g = (t.exit - t.entry) * (Number(t.quantity) || 0) * mult(t) * dir;
      if (isFinite(g)) gross += g;
    });
    return { commission: r2(comm), swap: r2(swap), other: r2(other), total: r2(total),
      pctOfGross: gross !== 0 ? r2(total / Math.abs(gross) * 100) : null, perTrade: trades.length ? r2(total / trades.length) : 0 };
  }

  // Realized gains grouped by tax year, split short- vs long-term (>365 days held)
  function taxReport(trades) {
    var byYear = {};
    trades.forEach(function (t) {
      if (t.isOpen) return;
      var p = pnlOf(t); if (!isFinite(p)) return;
      var closeDate = t.closeDate || t.date;
      var year = String(closeDate).slice(0, 4); if (!/^\d{4}$/.test(year)) return;
      var mins = holdMinutes(t);
      var term = (mins != null && mins / 1440 > 365) ? 'long' : 'short';
      if (!byYear[year]) byYear[year] = { year: year, trades: 0, proceeds: 0, gain: 0, fees: 0, shortGain: 0, longGain: 0, wins: 0, losses: 0 };
      var y = byYear[year];
      y.trades++; y.gain += p; y.fees += (t.fees || 0);
      var proceeds = (Number(t.exit) || 0) * (Number(t.quantity) || 0) * mult(t);
      if (isFinite(proceeds)) y.proceeds += proceeds;
      if (term === 'long') y.longGain += p; else y.shortGain += p;
      if (p > 0) y.wins++; else if (p < 0) y.losses++;
    });
    return Object.keys(byYear).sort().map(function (k) {
      var y = byYear[k];
      ['proceeds', 'gain', 'fees', 'shortGain', 'longGain'].forEach(function (f) { y[f] = r2(y[f]); });
      return y;
    });
  }

  window.Store = {
    uid: uid, subscribe: subscribe, getState: getState,
    add: add, update: update, remove: remove, removeAccount: removeAccount, reset: reset, clearAll: clearAll, replaceAll: replaceAll,
    getTrades: getTrades, allTags: allTags, allMistakes: allMistakes,
    getSettings: function () { return state.settings || {}; }, setSetting: setSetting,
    calc: { r2: r2, pnlOf: pnlOf, rOf: rOf, riskBasis: riskBasis, resultOf: resultOf, stats: stats, equityCurve: equityCurve,
      maxDrawdown: maxDrawdown, groupSum: groupSum, dailyPnl: dailyPnl, rDistribution: rDistribution,
      disciplineScore: disciplineScore, mistakeCost: mistakeCost, timeKey: timeKey,
      recoveryFactor: recoveryFactor, consistency: consistency, edgeScore: edgeScore, streaks: streaks,
      holdMinutes: holdMinutes, consistencyRule: consistencyRule, intradayCumPnl: intradayCumPnl,
      setupWinRateOverTime: setupWinRateOverTime, calendarStreakMap: calendarStreakMap,
      plannedRR: plannedRR, mfeValue: mfeValue, maeValue: maeValue, mfeR: mfeR, maeR: maeR,
      exitEfficiency: exitEfficiency, excursionStats: excursionStats, advancedRisk: advancedRisk,
      riskOfRuin: riskOfRuin, holdBuckets: holdBuckets, drawdownSeries: drawdownSeries,
      benchmarkCurve: benchmarkCurve, feeBreakdown: feeBreakdown, feeStats: feeStats, taxReport: taxReport }
  };

  window.useStore = function () {
    return React.useSyncExternalStore(subscribe, getState, getState);
  };
})();
