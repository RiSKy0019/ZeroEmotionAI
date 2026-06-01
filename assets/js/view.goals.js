/* ============================================================
   view.goals.js — Goals & Targets (Views.Goals)
   Set monthly profit / win-rate goals and risk guardrails
   (max daily loss, max trades/day, max risk per trade).
   Persisted in Store settings; powers the dashboard guardrail.
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, C = window.Store.calc, Store = window.Store;
  var useMemo = React.useMemo;

  var DEFAULTS = { monthlyTarget: '', winRateGoal: '', maxDailyLoss: '', maxTradesPerDay: '', maxRiskPerTrade: '' };

  function getGoals() { return Object.assign({}, DEFAULTS, (Store.getSettings().goals || {})); }

  function todayISO() { return Fmt.todayISO(); }
  function monthKey(d) { return d.slice(0, 7); }

  function ProgressRow(props) {
    var pct = props.pct == null ? null : Math.max(0, Math.min(100, props.pct));
    var color = props.color || (pct != null && pct >= 100 ? '#0ecb81' : '#7c5cff');
    return h('div', { className: 'py-3 border-b border-slate-100 dark:border-ink-700 last:border-0' },
      h('div', { className: 'flex items-center justify-between mb-1.5' },
        h('div', { className: 'text-sm font-semibold' }, props.label),
        h('div', { className: window.cx('text-sm font-bold tabular-nums', props.valueColor || '') }, props.value)),
      pct != null ? h(UI.Progress, { value: pct, color: color }) : h('div', { className: 'text-xs text-slate-400' }, props.hint || 'Set a target to track progress'),
      props.note ? h('div', { className: 'text-[11px] text-slate-400 mt-1' }, props.note) : null);
  }

  function Goals(props) {
    var state = props.state || Store.getState();
    var ctx = props.ctx || { accountId: 'all', range: 'all' };
    var goals = getGoals();

    function setGoal(k, v) { var o = {}; o[k] = v; Store.setSetting('goals', Object.assign({}, goals, o)); }
    function n(v) { var x = parseFloat(v); return isFinite(x) ? x : null; }

    var trades = useMemo(function () { return Store.getTrades({ accountId: ctx.accountId, range: 'all' }); }, [state, ctx.accountId]);

    var now = new Date();
    var curMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    var monthTrades = trades.filter(function (t) { return monthKey(t.date) === curMonth; });
    var ms = C.stats(monthTrades);
    var today = todayISO();
    var todayTrades = trades.filter(function (t) { return t.date === today; });
    var todayPnl = C.stats(todayTrades).netPnl;

    var tgt = n(goals.monthlyTarget), wr = n(goals.winRateGoal),
        mdl = n(goals.maxDailyLoss), mtd = n(goals.maxTradesPerDay);

    function field(label, key, hint) {
      return h(UI.Field, { label: label, hint: hint },
        h(UI.Input, { type: 'number', step: 'any', value: goals[key], placeholder: '—', onChange: function (e) { setGoal(key, e.target.value); } }));
    }

    return h('div', { className: 'space-y-5 animate-fade-in max-w-4xl' },
      h(UI.SectionHead, { title: 'Goals & Targets',
        sub: 'Define what good looks like, then let the guardrails keep you honest.' }),

      /* ── inputs ── */
      h(UI.Card, { className: 'p-5' },
        h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-3' }, 'Your targets & limits'),
        h('div', { className: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5' },
          field('Monthly profit goal', 'monthlyTarget', '— $'),
          field('Win-rate goal', 'winRateGoal', '— %'),
          field('Max daily loss', 'maxDailyLoss', '— $'),
          field('Max trades / day', 'maxTradesPerDay', '— #'),
          field('Max risk / trade', 'maxRiskPerTrade', '— %')),
        h('p', { className: 'text-[11px] text-slate-400 mt-3' }, 'Saved automatically. Limits drive the warning banner on your Dashboard.')),

      /* ── this month progress ── */
      h(UI.Card, { className: 'p-5' },
        h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1' }, 'This month — ' + now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })),
        h('div', null,
          h(ProgressRow, {
            label: 'Monthly profit goal',
            value: Fmt.money(ms.netPnl, { plus: true }) + (tgt != null ? ' / ' + Fmt.money(tgt) : ''),
            valueColor: ms.netPnl >= 0 ? 'text-profit' : 'text-loss',
            pct: tgt != null && tgt > 0 ? ms.netPnl / tgt * 100 : null,
            note: tgt != null && tgt > 0 ? (ms.netPnl >= tgt ? '🎉 Goal reached!' : Fmt.money(Math.max(0, tgt - ms.netPnl)) + ' to go') : null
          }),
          h(ProgressRow, {
            label: 'Win-rate goal',
            value: Fmt.pct(ms.winRate) + (wr != null ? ' / ' + Fmt.pct(wr) : ''),
            valueColor: wr != null ? (ms.winRate >= wr ? 'text-profit' : 'text-loss') : '',
            pct: wr != null && wr > 0 ? ms.winRate / wr * 100 : null
          }),
          h(ProgressRow, {
            label: 'Trades this month', value: String(ms.total),
            pct: null, hint: ms.total + ' trades logged in ' + now.toLocaleDateString('en-US', { month: 'long' })
          }))),

      /* ── today's guardrails ── */
      h(UI.Card, { className: 'p-5' },
        h('p', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1' }, 'Today\u2019s guardrails'),
        h('div', null,
          h(ProgressRow, {
            label: 'Daily loss limit',
            value: Fmt.money(todayPnl, { plus: true }) + (mdl != null ? ' / -' + Fmt.money(mdl) : ''),
            valueColor: todayPnl < 0 ? 'text-loss' : 'text-profit',
            pct: mdl != null && mdl > 0 ? (todayPnl < 0 ? Math.abs(todayPnl) / mdl * 100 : 0) : null,
            color: '#f6465d',
            note: mdl != null && mdl > 0 && todayPnl <= -mdl ? '🛑 You have hit your daily loss limit — consider stopping for the day.' : null
          }),
          h(ProgressRow, {
            label: 'Trades today',
            value: todayTrades.length + (mtd != null ? ' / ' + mtd : ''),
            pct: mtd != null && mtd > 0 ? todayTrades.length / mtd * 100 : null,
            note: mtd != null && mtd > 0 && todayTrades.length >= mtd ? '🛑 Max trades for the day reached.' : null
          })))
    );
  }

  // Shared helper for the dashboard banner: returns breach info or null
  window.evaluateGuardrails = function (trades) {
    var goals = getGoals();
    var mdl = parseFloat(goals.maxDailyLoss), mtd = parseFloat(goals.maxTradesPerDay);
    var today = todayISO();
    var todayTrades = trades.filter(function (t) { return t.date === today; });
    var todayPnl = C.stats(todayTrades).netPnl;
    var breaches = [];
    if (isFinite(mdl) && mdl > 0 && todayPnl <= -mdl)
      breaches.push('Daily loss limit hit (' + Fmt.money(todayPnl, { plus: true }) + ' vs -' + Fmt.money(mdl) + ')');
    if (isFinite(mtd) && mtd > 0 && todayTrades.length >= mtd)
      breaches.push('Max trades/day reached (' + todayTrades.length + '/' + mtd + ')');
    return breaches.length ? breaches : null;
  };

  window.Views = window.Views || {};
  window.Views.Goals = Goals;
})();
