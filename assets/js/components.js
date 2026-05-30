/* ============================================================
   components.js — polished UI primitives (window.UI)
   TradeZella-quality design: proper depth, hover states, badges
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

  /* ---------- currency hook ---------- */
  window.useCurrency = function () {
    var c = useState(window.Currency.get().code);
    useEffect(function () {
      return window.Currency.subscribe(function () {
        c[1](window.Currency.get().code + ':' + window.Currency.get().rate);
      });
    }, []);
    return c[0];
  };

  /* ---------- Card ---------- */
  function Card(props) {
    return h('div', {
      className: window.cx('card-base', props.className),
      style: props.style,
      onClick: props.onClick
    }, props.children);
  }

  /* ---------- Button ---------- */
  function Button(props) {
    var variant = props.variant || 'ghost';
    var vmap = {
      primary:      'tz-btn tz-btn-primary',
      ghost:        'tz-btn tz-btn-ghost',
      danger:       'tz-btn tz-btn-danger',
      dangerGhost:  'tz-btn tz-btn-danger-ghost'
    };
    var size = props.size === 'sm' ? ' tz-btn-sm' : '';
    return h('button', {
      type: props.type || 'button',
      onClick: props.onClick,
      disabled: props.disabled,
      title: props.title,
      className: window.cx((vmap[variant] || vmap.ghost) + size, props.className)
    }, props.children);
  }

  /* ---------- Pill / Chip ---------- */
  function Pill(props) {
    return h('span', {
      className: window.cx('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-ink-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-ink-600', props.className)
    }, props.children);
  }

  /* ---------- Direction / Result badges (use CSS classes) ---------- */
  function SideBadge(props) {
    var cls = props.side === 'short' ? 'badge badge-short' : 'badge badge-long';
    return h('span', { className: cls }, props.side === 'short' ? '▼ Short' : '▲ Long');
  }
  function ResultBadge(props) {
    var r = props.result;
    var cls = r === 'win' ? 'badge badge-win' : r === 'loss' ? 'badge badge-loss' : 'badge badge-be';
    return h('span', { className: cls }, r === 'win' ? 'Win' : r === 'loss' ? 'Loss' : 'B/E');
  }
  function Chip(props) {
    var cls = props.mistake
      ? 'badge badge-loss'
      : 'badge badge-be';
    return h('span', { className: window.cx(cls, 'mr-1 mb-0.5') }, props.children);
  }

  /* ---------- StatCard — TradeZella style ---------- */
  function StatCard(props) {
    return h(Card, { className: window.cx('p-5 flex flex-col gap-2', props.className) },
      h('div', { className: 'flex items-start justify-between gap-2' },
        h('div', { className: 'flex flex-col gap-1.5 flex-1 min-w-0' },
          h('div', { className: 'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500' },
            props.label,
            props.hint ? h('span', { title: props.hint, className: 'cursor-help opacity-70 normal-case tracking-normal' }, 'ⓘ') : null),
          h('div', { className: window.cx('stat-value', props.color || '') }, props.value),
          props.sub ? h('div', { className: window.cx('text-xs', props.subColor || 'text-slate-400 dark:text-slate-500') }, props.sub) : null),
        props.right ? h('div', { className: 'shrink-0' }, props.right) : null),
      props.barPct != null
        ? h('div', { className: 'h-1.5 rounded-full bg-slate-100 dark:bg-ink-700 overflow-hidden' },
            h('div', { className: 'h-full rounded-full trans', style: { width: Math.max(0, Math.min(100, props.barPct)) + '%', background: props.barColor || '#7c5cff' } }))
        : null
    );
  }

  /* ---------- Progress bar ---------- */
  function Progress(props) {
    return h('div', { className: 'h-2 rounded-full bg-slate-100 dark:bg-ink-700 overflow-hidden' },
      h('div', { className: 'h-full rounded-full trans', style: { width: Math.max(0, Math.min(100, props.value)) + '%', background: props.color || 'linear-gradient(90deg,#7c5cff,#d946b8)' } }));
  }

  /* ---------- Empty state ---------- */
  function Empty(props) {
    return h('div', { className: 'text-center py-20 px-5 rounded-2xl border border-dashed border-slate-200 dark:border-ink-600 bg-white dark:bg-ink-800' },
      h('div', { className: 'text-4xl mb-3 opacity-50' }, props.icon || '🗂️'),
      h('div', { className: 'font-semibold text-slate-700 dark:text-slate-200 text-base mb-1.5' }, props.title),
      props.sub ? h('div', { className: 'text-sm text-slate-400 dark:text-slate-500 max-w-sm mx-auto' }, props.sub) : null,
      props.action ? h('div', { className: 'mt-5 flex justify-center' }, props.action) : null
    );
  }

  /* ---------- Section head ---------- */
  function SectionHead(props) {
    return h('div', { className: 'flex items-start justify-between gap-3 flex-wrap mb-5' },
      h('div', null,
        h('h2', { className: 'section-title' }, props.title),
        props.sub ? h('p', { className: 'section-sub' }, props.sub) : null),
      props.right ? h('div', { className: 'flex gap-2 flex-wrap items-center' }, props.right) : null
    );
  }

  /* ---------- Form fields ---------- */
  function Field(props) {
    return h('label', { className: window.cx('flex flex-col gap-1.5', props.full ? 'sm:col-span-2' : '') },
      h('span', { className: 'text-xs font-medium text-slate-500 dark:text-slate-400' },
        props.label,
        props.hint ? h('span', { className: 'text-slate-400 font-normal ml-1' }, props.hint) : null),
      props.children
    );
  }
  function Input(props) {
    var p = Object.assign({}, props);
    delete p.className;
    return h('input', Object.assign({ className: window.cx('tz-input', props.className) }, p));
  }
  function Select(props) {
    var p = Object.assign({}, props);
    delete p.className; delete p.children;
    return h('select', Object.assign({ className: window.cx('tz-input', props.className) }, p), props.children);
  }
  function Textarea(props) {
    var p = Object.assign({}, props);
    delete p.className;
    return h('textarea', Object.assign({ className: window.cx('tz-input resize-y min-h-[80px]', props.className) }, p));
  }

  /* ---------- Tag editor ---------- */
  function TagEditor(props) {
    var value = props.value || [];
    var d = useState('');
    function toggle(tag) {
      var has = value.indexOf(tag) >= 0;
      props.onChange(has ? value.filter(function (x) { return x !== tag; }) : value.concat([tag]));
    }
    function addCustom() {
      var v = d[0].trim();
      if (v && value.indexOf(v) < 0) props.onChange(value.concat([v]));
      d[1]('');
    }
    var pool = (props.suggestions || []).slice();
    value.forEach(function (v) { if (pool.indexOf(v) < 0) pool.push(v); });
    return h('div', null,
      h('div', { className: 'flex flex-wrap gap-1.5 mb-2' },
        pool.map(function (tag) {
          var on = value.indexOf(tag) >= 0;
          return h('button', {
            key: tag, type: 'button', onClick: function () { toggle(tag); },
            className: window.cx('tz-btn tz-btn-sm border trans-colors',
              on ? (props.mistake ? 'badge-loss border-transparent' : 'badge-brand border-transparent')
                 : 'tz-btn-ghost')
          }, (on ? '✓ ' : '') + tag);
        })),
      h('div', { className: 'flex gap-2' },
        h(Input, { value: d[0], placeholder: props.placeholder || 'Add custom…', onChange: function (e) { d[1](e.target.value); }, onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } } }),
        h(Button, { variant: 'ghost', size: 'sm', onClick: addCustom }, 'Add'))
    );
  }

  /* ---------- Modal ---------- */
  function Modal(props) {
    useEffect(function () {
      function onKey(e) { if (e.key === 'Escape' && props.onClose) props.onClose(); }
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
      return function () { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    }, []);
    var node = h('div', { className: 'fixed inset-0 z-[100]' },
      h('div', { className: 'absolute inset-0 bg-black/60 backdrop-blur-[3px] animate-fade-in', onClick: props.onClose }),
      h('div', { className: window.cx('relative mx-auto my-[4vh] w-[94vw] animate-scale-in', props.wide ? 'max-w-4xl' : 'max-w-2xl') },
        h('div', { className: 'card-base max-h-[92vh] flex flex-col shadow-card-lg' },
          h('div', { className: 'flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-ink-700' },
            h('h3', { className: 'font-bold text-[15px]' }, props.title),
            h('button', {
              className: 'w-8 h-8 rounded-full grid place-items-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-ink-700 trans text-xl leading-none',
              onClick: props.onClose
            }, '×')),
          h('div', { className: 'p-5 overflow-y-auto flex-1' }, props.children),
          props.footer ? h('div', { className: 'px-5 py-4 border-t border-slate-100 dark:border-ink-700 flex justify-end gap-2.5' }, props.footer) : null
        )));
    return ReactDOM.createPortal(node, document.body);
  }

  /* ---------- Toast host ---------- */
  function ToastHost() {
    var st = useState([]); var list = st[0], set = st[1];
    useEffect(function () {
      return window.Bus.on('toast', function (t) {
        set(function (cur) { return cur.concat([t]); });
        setTimeout(function () { set(function (cur) { return cur.filter(function (x) { return x.id !== t.id; }); }); }, 3000);
      });
    }, []);
    return h('div', { className: 'fixed bottom-5 right-5 z-[200] flex flex-col gap-2' },
      list.map(function (t) {
        var accent = t.kind === 'ok' ? 'border-l-profit' : t.kind === 'err' ? 'border-l-loss' : 'border-l-brand';
        return h('div', {
          key: t.id,
          className: window.cx('bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 border-l-4 rounded-xl shadow-card-lg px-4 py-3 text-[13px] font-medium min-w-[220px] max-w-xs animate-slide-in', accent)
        }, t.message);
      }));
  }

  /* ---------- Divider ---------- */
  function Divider() { return h('hr', { className: 'divider my-1' }); }

  /* ---------- Skeleton ---------- */
  function Skel(props) {
    return h('div', { className: window.cx('skeleton', props.className), style: props.style });
  }

  window.UI = {
    Card, Button, Pill, SideBadge, ResultBadge, Chip,
    StatCard, Progress, Empty, SectionHead,
    Field, Input, Select, Textarea, TagEditor,
    Modal, ToastHost, Divider, Skel
  };
})();
