/* ============================================================
   components.js — shared UI primitives (window.UI) + window.useTheme
   ============================================================ */
(function () {
  'use strict';
  var h = window.h;
  var useState = React.useState, useEffect = React.useEffect;

  /* ---------- theme hook ---------- */
  window.useTheme = function () {
    var t = useState(window.Theme.get());
    useEffect(function () { return window.Theme.subscribe(function (nv) { t[1](nv); }); }, []);
    return t[0];
  };

  /* shared class fragments */
  var CARD = 'bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl';
  var INPUT = 'w-full bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-ink-600 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition';

  function Card(props) {
    return h('div', { className: window.cx(CARD, props.className), style: props.style }, props.children);
  }

  function Button(props) {
    var variant = props.variant || 'default';
    var map = {
      primary: 'bg-gradient-to-br from-brand to-brand-600 text-white shadow-glow hover:brightness-110',
      default: 'bg-slate-100 dark:bg-ink-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-ink-600',
      ghost: 'bg-transparent border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-ink-700',
      danger: 'bg-loss text-white hover:brightness-110',
      dangerGhost: 'bg-transparent border border-loss/40 text-loss hover:bg-loss/10'
    };
    var size = props.size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-[13px]';
    return h('button', {
      type: props.type || 'button', onClick: props.onClick, disabled: props.disabled, title: props.title,
      className: window.cx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed', map[variant], size, props.className)
    }, props.children);
  }

  function Pill(props) {
    return h('span', { className: window.cx('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-ink-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-ink-600', props.className) }, props.children);
  }

  function SideBadge(props) {
    var short = props.side === 'short';
    return h('span', { className: window.cx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold', short ? 'bg-loss/15 text-loss' : 'bg-profit/15 text-profit') }, short ? '▼ Short' : '▲ Long');
  }
  function ResultBadge(props) {
    var r = props.result;
    var cls = r === 'win' ? 'bg-profit/15 text-profit' : r === 'loss' ? 'bg-loss/15 text-loss' : 'bg-slate-100 dark:bg-ink-700 text-slate-400';
    return h('span', { className: window.cx('inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold', cls) }, r === 'win' ? 'Win' : r === 'loss' ? 'Loss' : 'B/E');
  }
  function Chip(props) {
    return h('span', { className: window.cx('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border mr-1.5 mb-1', props.mistake ? 'bg-loss/10 text-loss border-loss/30' : 'bg-slate-100 dark:bg-ink-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-ink-600') }, props.children);
  }

  function StatCard(props) {
    return h(Card, { className: 'p-4' },
      h('div', { className: 'flex flex-col gap-1.5' },
        h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-400 font-semibold flex items-center gap-1.5' }, props.label,
          props.hint ? h('span', { title: props.hint, className: 'cursor-help opacity-60' }, 'ⓘ') : null),
        h('div', { className: window.cx('text-2xl font-extrabold tracking-tight', props.color) }, props.value),
        props.sub ? h('div', { className: window.cx('text-xs', props.subColor || 'text-slate-400') }, props.sub) : null,
        props.barPct != null ? h('div', { className: 'h-1.5 rounded bg-slate-100 dark:bg-ink-700 overflow-hidden mt-1' },
          h('div', { className: 'h-full rounded', style: { width: Math.max(0, Math.min(100, props.barPct)) + '%', background: props.barColor || '#7c5cff' } })) : null
      )
    );
  }

  function Progress(props) {
    return h('div', { className: 'h-2 rounded-full bg-slate-100 dark:bg-ink-700 overflow-hidden' },
      h('div', { className: 'h-full rounded-full', style: { width: Math.max(0, Math.min(100, props.value)) + '%', background: props.color || 'linear-gradient(90deg,#7c5cff,#e15cc8)' } }));
  }

  function Empty(props) {
    return h('div', { className: 'text-center py-16 px-5 rounded-2xl border border-dashed border-slate-300 dark:border-ink-500 bg-white dark:bg-ink-800 text-slate-500 dark:text-slate-400' },
      h('div', { className: 'text-4xl mb-2 opacity-60' }, props.icon || '🗂️'),
      h('div', { className: 'font-semibold text-slate-700 dark:text-slate-200 mb-1' }, props.title),
      props.sub ? h('div', { className: 'text-sm' }, props.sub) : null,
      props.action ? h('div', { className: 'mt-4 flex justify-center' }, props.action) : null
    );
  }

  function SectionHead(props) {
    return h('div', { className: 'flex items-start justify-between gap-3 flex-wrap mb-4' },
      h('div', null,
        h('h2', { className: 'text-lg font-bold' }, props.title),
        props.sub ? h('p', { className: 'text-sm text-slate-500 dark:text-slate-400 mt-0.5' }, props.sub) : null),
      props.right ? h('div', { className: 'flex gap-2 flex-wrap' }, props.right) : null
    );
  }

  /* ---------- Field ---------- */
  function Field(props) {
    return h('label', { className: window.cx('flex flex-col gap-1.5', props.full ? 'sm:col-span-2' : '') },
      h('span', { className: 'text-xs text-slate-500 dark:text-slate-400 font-medium' }, props.label,
        props.hint ? h('span', { className: 'text-slate-400 ml-1' }, props.hint) : null),
      props.children);
  }
  function Input(props) {
    var p = Object.assign({}, props); delete p.className;
    return h('input', Object.assign({ className: window.cx(INPUT, props.className) }, p));
  }
  function Select(props) {
    var p = Object.assign({}, props); delete p.className; delete p.children;
    return h('select', Object.assign({ className: window.cx(INPUT, props.className) }, p), props.children);
  }
  function Textarea(props) {
    var p = Object.assign({}, props); delete p.className;
    return h('textarea', Object.assign({ className: window.cx(INPUT, 'min-h-[80px] resize-y', props.className) }, p));
  }

  /* ---------- Tag editor (used for tags & mistakes) ---------- */
  function TagEditor(props) {
    var value = props.value || [];
    var d = useState('');
    function toggle(tag) {
      var has = value.indexOf(tag) >= 0;
      props.onChange(has ? value.filter(function (x) { return x !== tag; }) : value.concat([tag]));
    }
    function addCustom() {
      var v = d[0].trim(); if (v && value.indexOf(v) < 0) props.onChange(value.concat([v]));
      d[1]('');
    }
    var pool = (props.suggestions || []).slice();
    value.forEach(function (v) { if (pool.indexOf(v) < 0) pool.push(v); });
    return h('div', null,
      h('div', { className: 'flex flex-wrap gap-1.5 mb-2' },
        pool.map(function (tag) {
          var on = value.indexOf(tag) >= 0;
          return h('button', { key: tag, type: 'button', onClick: function () { toggle(tag); },
            className: window.cx('px-2 py-1 rounded-md text-[11px] border transition',
              on ? (props.mistake ? 'bg-loss/15 text-loss border-loss/40' : 'bg-brand/15 text-brand-400 border-brand/40')
                 : 'bg-slate-100 dark:bg-ink-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-ink-600 hover:border-brand/40') },
            (on ? '✓ ' : '') + tag);
        })),
      h('div', { className: 'flex gap-2' },
        h(Input, { value: d[0], placeholder: props.placeholder || 'Add custom…', onChange: function (e) { d[1](e.target.value); },
          onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } } }),
        h(Button, { variant: 'ghost', size: 'sm', onClick: addCustom }, 'Add'))
    );
  }

  /* ---------- Modal (portal) ---------- */
  function Modal(props) {
    useEffect(function () {
      function onKey(e) { if (e.key === 'Escape') props.onClose && props.onClose(); }
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
      return function () { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    }, []);
    var node = h('div', { className: 'fixed inset-0 z-[100]' },
      h('div', { className: 'absolute inset-0 bg-black/55 backdrop-blur-sm animate-fade-in', onClick: props.onClose }),
      h('div', { className: window.cx('relative mx-auto my-[5vh] w-[94vw] animate-scale-in', props.wide ? 'max-w-4xl' : 'max-w-2xl') },
        h('div', { className: 'bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-500 rounded-2xl shadow-card max-h-[90vh] flex flex-col' },
          h('div', { className: 'flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-ink-600' },
            h('h3', { className: 'font-bold text-base' }, props.title),
            h('button', { className: 'text-slate-400 hover:text-slate-700 dark:hover:text-white text-2xl leading-none', onClick: props.onClose }, '×')),
          h('div', { className: 'p-5 overflow-y-auto' }, props.children),
          props.footer ? h('div', { className: 'px-5 py-4 border-t border-slate-200 dark:border-ink-600 flex justify-end gap-2.5' }, props.footer) : null
        )));
    return ReactDOM.createPortal(node, document.body);
  }

  /* ---------- Toast host ---------- */
  function ToastHost() {
    var st = useState([]); var list = st[0], set = st[1];
    useEffect(function () {
      return window.Bus.on('toast', function (t) {
        set(function (cur) { return cur.concat([t]); });
        setTimeout(function () { set(function (cur) { return cur.filter(function (x) { return x.id !== t.id; }); }); }, 2800);
      });
    }, []);
    return h('div', { className: 'fixed bottom-5 right-5 z-[200] flex flex-col gap-2.5' },
      list.map(function (t) {
        var border = t.kind === 'ok' ? 'border-l-profit' : t.kind === 'err' ? 'border-l-loss' : 'border-l-brand';
        return h('div', { key: t.id, className: window.cx('bg-white dark:bg-ink-700 border border-slate-200 dark:border-ink-500 border-l-4 rounded-xl shadow-card px-4 py-3 text-sm min-w-[220px] animate-fade-in', border) }, t.message);
      }));
  }

  window.UI = {
    Card: Card, Button: Button, Pill: Pill, SideBadge: SideBadge, ResultBadge: ResultBadge, Chip: Chip,
    StatCard: StatCard, Progress: Progress, Empty: Empty, SectionHead: SectionHead,
    Field: Field, Input: Input, Select: Select, Textarea: Textarea, TagEditor: TagEditor,
    Modal: Modal, ToastHost: ToastHost
  };
})();
