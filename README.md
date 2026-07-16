<img width="1799" height="919" alt="RobotTrack" src="https://github.com/user-attachments/assets/aa5f0e51-0821-4922-817d-13c325a15033" />

# Robotic OT Tracker

A browser-based tracking tool for da Vinci robotic surgical instruments. Designed for scrub nurses and OT supervisors to replace manual spreadsheet tracking with a live, auditable system.

---

## What it does

- Tracks every reusable robotic instrument by serial number, showing how many uses remain before it must be retired
- Logs instrument use case-by-case and prevents the same instrument being logged twice for the same case by mistake
- Monitors consumable stock levels (clip applicators, vessel sealers, staplers, etc.)
- Records faults and incidents against specific instruments
- Keeps a permanent audit trail of every action, including undos

---

## How to access

Open your browser and go to:

**https://jimltc.github.io/robotic-tracker/**

No login, no installation. Works on phones, tablets, and desktop computers.

---

## Quick task guide

| What you need to do | Where to go |
|---|---|
| Check instrument stock at a glance | Dashboard |
| See all instrument serial numbers and how many uses are left | All Instruments |
| Record that an instrument was used in a case | Log use / fault → Record instrument use |
| Report a fault or intra-op incident | Log use / fault → Record fault / incident |
| Reverse an incorrectly logged use | Log use / fault → Undo a logged use |
| Add a newly purchased instrument | Management → Add new instrument |
| Add a new consumable batch | Management → Add new consumable |
| Permanently retire a damaged instrument | Management → Condemn instrument |
| Review the full event history | Audit trail |

---

## Status indicator

The coloured dot in the top corner shows the connection status:

- **Green** — connected and up to date
- **Amber** — syncing
- **Red** — connection error (try refreshing the page)

---

## Data storage

All data is stored in a linked Google Sheet — not on this device. Any change made on one device is immediately visible to everyone else using the app.
