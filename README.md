# 5280 Command Center — MVP

Internal dashboard for **5280 Mobile Detailing** & **5280 Auto Studio**. Manual tracking, no integrations yet. All data is stored **locally in your browser** (localStorage) — no server, no login, no APIs.

## Stack
Next.js 14 (App Router) · React · TypeScript · Tailwind CSS · localStorage.

## Run it
```bash
npm install
npm run dev      # http://localhost:3000
```
Production build:
```bash
npm run build && npm start
```

## Sections
- **Overview** — KPI cards + charts (leads, bookings, close rate, revenue, ad spend, CPL, cost/booked, ROAS, tips, upsells).
- **Leads** — add/edit/delete, filter by source/status, search, CSV export.
- **Jobs** — add/edit/delete, filter by tech/status/source, CSV export, live gross-profit.
- **Marketing** — spend log + per-channel CPL / cost-per-booked / ROAS, CSV export.
- **Sales** — per-rep leads, booked, close rate, revenue, lost leads.
- **Operations** — production/tips/upsells by tech, job-status breakdown.
- **Finance** — revenue, tips, upsells, material cost, estimated gross profit, revenue by service/source.
- **Settings** — manage sources / services / sales reps / technicians; JSON backup **export & import**; reset sample / clear all.

## Data
- The top-bar **date range** filters every dashboard.
- Sample data loads on first run so nothing looks empty. Use **Settings → Clear All Records** to start clean, or **Reset to Sample** to restore the demo.
- **Back up regularly**: Settings → Export JSON Backup. Import it to move data to another browser/device.

## Definitions
- **Revenue** (a job) = invoice + upsell. **Gross profit** = invoice + tip + upsell − material.
- **Booked Jobs** = jobs not Canceled. **Completed Jobs** = status Completed.
- **Close Rate** = booked leads ÷ total leads. **ROAS** = revenue ÷ ad spend.

## Notes
No authentication, database, or paid APIs yet — those are planned for later. This MVP is intentionally simple.
