/* ============================================================
   view.notebook.js — Notebook screen (window.Views.Notebook)
   Multi-note, typed templates, multi-section rich editor,
   trade-linking, screenshot attachments, tags, full-text search.
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt, Store = window.Store;
  var useState = React.useState, useMemo = React.useMemo, useRef = React.useRef, useEffect = React.useEffect;

  /* ---- constants ---- */
  var NOTE_TYPES = [
    { key: 'daily',      label: 'Daily Plan',      icon: '📅', color: 'text-brand-400',    bg: 'bg-brand/10 border-brand/30' },
    { key: 'weekly',     label: 'Weekly Review',   icon: '📆', color: 'text-profit',        bg: 'bg-profit/10 border-profit/30' },
    { key: 'trade-note', label: 'Trade Analysis',  icon: '📊', color: 'text-amber',         bg: 'bg-amber/10 border-amber/30',  style: { color: '#f0a32a' } },
    { key: 'general',    label: 'General Note',    icon: '📝', color: 'text-slate-400',     bg: 'bg-slate-100 dark:bg-ink-700 border-slate-200 dark:border-ink-600' }
  ];
  var TEMPLATES = {
    daily: [
      { heading: 'Market bias',     body: '' },
      { heading: 'Setups to watch', body: '' },
      { heading: 'Rules for today', body: '' },
      { heading: 'Mental state',    body: '' }
    ],
    weekly: [
      { heading: 'What went well',        body: '' },
      { heading: 'What went wrong',       body: '' },
      { heading: 'Key lesson',            body: '' },
      { heading: 'Focus for next week',   body: '' }
    ],
    'trade-note': [
      { heading: 'Setup',            body: '' },
      { heading: 'Entry & management', body: '' },
      { heading: 'What I did right', body: '' },
      { heading: 'What to improve',  body: '' }
    ],
    general: [
      { heading: 'Notes', body: '' }
    ]
  };
  var TYPE_MAP = {};
  NOTE_TYPES.forEach(function (t) { TYPE_MAP[t.key] = t; });

  function todayISO() { return Fmt.todayISO(); }
  function nowISO() { return new Date().toISOString(); }

  /* ---- helpers ---- */
  function noteSnippet(note) {
    for (var i = 0; i < (note.sections || []).length; i++) {
      var b = String(note.sections[i].body || '').trim();
      if (b) return b.slice(0, 120) + (b.length > 120 ? '…' : '');
    }
    return '';
  }
  function fullText(note) {
    return [note.title, note.type, (note.tags || []).join(' ')].concat((note.sections || []).map(function (s) { return s.heading + ' ' + s.body; })).join(' ').toLowerCase();
  }
  function resizeImage(file, maxDim) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          var w = Math.round(img.width * scale), hh = Math.round(img.height * scale);
          var canvas = document.createElement('canvas'); canvas.width = w; canvas.height = hh;
          canvas.getContext('2d').drawImage(img, 0, 0, w, hh);
          try { resolve(canvas.toDataURL('image/jpeg', 0.82)); } catch (e) { resolve(reader.result); }
        };
        img.onerror = function () { resolve(reader.result); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ================================================================
     MAIN NOTEBOOK VIEW
     ================================================================ */
  function Notebook(props) {
    var state = props.state;
    var selId = useState(null);         // selected note id
    var searchQ = useState('');
    var filterType = useState('all');
    var showNew = useState(false);

    var notes = useMemo(function () {
      return (state.notes || []).slice().sort(function (a, b) {
        return new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date);
      });
    }, [state.notes]);

    var filtered = useMemo(function () {
      var q = searchQ[0].trim().toLowerCase();
      return notes.filter(function (n) {
        if (filterType[0] !== 'all' && n.type !== filterType[0]) return false;
        if (q) return fullText(n).indexOf(q) >= 0;
        return true;
      });
    }, [notes, searchQ[0], filterType[0]]);

    var selected = useMemo(function () {
      if (!selId[0]) return null;
      return (state.notes || []).find(function (n) { return n.id === selId[0]; }) || null;
    }, [state.notes, selId[0]]);

    // auto-select first note when list changes and nothing is selected
    useEffect(function () {
      if (!selId[0] && filtered.length) selId[1](filtered[0].id);
    }, [filtered.length]);

    function createNote(type) {
      var tpl = TEMPLATES[type] || TEMPLATES.general;
      var meta = TYPE_MAP[type] || TYPE_MAP.general;
      var titleDefault = meta.label + ' — ' + Fmt.date(todayISO());
      var note = Store.add('notes', {
        type: type, title: titleDefault, date: todayISO(),
        tags: [], tradeIds: [], screenshots: [],
        sections: tpl.map(function (s) { return { heading: s.heading, body: s.body }; }),
        createdAt: nowISO(), updatedAt: nowISO()
      });
      selId[1](note.id);
      showNew[1](false);
      window.toast('Note created', 'ok');
    }

    function deleteNote(id) {
      if (!window.confirm('Delete this note? This cannot be undone.')) return;
      Store.remove('notes', id);
      if (selId[0] === id) selId[1](filtered.find(function (n) { return n.id !== id; }) ? filtered.find(function (n) { return n.id !== id; }).id : null);
      window.toast('Note deleted', 'ok');
    }

    return h('div', { className: 'animate-fade-in flex flex-col gap-0' },
      // ---- header bar ----
      h('div', { className: 'flex items-center justify-between flex-wrap gap-2 mb-4' },
        h('div', null,
          h('h2', { className: 'text-lg font-bold' }, 'Notebook'),
          h('p', { className: 'text-sm text-slate-500 dark:text-slate-400 mt-0.5' }, 'Daily plans, weekly reviews, trade notes and anything you want to remember.')),
        h('div', { className: 'relative' },
          h(UI.Button, { variant: 'primary', onClick: function () { showNew[1](!showNew[0]); } }, '+ New note'),
          showNew[0] ? h('div', { className: 'absolute right-0 top-full mt-1 z-30 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-xl shadow-card overflow-hidden w-52' },
            NOTE_TYPES.map(function (t) {
              return h('button', { key: t.key, onClick: function () { createNote(t.key); },
                className: 'flex items-center gap-2.5 px-4 py-3 w-full text-sm text-left hover:bg-slate-50 dark:hover:bg-ink-700 transition border-b border-slate-100 dark:border-ink-600 last:border-0' },
                h('span', { className: 'text-base' }, t.icon), t.label);
            })) : null)),

      // ---- two-panel layout ----
      h('div', { className: 'flex gap-4 min-h-[600px]' },
        // left: list panel
        h('div', { className: 'w-72 shrink-0 flex flex-col gap-2' },
          // search + filter
          h(UI.Input, { className: 'text-sm', placeholder: '🔎 Search notes…', value: searchQ[0], onChange: function (e) { searchQ[1](e.target.value); } }),
          h('div', { className: 'flex gap-1.5 flex-wrap' },
            h('button', { onClick: function () { filterType[1]('all'); },
              className: window.cx('px-2.5 py-1 rounded-lg text-xs font-semibold border transition', filterType[0] === 'all' ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-ink-800 border-slate-200 dark:border-ink-600 text-slate-500 dark:text-slate-300') }, 'All'),
            NOTE_TYPES.map(function (t) {
              return h('button', { key: t.key, onClick: function () { filterType[1](t.key); }, title: t.label,
                className: window.cx('px-2.5 py-1 rounded-lg text-xs font-semibold border transition', filterType[0] === t.key ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-ink-800 border-slate-200 dark:border-ink-600 text-slate-500 dark:text-slate-300') },
                t.icon + ' ' + t.label.split(' ')[0]);
            })),
          // note list
          filtered.length === 0
            ? h('div', { className: 'text-center py-10 text-slate-400 text-sm' }, searchQ[0] ? 'No notes match.' : 'No notes yet — create one above.')
            : h('div', { className: 'flex flex-col gap-1.5 overflow-y-auto' },
                filtered.map(function (n) {
                  var meta = TYPE_MAP[n.type] || TYPE_MAP.general;
                  var active = selId[0] === n.id;
                  return h('button', { key: n.id, onClick: function () { selId[1](n.id); },
                    className: window.cx('text-left p-3 rounded-xl border transition w-full',
                      active ? 'bg-brand/15 border-brand/40 ring-1 ring-brand/30' : 'bg-white dark:bg-ink-800 border-slate-200 dark:border-ink-600 hover:border-brand/30') },
                    h('div', { className: 'flex items-start justify-between gap-1' },
                      h('div', { className: 'flex items-center gap-1.5 min-w-0' },
                        h('span', { className: 'text-sm shrink-0' }, meta.icon),
                        h('span', { className: 'font-semibold text-sm truncate' }, n.title)),
                      h('span', { className: 'text-[10px] text-slate-400 shrink-0 mt-0.5' }, Fmt.dateShort(n.date))),
                    h('p', { className: 'text-xs text-slate-400 mt-0.5 truncate' }, noteSnippet(n)),
                    (n.tags || []).length ? h('div', { className: 'flex flex-wrap gap-1 mt-1.5' }, n.tags.map(function (tg) {
                      return h('span', { key: tg, className: 'px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-ink-700 text-slate-400' }, tg);
                    })) : null);
                }))),
        // right: editor
        selected
          ? h(NoteEditor, { key: selected.id, note: selected, onDelete: deleteNote, state: state })
          : h('div', { className: 'flex-1 rounded-2xl border border-dashed border-slate-300 dark:border-ink-500 grid place-items-center text-slate-400 text-sm' }, 'Select a note or create one to get started.')
      )
    );
  }

  /* ================================================================
     NOTE EDITOR
     ================================================================ */
  function NoteEditor(props) {
    var note = props.note;
    var state = props.state;
    var draft = useState({
      title: note.title, date: note.date,
      tags: (note.tags || []).slice(),
      tradeIds: (note.tradeIds || []).slice(),
      sections: (note.sections || []).map(function (s) { return { heading: s.heading, body: s.body }; }),
      screenshots: (note.screenshots || []).slice()
    });
    var d = draft[0], setD = draft[1];
    var saved = useState(true); // false = unsaved changes
    var tagInput = useState('');
    var meta = TYPE_MAP[note.type] || TYPE_MAP.general;

    function set(k, v) { setD(function (cur) { var n = Object.assign({}, cur); n[k] = v; return n; }); saved[1](false); }
    function setSection(i, field, val) {
      setD(function (cur) { var secs = cur.sections.map(function (s, j) { return j === i ? Object.assign({}, s, (field === 'heading' ? { heading: val } : { body: val })) : s; }); return Object.assign({}, cur, { sections: secs }); });
      saved[1](false);
    }
    function addSection() { setD(function (cur) { return Object.assign({}, cur, { sections: cur.sections.concat([{ heading: 'New section', body: '' }]) }); }); saved[1](false); }
    function removeSection(i) { setD(function (cur) { return Object.assign({}, cur, { sections: cur.sections.filter(function (_, j) { return j !== i; }) }); }); saved[1](false); }
    function addTag() {
      var v = tagInput[0].trim(); if (!v || d.tags.indexOf(v) >= 0) { tagInput[1](''); return; }
      set('tags', d.tags.concat([v])); tagInput[1]('');
    }
    function removeTag(t) { set('tags', d.tags.filter(function (x) { return x !== t; })); }

    function onFiles(e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      Promise.all(files.slice(0, 4).map(function (f) { return resizeImage(f, 1200); })).then(function (urls) {
        set('screenshots', (d.screenshots || []).concat(urls).slice(0, 8));
      });
      e.target.value = '';
    }

    function save() {
      Store.update('notes', note.id, {
        title: d.title.trim() || 'Untitled',
        date: d.date, tags: d.tags, tradeIds: d.tradeIds,
        sections: d.sections, screenshots: d.screenshots,
        updatedAt: nowISO()
      });
      saved[1](true);
      window.toast('Note saved', 'ok');
    }
    function autoSave() { if (!saved[0]) save(); }

    // auto-save on blur from any field
    return h('div', { className: 'flex-1 bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 rounded-2xl flex flex-col overflow-hidden' },
      // note toolbar
      h('div', { className: 'flex items-center justify-between gap-2 px-5 py-3 border-b border-slate-200 dark:border-ink-600 flex-wrap' },
        h('div', { className: 'flex items-center gap-2' },
          h('span', { className: window.cx('text-xs px-2 py-1 rounded-lg border font-medium', meta.bg) }, meta.icon + ' ' + meta.label),
          !saved[0] ? h('span', { className: 'text-xs text-slate-400 italic' }, 'Unsaved changes') : null),
        h('div', { className: 'flex gap-2' },
          h(UI.Button, { variant: 'primary', size: 'sm', onClick: save }, saved[0] ? '✓ Saved' : 'Save'),
          h(UI.Button, { variant: 'dangerGhost', size: 'sm', onClick: function () { props.onDelete(note.id); } }, 'Delete'))),
      // scrollable content
      h('div', { className: 'flex-1 overflow-y-auto p-5 space-y-5' },
        // title + date row
        h('div', { className: 'flex gap-3 flex-wrap' },
          h('input', { className: 'flex-1 text-xl font-bold bg-transparent outline-none border-b-2 border-transparent focus:border-brand pb-1 text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 min-w-[180px]',
            value: d.title, placeholder: 'Note title…',
            onChange: function (e) { set('title', e.target.value); }, onBlur: autoSave }),
          h('input', { type: 'date', className: 'text-sm bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-ink-600 rounded-lg px-2 py-1 outline-none focus:border-brand',
            value: d.date, onChange: function (e) { set('date', e.target.value); }, onBlur: autoSave })),
        // tags
        h('div', null,
          h('div', { className: 'text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2' }, 'Tags'),
          h('div', { className: 'flex flex-wrap gap-1.5 mb-2' },
            d.tags.map(function (t) {
              return h('span', { key: t, className: 'flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-brand/15 text-brand-400 border border-brand/30' },
                t, h('button', { onClick: function () { removeTag(t); }, className: 'opacity-60 hover:opacity-100 font-bold' }, '×'));
            }),
            h('div', { className: 'flex items-center gap-1.5' },
              h('input', { className: 'text-xs bg-slate-50 dark:bg-ink-900 border border-slate-200 dark:border-ink-600 rounded-lg px-2 py-1 outline-none focus:border-brand w-28',
                value: tagInput[0], placeholder: 'Add tag…',
                onChange: function (e) { tagInput[1](e.target.value); },
                onKeyDown: function (e) { if (e.key === 'Enter') { e.preventDefault(); addTag(); } } }),
              h('button', { onClick: addTag, className: 'text-xs text-brand-400 hover:underline' }, 'Add')))),
        // trade links
        h(TradeLinker, { tradeIds: d.tradeIds, state: state, onSave: function (ids) { set('tradeIds', ids); }, noteDate: d.date }),
        // sections
        h('div', { className: 'space-y-4' },
          d.sections.map(function (sec, i) {
            return h('div', { key: i, className: 'rounded-xl border border-slate-200 dark:border-ink-600 overflow-hidden' },
              h('div', { className: 'flex items-center justify-between bg-slate-50 dark:bg-ink-750 px-3 py-2 gap-2' },
                h('input', { className: 'font-semibold text-sm bg-transparent outline-none flex-1 text-slate-700 dark:text-slate-200',
                  value: sec.heading, placeholder: 'Section heading',
                  onChange: function (e) { setSection(i, 'heading', e.target.value); }, onBlur: autoSave }),
                h('button', { onClick: function () { removeSection(i); }, className: 'text-slate-300 dark:text-slate-600 hover:text-loss text-lg leading-none', title: 'Remove section' }, '×')),
              h('textarea', { className: 'w-full px-3 py-2.5 text-sm bg-white dark:bg-ink-800 outline-none resize-none text-slate-700 dark:text-slate-300 placeholder-slate-300 dark:placeholder-slate-600 min-h-[100px]',
                value: sec.body, placeholder: 'Write here…',
                onChange: function (e) { setSection(i, 'body', e.target.value); }, onBlur: autoSave }));
          }),
          h('button', { onClick: addSection, className: 'flex items-center gap-2 text-sm text-brand-400 hover:text-brand font-medium px-2 py-1 rounded-lg hover:bg-brand/10 transition' },
            h('span', { className: 'text-lg leading-none' }, '+'), 'Add section')),
        // screenshots
        h('div', null,
          h('div', { className: 'text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2' }, 'Screenshots'),
          (d.screenshots && d.screenshots.length) ? h('div', { className: 'grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2' },
            d.screenshots.map(function (src, i) {
              return h('div', { key: i, className: 'relative group cursor-pointer', onClick: function () { window.open(src); } },
                h('img', { src: src, className: 'w-full h-28 object-cover rounded-lg border border-slate-200 dark:border-ink-600' }),
                h('button', { type: 'button', onClick: function (e) { e.stopPropagation(); set('screenshots', d.screenshots.filter(function (_, j) { return j !== i; })); },
                  className: 'absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full w-5 h-5 text-xs grid place-items-center opacity-0 group-hover:opacity-100 transition' }, '×'));
            })) : null,
          h('label', { className: 'inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand font-medium cursor-pointer px-2 py-1 rounded-lg hover:bg-brand/10 transition' },
            h('span', null, '📎 Attach screenshot'),
            h('input', { type: 'file', accept: 'image/*', multiple: true, onChange: onFiles, className: 'hidden' }))))
    );
  }

  /* ---- Trade Linker widget ---- */
  function TradeLinker(props) {
    var tradeIds = props.tradeIds || [];
    var state = props.state;
    var open = useState(false);
    var nearby = useMemo(function () {
      var d = props.noteDate;
      return (state.trades || []).filter(function (t) {
        if (!d) return false;
        var diff = Math.abs(new Date(t.date + 'T00:00:00') - new Date(d + 'T00:00:00')) / 86400000;
        return diff <= 3;
      }).sort(function (a, b) { return Store.calc.timeKey(b) - Store.calc.timeKey(a); }).slice(0, 20);
    }, [state.trades, props.noteDate]);

    var linked = (state.trades || []).filter(function (t) { return tradeIds.indexOf(t.id) >= 0; });

    function toggle(id) {
      var next = tradeIds.indexOf(id) >= 0 ? tradeIds.filter(function (x) { return x !== id; }) : tradeIds.concat([id]);
      props.onSave(next);
    }

    return h('div', null,
      h('div', { className: 'flex items-center justify-between mb-1.5' },
        h('div', { className: 'text-xs uppercase tracking-wide text-slate-400 font-semibold' }, 'Linked trades'),
        h('button', { onClick: function () { open[1](!open[0]); }, className: 'text-xs text-brand-400 hover:underline' }, open[0] ? 'Close' : '+ Link trades')),
      linked.length ? h('div', { className: 'flex flex-wrap gap-1.5 mb-2' },
        linked.map(function (t) {
          var p = Store.calc.pnlOf(t);
          return h('span', { key: t.id, onClick: function () { toggle(t.id); }, title: 'Click to unlink',
            className: 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-brand/30 bg-brand/10 text-xs font-semibold cursor-pointer hover:bg-loss/10 hover:border-loss/30 transition' },
            t.symbol, Fmt.dateShort(t.date),
            h('span', { className: window.cx(Fmt.signColor(p)) }, Fmt.money(p, { plus: true })),
            h('span', { className: 'opacity-50 font-normal ml-0.5' }, '×'));
        })) : null,
      open[0] ? h('div', { className: 'rounded-xl border border-slate-200 dark:border-ink-600 overflow-hidden' },
        h('div', { className: 'text-[11px] text-slate-400 px-3 py-2 bg-slate-50 dark:bg-ink-750 border-b border-slate-200 dark:border-ink-600' }, 'Trades within ±3 days of note date'),
        nearby.length === 0
          ? h('div', { className: 'text-sm text-slate-400 p-3' }, 'No trades found within ±3 days.')
          : h('div', { className: 'divide-y divide-slate-100 dark:divide-ink-700 max-h-52 overflow-y-auto' },
              nearby.map(function (t) {
                var linked2 = tradeIds.indexOf(t.id) >= 0;
                var p = Store.calc.pnlOf(t);
                return h('button', { key: t.id, onClick: function () { toggle(t.id); },
                  className: window.cx('flex items-center justify-between gap-2 px-3 py-2 w-full text-left text-sm hover:bg-slate-50 dark:hover:bg-ink-700 transition', linked2 ? 'bg-brand/5' : '') },
                  h('div', { className: 'flex items-center gap-2' },
                    linked2 ? h('span', { className: 'text-brand-400 font-bold' }, '✓') : h('span', { className: 'w-4' }),
                    h('span', { className: 'font-semibold' }, t.symbol),
                    h('span', { className: 'text-slate-400' }, Fmt.dateShort(t.date)),
                    h('span', { className: 'text-slate-400 text-xs' }, t.side)),
                  h('span', { className: window.cx('font-semibold', Fmt.signColor(p)) }, Fmt.money(p, { plus: true })));
              }))) : null
    );
  }

  window.Views = window.Views || {};
  window.Views.Notebook = Notebook;
})();
