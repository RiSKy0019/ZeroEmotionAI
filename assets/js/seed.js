/* ============================================================
   seed.js — realistic sample data so the app isn't empty.
   window.seedState(uid)
   ============================================================ */
(function () {
  'use strict';
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  window.seedState = function (uid) {
    var accMain = uid('acc'), accProp = uid('acc');

    var playbooks = [
      { id: uid('pb'), name: 'Opening Range Breakout', market: 'Futures', description: 'Break of the first 15-min range with volume confirmation.',
        rules: ['Wait for the 15-min range to form', 'Volume above average on the break', 'Enter on retest of the range edge', 'Stop on the opposite side of the range', 'Target 2R minimum'] },
      { id: uid('pb'), name: 'VWAP Reclaim', market: 'Stocks', description: 'Price reclaims VWAP after a flush; momentum continuation.',
        rules: ['Price below VWAP, then reclaims it', 'Higher low before entry', 'Stop under the reclaim candle', 'Trail after 1R'] },
      { id: uid('pb'), name: 'Trend Pullback', market: 'Stocks', description: 'Buy the pullback to a rising 20 EMA in an uptrend.',
        rules: ['Clear uptrend (HH/HL)', 'Pullback to the 20 EMA', 'Bullish reversal candle', 'Stop below the swing low'] },
      { id: uid('pb'), name: 'Mean Reversion Fade', market: 'Futures', description: 'Fade overextended moves into key levels.',
        rules: ['2+ std dev from VWAP', 'At a prior support / resistance', 'Half size', 'Fixed 1R target'] }
    ];
    var setups = playbooks.map(function (p) { return p.name; });
    var symbolsBySetup = {
      'Opening Range Breakout': ['ES', 'NQ', 'CL'],
      'VWAP Reclaim': ['AAPL', 'TSLA', 'NVDA', 'AMD'],
      'Trend Pullback': ['MSFT', 'SPY', 'META', 'AMZN'],
      'Mean Reversion Fade': ['NQ', 'ES', 'GC']
    };
    var mistakesPool = ['Moved stop', 'Chased entry', 'Oversized', 'No setup (FOMO)', 'Exited early', 'Revenge trade', 'Ignored plan', 'Held too long'];
    var tagPool = ['A+ setup', 'News', 'Trend day', 'Choppy', 'Breakout', 'Reversal', 'Earnings', 'Pre-market plan'];
    var emotions = ['Calm', 'Confident', 'Anxious', 'Greedy', 'Frustrated', 'Focused'];

    var s = 987654321;
    function rnd() { s = (1103515245 * s + 12345) % 2147483648; return s / 2147483648; }
    function pick(a) { return a[Math.floor(rnd() * a.length)]; }
    function between(a, b) { return a + rnd() * (b - a); }

    var trades = [], today = new Date(), start = new Date();
    start.setDate(today.getDate() - 100);

    for (var i = 0; i < 64; i++) {
      var d = new Date(start); d.setDate(start.getDate() + Math.floor(between(0, 100)));
      var dow = d.getDay(); if (dow === 0) d.setDate(d.getDate() + 1); if (dow === 6) d.setDate(d.getDate() - 1);

      var setup = pick(setups), sym = pick(symbolsBySetup[setup]);
      var side = rnd() > 0.42 ? 'long' : 'short';
      var fut = ['ES', 'NQ', 'CL', 'GC'].indexOf(sym) >= 0;
      var base = ({ ES: 5300, NQ: 18500, CL: 78, GC: 2350, AAPL: 220, TSLA: 240, NVDA: 120, AMD: 160, MSFT: 420, SPY: 540, META: 500, AMZN: 185 })[sym] || 100;
      var qty = fut ? Math.ceil(between(1, 4)) : Math.ceil(between(20, 200));
      var ptVal = ({ ES: 50, NQ: 20, CL: 1000, GC: 100 })[sym] || 1;
      var entry = +(base * (1 + between(-0.01, 0.01))).toFixed(2);
      var win = rnd() < 0.57;
      var moveR = win ? between(0.6, 3.2) : -between(0.5, 1.6);
      var riskPerUnit = base * between(0.004, 0.012);
      var riskAmount = Math.round(riskPerUnit * qty * (fut ? ptVal : 1));
      var pnlTarget = riskAmount * moveR;
      var perUnit = pnlTarget / (qty * (fut ? ptVal : 1));
      var exit = +(entry + (side === 'short' ? -1 : 1) * perUnit).toFixed(2);
      var fees = fut ? +(qty * 2.2).toFixed(2) : +(Math.max(1, qty * 0.01)).toFixed(2);

      var hasMistake = !win ? rnd() < 0.55 : rnd() < 0.16;
      var mistakes = [];
      if (hasMistake) { mistakes.push(pick(mistakesPool)); if (rnd() < 0.22) mistakes.push(pick(mistakesPool)); }
      mistakes = mistakes.filter(function (v, idx, a) { return a.indexOf(v) === idx; });

      var tags = [];
      if (rnd() < 0.6) tags.push(pick(tagPool));
      if (rnd() < 0.25) tags.push(pick(tagPool));
      tags = tags.filter(function (v, idx, a) { return a.indexOf(v) === idx; });

      trades.push({
        id: uid('trd'), accountId: rnd() < 0.7 ? accMain : accProp,
        date: iso(d), time: pad(Math.floor(between(9, 15))) + ':' + pad(pick([0, 5, 12, 18, 27, 33, 41, 52])),
        symbol: sym, side: side, entry: entry, exit: exit, quantity: qty, fees: fees,
        multiplier: fut ? ptVal : 1,
        setup: setup, mistakes: mistakes, tags: tags, emotion: pick(emotions),
        rating: Math.max(1, Math.min(5, Math.round(win ? between(3, 5) : between(1, 3)))),
        riskAmount: riskAmount, screenshots: [],
        notes: win ? 'Followed the plan, clean execution.' : (hasMistake ? 'Broke a rule — review this one.' : 'Valid setup, did not work out.')
      });
    }
    trades.sort(function (a, b) { return new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time); });

    var journal = [
      { id: uid('jr'), date: iso(today), mood: 'Focused',
        premarket: 'CPI at 8:30. Stay flat until the number, then trade the ORB on NQ. Max 3 trades today.', review: '', lessons: '' },
      { id: uid('jr'), date: iso(new Date(today.getTime() - 86400000)), mood: 'Frustrated',
        premarket: 'Choppy overnight — reduce size.',
        review: 'Took a revenge trade after the first loss and gave back the morning gains. Stopped after 2 reds — good.',
        lessons: 'Hard stop after 2 losses. Step away from the desk for 15 minutes.' }
    ];

    return {
      meta: { v: 1, createdAt: new Date().toISOString() },
      accounts: [
        { id: accMain, name: 'Main Account', broker: 'Interactive Brokers', startingBalance: 25000 },
        { id: accProp, name: 'Prop — 50K Eval', broker: 'TopStep', startingBalance: 50000 }
      ],
      trades: trades, playbooks: playbooks, journal: journal
    };
  };
})();
