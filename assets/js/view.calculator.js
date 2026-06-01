/* ============================================================
   view.calculator.js — Position-Size & Risk Calculator (Views.Calculator)
   Pre-trade tool: balance + risk% + entry + stop -> position size,
   plus reward:risk and target projection. Pure client-side.
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, Store = window.Store;
  var useState = React.useState, useMemo = React.useMemo;

  function num(v) { var x = parseFloat(v); return isFinite(x) ? x : null; }

  function Stat(props) {
    return h('div', { className: 'rounded-xl border border-slate-200 dark:border-ink-600 bg-slate-50 dark:bg-ink-900 p-4' },
      h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold' }, props.label),
      h('div', { className: window.cx('text-2xl font-extrabold mt-1 tabular-nums', props.color || ''), }, props.value),
      props.sub ? h('div', { className: 'text-xs text-slate-400 mt-0.5' }, props.sub) : null);
  }

  function Calculator(props) {
    var state = props.state || Store.getState();

    // default balance: selected account's starting balance + its net P&L
    var defBal = useMemo(function () {
      var accs = state.accounts || [];
      var acc = (props.ctx && props.ctx.accountId && props.ctx.accountId !== 'all')
        ? accs.find(function (a) { return a.id === props.ctx.accountId; }) : accs[0];
      if (!acc) return 25000;
      var ts = state.trades.filter(function (t) { return t.accountId === acc.id; });
      return Math.round((acc.startingBalance || 0) + Store.calc.stats(ts).netPnl);
    }, [state]);

    var f = useState({ balance: String(defBal), riskPct: '1', entry: '', stop: '', target: '', multiplier: '1', side: 'long' });
    var form = f[0], setF = f[1];
    function set(k, v) { var o = {}; o[k] = v; setF(Object.assign({}, form, o)); }

    var res = useMemo(function () {
      var bal = num(form.balance), riskPct = num(form.riskPct), entry = num(form.entry),
          stop = num(form.stop), target = num(form.target), mult = num(form.multiplier) || 1;
      if (bal == null || riskPct == null || entry == null || stop == null) return null;
      var riskDollar = bal * (riskPct / 100);
      var perUnitRisk = Math.abs(entry - stop) * mult;
      if (perUnitRisk <= 0) return { riskDollar: riskDollar, error: 'Entry and stop must differ.' };
      var size = riskDollar / perUnitRisk;
      var positionValue = entry * size * mult;
      var rr = null, targetPnl = null, rMultipleAtTarget = null;
      if (target != null) {
        var reward = Math.abs(target - entry) * mult;
        rr = perUnitRisk > 0 ? reward / perUnitRisk : null;
        targetPnl = reward * size;
        rMultipleAtTarget = rr;
      }
      // validate stop side vs direction
      var dirOk = form.side === 'long' ? stop < entry : stop > entry;
      return {
        riskDollar: riskDollar, perUnitRisk: perUnitRisk, size: size, positionValue: positionValue,
        rr: rr, targetPnl: targetPnl, rMultipleAtTarget: rMultipleAtTarget,
        leverage: bal > 0 ? positionValue / bal : null,
        stopDistance: Math.abs(entry - stop), dirOk: dirOk,
        pctPerUnit: entry ? Math.abs(entry - stop) / entry * 100 : null
      };
    }, [form]);

    function field(label, key, opts) {
      opts = opts || {};
      return h(UI.Field, { label: label, hint: opts.hint },
        h(UI.Input, { type: opts.type || 'number', step: 'any', value: form[key], placeholder: opts.ph, onChange: function (e) { set(key, e.target.value); } }));
    }

    return h('div', { className: 'space-y-5 animate-fade-in max-w-4xl' },
      h(UI.SectionHead, { title: 'Position-Size & Risk Calculator',
        sub: 'Size every trade by the dollars you are willing to lose — never by gut feel.' }),

      h(UI.Card, { className: 'p-5' },
        h('div', { className: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5' },
          h(UI.Field, { label: 'Direction' },
            h(UI.Select, { value: form.side, onChange: function (e) { set('side', e.target.value); } },
              h('option', { value: 'long' }, '▲ Long'), h('option', { value: 'short' }, '▼ Short'))),
          field('Account balance', 'balance'),
          field('Risk per trade', 'riskPct', { hint: '— %' }),
          field('Contract multiplier', 'multiplier', { hint: '— 1 stocks · 50 ES · 20 NQ' }),
          field('Entry price', 'entry'),
          field('Stop price', 'stop'),
          field('Target price', 'target', { hint: '— optional' }))),

      !res ? h(UI.Card, { className: 'p-8 text-center text-slate-400 text-sm' },
        'Enter balance, risk %, entry and stop to calculate your position size.') :
      res.error ? h('div', { className: 'rounded-xl border border-dashed border-loss/40 bg-loss/5 p-4 text-sm text-loss font-semibold' }, '⚠️ ' + res.error) :
      h('div', { className: 'space-y-4' },
        !res.dirOk ? h('div', { className: 'rounded-xl border border-warn/40 bg-warn/5 px-4 py-3 text-sm' },
          h('span', { className: 'mr-1' }, '⚠️'),
          'For a ', h('strong', null, form.side), ' trade your stop should be ', form.side === 'long' ? 'below' : 'above', ' the entry. Double-check your levels.') : null,

        h('div', { className: 'grid grid-cols-2 lg:grid-cols-4 gap-3' },
          h(Stat, { label: 'Position size', value: Fmt.num(res.size, res.size < 10 ? 2 : 0), color: 'text-brand-400',
            sub: (num(form.multiplier) > 1 ? 'contracts' : 'shares/units') }),
          h(Stat, { label: 'Risk amount', value: Fmt.money(res.riskDollar), color: 'text-loss',
            sub: form.riskPct + '% of ' + Fmt.money(num(form.balance)) }),
          h(Stat, { label: 'Stop distance', value: Fmt.num(res.stopDistance, 2),
            sub: res.pctPerUnit != null ? Fmt.pct(res.pctPerUnit) + ' from entry' : null }),
          h(Stat, { label: 'Position value', value: Fmt.money(res.positionValue),
            sub: res.leverage != null ? Fmt.num(res.leverage, 2) + '× of balance' : null })),

        res.rr != null ? h('div', { className: 'grid grid-cols-2 lg:grid-cols-3 gap-3' },
          h(Stat, { label: 'Reward : Risk', value: Fmt.num(res.rr, 2) + ' : 1', color: res.rr >= 2 ? 'text-profit' : res.rr >= 1 ? '' : 'text-loss',
            sub: res.rr >= 2 ? 'Healthy' : res.rr >= 1 ? 'Acceptable' : 'Skewed against you' }),
          h(Stat, { label: 'Profit at target', value: Fmt.money(res.targetPnl, { plus: true }), color: 'text-profit' }),
          h(Stat, { label: 'Loss at stop', value: '-' + Fmt.money(res.riskDollar), color: 'text-loss' })) : null,

        h('div', { className: 'rounded-xl bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-ink-700 p-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed' },
          h('strong', { className: 'text-slate-700 dark:text-slate-200' }, 'How it works: '),
          'Position size = (Balance × Risk %) ÷ (|Entry − Stop| × Multiplier). ',
          'Risk a fixed small % (most pros use 0.5–2%) so no single trade can blow up your account. ',
          'A reward:risk of 2:1 or better lets you stay profitable even below a 50% win rate.')
      )
    );
  }

  window.Views = window.Views || {};
  window.Views.Calculator = Calculator;
})();
