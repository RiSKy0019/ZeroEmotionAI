# ZeroEmotionAI — Trading Journal & Analytics

Plan your trades, review your performance, and course‑correct your mistakes.
A fast, private, self‑hosted trading journal — no install, no build step, no backend.

All data is stored locally in your browser (`localStorage`). Nothing is uploaded anywhere.

---

## Features

- **Dashboard** — Net P&L, win rate, profit factor, expectancy, equity curve, daily P&L calendar, max drawdown and streaks.
- **Trades** — Full trade log with automatic P&L and R‑multiple, mistake/emotion tagging, execution rating, search, sort and filtering. **CSV import** included.
- **Planning** — Pre‑trade plans with bias, entry/stop/target, auto reward‑to‑risk, a pre‑trade checklist, and a one‑click "log as trade".
- **Playbooks** — Define your strategies and their rules, and see per‑strategy stats (net P&L, win rate, profit factor).
- **Reports** — P&L by day of week, hour, symbol and playbook; win rate by setup; long vs short.
- **Journal & Review** — A discipline score, a breakdown of what each mistake costs you, and a daily pre‑market / review / lesson log.
- **Light & dark themes** — Toggle in the top bar; your choice is remembered.
- **Backup** — Export/import your whole journal as JSON.

The app ships with realistic sample data so you can explore immediately. Use **Reset / reseed** to start clean (or to reload the sample set).

---

## Run it

### Option A — GitHub Pages (live link)
1. In this repo: **Settings → Pages**.
2. **Build and deployment → Source:** *Deploy from a branch*.
3. **Branch:** `main`, **folder:** `/ (root)` → **Save**.
4. After a minute it's live at: `https://<your-username>.github.io/ZeroEmotionAI/`

### Option B — Locally
Download the repo and open `index.html` in your browser. That's it.
(Charts load Chart.js from a CDN; if you're fully offline the app still works and just hides the charts.)

---

## CSV import

Open **Trades → ⤓ Import CSV**, then upload a file or paste rows. The first row must be headers; columns are auto‑detected by name (case‑insensitive). A **Download template** button is provided in the dialog.

Recognized columns:

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
| Mistakes | `mistakes`, `tags` (separate multiple with `;` or `|`) |
| Risk | `risk`, `risk amount` (enables R‑multiple) |
| Notes | `notes`, `comment` |

Required to import a row: **symbol**, **entry**, **exit**, **quantity** and a valid **date**. Invalid rows are skipped and counted in the preview.

Example:

```csv
Date,Time,Symbol,Side,Quantity,Entry,Exit,Fees,Setup,Mistakes,Risk,Notes
2026-05-20,09:34,NQ,Long,2,18520.25,18560.50,4.40,Opening Range Breakout,,300,Clean break with volume
2026-05-20,10:12,AAPL,Short,150,224.80,223.10,1.50,Mean Reversion Fade,Chased entry,250,Faded into resistance
```

---

## How P&L is calculated

- **Long:** `(exit − entry) × quantity − fees`
- **Short:** `(entry − exit) × quantity − fees`
- **R‑multiple:** `net P&L ÷ risk amount` (only when a risk amount is provided)

For futures, enter the per‑contract price and a quantity/multiplier that reflects the contract's point value (e.g. risk amount in dollars).

---

## Project structure

```
index.html              App shell + script/style includes
assets/css/styles.css   Theme variables (light + dark) and all styling
assets/js/store.js      Data layer, localStorage persistence, trade math
assets/js/seed.js       Sample data generator
assets/js/util.js       Formatting, DOM helpers, CSV parsing
assets/js/charts.js     Chart.js wrappers (theme-aware, graceful fallback)
assets/js/ui.js         Modal, toast, confirm, reusable UI bits
assets/js/views.js      All screens and forms
assets/js/app.js        Bootstrap, routing, top-bar wiring, theme toggle
```

Plain vanilla JavaScript (no framework) + [Chart.js](https://www.chartjs.org/).

---

## Disclaimer

This is a personal journaling and analytics tool, not financial advice. Trading involves substantial risk.
