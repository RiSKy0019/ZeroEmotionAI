/* ============================================================
   insights.js — statistical insight engine (window.Insights)
   Reads trades and produces plain-English findings (leaks / strengths /
   info). Pure data analysis — no AI key, no network. All claims are
   sample-size guarded so it never over-states on thin data.
   ============================================================ */
(function () {
  'use strict';
  var C = window.Store.calc, Fmt = window.Fmt;
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function pf(s) { return s.profitFactor === Infinity ? '\u221E' : Fmt.num(s.profitFactor, 2); }

  function generate(trades) {
    var out = [];
    var n = trades.length;
    if (n < 5) {
      out.push({ kind: 'info', icon: '\uD83D\uDCED', title: 'Not enough data yet', text: 'Log at least 5 trades to unlock insights — you currently have ' + n + '.' });
      return out;
    }
    var s = C.stats(trades);
    function add(o) { if (o.weight == null) o.weight = 1; out.push(o); }
    function buckets(keyFn, minCount) { return C.groupSum(trades, keyFn).filter(function (b) { return b.count >= (minCount || 3); }); }

    // ---- snapshot (always) ----
    add({ kind: 'info', icon: '\uD83D\uDCCA', title: 'Snapshot', weight: 0,
      text: n + ' trades · net ' + Fmt.money(s.netPnl, { plus: true }) + ' · win rate ' + Fmt.pct(s.winRate) + ' · profit factor ' + pf(s) + ' · expectancy ' + Fmt.money(s.expectancy, { plus: true }) + '/trade.' });

    // ---- day of week ----
    var dow = buckets(function (t) { return new Date(t.date + 'T00:00:00').getDay(); }, 3);
    if (dow.length >= 2) {
      dow.sort(function (a, b) { return b.pnl - a.pnl; });
      var bD = dow[0], wD = dow[dow.length - 1];
      if (bD.pnl > 0) add({ kind: 'strength', icon: '\uD83D\uDCC5', title: 'Strongest day: ' + DOW[bD.key], weight: Math.abs(bD.pnl),
        text: DOW[bD.key] + ' is your best day — ' + Fmt.money(bD.pnl, { plus: true }) + ' over ' + bD.count + ' trades (' + Fmt.pct(bD.winRate) + ' win).' });
      if (wD.pnl < 0 && wD !== bD) add({ kind: 'leak', icon: '\uD83D\uDCC9', title: 'Weakest day: ' + DOW[wD.key], weight: Math.abs(wD.pnl),
        text: DOW[wD.key] + ' drags you down — ' + Fmt.money(wD.pnl, { plus: true }) + ' over ' + wD.count + ' trades (' + Fmt.pct(wD.winRate) + ' win). Consider trading smaller or sitting it out.' });
    }

    // ---- time of day ----
    var hr = buckets(function (t) { return (t.time || '00:00').split(':')[0]; }, 3);
    if (hr.length >= 2) {
      hr.sort(function (a, b) { return b.pnl - a.pnl; });
      var bH = hr[0], wH = hr[hr.length - 1];
      if (bH.pnl > 0) add({ kind: 'strength', icon: '\u23F0', title: 'Best time: ' + Fmt.hourLabel(bH.key), weight: Math.abs(bH.pnl),
        text: 'Around ' + Fmt.hourLabel(bH.key) + ' you make ' + Fmt.money(bH.pnl, { plus: true }) + ' (' + bH.count + ' trades, ' + Fmt.pct(bH.winRate) + ' win).' });
      if (wH.pnl < 0 && wH !== bH) add({ kind: 'leak', icon: '\uD83D\uDD52', title: 'Worst time: ' + Fmt.hourLabel(wH.key), weight: Math.abs(wH.pnl),
        text: Fmt.hourLabel(wH.key) + ' is a leak: ' + Fmt.money(wH.pnl, { plus: true }) + ' over ' + wH.count + ' trades.' });
    }

    // ---- playbook ----
    var pb = buckets(function (t) { return t.setup || null; }, 3);
    if (pb.length >= 1) {
      pb.sort(function (a, b) { return b.pnl - a.pnl; });
      var bP = pb[0], wP = pb[pb.length - 1];
      if (bP.pnl > 0) add({ kind: 'strength', icon: '\uD83D\uDCD8', title: 'Top playbook: ' + bP.key, weight: Math.abs(bP.pnl),
        text: '"' + bP.key + '" is your most profitable setup: ' + Fmt.money(bP.pnl, { plus: true }) + ' (' + Fmt.pct(bP.winRate) + ' win over ' + bP.count + ' trades).' });
      if (wP !== bP && wP.pnl < 0) add({ kind: 'leak', icon: '\uD83D\uDCD5', title: 'Cut or fix: ' + wP.key, weight: Math.abs(wP.pnl),
        text: '"' + wP.key + '" is losing money: ' + Fmt.money(wP.pnl, { plus: true }) + ' over ' + wP.count + ' trades (' + Fmt.pct(wP.winRate) + ' win). Review the rules or stop trading it.' });
    }

    // ---- direction ----
    var longs = trades.filter(function (t) { return t.side !== 'short'; });
    var shorts = trades.filter(function (t) { return t.side === 'short'; });
    if (longs.length >= 5 && shorts.length >= 5) {
      var ls = C.stats(longs), ss = C.stats(shorts);
      var better = ls.netPnl >= ss.netPnl ? 'long' : 'short';
      add({ kind: 'info', icon: '\u2195\uFE0F', title: 'Direction edge: ' + better + 's', weight: 0,
        text: 'Longs ' + Fmt.money(ls.netPnl, { plus: true }) + ' (' + Fmt.pct(ls.winRate) + ' win) vs shorts ' + Fmt.money(ss.netPnl, { plus: true }) + ' (' + Fmt.pct(ss.winRate) + ' win). You trade ' + better + 's better.' });
    }

    // ---- costliest mistake ----
    var mc = C.mistakeCost(trades);
    if (mc.length && mc[0].pnl < 0) {
      var m0 = mc[0];
      add({ kind: 'leak', icon: '\u26A0\uFE0F', title: 'Costliest mistake: ' + m0.key, weight: Math.abs(m0.pnl) * 1.5,
        text: '"' + m0.key + '" appears in ' + m0.count + ' trades and has cost you ' + Fmt.money(m0.pnl, { plus: true }) + '. Eliminating it is your fastest win.' });
    }

    // ---- tilt after losing streaks ----
    var sorted = trades.slice().sort(function (a, b) { return C.timeKey(a) - C.timeKey(b); });
    var consec = 0, after = [];
    sorted.forEach(function (t) {
      if (consec >= 2) after.push(t);
      var p = C.pnlOf(t);
      if (p < 0) consec++; else if (p > 0) consec = 0;
    });
    if (after.length >= 5) {
      var as = C.stats(after);
      if (as.winRate < s.winRate - 5 || as.netPnl < 0) {
        add({ kind: 'leak', icon: '\uD83D\uDD25', title: 'Tilt after losing streaks', weight: Math.abs(as.netPnl) + 250,
          text: 'After 2+ losses in a row, your win rate is ' + Fmt.pct(as.winRate) + ' (vs ' + Fmt.pct(s.winRate) + ' overall) and those ' + after.length + ' trades netted ' + Fmt.money(as.netPnl, { plus: true }) + '. Step away after two reds.' });
      }
    }

    // ---- overtrading ----
    var daily = C.dailyPnl(trades);
    var dk = Object.keys(daily);
    if (dk.length >= 6) {
      var counts = dk.map(function (k) { return daily[k].count; });
      var avgCount = counts.reduce(function (a, b) { return a + b; }, 0) / counts.length;
      var thresh = Math.max(4, Math.ceil(avgCount * 1.5));
      var busy = dk.filter(function (k) { return daily[k].count >= thresh; });
      var calm = dk.filter(function (k) { return daily[k].count < thresh; });
      if (busy.length >= 3 && calm.length >= 3) {
        var busyAvg = busy.reduce(function (a, k) { return a + daily[k].pnl; }, 0) / busy.length;
        var calmAvg = calm.reduce(function (a, k) { return a + daily[k].pnl; }, 0) / calm.length;
        if (busyAvg < calmAvg) {
          add({ kind: 'leak', icon: '\uD83C\uDF00', title: 'Overtrading hurts you', weight: Math.abs(busyAvg - calmAvg) * 4,
            text: 'On busy days (' + thresh + '+ trades) you average ' + Fmt.money(busyAvg, { plus: true }) + '/day vs ' + Fmt.money(calmAvg, { plus: true }) + '/day on calmer days. Fewer, higher-quality trades pay more.' });
        }
      }
    }

    // ---- emotion ----
    var emo = buckets(function (t) { return t.emotion || null; }, 3);
    if (emo.length >= 1) {
      emo.sort(function (a, b) { return a.pnl - b.pnl; });
      var wE = emo[0];
      if (wE.pnl < 0) add({ kind: 'leak', icon: '\uD83E\uDDE0', title: 'Emotion to watch: ' + wE.key, weight: Math.abs(wE.pnl),
        text: 'Trades you logged as "' + wE.key + '" netted ' + Fmt.money(wE.pnl, { plus: true }) + ' over ' + wE.count + ' trades.' });
    }

    // ---- oversizing ----
    var withRisk = trades.filter(function (t) { return Number(t.riskAmount) > 0; });
    if (withRisk.length >= 8) {
      var risks = withRisk.map(function (t) { return Number(t.riskAmount); }).sort(function (a, b) { return a - b; });
      var med = risks[Math.floor(risks.length / 2)];
      var over = withRisk.filter(function (t) { return Number(t.riskAmount) > med * 1.5; });
      var norm = withRisk.filter(function (t) { return Number(t.riskAmount) <= med * 1.5; });
      if (over.length >= 4 && norm.length >= 4) {
        var os = C.stats(over), ns = C.stats(norm);
        if (os.winRate < ns.winRate - 5 || os.expectancy < ns.expectancy) {
          add({ kind: 'leak', icon: '\uD83C\uDFAF', title: 'Oversizing lowers your edge', weight: 300,
            text: 'When you risk more than usual (' + Fmt.money(med * 1.5) + '+), win rate is ' + Fmt.pct(os.winRate) + ' vs ' + Fmt.pct(ns.winRate) + ' on normal size, and expectancy drops. Keep risk consistent.' });
        }
      }
    }

    // ---- profit concentration ----
    var profitDays = dk.map(function (k) { return daily[k].pnl; }).filter(function (p) { return p > 0; });
    var totalProfit = profitDays.reduce(function (a, b) { return a + b; }, 0);
    if (totalProfit > 0 && profitDays.length >= 4) {
      var best = Math.max.apply(null, profitDays);
      var share = best / totalProfit * 100;
      if (share > 40) add({ kind: 'leak', icon: '\u2696\uFE0F', title: 'Profits are concentrated', weight: 220,
        text: 'Your single best day made ' + Fmt.money(best) + ' — ' + Fmt.pct(share) + ' of all your profit. One great day may be masking inconsistent results.' });
    }

    // ---- risk:reward vs win rate ----
    if (s.avgLoss > 0) {
      var ratio = s.avgWin / s.avgLoss;
      var beWin = 1 / (1 + ratio) * 100;
      if (s.winRate < beWin - 1) {
        add({ kind: 'leak', icon: '\uD83D\uDCD0', title: 'Risk:reward vs win-rate mismatch', weight: 260,
          text: 'Your average win is ' + Fmt.num(ratio, 2) + 'x your average loss, which needs a ' + Fmt.pct(beWin) + ' win rate to break even — you are at ' + Fmt.pct(s.winRate) + '. Aim for bigger winners or tighter losers.' });
      } else if (ratio >= 2 && s.winRate >= 45) {
        add({ kind: 'strength', icon: '\uD83D\uDCD0', title: 'Healthy risk:reward', weight: 60,
          text: 'Average win ' + Fmt.num(ratio, 2) + 'x average loss at ' + Fmt.pct(s.winRate) + ' win rate — a solid, sustainable combination.' });
      }
    }

    // ---- discipline ----
    var disc = C.disciplineScore(trades);
    if (disc.total) {
      if (disc.score >= 80) add({ kind: 'strength', icon: '\uD83D\uDEE1\uFE0F', title: 'Disciplined execution', weight: 70,
        text: 'You followed your rules on ' + disc.score + '% of trades (' + disc.clean + ' of ' + disc.total + '). Keep protecting that.' });
      else if (disc.score < 60) add({ kind: 'leak', icon: '\uD83D\uDEE1\uFE0F', title: 'Discipline is slipping', weight: 160,
        text: 'Only ' + disc.score + '% of trades were mistake-free. Tag and review the rule-breaks to find the pattern.' });
    }

    return out;
  }

  window.Insights = { generate: generate };
})();
