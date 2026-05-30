/* ============================================================
   insights.js — advanced statistical insight engine (window.Insights)
   Pure data analysis — no AI key, no network.
   All findings are sample-size guarded (never over-states on thin data).
   ============================================================ */
(function () {
  'use strict';
  var C = window.Store.calc, Fmt = window.Fmt;
  var DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function pfStr(s) { return s.profitFactor === Infinity ? '∞' : Fmt.num(s.profitFactor, 2); }
  function avg(arr) { return arr.length ? arr.reduce(function(a,b){return a+b;},0)/arr.length : 0; }
  function stddev(arr) {
    if (arr.length < 2) return 0;
    var m = avg(arr);
    return Math.sqrt(arr.reduce(function(s,v){return s+(v-m)*(v-m);},0)/arr.length);
  }

  function generate(trades) {
    var out = [];
    var n = trades.length;
    if (n < 5) {
      out.push({ kind:'info', icon:'🧪', title:'Not enough data yet', priority:0,
        text:'Log at least 5 trades to unlock insights. You currently have ' + n + '.',
        detail: null });
      return out;
    }
    var s = C.stats(trades);
    function add(o) { if (o.priority == null) o.priority = 1; out.push(o); }
    function buckets(keyFn, min) { return C.groupSum(trades, keyFn).filter(function(b){return b.count>=(min||3);}); }
    var sorted = trades.slice().sort(function(a,b){return C.timeKey(a)-C.timeKey(b);});

    /* ── 0. Snapshot (always shown first) ─────────────────────────── */
    add({ kind:'info', icon:'📊', title:'Performance snapshot', priority:0,
      text: n + ' trades · net ' + Fmt.money(s.netPnl,{plus:true}) +
            ' · win rate ' + Fmt.pct(s.winRate) +
            ' · profit factor ' + pfStr(s) +
            ' · expectancy ' + Fmt.money(s.expectancy,{plus:true}) + '/trade' +
            (s.avgR != null ? ' · avg R ' + Fmt.num(s.avgR,2) + 'R' : '') + '.',
      detail: [
        'Gross profit: ' + Fmt.money(s.grossWin),
        'Gross loss: -' + Fmt.money(s.grossLoss),
        'Total fees: ' + Fmt.money(s.fees),
        'Avg win: ' + Fmt.money(s.avgWin) + ' · Avg loss: -' + Fmt.money(s.avgLoss),
        'Win streak: ' + s.winStreak + ' · Loss streak: ' + s.lossStreak
      ]});

    /* ── 1. Day-of-week ────────────────────────────────────────────── */
    var dow = buckets(function(t){return new Date(t.date+'T00:00:00').getDay();},3);
    if (dow.length >= 2) {
      dow.sort(function(a,b){return b.pnl-a.pnl;});
      var bD = dow[0], wD = dow[dow.length-1];
      if (bD.pnl > 0) add({ kind:'strength', icon:'📅', title:'Strongest day: ' + DOW[bD.key], priority: Math.abs(bD.pnl),
        text: DOW[bD.key] + ' is your best trading day — ' + Fmt.money(bD.pnl,{plus:true}) + ' over ' + bD.count + ' trades (' + Fmt.pct(bD.winRate) + ' win).',
        detail:['Consider sizing up slightly on ' + DOW[bD.key] + ' when your pre-market plan aligns well.']});
      if (wD.pnl < 0 && wD.key !== bD.key) add({ kind:'leak', icon:'📉', title:'Weakest day: ' + DOW[wD.key], priority: Math.abs(wD.pnl)*1.3,
        text: DOW[wD.key] + ' is dragging you down — ' + Fmt.money(wD.pnl,{plus:true}) + ' over ' + wD.count + ' trades (' + Fmt.pct(wD.winRate) + ' win).',
        detail:['Option 1: sit ' + DOW[wD.key] + ' out entirely until you find the pattern.',
                'Option 2: reduce size by 50% on ' + DOW[wD.key] + ' while you investigate.']});
    }

    /* ── 2. Time of day ────────────────────────────────────────────── */
    var hr = buckets(function(t){return (t.time||'00:00').split(':')[0];},3);
    if (hr.length >= 2) {
      hr.sort(function(a,b){return b.pnl-a.pnl;});
      var bH = hr[0], wH = hr[hr.length-1];
      if (bH.pnl > 0) add({ kind:'strength', icon:'⏰', title:'Best time window: ' + Fmt.hourLabel(bH.key), priority: Math.abs(bH.pnl),
        text: Fmt.hourLabel(bH.key) + ' is your golden hour — ' + Fmt.money(bH.pnl,{plus:true}) + ' across ' + bH.count + ' trades (' + Fmt.pct(bH.winRate) + ' win).',
        detail:['Focus your best setups in this window. It is when your edge is sharpest.']});
      if (wH.pnl < 0 && wH.key !== bH.key) add({ kind:'leak', icon:'🕑', title:'Worst time window: ' + Fmt.hourLabel(wH.key), priority: Math.abs(wH.pnl)*1.2,
        text: Fmt.hourLabel(wH.key) + ' costs you money — ' + Fmt.money(wH.pnl,{plus:true}) + ' over ' + wH.count + ' trades. This is likely a low-liquidity or chop window.',
        detail:['Try adding a hard rule: no new entries in this window.',
                'If you must trade, cut size to 25% of normal.']});
    }

    /* ── 3. Day + time combination leak ───────────────────────────── */
    if (n >= 20) {
      var combos = buckets(function(t){
        var d = new Date(t.date+'T00:00:00').getDay();
        var h = parseInt((t.time||'00:00').split(':')[0],10);
        var session = h < 12 ? 'AM' : 'PM';
        return DOW[d] + ' ' + session;
      },3);
      combos.sort(function(a,b){return a.pnl-b.pnl;});
      var wC = combos[0];
      if (wC && wC.pnl < 0 && Math.abs(wC.pnl) > Math.abs(s.netPnl)*0.1) {
        add({ kind:'leak', icon:'🔍', title:'Specific combo leak: ' + wC.key, priority: Math.abs(wC.pnl)*1.5,
          text: wC.key + ' sessions are your worst combination — ' + Fmt.money(wC.pnl,{plus:true}) + ' over ' + wC.count + ' trades (' + Fmt.pct(wC.winRate) + ' win rate). This is a specific pattern worth eliminating.',
          detail:['Avoid trading during ' + wC.key + ' until you can explain why it keeps losing.']});
      }
    }

    /* ── 4. Playbook ───────────────────────────────────────────────── */
    var pb = buckets(function(t){return t.setup||null;},3);
    if (pb.length >= 1) {
      pb.sort(function(a,b){return b.pnl-a.pnl;});
      var bP = pb[0], wP = pb[pb.length-1];
      if (bP.pnl > 0) add({ kind:'strength', icon:'📗', title:'Top playbook: ' + bP.key, priority: Math.abs(bP.pnl),
        text:'"' + bP.key + '" is your most profitable setup — ' + Fmt.money(bP.pnl,{plus:true}) + ' (' + Fmt.pct(bP.winRate) + ' win over ' + bP.count + ' trades).',
        detail:['Profit factor on this setup: ' + (function(){var ts=trades.filter(function(t){return t.setup===bP.key;});return pfStr(C.stats(ts));}()) ,
                'Consider allocating more of your daily trade budget here.']});
      if (wP.key !== bP.key && wP.pnl < 0) add({ kind:'leak', icon:'📕', title:'Cut or fix: ' + wP.key, priority: Math.abs(wP.pnl)*1.4,
        text:'"' + wP.key + '" is underwater — ' + Fmt.money(wP.pnl,{plus:true}) + ' over ' + wP.count + ' trades (' + Fmt.pct(wP.winRate) + ' win). Either find the rule you are breaking or stop trading it.',
        detail:['Replay your worst 3 trades in this setup and find the common mistake.',
                'Paper-trade it for 2 weeks before taking real risk again.']});
    }

    /* ── 5. Setup degradation (recent vs historic) ─────────────────── */
    if (n >= 20 && pb.length >= 1) {
      pb.forEach(function(setup) {
        var ts = trades.filter(function(t){return t.setup===setup.key;});
        if (ts.length < 8) return;
        var half = Math.floor(ts.length/2);
        var early = ts.slice(0,half), recent2 = ts.slice(half);
        var es = C.stats(early), rs2 = C.stats(recent2);
        if (rs2.winRate < es.winRate - 15 && rs2.netPnl < 0) {
          add({ kind:'leak', icon:'📉', title:'Degrading setup: ' + setup.key, priority: Math.abs(rs2.netPnl)*1.6,
            text:'"' + setup.key + '" used to work (' + Fmt.pct(es.winRate) + ' win rate historically) but your recent ' + recent2.length + ' trades are ' + Fmt.pct(rs2.winRate) + ' win. The market may have changed, or you are not executing the rules.',
            detail:['Compare your recent entries to the original rules.',
                    'Check if this setup is still working for other traders in your community.']});
        }
      });
    }

    /* ── 6. Direction (long vs short) ──────────────────────────────── */
    var longs = trades.filter(function(t){return t.side!=='short';}),
        shorts = trades.filter(function(t){return t.side==='short';});
    if (longs.length >= 5 && shorts.length >= 5) {
      var ls = C.stats(longs), ss = C.stats(shorts);
      var better = ls.netPnl >= ss.netPnl ? 'long' : 'short';
      var worse  = better === 'long' ? 'short' : 'long';
      var wSt    = better === 'long' ? ss : ls;
      add({ kind: wSt.netPnl < 0 ? 'leak' : 'info', icon:'↕️', title:'Direction edge: ' + better + 's', priority: Math.abs(ls.netPnl - ss.netPnl)*0.5,
        text:'You trade ' + better + 's better — ' + Fmt.money(better==='long'?ls.netPnl:ss.netPnl,{plus:true}) + ' (' + Fmt.pct(better==='long'?ls.winRate:ss.winRate) + ' win) vs ' + worse + 's: ' + Fmt.money(wSt.netPnl,{plus:true}) + ' (' + Fmt.pct(wSt.winRate) + ' win).',
        detail: wSt.netPnl < 0 ? ['Consider limiting ' + worse + ' trades to only the highest-conviction setups.'] : []});
    }

    /* ── 7. Tilt after losing streaks ──────────────────────────────── */
    var consec = 0, afterLoss = [];
    sorted.forEach(function(t){
      if (consec >= 2) afterLoss.push(t);
      var p = C.pnlOf(t);
      if (p < 0) consec++; else if (p > 0) consec = 0;
    });
    if (afterLoss.length >= 5) {
      var as = C.stats(afterLoss);
      if (as.winRate < s.winRate - 5 || as.netPnl < 0) {
        add({ kind:'leak', icon:'🔥', title:'Tilt after losing streaks', priority: Math.abs(as.netPnl) + 400,
          text:'After 2+ consecutive losses your win rate drops to ' + Fmt.pct(as.winRate) + ' (vs ' + Fmt.pct(s.winRate) + ' overall). Those ' + afterLoss.length + ' post-streak trades netted ' + Fmt.money(as.netPnl,{plus:true}) + '.',
          detail:['Hard rule: step away for at least 15 minutes after 2 losses.',
                  'Reduce size to 50% on the next trade after a losing streak.',
                  'Ask yourself: "Am I trying to make back what I lost?" before entering.']});
      }
    }

    /* ── 8. Overtrading ─────────────────────────────────────────────── */
    var daily = C.dailyPnl(trades);
    var dk = Object.keys(daily);
    if (dk.length >= 6) {
      var counts = dk.map(function(k){return daily[k].count;});
      var avgCount = avg(counts);
      var thresh = Math.max(4, Math.ceil(avgCount*1.6));
      var busyDays = dk.filter(function(k){return daily[k].count>=thresh;});
      var calmDays = dk.filter(function(k){return daily[k].count<thresh;});
      if (busyDays.length >= 3 && calmDays.length >= 3) {
        var busyAvg = avg(busyDays.map(function(k){return daily[k].pnl;}));
        var calmAvg = avg(calmDays.map(function(k){return daily[k].pnl;}));
        if (busyAvg < calmAvg) {
          add({ kind:'leak', icon:'🌀', title:'Overtrading costs you', priority: Math.abs(busyAvg-calmAvg)*4,
            text:'On busy days (' + thresh + '+ trades) you average ' + Fmt.money(busyAvg,{plus:true}) + '/day vs ' + Fmt.money(calmAvg,{plus:true}) + '/day on calmer days. More trades ≠ more profit.',
            detail:['Set a daily max-trade limit (' + Math.floor(avgCount*1.2) + ' is a reasonable cap for you).',
                    'Stop adding trades after you hit your daily profit target.',
                    'Quality over quantity: the best setups usually appear in the first hour.']});
        }
      }
    }

    /* ── 9. Hold-time analysis (cutting winners early) ─────────────── */
    var withR = trades.filter(function(t){return Number(t.riskAmount)>0;});
    if (withR.length >= 10) {
      var wins = withR.filter(function(t){return C.pnlOf(t)>0;});
      var losses2 = withR.filter(function(t){return C.pnlOf(t)<0;});
      if (wins.length >= 5 && losses2.length >= 5) {
        var avgWinR = avg(wins.map(function(t){return C.rOf(t)||0;}));
        var avgLossR = avg(losses2.map(function(t){return Math.abs(C.rOf(t)||0);}));
        if (avgWinR < 1.2 && avgLossR > 0.7) {
          add({ kind:'leak', icon:'✂️', title:'Cutting winners too early', priority: 350,
            text:'Your average winner is only ' + Fmt.num(avgWinR,2) + 'R but your average loser is ' + Fmt.num(avgLossR,2) + 'R. You are letting losers run but cutting winners short — the opposite of what profits require.',
            detail:['Move stop to breakeven after 1R gained, then let price decide.',
                    'Use a trailing stop instead of a fixed target on strong momentum moves.',
                    'Your win rate needs to be ' + Fmt.pct(100/(1+avgWinR/avgLossR)) + '+ to break even at this ratio.']});
        } else if (avgWinR >= 2 && s.winRate >= 40) {
          add({ kind:'strength', icon:'🎯', title:'Letting winners run', priority: 120,
            text:'Your average winner is ' + Fmt.num(avgWinR,2) + 'R vs ' + Fmt.num(avgLossR,2) + 'R average loser. You are running a positive risk:reward — keep this discipline.',
            detail:['Win rate only needs to stay above ' + Fmt.pct(100/(1+avgWinR/avgLossR)) + ' to remain profitable.']});
        }
      }
    }

    /* ── 10. R-multiple consistency ─────────────────────────────────── */
    if (withR.length >= 10) {
      var rVals = withR.map(function(t){return C.rOf(t)||0;});
      var sd = stddev(rVals);
      var mn = avg(rVals);
      if (sd > 2.5 && mn < 0.5) {
        add({ kind:'leak', icon:'📐', title:'Inconsistent position sizing', priority: 300,
          text:'Your R-multiples vary wildly (std dev: ' + Fmt.num(sd,2) + 'R). This suggests your risk per trade is not consistent — some bets are much bigger than others, which makes your results random.',
          detail:['Fix your risk amount at a set dollar value or % of account per trade.',
                  'Run every trade through: "If I lose this, am I OK with that?" before entering.']});
      }
    }

    /* ── 11. Costliest mistake ───────────────────────────────────────── */
    var mc = C.mistakeCost(trades);
    if (mc.length && mc[0].pnl < 0) {
      var m0 = mc[0];
      add({ kind:'leak', icon:'⚠️', title:'Costliest mistake: ' + m0.key, priority: Math.abs(m0.pnl)*1.8,
        text:'"' + m0.key + '" has appeared in ' + m0.count + ' trades and cost you ' + Fmt.money(m0.pnl,{plus:true}) + ' total (' + Fmt.money(m0.pnl/m0.count,{plus:true}) + ' per occurrence). Eliminating just this one mistake is your highest-leverage fix.',
        detail: mc.slice(0,3).map(function(m){return '"' + m.key + '": ' + m.count + ' trades, ' + Fmt.money(m.pnl,{plus:true});})});
    }

    /* ── 12. Emotion impact ──────────────────────────────────────────── */
    var emo = buckets(function(t){return t.emotion||null;},3);
    if (emo.length >= 2) {
      emo.sort(function(a,b){return a.pnl-b.pnl;});
      var wE = emo[0], bE = emo[emo.length-1];
      if (wE.pnl < 0) add({ kind:'leak', icon:'🧠', title:'Emotion to eliminate: ' + wE.key, priority: Math.abs(wE.pnl)*1.1,
        text:'When you log as "' + wE.key + '", trades net ' + Fmt.money(wE.pnl,{plus:true}) + ' over ' + wE.count + ' trades (' + Fmt.pct(wE.winRate) + ' win). This emotional state is costing you real money.',
        detail:['Build a rule: if you feel "' + wE.key + '", size is automatically halved.',
                'Add a pre-trade check — write down your emotion before every entry.']});
      if (bE.pnl > 0 && bE.key !== wE.key) add({ kind:'strength', icon:'😌', title:'Best state: ' + bE.key, priority: 80,
        text:'When feeling "' + bE.key + '" you net ' + Fmt.money(bE.pnl,{plus:true}) + ' (' + Fmt.pct(bE.winRate) + ' win). Replicate the conditions that put you in this state.',
        detail:['What was your sleep, routine, and preparation on these days? Systematise it.']});
    }

    /* ── 13. Oversizing risk ─────────────────────────────────────────── */
    if (withR.length >= 8) {
      var risks = withR.map(function(t){return Number(t.riskAmount);}).sort(function(a,b){return a-b;});
      var med = risks[Math.floor(risks.length/2)];
      var over = withR.filter(function(t){return Number(t.riskAmount)>med*1.5;});
      var norm = withR.filter(function(t){return Number(t.riskAmount)<=med*1.5;});
      if (over.length >= 4 && norm.length >= 4) {
        var os = C.stats(over), ns = C.stats(norm);
        if (os.winRate < ns.winRate - 5 || os.expectancy < ns.expectancy) {
          add({ kind:'leak', icon:'🎰', title:'Oversizing destroys your edge', priority: 340,
            text:'When you risk more than ' + Fmt.money(med*1.5) + ' (1.5× your median), your win rate is ' + Fmt.pct(os.winRate) + ' vs ' + Fmt.pct(ns.winRate) + ' on normal size. Bigger bets are making you worse.',
            detail:['Hypothesis: you change your behaviour under larger risk (hold too long, cut too early).',
                    'Hard cap: never risk more than ' + Fmt.money(med*1.5) + ' until this pattern reverses.',
                    'Track "did I follow my rules?" specifically on oversized trades.']});
        }
      }
    }

    /* ── 14. Profit concentration ────────────────────────────────────── */
    var profitDays = dk.map(function(k){return daily[k].pnl;}).filter(function(p){return p>0;});
    var totalProfit = profitDays.reduce(function(a,b){return a+b;},0);
    if (totalProfit > 0 && profitDays.length >= 4) {
      var bestDay = Math.max.apply(null, profitDays);
      var share = bestDay/totalProfit*100;
      if (share > 35) add({ kind:'leak', icon:'⚖️', title:'Profits too concentrated', priority: 240,
        text:'Your single best day made ' + Fmt.money(bestDay) + ' — ' + Fmt.pct(share) + ' of all your gross profit. One great day is masking inconsistent results. Without it, your account might be flat or negative.',
        detail:['Aim for at least 5+ green days to build a similar profit total.',
                'Consistency is more valuable than occasional home-runs at this stage.']});
    }

    /* ── 15. Risk:reward vs win-rate alignment ────────────────────────── */
    if (s.avgLoss > 0) {
      var ratio = s.avgWin/s.avgLoss;
      var beWin = 1/(1+ratio)*100;
      if (s.winRate < beWin - 2) {
        add({ kind:'leak', icon:'📏', title:'Risk:reward mismatch', priority: 280,
          text:'Your average win is ' + Fmt.num(ratio,2) + '× your average loss. At that ratio you need a ' + Fmt.pct(beWin) + ' win rate to break even — you are currently at ' + Fmt.pct(s.winRate) + '. You are losing money on every trade on average.',
          detail:['Fix 1: Aim for bigger wins (wider targets, trail your stop).',
                  'Fix 2: Cut losses faster (tighter stops, strict max-loss rule).',
                  'Fix 3: Only take setups where you believe win probability is above ' + Fmt.pct(beWin) + '.']});
      } else if (ratio >= 1.8 && s.winRate >= 42) {
        add({ kind:'strength', icon:'📏', title:'Solid risk:reward ratio', priority: 100,
          text:'Average win is ' + Fmt.num(ratio,2) + '× average loss at ' + Fmt.pct(s.winRate) + ' win rate — a mathematically profitable combination. Your edge is real.',
          detail:['Breakeven win rate at your current ratio: ' + Fmt.pct(beWin) + '. You have a ' + Fmt.pct(s.winRate - beWin) + ' buffer above that.']});
      }
    }

    /* ── 16. Fee drag ────────────────────────────────────────────────── */
    if (s.fees > 0 && s.grossWin > 0) {
      var feePct = s.fees/s.grossWin*100;
      if (feePct > 15) add({ kind:'leak', icon:'💸', title:'Fees eating your profits', priority: 200,
        text:'You are paying ' + Fmt.money(s.fees) + ' in fees — ' + Fmt.pct(feePct) + ' of your gross profit. High fees often signal overtrading or use of expensive instruments.',
        detail:['Reduce trade frequency (fewer, higher-quality setups).',
                'Compare your broker commissions to alternatives.',
                'Your breakeven gross profit per trade is ' + Fmt.money(s.fees/n) + ' before you make anything.']});
    }

    /* ── 17. Win-rate trend (improving or declining) ─────────────────── */
    if (n >= 20) {
      var chunk = Math.floor(n/4);
      var q1 = C.stats(sorted.slice(0,chunk)).winRate;
      var q4 = C.stats(sorted.slice(-chunk)).winRate;
      if (q4 > q1 + 8) add({ kind:'strength', icon:'📈', title:'Win rate improving', priority: 130,
        text:'Your win rate has climbed from ' + Fmt.pct(q1) + ' (earliest trades) to ' + Fmt.pct(q4) + ' (most recent). You are genuinely improving.',
        detail:['What changed? Identify the adjustment that drove this and double down on it.']});
      else if (q4 < q1 - 8) add({ kind:'leak', icon:'📉', title:'Win rate declining', priority: 320,
        text:'Your win rate has slipped from ' + Fmt.pct(q1) + ' (earlier trades) to ' + Fmt.pct(q4) + ' (recent). Something changed — either the market conditions or your execution.',
        detail:['Compare your most recent 10 losing trades to your setup rules.',
                'Have you introduced new setups recently that are dragging the average down?']});
    }

    /* ── 18. Discipline score ────────────────────────────────────────── */
    var disc = C.disciplineScore(trades);
    if (disc.total >= 5) {
      if (disc.score >= 85) add({ kind:'strength', icon:'🛡️', title:'Elite discipline (' + disc.score + '%)', priority: 90,
        text:'You followed your rules on ' + disc.score + '% of trades (' + disc.clean + '/' + disc.total + '). This level of discipline is rare and is the foundation of consistent profitability.',
        detail:['Clean trades P&L: ' + Fmt.money(C.stats(trades.filter(function(t){return !(t.mistakes&&t.mistakes.length);})).netPnl,{plus:true})]});
      else if (disc.score < 55) add({ kind:'leak', icon:'🛡️', title:'Discipline breakdown (' + disc.score + '%)', priority: 290,
        text:'Only ' + disc.score + '% of your trades are mistake-free. ' + (disc.total-disc.clean) + ' trades had tagged rule-breaks. Poor discipline is likely your single biggest drag.',
        detail:['Start tagging every mistake immediately after the trade while memory is fresh.',
                'Each mistake costs you on average: ' + Fmt.money(C.stats(trades.filter(function(t){return t.mistakes&&t.mistakes.length;})).expectancy) + '/trade.']});
    }

    /* ── Sort by priority desc, with snapshot always first ──────────── */
    var snapshot = out.filter(function(i){return i.title==='Performance snapshot';});
    var rest = out.filter(function(i){return i.title!=='Performance snapshot';});
    rest.sort(function(a,b){return (b.priority||0)-(a.priority||0);});
    return snapshot.concat(rest);
  }

  window.Insights = { generate: generate };
})();
