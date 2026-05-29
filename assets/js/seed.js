/* ============================================================
   seed.js — realistic sample data so the journal isn't empty.
   Exposes window.seedState(uid) used by Store.init / reset.
   ============================================================ */
(function (global) {
  'use strict';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function seedState(uid) {
    var accMain = uid('acc');
    var accProp = uid('acc');

    var playbooks = [
      { id: uid('pb'), name: 'Opening Range Breakout', market: 'Futures', description: 'Break of the first 15-min range with volume confirmation.',
        rules: ['Wait for 15-min range to form', 'Volume above average on break', 'Enter on retest of range edge', 'Stop below range / above range', 'Target 2R minimum'] },
      { id: uid('pb'), name: 'VWAP Reclaim', market: 'Stocks', description: 'Price reclaims VWAP after a flush; momentum continuation.',
        rules: ['Price below VWAP then reclaims', 'Higher low before entry', 'Stop under reclaim candle', 'Trail after 1R'] },
      { id: uid('pb'), name: 'Trend Pullback', market: 'Stocks', description: 'Buy pullback to rising 20 EMA in an uptrend.',
        rules: ['Clear uptrend (HH/HL)', 'Pullback to 20 EMA', 'Bullish reversal candle', 'Stop below swing low'] },
      { id: uid('pb'), name: 'Mean Reversion Fade', market: 'Futures', description: 'Fade overextended moves into key levels.',
        rules: ['2+ std dev from VWAP', 'At prior support/resistance', 'Size half', 'Fixed 1R target'] }
    ];
    var setups = playbooks.map(function (p) { return p.name; });

    var symbolsByMarket = {
      'Opening Range Breakout': ['ES', 'NQ', 'CL'],
      'VWAP Reclaim': ['AAPL', 'TSLA', 'NVDA', 'AMD'],
      'Trend Pullback': ['MSFT', 'SPY', 'META', 'AMZN'],
      'Mean Reversion Fade': ['NQ', 'ES', 'GC']
    };
    var mistakesPool = ['Moved stop', 'Chased entry', 'Oversized', 'No setup (FOMO)', 'Exited early', 'Revenge trade', 'Ignored plan', 'Held too long'];
    var emotions = ['Calm', 'Confident', 'Anxious', 'Greedy', 'Frustrated', 'Focused'];

    // Deterministic-ish PRNG so seeds look consistent across reloads
    var s = 123456789;
    function rnd() { s = (1103515245 * s + 12345) % 2147483648; return s / 2147483648; }
    function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
    function between(a, b) { return a + rnd() * (b - a); }

    var trades = [];
    var today = new Date();
    var start = new Date(); start.setDate(today.getDate() - 95);

    // ~55 trades, win-biased but with realistic losers & mistakes
    for (var i = 0; i < 55; i++) {
      var dayOffset = Math.floor(between(0, 95));
      var d = new Date(start); d.setDate(start.getDate() + dayOffset);
      var dow = d.getDay();
      if (dow === 0 || dow === 6) { d.setDate(d.getDate() + 1); } // skip weekends-ish

      var setup = pick(setups);
      var sym = pick(symbolsByMarket[setup]);
      var side = rnd() > 0.42 ? 'long' : 'short';
      var isFutures = ['ES', 'NQ', 'CL', 'GC'].indexOf(sym) >= 0;
      var basePrice = sym === 'ES' ? 5300 : sym === 'NQ' ? 18500 : sym === 'CL' ? 78 : sym === 'GC' ? 2350 :
                      sym === 'AAPL' ? 220 : sym === 'TSLA' ? 240 : sym === 'NVDA' ? 120 : sym === 'AMD' ? 160 :
                      sym === 'MSFT' ? 420 : sym === 'SPY' ? 540 : sym === 'META' ? 500 : sym === 'AMZN' ? 185 : 100;
      var qty = isFutures ? Math.ceil(between(1, 4)) : Math.ceil(between(20, 200));
      var tick = isFutures ? (sym === 'ES' ? 0.25 : sym === 'NQ' ? 0.25 : 0.01) : 0.01;
      var ptVal = sym === 'ES' ? 50 : sym === 'NQ' ? 20 : sym === 'CL' ? 1000 : sym === 'GC' ? 100 : 1;

      var entry = +(basePrice * (1 + between(-0.01, 0.01))).toFixed(2);
      // outcome: ~58% winners
      var win = rnd() < 0.58;
      var moveR = win ? between(0.6, 3.2) : -between(0.5, 1.6);
      var riskPerUnit = basePrice * between(0.004, 0.012);
      var riskAmount = Math.round(riskPerUnit * qty * (isFutures ? ptVal : 1));
      var pnlTarget = riskAmount * moveR;

      // back out an exit that produces pnlTarget
      var dir = side === 'short' ? -1 : 1;
      var perUnit = pnlTarget / (qty * (isFutures ? ptVal : 1));
      var exit = +(entry + dir * perUnit).toFixed(2);

      var fees = isFutures ? +(qty * 2.2).toFixed(2) : +(Math.max(1, qty * 0.01)).toFixed(2);

      var hasMistake = !win ? rnd() < 0.55 : rnd() < 0.18;
      var mistakes = [];
      if (hasMistake) {
        mistakes.push(pick(mistakesPool));
        if (rnd() < 0.25) mistakes.push(pick(mistakesPool));
        mistakes = mistakes.filter(function (v, idx, a) { return a.indexOf(v) === idx; });
      }

      var hour = Math.floor(between(9, 15));
      var minute = pick([0, 5, 12, 18, 27, 33, 41, 52]);

      trades.push({
        id: uid('trd'),
        accountId: rnd() < 0.7 ? accMain : accProp,
        date: isoDate(d),
        time: pad(hour) + ':' + pad(minute),
        symbol: sym,
        side: side,
        entry: entry,
        exit: exit,
        quantity: qty,
        fees: fees,
        setup: setup,
        mistakes: mistakes,
        emotion: pick(emotions),
        rating: Math.max(1, Math.min(5, Math.round(win ? between(3, 5) : between(1, 3)))),
        riskAmount: riskAmount,
        notes: win ? 'Followed the plan, clean execution.' : (hasMistake ? 'Broke a rule — review this one.' : 'Valid setup, just did not work out.')
      });
    }

    trades.sort(function (a, b) {
      return new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time);
    });

    // A couple of pre-trade plans
    var plans = [
      { id: uid('pln'), accountId: accMain, createdAt: isoDate(today), symbol: 'NQ', bias: 'long',
        entryZone: '18,520 – 18,540', stop: '18,470', target: '18,640', size: '2 contracts',
        playbook: 'Opening Range Breakout',
        rules: [
          { text: 'Wait for 15-min opening range', checked: true },
          { text: 'Volume confirms the break', checked: false },
          { text: 'Risk capped at 1R ($300)', checked: true },
          { text: 'No entry after 11:00 ET', checked: false }
        ],
        rationale: 'Trend day expected on CPI follow-through. Long bias above ON high.',
        status: 'planned' },
      { id: uid('pln'), accountId: accMain, createdAt: isoDate(today), symbol: 'AAPL', bias: 'short',
        entryZone: '224.50 – 225.00', stop: '226.20', target: '220.00', size: '150 shares',
        playbook: 'Mean Reversion Fade',
        rules: [
          { text: '2 std dev above VWAP', checked: true },
          { text: 'At prior resistance', checked: true },
          { text: 'Half size on fade', checked: true }
        ],
        rationale: 'Overextended into daily resistance, fading the spike.',
        status: 'planned' }
    ];

    var journal = [
      { id: uid('jr'), date: isoDate(today), mood: 'Focused',
        premarket: 'CPI at 8:30. Plan: stay flat until the number, then trade the ORB on NQ. Max 3 trades today.',
        review: '', lessons: '' },
      { id: uid('jr'), date: isoDate(new Date(today.getTime() - 86400000)), mood: 'Frustrated',
        premarket: 'Choppy overnight. Reduce size.',
        review: 'Took a revenge trade after the first loss and gave back the morning gains. Stopped after 2 reds — good.',
        lessons: 'Hard stop after 2 losses. Walk away from the desk for 15 minutes.' }
    ];

    return {
      meta: { version: 1, createdAt: new Date().toISOString() },
      accounts: [
        { id: accMain, name: 'Main Account', broker: 'Interactive Brokers', startingBalance: 25000 },
        { id: accProp, name: 'Prop — 50K Eval', broker: 'TopStep', startingBalance: 50000 }
      ],
      trades: trades,
      plans: plans,
      playbooks: playbooks,
      journal: journal
    };
  }

  global.seedState = seedState;
})(window);
