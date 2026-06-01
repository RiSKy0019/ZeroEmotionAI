/* ============================================================
   view.account.js — Account & Cloud Sync (Views.Account)
   Connect a free Supabase project, log in, and sync trades across
   devices. Local-first: everything works offline without this.
   ============================================================ */
(function () {
  'use strict';
  var h = window.h, UI = window.UI, Fmt = window.Fmt;
  var useState = React.useState;

  var SETUP_SQL =
    "create table if not exists public.app_state (\n" +
    "  user_id uuid primary key references auth.users on delete cascade,\n" +
    "  data jsonb,\n" +
    "  updated_at timestamptz default now()\n" +
    ");\n" +
    "alter table public.app_state enable row level security;\n" +
    "create policy \"own row read\"   on public.app_state for select using (auth.uid() = user_id);\n" +
    "create policy \"own row insert\" on public.app_state for insert with check (auth.uid() = user_id);\n" +
    "create policy \"own row update\" on public.app_state for update using (auth.uid() = user_id);";

  function relTime(ts) {
    if (!ts) return 'never';
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    return Math.round(s / 3600) + 'h ago';
  }

  function Account(props) {
    var cloud = window.useCloud ? window.useCloud() : { configured: false };
    var cfg = window.Cloud ? window.Cloud.getConfig() : null;

    var url = useState(cfg ? cfg.url : ''); var key = useState(cfg ? cfg.key : '');
    var email = useState(''); var pw = useState('');
    var showSql = useState(false);

    function connect() {
      if (!url[0].trim() || !key[0].trim()) { window.toast('Paste both the Project URL and anon key', 'err'); return; }
      window.Cloud.setConfig(url[0], key[0]); window.toast('Supabase connected', 'ok');
    }
    function disconnect() {
      if (window.confirm('Disconnect cloud sync? Your local data stays on this device.')) { window.Cloud.setConfig(null, null); window.toast('Cloud disconnected', 'ok'); }
    }
    function copySql() {
      try { navigator.clipboard.writeText(SETUP_SQL); window.toast('SQL copied', 'ok'); } catch (e) { window.toast('Copy failed — select manually', 'err'); }
    }

    var notConfigured = !cloud.configured;

    return h('div', { className: 'space-y-5 animate-fade-in max-w-3xl' },
      h(UI.SectionHead, { title: 'Account & Cloud Sync',
        sub: 'Optional: log in to back up and sync your journal across devices. The app works fully offline without this.' }),

      /* status banner */
      h(UI.Card, { className: 'p-4' },
        h('div', { className: 'flex items-center gap-3 flex-wrap' },
          h('span', { className: window.cx('w-2.5 h-2.5 rounded-full', cloud.signedIn ? 'bg-profit' : cloud.configured ? 'bg-warn' : 'bg-slate-400'), style: { boxShadow: cloud.signedIn ? '0 0 8px #0ecb81' : 'none' } }),
          h('div', { className: 'flex-1 min-w-[200px]' },
            h('div', { className: 'font-semibold text-sm' }, cloud.signedIn ? ('Signed in as ' + cloud.email) : cloud.configured ? 'Connected — not signed in' : 'Local only (not connected)'),
            h('div', { className: 'text-xs text-slate-400' },
              cloud.signedIn ? ('Last sync ' + relTime(cloud.lastSync) + (cloud.syncing ? ' · syncing…' : '')) : 'Your data is stored on this device only.')),
          cloud.signedIn ? h(UI.Button, { variant: 'ghost', size: 'sm', onClick: function () { window.Cloud.syncNow(); } }, '↻ Sync now') : null),
        cloud.error ? h('div', { className: 'text-xs text-loss mt-2' }, '⚠️ ' + cloud.error) : null),

      /* step 1: connect project */
      notConfigured ? h(UI.Card, { className: 'p-5' },
        h('div', { className: 'flex items-center gap-2 mb-3' },
          h('div', { className: 'w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold text-white', style: { background: '#1b1b1b' } }, '1'),
          h('h3', { className: 'font-bold text-[15px]' }, 'Connect your free Supabase project')),
        h('ol', { className: 'text-sm text-slate-600 dark:text-slate-300 space-y-1.5 mb-4 list-decimal pl-5' },
          h('li', null, 'Create a free project at ', h('a', { href: 'https://supabase.com', target: '_blank', rel: 'noopener', className: 'text-brand-400 font-semibold hover:underline' }, 'supabase.com'), ' (no card needed).'),
          h('li', null, 'In the project: ', h('strong', null, 'Settings → API'), ' — copy the ', h('strong', null, 'Project URL'), ' and the ', h('strong', null, 'anon public'), ' key.'),
          h('li', null, 'In the ', h('strong', null, 'SQL Editor'), ', run the setup SQL below (creates your private table + security rules).'),
          h('li', null, 'Paste the URL + key here and connect.')),
        h('div', { className: 'mb-3' },
          h('button', { className: 'text-xs text-brand-400 font-semibold hover:underline', onClick: function () { showSql[1](!showSql[0]); } }, showSql[0] ? '▼ Hide setup SQL' : '▶ Show setup SQL'),
          showSql[0] ? h('div', { className: 'mt-2' },
            h('pre', { className: 'text-[11px] font-mono bg-slate-100 dark:bg-ink-900 border border-slate-200 dark:border-ink-700 rounded-xl p-3 overflow-x-auto whitespace-pre' }, SETUP_SQL),
            h(UI.Button, { variant: 'ghost', size: 'sm', onClick: copySql }, '⧉ Copy SQL')) : null),
        h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
          h(UI.Field, { label: 'Project URL' }, h(UI.Input, { value: url[0], placeholder: 'https://xxxx.supabase.co', onChange: function (e) { url[1](e.target.value); } })),
          h(UI.Field, { label: 'anon public key' }, h(UI.Input, { value: key[0], placeholder: 'eyJhbGci…', onChange: function (e) { key[1](e.target.value); } }))),
        h('div', { className: 'mt-3' }, h(UI.Button, { variant: 'primary', onClick: connect }, 'Connect'))) : null,

      /* step 2: sign in / up */
      (cloud.configured && !cloud.signedIn) ? h(UI.Card, { className: 'p-5' },
        h('div', { className: 'flex items-center gap-2 mb-3' },
          h('div', { className: 'w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold text-white', style: { background: '#1b1b1b' } }, '2'),
          h('h3', { className: 'font-bold text-[15px]' }, 'Sign in or create an account')),
        h('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
          h(UI.Field, { label: 'Email' }, h(UI.Input, { type: 'email', value: email[0], onChange: function (e) { email[1](e.target.value); } })),
          h(UI.Field, { label: 'Password' }, h(UI.Input, { type: 'password', value: pw[0], onChange: function (e) { pw[1](e.target.value); } }))),
        h('div', { className: 'flex gap-2 mt-3' },
          h(UI.Button, { variant: 'primary', disabled: cloud.busy, onClick: function () { window.Cloud.signIn(email[0], pw[0]); } }, cloud.busy ? '…' : 'Sign in'),
          h(UI.Button, { variant: 'ghost', disabled: cloud.busy, onClick: function () { window.Cloud.signUp(email[0], pw[0]).then(function (r) { if (r && !r.error) window.toast('Account created — if email confirmation is on, check your inbox, then sign in.', 'ok'); }); } }, 'Create account')),
        h('p', { className: 'text-[11px] text-slate-400 mt-2' }, 'Tip: in Supabase → Authentication → Providers → Email, you can turn off "Confirm email" for instant sign-in while testing.'),
        h('button', { className: 'text-[11px] text-slate-400 hover:underline mt-3', onClick: disconnect }, 'Disconnect this project')) : null,

      /* step 3: signed in */
      cloud.signedIn ? h(UI.Card, { className: 'p-5' },
        h('h3', { className: 'font-bold text-[15px] mb-2' }, 'You\u2019re synced ✓'),
        h('p', { className: 'text-sm text-slate-600 dark:text-slate-300 mb-3' }, 'Every change saves to this device instantly and syncs to the cloud automatically. Sign in on another device with the same project to pull your journal there.'),
        h('div', { className: 'flex gap-2 flex-wrap' },
          h(UI.Button, { variant: 'ghost', onClick: function () { window.Cloud.syncNow(); } }, '↻ Sync now'),
          h(UI.Button, { variant: 'ghost', onClick: function () { window.Cloud.signOut(); } }, 'Sign out'),
          h(UI.Button, { variant: 'dangerGhost', onClick: disconnect }, 'Disconnect project'))) : null,

      h('p', { className: 'text-xs text-center text-slate-400 pb-2' },
        'Local-first & private: data is stored in your browser and (when signed in) in your own Supabase project. Nothing is sent to ZeroEmotionAI servers.')
    );
  }

  window.Views = window.Views || {};
  window.Views.Account = Account;
})();
