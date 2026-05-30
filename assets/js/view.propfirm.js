(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, C = window.Store.calc, Store = window.Store;
  var useState = React.useState, useMemo = React.useMemo;

  // Settings stored in localStorage
  var PF_KEY = 'zea.propfirm';
  function loadPF() {
    try { return JSON.parse(localStorage.getItem(PF_KEY) || '{}'); } catch(e) { return {}; }
  }
  function savePF(obj) { try { localStorage.setItem(PF_KEY, JSON.stringify(obj)); } catch(e) {} }

  function PropFirm(props) {
    var state = props.state, ctx = props.ctx;
    var trades = useMemo(function() { return Store.getTrades(ctx); }, [state, ctx.accountId, ctx.range]);
    var pf = loadPF();
    var cfg = useState({
      profitTarget: pf.profitTarget || 3000,
      dailyLossLimit: pf.dailyLossLimit || 1000,
      maxDrawdown: pf.maxDrawdown || 2000,
      maxContracts: pf.maxContracts || 6,
      consistencyThreshold: pf.consistencyThreshold || 200,
      minTradingDays: pf.minTradingDays || 5
    });
    var editing = useState(false);

    var form = cfg[0], setForm = cfg[1];
    function set(k, v) { setForm(function(c){ var n=Object.assign({},c); n[k]=v; return n; }); }
    function save() { savePF(form); editing[1](false); window.toast('Rules saved', 'ok'); }

    // Compute live metrics
    var s = C.stats(trades);
    var sb = state.accounts.reduce(function(sum, a){ return sum + (a.startingBalance||0); }, 0);
    if (ctx.accountId !== 'all') {
      var acc = state.accounts.find(function(a){ return a.id === ctx.accountId; });
      sb = acc ? acc.startingBalance : 0;
    }
    var dd = C.maxDrawdown(trades, sb);
    var daily = C.dailyPnl(trades);
    var days = Object.keys(daily);
    var worstDay = days.reduce(function(w, d){ return daily[d].pnl < w ? daily[d].pnl : w; }, 0);
    var bestDay  = days.reduce(function(b, d){ return daily[d].pnl > b ? daily[d].pnl : b; }, 0);
    var tradingDays = days.length;
    var consistCheck = C.consistencyRule(trades, form.consistencyThreshold);

    // Profit target progress
    var ptPct = Math.min(100, Math.max(0, s.netPnl / form.profitTarget * 100));
    var ddPct = Math.min(100, dd.amount / form.maxDrawdown * 100);
    var dlPct = Math.min(100, Math.abs(worstDay) / form.dailyLossLimit * 100);

    // Oversized trades
    var oversized = trades.filter(function(t){ return (t.quantity||0) > form.maxContracts; });

    function statusDot(ok) {
      return h('span', { className: 'w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block', style: { background: ok ? '#00B67A' : '#f6465d' } });
    }

    function RuleRow(label, value, limit, pct, isLoss) {
      var danger = isLoss ? pct >= 90 : false;
      var warn = isLoss ? (pct >= 60 && pct < 90) : (pct >= 70 && pct < 100);
      var barColor = danger ? '#f6465d' : warn ? '#f0a32a' : '#00B67A';
      return h('div', { className: 'card-base p-4' },
        h('div', { className: 'flex items-center justify-between mb-2' },
          h('div', { className: 'flex items-center gap-2' },
            statusDot(!danger),
            h('span', { className: 'font-semibold text-sm' }, label)),
          h('span', { className: 'text-sm font-bold', style: { color: barColor } }, value + ' / ' + Fmt.money(limit))),
        h('div', { className: 'h-2.5 rounded-full bg-slate-100 dark:bg-ink-700 overflow-hidden' },
          h('div', { className: 'h-full rounded-full transition-all', style: { width: Math.min(100,pct) + '%', background: barColor } })),
        h('div', { className: 'flex justify-between text-xs text-slate-400 mt-1' },
          h('span', null, Fmt.pct(pct) + ' used'),
          h('span', null, isLoss ? 'Limit: ' + Fmt.money(limit) : 'Target: ' + Fmt.money(limit))));
    }

    return h('div', { className: 'space-y-5 animate-fade-in' },
      h(UI.SectionHead, { title: 'Prop Firm Tracker',
        sub: 'Monitor your evaluation rules in real time.',
        right: [h(UI.Button, { key: 'e', variant: editing[0] ? 'primary' : 'ghost', onClick: function(){ if(editing[0]) save(); else editing[1](true); } },
          editing[0] ? 'Save rules' : '\u2699 Edit rules')] }),

      // Edit panel
      editing[0] ? h('div', { className: 'card-base p-5 grid grid-cols-2 sm:grid-cols-3 gap-3' },
        ['profitTarget','dailyLossLimit','maxDrawdown','maxContracts','consistencyThreshold','minTradingDays'].map(function(k){
          var labels = { profitTarget:'Profit target ($)', dailyLossLimit:'Daily loss limit ($)', maxDrawdown:'Max drawdown ($)', maxContracts:'Max contracts', consistencyThreshold:'Consistency min $ / day', minTradingDays:'Min trading days' };
          return h(UI.Field, { key: k, label: labels[k] },
            h(UI.Input, { type: 'number', step: 'any', value: form[k], onChange: function(e){ set(k, parseFloat(e.target.value)||0); } }));
        })) : null,

      // Progress bars
      h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' },
        RuleRow('Profit Target', Fmt.money(s.netPnl, {plus:true}), form.profitTarget, ptPct, false),
        RuleRow('Daily Loss Limit', Fmt.money(worstDay), form.dailyLossLimit, dlPct, true),
        RuleRow('Max Drawdown', '-' + Fmt.money(dd.amount), form.maxDrawdown, ddPct, true)),

      // Status cards
      h('div', { className: 'grid grid-cols-2 sm:grid-cols-4 gap-3' },
        h('div', { className: 'card-base p-4' },
          h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1' }, 'Trading Days'),
          h('div', { className: 'flex items-center gap-2' },
            statusDot(tradingDays >= form.minTradingDays),
            h('span', { className: 'text-xl font-bold' }, tradingDays + ' / ' + form.minTradingDays))),
        h('div', { className: 'card-base p-4' },
          h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1' }, 'Consistency Rule'),
          h('div', { className: 'flex items-center gap-2' },
            statusDot(consistCheck.score >= 60),
            h('span', { className: 'text-xl font-bold' }, consistCheck.score + '%')),
          h('div', { className: 'text-xs text-slate-400 mt-0.5' }, consistCheck.green + '/' + consistCheck.total + ' days \u2265 ' + Fmt.money(form.consistencyThreshold))),
        h('div', { className: 'card-base p-4' },
          h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1' }, 'Best Day'),
          h('div', { className: 'text-xl font-bold pnl-pos' }, Fmt.moneyShort(bestDay))),
        h('div', { className: 'card-base p-4' },
          h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1' }, 'Oversized Trades'),
          h('div', { className: 'flex items-center gap-2' },
            statusDot(oversized.length === 0),
            h('span', { className: 'text-xl font-bold' + (oversized.length ? ' pnl-neg' : '') }, oversized.length)),
          oversized.length ? h('div', { className: 'text-xs text-slate-400 mt-0.5' }, oversized.slice(0,3).map(function(t){ return t.symbol + ' (' + t.quantity + ')'; }).join(', ')) : null)),

      // Oversized trades list
      oversized.length ? h('div', { className: 'card-base p-4' },
        h('p', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2' }, 'Oversized Trades (exceeded ' + form.maxContracts + ' contracts)'),
        h('div', { className: 'overflow-x-auto' },
          h('table', { className: 'tz-table' },
            h('thead', null, h('tr', null, ['Date','Symbol','Side','Qty','Limit','P&L'].map(function(c){ return h('th',{key:c},c); }))),
            h('tbody', null, oversized.map(function(t){
              var p = C.pnlOf(t);
              return h('tr', { key: t.id },
                h('td', null, Fmt.dateShort(t.date)), h('td', null, t.symbol),
                h('td', null, h('span',{className: t.side==='short'?'badge badge-short':'badge badge-long'}, t.side==='short'?'\u25bc Short':'\u25b2 Long')),
                h('td', { style:{color:'#f6465d',fontWeight:700} }, t.quantity),
                h('td', null, form.maxContracts),
                h('td', { className: p>=0?'pnl-pos':'pnl-neg' }, Fmt.money(p,{plus:true})));
            }))))) : null
    );
  }

  window.Views = window.Views || {};
  window.Views.Propfirm = PropFirm;
})();
