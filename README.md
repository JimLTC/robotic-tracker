<img width="1799" height="919" alt="RobotTrack" src="https://github.com/user-attachments/assets/aa5f0e51-0821-4922-817d-13c325a15033" />
# Robotic OT Tracker

A web-based instrument lifecycle tracking system for the robotic surgery. Replaces a manual Excel spreadsheet used by scrub nurses and OT supervisors to manage reusable robotic instrument lifecycles, consumable stock, and fault reporting.

> **Portfolio project** — demonstrates clinical informatics applied to real operating theatre workflows.

---

## Tech stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Frontend   | Pure HTML + CSS + JavaScript (no frameworks) |
| Database   | Google Sheets (4-tab workbook)          |
| Backend    | Google Apps Script (REST-style Web App) |
| Hosting    | GitHub Pages                            |
| Fonts      | DM Sans + DM Mono via Google Fonts      |

No build tools, no npm, no dependencies. Works by opening `index.html` in any browser.

---

## Features

- **Dashboard** — live stats: instruments in circulation, critical count, wire breaks, consumables available; critical instruments list; recent faults; consumable stock bars
- **All instruments** — filterable table with colour-coded lifecycle bars (green > 40 %, amber 20–40 %, red ≤ 20 %); status badges per instrument
- **Consumables** — grouped stock view with expiry dates and fill-level bars
- **Log use / fault** — record an instrument use (decrements uses, sets Complete at zero); log a fault/incident; undo a logged use (supervisor-authorised, fully audited)
- **Instrument management** — add new instruments and consumables; retire/condemn instruments permanently (Condemned instruments remain visible for audit but are excluded from all action dropdowns)
- **Fault log** — full fault history filterable by type and fault kind
- **Audit trail** — immutable timestamped log of every event with CSV export
- **Responsive layout** — full sidebar on desktop (> 1024 px), icon-only sidebar on tablet (768–1024 px), bottom navigation bar on mobile (< 768 px)
- **Sync status** — live indicator (green connected / amber syncing / red error) with auto-refresh every 60 seconds

---

## Deployment

### 1 — Google Apps Script

1. Open the linked Google Sheet and go to **Extensions → Apps Script**.
2. Paste in the Web App script (handles `getAll`, `saveInstrument`, `saveConsumable`, `saveFault`, `saveAudit` actions).
3. Click **Deploy → New deployment**, type: **Web app**, execute as: **Me**, access: **Anyone**.
4. Copy the deployment URL and update `SCRIPT_URL` in `js/app.js`.

### 2 — GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**, source: **Deploy from a branch**, branch: `main`, folder: `/ (root)`.
3. GitHub Pages will serve `index.html` at `https://<username>.github.io/<repo>/`.

---

## Usage guide

| Task | Where |
|------|-------|
| Check instrument stock at a glance | Dashboard |
| View all instrument serial numbers and lifecycle status | All instruments |
| Record that an instrument was used in a case | Log use / fault → Record instrument use |
| Report a fault or intra-op incident | Log use / fault → Record fault / incident |
| Reverse an incorrectly logged use | Log use / fault → Undo a logged use (supervisor) |
| Add a newly purchased instrument | Instrument management → Add new instrument |
| Add a new consumable batch | Instrument management → Add new consumable |
| Permanently retire a damaged / end-of-life instrument | Instrument management → Retire / condemn (supervisor) |
| Review the full event history | Audit trail |
| Download a CSV of all instruments or events | All instruments → Export / Audit trail → Export CSV |

---
---

*This is a portfolio project demonstrating how clinical informatics principles can be applied to real operating theatre workflows — replacing manual tracking with a live, auditable, mobile-friendly web application backed by Google Sheets.*
