# ZeroEmotionAI — Trading Journal & Analytics

Plan, review and course‑correct your trading. A fast, private journaling + analytics app built with **React + Tailwind**, with **no build step** — just open it.

All data is stored locally in your browser (`localStorage`). Nothing is uploaded anywhere.

---

## Features

- **Dashboard** — Net P&L, win rate, profit factor, expectancy, equity curve, win/loss split, a daily **P&L calendar**, max drawdown, streaks and recent trades.
- **Trades** — Full trade log with automatic **P&L** and **R‑multiple**, tags, mistake tagging, emotion + execution rating, **screenshots**, search, sort and filtering.
- **Manual + CSV import** — Add trades by hand, or import a CSV (auto‑detected columns, live preview, downloadable template).
- **Import from TradingView** — Bring in trades from a TradingView **List of Trades** CSV export (Strategy Tester / Paper Trading panel → Export). Entry and exit legs are paired into round‑trip trades and futures point value is detected automatically.
- **Reports** — A library of analytics across five tabs (Time, Instruments, Strategy, Behavior, Risk & Quality): P&L and win rate by day, hour, month, symbol, playbook, tag, emotion and rating; long vs short; R‑multiple distribution; mistake cost.
- **Playbooks** — Define your strategies and rules, and see per‑strategy stats (net P&L, win rate, profit factor, trade count).
- **Journal & Review** — A discipline score, “what your mistakes cost you” breakdown, and a daily pre‑market / review / lesson log.
- **Multiple accounts** — Add, edit and delete trading accounts (name, broker, starting balance) from the ⚙ next to the account picker. Each account keeps its own trades, balance and stats; pick one to focus, or **All accounts** to see everything combined.
- **Light & dark themes** — Toggle in the top bar; your choice is remembered.
- **Display currency** — View all P&L and money in USD, EUR, GBP, INR, JPY, AUD or CAD. Trades are stored in USD and converted for display only; exchange rates are editable (no live feed).
- **Backup** — Export/import your whole journal as JSON; reset to fresh sample data anytime.

The app ships with realistic sample data so you can explore immediately.

---

## Tech & approach

- **React 18** and **Tailwind CSS**, both loaded from a CDN — there is **no build step** and nothing to install.
- **Chart.js** for charts (loads from CDN; the app still works offline and just hides charts).
- Components are written with `React.createElement` (via a small `h` helper) so the app runs straight from static files.

> Note: this uses the Tailwind Play CDN for zero‑setup convenience. To “graduate” to a production build later, the same components can be moved into a Vite + React + Tailwind project.

---

## Run it

### Option A — GitHub Pages (live link)
1. In this repo: **Settings → Pages**.
2. **Build and deployment → Source:** *Deploy from a branch*.
3. **Branch:** `main`, **folder:** `/ (root)` → **Save**.
4. After a minute it's live at: `https://<your-username>.github.io/ZeroEmotionAI/`

### Option B — Locally
Download the repo and open `index.html` in your browser. (An internet connection is needed the first time so the CDN libraries can load.)

---

## CSV import

Open **Trades → ⤓ Import CSV**, then upload a file or paste rows. The first row must be headers; columns are auto‑detected by name (case‑insensitive). A **Download template** button is in the dialog.

| Field | Accepted headers (examples) |
|-------|------------------------------|
| Date | `date`, `open date`, `entry date`, `date/time` |
| Time | `time`, `entry time` |
| Symbol | `symbol`, `ticker`, `instrument`, `contract` |
| Side | `side`, `direction`, `type` (`long`/`short` or `buy`/`sell`) |
| Quantity | `qty`, `quantity`, `size`, `shares`, `contracts` |
| Entry | `entry`, `entry price`, `avg entry`, `buy price` |
| Exit | `exit`, `exit price`, `avg exit`, `sell price` |
| Fees | `fees`, `commission` |
| Setup | `setup`, `playbook`, `strategy` |
| Tags | `tags` (separate with `;` or `|`) |
| Mistakes | `mistakes` (separate with `;` or `|`) |
| Risk | `risk`, `risk amount` (enables R‑multiple) |
| Notes | `notes`, `comment` |

Required per row: **symbol**, **entry**, **exit**, **quantity**, and a valid **date**. Invalid rows are skipped and counted in the preview.

```csv
Date,Time,Symbol,Side,Quantity,Entry,Exit,Fees,Setup,Tags,Mistakes,Risk,Notes
2026-05-20,09:34,NQ,Long,2,18520.25,18560.50,4.40,Opening Range Breakout,Trend day,,300,Clean break
2026-05-20,10:12,AAPL,Short,150,224.80,223.10,1.50,Mean Reversion Fade,Reversal,Chased entry,250,Faded resistance
```

---

## How P&L is calculated

- **Long:** `(exit − entry) × quantity × multiplier − fees`
- **Short:** `(entry − exit) × quantity × multiplier − fees`
- **Multiplier** is the contract point value — `1` for stocks/crypto/forex, `50` for ES, `20` for NQ, etc. Leave it blank (= 1) for non‑futures.
- **R‑multiple:** `net P&L ÷ risk amount` (only when a risk amount is provided)

### Import from TradingView

TradingView has no public account API, so this imports the CSV it produces. In the TradingView Account Manager, use the **Export** (download) icon on one of these tabs:

- **List of Trades** (Strategy Tester) — two rows per trade (Entry + Exit). Set the **Symbol** in the dialog (TradingView omits it here). Futures point value is auto-detected from the P&L column.
- **Orders / Order History** — individual Buy/Sell fills. These are reconstructed into round-trip trades via FIFO position matching per symbol. Since order history has no P&L column, set the **multiplier** for futures and import one instrument type at a time (or fix the multiplier per trade afterwards).
- **Balance History** — imports only if it includes a realized **P&L column**. Those rows become **P&L-only** entries (they count toward net P&L, win rate and the calendar but have no entry/exit prices).

**Not importable:** *Positions* (open trades only — no exit). If an export isn't recognized, the dialog lists the **detected column names** so the mapping can be extended.

Open **Trades → ⇪ TradingView**, set the symbol/multiplier as needed, then upload or paste the CSV. A live preview shows the trades (and any open/unpaired or skipped rows) before you import.

---

## Project structure

```
index.html                  Loads React, Tailwind, Chart.js (CDN) + app scripts
assets/css/app.css          Small custom layer (scrollbars, base)
assets/js/base.js           h() helper, theme controller, event bus
assets/js/format.js         Money / %, dates, download helpers
assets/js/store.js          localStorage store + React hook + all trade math
assets/js/seed.js           Sample data generator
assets/js/charts.js         Chart.js React wrappers (theme-aware)
assets/js/tvimport.js       TradingView "List of Trades" CSV parser
assets/js/components.js     Card, Button, Modal, Badges, Field, TagEditor, Toasts
assets/js/view.dashboard.js Dashboard (stats, equity, calendar)
assets/js/view.trades.js    Trade log, add/edit form, CSV import
assets/js/view.reports.js   Report library (5 tabs)
assets/js/view.playbooks.js Strategies + per-strategy stats
assets/js/view.journal.js   Discipline score, mistake cost, daily journal
assets/js/app.js            Shell, routing, top bar, modal manager, mount
```

---

## Disclaimer

A personal journaling and analytics tool, not financial advice. Trading involves substantial risk.
