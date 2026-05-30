/* ============================================================
   chat.js — two-way conversation engine (window.Chat)
   Option B: local NLP query engine (no key, always works)
   Option A: OpenAI bridge (paste your key to unlock)
   ============================================================ */
(function () {
  'use strict';
  var C = window.Store.calc, Fmt = window.Fmt;

  /* ── helpers ── */
  function r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function pf(s) { return s.profitFactor === Infinity ? '∞' : Fmt.num(s.profitFactor, 2); }
  function DOW(i) { return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][i]; }
  function has(text, words) { return words.some(function(w){ return text.indexOf(w) >= 0; }); }

  /* ── build compact trade context for OpenAI ── */
  function buildContext(trades) {
    var s = C.stats(trades);
    var daily = C.dailyPnl(trades);
    var dk = Object.keys(daily);
    var green = dk.filter(function(d){ return daily[d].pnl > 0; }).length;
    var red   = dk.filter(function(d){ return daily[d].pnl < 0; }).length;

    var sym = C.groupSum(trades, function(t){ return t.symbol; }).sort(function(a,b){ return b.pnl-a.pnl; }).slice(0,5);
    var pb  = C.groupSum(trades, function(t){ return t.setup||'Untagged'; }).sort(function(a,b){ return b.pnl-a.pnl; }).slice(0,5);
    var dow = C.groupSum(trades, function(t){ return DOW(new Date(t.date+'T00:00:00').getDay()); }).sort(function(a,b){ return b.pnl-a.pnl; });
    var hr  = C.groupSum(trades, function(t){ return (t.time||'00:00').split(':')[0]; }).sort(function(a,b){ return b.pnl-a.pnl; });
    var mc  = C.mistakeCost(trades).slice(0,5);
    var disc = C.disciplineScore(trades);

    return [
      'TRADING PERFORMANCE SUMMARY (' + trades.length + ' trades)',
      '---',
      'Net P&L: ' + Fmt.money(s.netPnl,{plus:true}),
      'Win rate: ' + Fmt.pct(s.winRate) + ' (' + s.wins + 'W / ' + s.losses + 'L / ' + s.be + ' BE)',
      'Profit factor: ' + pf(s),
      'Expectancy: ' + Fmt.money(s.expectancy,{plus:true}) + '/trade',
      'Avg win: ' + Fmt.money(s.avgWin) + ' | Avg loss: -' + Fmt.money(s.avgLoss),
      s.avgR != null ? 'Avg R: ' + Fmt.num(s.avgR,2) + 'R' : '',
      'Max drawdown: ' + Fmt.money(C.maxDrawdown(trades,0).amount),
      'Trading days: ' + dk.length + ' (' + green + ' green, ' + red + ' red)',
      'Discipline score: ' + disc.score + '%',
      '',
      'TOP SYMBOLS: ' + sym.map(function(x){ return x.key+'('+Fmt.moneyShort(x.pnl)+','+Fmt.pct(x.winRate)+'win)'; }).join(', '),
      'TOP SETUPS: ' + pb.map(function(x){ return x.key+'('+Fmt.moneyShort(x.pnl)+','+Fmt.pct(x.winRate)+'win)'; }).join(', '),
      'BY DAY: ' + dow.map(function(x){ return x.key+'('+Fmt.moneyShort(x.pnl)+','+Fmt.pct(x.winRate)+'win)'; }).join(', '),
      'BY HOUR: ' + hr.slice(0,6).map(function(x){ return Fmt.hourLabel(x.key)+'('+Fmt.moneyShort(x.pnl)+')'; }).join(', '),
      mc.length ? 'MISTAKES: ' + mc.map(function(m){ return m.key+'('+m.count+'x, '+Fmt.moneyShort(m.pnl)+')'; }).join(', ') : ''
    ].filter(Boolean).join('\n');
  }

  /* ══════════════════════════════════════════════════════════
     LOCAL NLP ENGINE — no API key required
     ══════════════════════════════════════════════════════════ */
  var INTENTS = [
    // overview / summary
    { match: ['how am i doing','overall','summary','overview','performance'],
      run: function(t,q){ var s=C.stats(t); return 'Here\'s your overview across **'+t.length+' trades**:\n\n• **Net P&L:** '+Fmt.money(s.netPnl,{plus:true})+'\n• **Win rate:** '+Fmt.pct(s.winRate)+' ('+s.wins+'W / '+s.losses+'L'+(s.be?' / '+s.be+' BE':'')+')'+'\n• **Profit factor:** '+pf(s)+'\n• **Expectancy:** '+Fmt.money(s.expectancy,{plus:true})+' per trade\n• **Avg win:** '+Fmt.money(s.avgWin)+' | **Avg loss:** -'+Fmt.money(s.avgLoss)+(s.avgR!=null?'\n• **Avg R-multiple:** '+Fmt.num(s.avgR,2)+'R':''); } },

    // P&L
    { match: ['pnl','profit','loss','made','earned','net'],
      run: function(t,q){ var s=C.stats(t); return 'Your net P&L is **'+Fmt.money(s.netPnl,{plus:true})+'**.\n\nGross profit: '+Fmt.money(s.grossWin)+' | Gross loss: -'+Fmt.money(s.grossLoss)+' | Fees: '+Fmt.money(s.fees)+'\n\nExpectancy (avg per trade): **'+Fmt.money(s.expectancy,{plus:true})+'**'; } },

    // win rate
    { match: ['win rate','win%','winning'],
      run: function(t,q){ var s=C.stats(t); return 'Your win rate is **'+Fmt.pct(s.winRate)+'** ('+s.wins+' wins, '+s.losses+' losses'+(s.be?', '+s.be+' break-evens':'')+').\n\nProfit factor: **'+pf(s)+'** (you need >1.0 to be net profitable).\n\nAvg win: **'+Fmt.money(s.avgWin)+'** | Avg loss: **-'+Fmt.money(s.avgLoss)+'** | Ratio: **'+Fmt.num(s.avgLoss>0?s.avgWin/s.avgLoss:0,2)+'x**'; } },

    // best / worst day of week
    { match: ['best day','worst day','day of week','monday','tuesday','wednesday','thursday','friday'],
      run: function(t,q){
        var g=C.groupSum(t,function(tr){return new Date(tr.date+'T00:00:00').getDay();}).filter(function(x){return x.count>=2;});
        if(!g.length) return 'Not enough data per day yet — log more trades to see day-of-week patterns.';
        g.sort(function(a,b){return b.pnl-a.pnl;});
        var best=g[0],worst=g[g.length-1];
        var rows=g.map(function(x){return '• **'+DOW(x.key)+':** '+Fmt.money(x.pnl,{plus:true})+' | '+Fmt.pct(x.winRate)+' win | '+x.count+' trades';});
        return '**Day-of-week breakdown:**\n\n'+rows.join('\n')+'\n\n🟢 **Best day:** '+DOW(best.key)+' ('+Fmt.money(best.pnl,{plus:true})+')\n🔴 **Worst day:** '+DOW(worst.key)+' ('+Fmt.money(worst.pnl,{plus:true})+')';
      }
    },

    // best / worst time
    { match: ['best time','worst time','hour','morning','afternoon','time of day'],
      run: function(t,q){
        var g=C.groupSum(t,function(tr){return (tr.time||'00:00').split(':')[0];}).filter(function(x){return x.count>=2;});
        if(!g.length) return 'Not enough data per hour yet.';
        g.sort(function(a,b){return b.pnl-a.pnl;});
        var best=g[0],worst=g[g.length-1];
        var rows=g.map(function(x){return '• **'+Fmt.hourLabel(x.key)+':** '+Fmt.money(x.pnl,{plus:true})+' | '+Fmt.pct(x.winRate)+' win | '+x.count+' trades';});
        return '**Hourly breakdown:**\n\n'+rows.join('\n')+'\n\n⏰ **Best hour:** '+Fmt.hourLabel(best.key)+'\n⚠️ **Worst hour:** '+Fmt.hourLabel(worst.key);
      }
    },

    // playbook / setup
    { match: ['setup','playbook','strategy','which setup','best setup'],
      run: function(t,q){
        var g=C.groupSum(t,function(tr){return tr.setup||'Untagged';}).filter(function(x){return x.count>=2;});
        if(!g.length) return 'No setups tagged yet. Add a playbook/setup to your trades to see which strategies work.';
        g.sort(function(a,b){return b.pnl-a.pnl;});
        var rows=g.map(function(x){return '• **'+x.key+':** '+Fmt.money(x.pnl,{plus:true})+' | '+Fmt.pct(x.winRate)+' win | '+x.count+' trades';});
        return '**Playbook performance:**\n\n'+rows.join('\n')+'\n\n📗 **Top setup:** '+g[0].key+' ('+Fmt.money(g[0].pnl,{plus:true})+')\n📕 **Weakest:** '+g[g.length-1].key+' ('+Fmt.money(g[g.length-1].pnl,{plus:true})+')';
      }
    },

    // symbol / instrument
    { match: ['symbol','ticker','instrument','nq','es','aapl','tsla','which symbol','best symbol'],
      run: function(t,q){
        var g=C.groupSum(t,function(tr){return tr.symbol;}).filter(function(x){return x.count>=2;});
        if(!g.length) return 'Not enough data per symbol yet.';
        g.sort(function(a,b){return b.pnl-a.pnl;});
        var rows=g.map(function(x){return '• **'+x.key+':** '+Fmt.money(x.pnl,{plus:true})+' | '+Fmt.pct(x.winRate)+' win | '+x.count+' trades';});
        return '**Symbol breakdown:**\n\n'+rows.join('\n');
      }
    },

    // mistakes
    { match: ['mistake','rule break','error','discipline'],
      run: function(t,q){
        var mc=C.mistakeCost(t);
        if(!mc.length) return 'No mistakes tagged yet. Tag rule breaks on your trades to see their dollar cost.';
        var rows=mc.slice(0,8).map(function(m){return '• **'+m.key+':** '+Fmt.money(m.pnl,{plus:true})+' across '+m.count+' trades (avg '+Fmt.money(m.pnl/m.count,{plus:true})+'/trade)';});
        var disc=C.disciplineScore(t);
        return '**Mistake cost breakdown:**\n\n'+rows.join('\n')+'\n\n🛡️ **Discipline score:** '+disc.score+'% ('+disc.clean+'/'+disc.total+' trades mistake-free)';
      }
    },

    // long vs short
    { match: ['long','short','direction','side','long vs short'],
      run: function(t,q){
        var longs=t.filter(function(tr){return tr.side!=='short';}),shorts=t.filter(function(tr){return tr.side==='short';});
        if(!longs.length||!shorts.length) return 'You need both long and short trades to compare directions.';
        var ls=C.stats(longs),ss=C.stats(shorts);
        return '**Long vs Short:**\n\n• **Longs:** '+Fmt.money(ls.netPnl,{plus:true})+' | '+Fmt.pct(ls.winRate)+' win | '+longs.length+' trades\n• **Shorts:** '+Fmt.money(ss.netPnl,{plus:true})+' | '+Fmt.pct(ss.winRate)+' win | '+shorts.length+' trades\n\nYou trade **'+(ls.netPnl>=ss.netPnl?'longs':'shorts')+'** better.';
      }
    },

    // drawdown
    { match: ['drawdown','max loss','worst','underwater'],
      run: function(t,q){
        var s=C.stats(t),dd=C.maxDrawdown(t,0);
        return '**Drawdown analysis:**\n\n• Max drawdown: **-'+Fmt.money(dd.amount)+'** (-'+Fmt.pct(dd.pct)+')\n• Largest losing trade: **'+Fmt.money(s.largestLoss)+'**\n• Max loss streak: **'+s.lossStreak+' trades**\n\nTip: if your max drawdown exceeds 10–15% of account, consider reducing size until win rate improves.';
      }
    },

    // emotion
    { match: ['emotion','feeling','mood','anxious','calm','greedy','frustrated'],
      run: function(t,q){
        var g=C.groupSum(t,function(tr){return tr.emotion||null;}).filter(function(x){return x.count>=2;});
        if(!g.length) return 'No emotions logged yet. Tag your emotional state when adding trades to see how it affects results.';
        g.sort(function(a,b){return b.pnl-a.pnl;});
        var rows=g.map(function(x){return '• **'+x.key+':** '+Fmt.money(x.pnl,{plus:true})+' | '+Fmt.pct(x.winRate)+' win | '+x.count+' trades';});
        return '**P&L by emotional state:**\n\n'+rows.join('\n')+'\n\n😌 Best: '+g[0].key+' | 😰 Worst: '+g[g.length-1].key;
      }
    },

    // fees
    { match: ['fee','commission','cost'],
      run: function(t,q){
        var s=C.stats(t);
        var feePct=s.grossWin>0?s.fees/s.grossWin*100:0;
        return '**Fee analysis:**\n\n• Total fees paid: **'+Fmt.money(s.fees)+'**\n• As % of gross profit: **'+Fmt.pct(feePct)+'**\n• Avg fee per trade: **'+Fmt.money(s.fees/t.length)+'**\n\n'+(feePct>15?'⚠️ Fees are eating **'+Fmt.pct(feePct)+'** of your gross profit — this is high. Reduce trade frequency or find a cheaper broker.':'✅ Fee drag is reasonable.');
      }
    },

    // R-multiple
    { match: ['r multiple','r-multiple','risk reward','risk:reward','rr'],
      run: function(t,q){
        var s=C.stats(t);
        if(s.avgR==null) return 'No R-multiple data yet. Add a "risk amount" ($) to your trades to enable R-multiple tracking.';
        var ratio=s.avgLoss>0?s.avgWin/s.avgLoss:0;
        var beWin=ratio>0?100/(1+ratio):50;
        return '**Risk:reward & R-multiples:**\n\n• Avg R: **'+Fmt.num(s.avgR,2)+'R**\n• Win/loss size ratio: **'+Fmt.num(ratio,2)+'x**\n• Breakeven win rate at this ratio: **'+Fmt.pct(beWin)+'**\n• Your current win rate: **'+Fmt.pct(s.winRate)+'**\n\n'+(s.winRate>beWin?'✅ Your win rate is **'+Fmt.pct(s.winRate-beWin)+'** above breakeven — profitable edge.':'⚠️ You are **'+Fmt.pct(beWin-s.winRate)+'** below the win rate needed to break even at this R ratio.');
      }
    },

    // recent trades
    { match: ['recent','last','latest','today','this week'],
      run: function(t,q){
        var sorted=t.slice().sort(function(a,b){return C.timeKey(b)-C.timeKey(a);}).slice(0,5);
        if(!sorted.length) return 'No recent trades found.';
        var rows=sorted.map(function(tr){var p=C.pnlOf(tr);return '• **'+tr.symbol+'** '+Fmt.dateShort(tr.date)+' — '+Fmt.money(p,{plus:true})+' ('+tr.side+', '+C.resultOf(tr)+')';});
        return '**Your 5 most recent trades:**\n\n'+rows.join('\n');
      }
    },

    // best / worst trades
    { match: ['best trade','worst trade','biggest win','biggest loss'],
      run: function(t,q){
        var s=C.stats(t);
        var sorted=t.slice().sort(function(a,b){return C.pnlOf(b)-C.pnlOf(a);});
        var best=sorted[0],worst=sorted[sorted.length-1];
        if(!best) return 'No trades found.';
        return '**Best trade:** '+best.symbol+' on '+Fmt.date(best.date)+' → **'+Fmt.money(C.pnlOf(best),{plus:true})+'** ('+best.side+', '+best.setup+')\n\n**Worst trade:** '+worst.symbol+' on '+Fmt.date(worst.date)+' → **'+Fmt.money(C.pnlOf(worst),{plus:true})+'** ('+worst.side+', '+(worst.setup||'no setup')+')';
      }
    },

    // tilt / streaks
    { match: ['streak','tilt','revenge','after loss'],
      run: function(t,q){
        var strk=C.streaks(t);
        var sorted2=t.slice().sort(function(a,b){return C.timeKey(a)-C.timeKey(b);});
        var consec=0,afterLoss=[];
        sorted2.forEach(function(tr){if(consec>=2)afterLoss.push(tr);var p=C.pnlOf(tr);if(p<0)consec++;else if(p>0)consec=0;});
        var s=C.stats(t),as=C.stats(afterLoss);
        return '**Streak & tilt analysis:**\n\n• Current trade streak: **'+strk.trade.current+(strk.trade.sign>=0?' wins':' losses')+'**\n• Longest win streak: **'+strk.trade.longest+' trades**\n• Max loss streak: **'+s.lossStreak+' trades**\n\n'+(afterLoss.length>=5?'**After 2+ consecutive losses** ('+afterLoss.length+' trades): win rate = **'+Fmt.pct(as.winRate)+'** vs **'+Fmt.pct(s.winRate)+'** overall. '+(as.winRate<s.winRate-5?'⚠️ You tilt — consider a mandatory break after 2 losses.':'✅ You stay disciplined after losses.'):'Not enough post-loss data yet.');
      }
    },

    // what if / scenario
    { match: ['what if','if i remove','without','exclude','scenario'],
      run: function(t,q){
        var hasMistake=t.filter(function(tr){return tr.mistakes&&tr.mistakes.length;});
        var clean=t.filter(function(tr){return !(tr.mistakes&&tr.mistakes.length);});
        var s=C.stats(t),cs=C.stats(clean);
        return '**"What if I removed all mistake trades?" scenario:**\n\n• Current net P&L: **'+Fmt.money(s.netPnl,{plus:true})+'** ('+t.length+' trades)\n• Clean trades only: **'+Fmt.money(cs.netPnl,{plus:true})+'** ('+clean.length+' trades)\n• Difference: **'+Fmt.money(cs.netPnl-s.netPnl,{plus:true})+'**\n• Win rate: '+Fmt.pct(s.winRate)+' → **'+Fmt.pct(cs.winRate)+'**\n\nTagging mistakes is the most important habit for improving — it reveals exactly what is costing you.';
      }
    }
  ];

  function localAnswer(trades, question) {
    var q = question.toLowerCase().trim();
    for (var i = 0; i < INTENTS.length; i++) {
      if (has(q, INTENTS[i].match)) {
        try { return INTENTS[i].run(trades, q); } catch (e) { return 'Could not compute that — try rephrasing.'; }
      }
    }
    return null; // signal: no match
  }

  function fallbackAnswer(trades, question) {
    var s = C.stats(trades);
    return 'I\'m not sure I understood that specific question, but here\'s a quick summary:\n\n• **Net P&L:** ' + Fmt.money(s.netPnl,{plus:true}) + '\n• **Win rate:** ' + Fmt.pct(s.winRate) + '\n• **Profit factor:** ' + pf(s) + '\n\nTry asking things like: *"How did I do on Mondays?"*, *"What\'s my best setup?"*, *"Show me my mistakes"*, or *"What\'s my R-multiple?"*\n\nFor open-ended questions, add your OpenAI key in **Settings → AI Settings** to unlock full GPT-powered answers.';
  }

  /* ══════════════════════════════════════════════════════════
     OPENAI BRIDGE
     ══════════════════════════════════════════════════════════ */
  function askOpenAI(trades, question, history, onChunk, onDone, onError) {
    var key = window.AIKey.get();
    if (!key) { onError('No OpenAI key set. Go to Settings → AI Settings to add one.'); return; }

    var context = buildContext(trades);
    var messages = [
      { role: 'system', content: 'You are an expert trading coach and analyst. The user has given you their trading performance data below. Answer their questions concisely, citing specific numbers from the data. Be direct and actionable. Use markdown for formatting.\n\n' + context }
    ].concat(history.slice(-8)).concat([{ role: 'user', content: question }]);

    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: messages, stream: true, max_tokens: 600, temperature: 0.4 })
    }).then(function(res) {
      if (!res.ok) { return res.json().then(function(e){ onError('OpenAI error: ' + (e.error&&e.error.message||res.status)); }); }
      var reader = res.body.getReader(), decoder = new TextDecoder(), buf = '';
      function pump() {
        reader.read().then(function(d) {
          if (d.done) { onDone(); return; }
          buf += decoder.decode(d.value, { stream: true });
          var lines = buf.split('\n'); buf = lines.pop();
          lines.forEach(function(line) {
            var data = line.replace(/^data: /, '').trim();
            if (!data || data === '[DONE]') return;
            try { var j = JSON.parse(data); var delta = j.choices&&j.choices[0]&&j.choices[0].delta&&j.choices[0].delta.content; if (delta) onChunk(delta); } catch (e) {}
          });
          pump();
        }).catch(function(e){ onError('Stream error: ' + e.message); });
      }
      pump();
    }).catch(function(e){ onError('Network error — check your API key and internet connection. ' + e.message); });
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC API
     ══════════════════════════════════════════════════════════ */
  window.Chat = {
    /* answer(): returns a promise resolving to { text, mode } */
    answer: function(trades, question, history) {
      return new Promise(function(resolve) {
        var local = localAnswer(trades, question);
        if (local) { resolve({ text: local, mode: 'local' }); return; }
        if (window.AIKey.has()) {
          var full = '';
          askOpenAI(trades, question, history,
            function(chunk) { full += chunk; },
            function() { resolve({ text: full, mode: 'openai' }); },
            function(err) { resolve({ text: fallbackAnswer(trades, question) + '\n\n_(OpenAI error: ' + err + ')_', mode: 'error' }); });
        } else {
          resolve({ text: fallbackAnswer(trades, question), mode: 'local' });
        }
      });
    },

    /* stream(): calls onChunk repeatedly then onDone — for streaming UI */
    stream: function(trades, question, history, onChunk, onDone) {
      var local = localAnswer(trades, question);
      if (local) { onChunk(local); setTimeout(onDone, 50); return; }
      if (window.AIKey.has()) {
        askOpenAI(trades, question, history, onChunk, onDone,
          function(err) { onChunk(fallbackAnswer(trades, question) + '\n\n_(Error: ' + err + ')_'); setTimeout(onDone, 50); });
      } else {
        onChunk(fallbackAnswer(trades, question)); setTimeout(onDone, 50);
      }
    },

    buildContext: buildContext,

    SUGGESTED: [
      'How am I doing overall?',
      'What is my win rate and profit factor?',
      'Which day of the week is my best?',
      'What time of day should I be trading?',
      'What is my best playbook / setup?',
      'Which mistakes are costing me the most?',
      'How do my longs compare to my shorts?',
      'What is my average R-multiple?',
      'Show me my best and worst trades',
      'What would happen if I removed my mistake trades?',
      'Am I overtrading?',
      'How is my discipline score?'
    ]
  };
})();
