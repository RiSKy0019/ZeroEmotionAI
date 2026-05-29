/* ============================================================
   ui.js — modal, toast, confirm, reusable bits (global `UI`)
   ============================================================ */
(function (global) {
  'use strict';
  var el = U.el;

  /* ---------- Toast ---------- */
  function toast(msg, type) {
    var root = document.getElementById('toastRoot');
    var t = el('div', { class: 'toast' + (type === 'ok' ? ' toast--ok' : type === 'err' ? ' toast--err' : ''), text: msg });
    root.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = '0'; t.style.transform = 'translateY(8px)';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, 2600);
  }

  /* ---------- Modal ---------- */
  var activeClose = null;
  function modal(opts) {
    opts = opts || {};
    var root = document.getElementById('modalRoot');
    root.innerHTML = '';

    var overlay = el('div', { class: 'modal-overlay' });
    var box = el('div', { class: 'modal' + (opts.wide ? ' modal--wide' : '') });

    var head = el('div', { class: 'modal__head' }, [
      el('h3', { text: opts.title || '' }),
      el('button', { class: 'icon-btn', html: '&times;', onclick: close })
    ]);
    var body = el('div', { class: 'modal__body' });
    if (opts.body) body.appendChild(opts.body);

    box.appendChild(head);
    box.appendChild(body);

    if (opts.footer) {
      var foot = el('div', { class: 'modal__foot' });
      opts.footer.forEach(function (b) { foot.appendChild(b); });
      box.appendChild(foot);
    }

    overlay.addEventListener('click', close);
    root.appendChild(overlay);
    root.appendChild(box);
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    function close() {
      root.classList.remove('open');
      root.setAttribute('aria-hidden', 'true');
      root.innerHTML = '';
      document.body.style.overflow = '';
      activeClose = null;
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    activeClose = close;
    return { close: close, body: body };
  }
  function closeModal() { if (activeClose) activeClose(); }

  function confirm(opts) {
    opts = opts || {};
    var msg = el('p', { text: opts.message || 'Are you sure?', class: 'muted' });
    var m = modal({
      title: opts.title || 'Please confirm',
      body: msg,
      footer: [
        el('button', { class: 'btn btn--ghost', text: opts.cancelText || 'Cancel', onclick: function () { m.close(); } }),
        el('button', { class: 'btn ' + (opts.danger ? 'btn--danger' : 'btn--primary'), text: opts.okText || 'Confirm', onclick: function () { m.close(); if (opts.onConfirm) opts.onConfirm(); } })
      ]
    });
    return m;
  }

  /* ---------- Reusable bits ---------- */
  function statCard(o) {
    var bar = '';
    if (o.barPct != null) {
      bar = '<div class="stat__bar"><span style="width:' + Math.max(0, Math.min(100, o.barPct)) + '%;background:' + (o.barColor || 'var(--violet)') + '"></span></div>';
    }
    return el('div', { class: 'card' }, el('div', { class: 'stat', html:
      '<div class="stat__label">' + U.esc(o.label) + (o.hint ? ' <span class="faint" title="' + U.esc(o.hint) + '">ⓘ</span>' : '') + '</div>' +
      '<div class="stat__value ' + (o.cls || '') + '">' + o.value + '</div>' +
      (o.sub ? '<div class="stat__sub ' + (o.subCls || '') + '">' + o.sub + '</div>' : '') +
      bar
    }));
  }

  function sideBadge(side) {
    return '<span class="badge badge--' + (side === 'short' ? 'short' : 'long') + '">' + (side === 'short' ? '▼ Short' : '▲ Long') + '</span>';
  }
  function resultBadge(result) {
    if (result === 'win') return '<span class="badge badge--win">Win</span>';
    if (result === 'loss') return '<span class="badge badge--loss">Loss</span>';
    return '<span class="badge badge--be">B/E</span>';
  }

  function emptyState(icon, title, sub) {
    return el('div', { class: 'empty', html:
      '<div class="empty__icon">' + (icon || '🗂️') + '</div>' +
      '<div style="font-weight:600;color:var(--text);margin-bottom:4px">' + U.esc(title) + '</div>' +
      (sub ? '<div>' + U.esc(sub) + '</div>' : '')
    });
  }

  global.UI = {
    toast: toast, modal: modal, closeModal: closeModal, confirm: confirm,
    statCard: statCard, sideBadge: sideBadge, resultBadge: resultBadge, emptyState: emptyState
  };
})(window);
