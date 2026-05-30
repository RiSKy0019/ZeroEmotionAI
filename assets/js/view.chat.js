/* ============================================================
   view.chat.js — Live AI Chat (Views.Chat)
   Two-way conversation about your trades.
   Option B: local NLP (works immediately, no key)
   Option A: OpenAI streaming (paste key in settings)
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt;
  var useState = React.useState, useEffect = React.useEffect,
      useRef = React.useRef, useMemo = React.useMemo;

  /* ── markdown-lite renderer (bold, bullet, italic, code) ── */
  function renderMD(text) {
    if (!text) return '';
    var lines = text.split('\n');
    var out = [];
    lines.forEach(function (line, i) {
      var t = line;
      // bold **...**
      t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      // italic *...*
      t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
      // inline code `...`
      t = t.replace(/`(.+?)`/g, '<code class="bg-slate-100 dark:bg-ink-700 px-1 rounded text-xs font-mono">$1</code>');
      // bullet •
      if (/^[•\-]\s/.test(t)) {
        t = '<div class="flex gap-2 my-0.5"><span class="text-brand-400 shrink-0">•</span><span>' + t.replace(/^[•\-]\s/,'') + '</span></div>';
      } else if (t.trim() === '') {
        t = '<div class="h-2"></div>';
      } else {
        t = '<div>' + t + '</div>';
      }
      out.push(t);
    });
    return out.join('');
  }

  /* ── single message bubble ── */
  function Bubble(props) {
    var m = props.msg;
    var isUser = m.role === 'user';
    var isTyping = m.typing;
    return h('div', { className: window.cx('flex gap-2.5 animate-fade-in', isUser ? 'flex-row-reverse' : 'flex-row') },
      /* avatar */
      h('div', { className: window.cx('w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-bold mt-0.5', isUser ? 'bg-brand text-white' : 'bg-gradient-to-br from-brand to-accentpink text-white') },
        isUser ? 'U' : '✦'),
      /* bubble */
      h('div', { className: window.cx('max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed', isUser
          ? 'bg-brand text-white rounded-tr-sm'
          : 'bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-700 text-slate-700 dark:text-slate-200 rounded-tl-sm shadow-sm') },
        isTyping
          ? h('div', { className: 'flex gap-1 items-center h-5' },
              h('span', { className: 'w-2 h-2 rounded-full bg-slate-400 animate-pulse-dot', style: { animationDelay: '0ms' } }),
              h('span', { className: 'w-2 h-2 rounded-full bg-slate-400 animate-pulse-dot', style: { animationDelay: '200ms' } }),
              h('span', { className: 'w-2 h-2 rounded-full bg-slate-400 animate-pulse-dot', style: { animationDelay: '400ms' } }))
          : h('div', { dangerouslySetInnerHTML: { __html: renderMD(m.text) } }),
        /* mode badge for AI responses */
        !isUser && !isTyping && m.mode
          ? h('div', { className: 'mt-2 text-[10px] ' + (m.mode === 'openai' ? 'text-brand-400' : 'text-slate-400') },
              m.mode === 'openai' ? '✦ GPT-4o mini' : '✦ Local analysis')
          : null
      )
    );
  }

  /* ── suggested question chip ── */
  function Chip(props) {
    return h('button', {
      onClick: props.onClick,
      className: 'tz-btn tz-btn-ghost tz-btn-sm text-left whitespace-normal leading-snug border border-slate-200 dark:border-ink-700 hover:border-brand/50 hover:text-brand transition-all'
    }, props.children);
  }

  /* ── settings panel ── */
  function SettingsPanel(props) {
    var key = useState(window.AIKey.get());
    var saved = useState(window.AIKey.has());
    function save() {
      var v = key[0].trim();
      window.AIKey.set(v);
      saved[1](!!v);
      window.toast(v ? 'OpenAI key saved — GPT-4 answers enabled' : 'Key cleared — back to local mode', 'ok');
      props.onClose();
    }
    return h(UI.Modal, { title: 'AI Settings', onClose: props.onClose,
      footer: [
        h(UI.Button, { key: 'c', variant: 'ghost', onClick: props.onClose }, 'Cancel'),
        h(UI.Button, { key: 's', variant: 'primary', onClick: save }, 'Save')
      ]},
      h('div', { className: 'space-y-4' },
        /* mode indicator */
        h('div', { className: window.cx('rounded-xl p-3 text-sm border', saved[0] ? 'bg-profit/5 border-profit/30 text-profit' : 'bg-brand/5 border-brand/30 text-brand-400') },
          saved[0]
            ? '✅ OpenAI key is set — all questions go to GPT-4o mini for smart, open-ended answers.'
            : '✦ No key set — using local analysis mode (works offline, answers predefined questions).'),
        h(UI.Field, { label: 'OpenAI API Key', hint: '(stored only in your browser, never sent to our servers)' },
          h(UI.Input, { type: 'password', value: key[0], placeholder: 'sk-...', onChange: function (e) { key[1](e.target.value); } })),
        h('div', { className: 'text-xs text-slate-400 space-y-1' },
          h('p', null, '• Get a free key at ', h('a', { href: 'https://platform.openai.com/api-keys', target: '_blank', className: 'text-brand-400 underline' }, 'platform.openai.com/api-keys')),
          h('p', null, '• New accounts get $5 free credit — enough for hundreds of conversations.'),
          h('p', null, '• Each conversation costs roughly $0.01–0.05.'),
          h('p', null, '• To remove the key: clear the field and save.')),
        saved[0] ? h(UI.Button, { variant: 'dangerGhost', size: 'sm', onClick: function () { window.AIKey.set(''); key[1](''); saved[1](false); window.toast('Key cleared', 'ok'); } }, 'Remove key') : null
      )
    );
  }

  /* ═══════════════════════════════════════════════════════
     MAIN CHAT VIEW
     ═══════════════════════════════════════════════════════ */
  function ChatView(props) {
    var state = props.state, ctx = props.ctx;
    var trades = useMemo(function () { return window.Store.getTrades(ctx); }, [state, ctx.accountId, ctx.range]);

    var messagesS = useState(function () {
      return [{
        id: 'welcome', role: 'assistant', mode: 'local',
        text: trades.length < 5
          ? 'Hi! I\'m your AI trading coach. I don\'t have enough data yet — log at least **5 trades** and I\'ll be able to answer questions about your performance.'
          : 'Hi! I\'m your AI trading coach. I can answer questions about your **' + trades.length + ' trades** — your win rate, best setups, worst days, mistakes, and much more.\n\nTry a question below, or type your own. Add an **OpenAI key** in ⚙️ Settings for open-ended GPT-4 answers.'
      }];
    });
    var msgs = messagesS[0], setMsgs = messagesS[1];
    var inputS = useState('');
    var loadingS = useState(false);
    var showSettingsS = useState(false);
    var showSuggestedS = useState(true);
    var bottomRef = useRef(null);
    var inputRef = useRef(null);

    /* scroll to bottom on new message */
    useEffect(function () {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, [msgs.length]);

    /* history for OpenAI context */
    var history = useMemo(function () {
      return msgs.filter(function (m) { return !m.typing; }).map(function (m) {
        return { role: m.role, content: m.text };
      });
    }, [msgs]);

    function addMsg(msg) {
      setMsgs(function (prev) { return prev.concat([msg]); });
    }
    function replaceLastAI(patch) {
      setMsgs(function (prev) {
        var copy = prev.slice();
        for (var i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === 'assistant') { copy[i] = Object.assign({}, copy[i], patch); break; }
        }
        return copy;
      });
    }

    function send(question) {
      var q = (question || inputS[0]).trim();
      if (!q || loadingS[0]) return;
      inputS[1]('');
      showSuggestedS[1](false);
      loadingS[1](true);

      /* add user bubble */
      addMsg({ id: Date.now() + 'u', role: 'user', text: q });
      /* add typing indicator */
      var aiId = Date.now() + 'a';
      addMsg({ id: aiId, role: 'assistant', typing: true, text: '', mode: 'local' });

      /* stream the answer */
      var accumulated = '';
      window.Chat.stream(trades, q, history,
        function onChunk(chunk) {
          accumulated += chunk;
          replaceLastAI({ typing: false, text: accumulated });
        },
        function onDone() {
          replaceLastAI({ typing: false, text: accumulated, mode: window.AIKey.has() ? 'openai' : 'local' });
          loadingS[1](false);
          if (inputRef.current) inputRef.current.focus();
        }
      );
    }

    function clearChat() {
      setMsgs([{
        id: 'welcome2', role: 'assistant', mode: 'local',
        text: 'Chat cleared. Ask me anything about your ' + trades.length + ' trades!'
      }]);
      showSuggestedS[1](true);
      loadingS[1](false);
    }

    var hasKey = window.AIKey.has();

    return h('div', { className: 'flex flex-col h-[calc(100vh-7rem)] max-h-[860px] animate-fade-in' },
      /* ── header ── */
      h('div', { className: 'flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 rounded-t-2xl' },
        h('div', { className: 'flex items-center gap-3' },
          h('div', { className: 'w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-accentpink grid place-items-center text-white text-lg' }, '✦'),
          h('div', null,
            h('div', { className: 'font-bold text-[15px]' }, 'AI Trading Coach'),
            h('div', { className: 'text-xs ' + (hasKey ? 'text-profit' : 'text-slate-400') },
              hasKey ? '● GPT-4o mini connected' : '● Local mode (no key)'))),
        h('div', { className: 'flex items-center gap-2' },
          h('button', { className: 'tz-btn tz-btn-ghost tz-btn-sm', onClick: clearChat, title: 'Clear chat' }, '🗑 Clear'),
          h('button', { className: 'tz-btn tz-btn-sm ' + (hasKey ? 'tz-btn-ghost' : 'tz-btn-primary'), onClick: function () { showSettingsS[1](true); }, title: 'AI Settings' },
            '⚙ ' + (hasKey ? 'Key set' : 'Add key')))),

      /* ── messages ── */
      h('div', { className: 'flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50 dark:bg-ink-950' },
        msgs.map(function (m) { return h(Bubble, { key: m.id, msg: m }); }),
        /* suggested questions */
        showSuggestedS[0] && trades.length >= 5
          ? h('div', { className: 'mt-2 animate-fade-up' },
              h('p', { className: 'text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2.5' }, 'Suggested questions'),
              h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2' },
                window.Chat.SUGGESTED.slice(0, 8).map(function (s) {
                  return h(Chip, { key: s, onClick: function () { send(s); } }, s);
                })))
          : null,
        h('div', { ref: bottomRef })
      ),

      /* ── input bar ── */
      h('div', { className: 'px-4 py-3 border-t border-slate-200 dark:border-ink-700 bg-white dark:bg-ink-900 rounded-b-2xl' },
        h('div', { className: 'flex gap-2.5 items-end' },
          h('div', { className: 'flex-1 relative' },
            h('textarea', {
              ref: inputRef,
              value: inputS[0],
              placeholder: hasKey ? 'Ask anything about your trades…' : 'Ask about your trades (or add an OpenAI key for open-ended questions)…',
              rows: 1,
              className: 'tz-input resize-none leading-relaxed pr-2',
              style: { minHeight: '44px', maxHeight: '120px' },
              onChange: function (e) {
                inputS[1](e.target.value);
                /* auto-grow */
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              },
              onKeyDown: function (e) {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }
            })),
          h('button', {
            className: 'tz-btn tz-btn-primary px-4 py-3 self-end',
            disabled: !inputS[0].trim() || loadingS[0],
            onClick: function () { send(); }
          }, loadingS[0] ? '…' : '↑')),
        h('p', { className: 'text-[10px] text-slate-400 mt-1.5 text-center' },
          hasKey ? 'GPT-4o mini · Your key · Enter to send · Shift+Enter for newline'
                 : 'Local mode — add an OpenAI key above for open-ended questions · Enter to send')),

      /* ── settings modal ── */
      showSettingsS[0] ? h(SettingsPanel, { onClose: function () { showSettingsS[1](false); } }) : null
    );
  }

  window.Views = window.Views || {};
  window.Views.Chat = ChatView;
})();
