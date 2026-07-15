# 5280 Command Center — App Revision Plan v2

> **See the "v2.1 Corrections" section at the bottom — it is authoritative and supersedes anything above where they conflict** (storage model, service catalog, deposits, KPI logic).


Source: Jul 13, 2026 planning meeting + `productsServices.csv` (service catalog source of truth).
Scope: **App revisions only.** Excludes Notion task tracker, Google Drive cleanup, voiceovers, weekly meetings, and SOP work.
Repo: `Admin5280/5280-command_dashboard`. Status: **PLAN ONLY — no code yet.**

---

## Architecture reality check (read first)

The app is a **hybrid store**:
- **Supabase (live tables):** `leads`, `jobs`, `webhook_events`, `profiles` only.
- **localStorage only:** Care Club (members/visits/perks/pipeline leads), expenses, marketing spend, payroll payments, dropdowns, finance settings, pay rules, team lists.

**Consequence for this revision:** almost every new feature here (Care Club metrics, Overhead Calendar, Bank Buckets, KPI Targets, Service Catalog) lives in the **localStorage store + `types.ts`** and needs **no Supabase migration**. The *only* item that touches a live Supabase table is **Sales close/deposit fields on `leads`** (and optionally a deposit field on `jobs`). This de-risks the whole plan: most of it is additive TypeScript, not database migrations.

---

## 1. What is already built

| Spec area | Already present | File |
|---|---|---|
| Care Club members | `CareMember` with memberNumber, offerType, paymentPlan, monthlyRate, memberStatus, assignedFounderTech, startDate, renewalDate, cancelDate, lastDetailDate, nextDetailDate, visitsThisMonth/Year, totalContractValue, ghlContactLink | `types.ts:196` |
| **Care Club visit history** | `CareVisit` already has **every requested field**: id(VisitID), memberId, leadId, urableJobId, urableJobLink, ghlContactLink, customerName, vehicle, visitDate, serviceType, visitStatus, tech, unit, bonusServiceUsed, addOnSold, addOnRevenue, tip, notes. Visits tab + "+Visit" already exist. | `types.ts:211`, `care-club/page.tsx:468` |
| MRR / ARR | Computed live from active monthly members | `careClub.ts:80` |
| Care KPIs | active, MRR, ARR, cashCollected, avgRevPerMember, visitsThisMonth/Year, pastDue, renewalsDue, overdueDetails, needingBooking | `careClub.ts:80` |
| Expense entry (daily-capable) | `Expense` is a single-dated row (`date` defaults today) + weekStart/weekEnd + vendor, category, amount, paymentMethod, accountLast4, receiptLink, notes, enteredBy — already per-transaction | `types.ts:368`, `finance/page.tsx:116` |
| Stripe fee | `jobProcessingFee` = amountPaid×stripeFeePct + stripeFixedFee; Stripe Gross/Fees/Net KPIs | `finance.ts:13` |
| Tax estimate | netProfit × taxEstimatePct (Monthly P&L) | `finance/page.tsx:459` |
| Finance settings | stripeFeePct, stripeFixedFee, taxEstimatePct, monthlyOverhead, defaultLast4 (editable in-page) | `types.ts:374`, `finance/page.tsx:479` |
| Marketing→Finance link | Marketing spend pulled into Finance as `marketingCost`; marketing expense categories excluded to avoid double-count | `finance.ts:6,90` |
| Marketing performance | Auto-computed CPL, Cost/Booked, ROAS, booking rate by channel (matched via confirmedSource) | `metrics.ts:54` |
| Dropdown management | Owner/Admin add/remove/reorder 11 MANAGED_DROPDOWNS incl. Job Categories | `settings/page.tsx:361` |
| Leads on Supabase | Live `leads` table + webhook intake | `supabase/schema.sql:11` |

## 2. What is missing

**Care Club**
- Churn rate, cancellation rate, average member duration, average visits per member (KPI), total member visits, members needing booking (KPI card), contracts ending soon, past-due members — as **KPI cards**.
- Member **lifetime visit count** and **member lifetime value** (computed from `careVisits` by memberId — data exists, metric doesn't).
- **Contract fields:** contractStartDate, contractEndDate, contractDurationMonths, **ghlContractLink** (only ghlContactLink exists today).
- **Active Members as cards** (currently table-only) with View Visit History / Add Visit / Open Urable Job buttons.

**Finance**
- Rename "Weekly Expenses" → **Daily Expenses**; add `month` + **bankBucket** fields; add grouping views (daily/weekly/monthly, by category, by payment method, by bank bucket).
- **Overhead / recurring calendar** — does not exist (only a flat `monthlyOverhead` number).
- **Bank bucket tracking** — does not exist.
- Marketing **duplicate warning**, and channel-split KPIs (Google Ads / LSA / Meta / GBP-SEO), marketing % of revenue.
- **profitMarginTarget** + **defaultBankBuckets** in FinanceSettings; surface Net Revenue / Estimated Tax / Profit Margin beyond Monthly P&L.

**Overview**
- **KPI Targets** section — no goals model exists anywhere. Target/Actual/Difference/Hit-Miss/Progress%/Needed-remaining with green/gold/red.

**Settings**
- **Editable KPI targets** (per-unit revenue/job targets, monthly goals) — none exist.
- **Service Catalog management** (categories, services, price, description, active) — none exists.

**Service categories**
- **Service→category mapping does not exist.** Job `services` and `category` are two independent free dropdowns; nothing derives category from service.

**Sales / Leads**
- No close/deposit fields on Lead: closedDate, closedBySalesRep, bookingConfirmedDate, depositRequired, depositCollected, depositAmount, depositPaymentMethod, depositReference, depositCollectedDate, depositStatus, proposalSentDate, quoteSentDate.
- Sales Dashboard: closed-leads KPI cards, Daily Closed Leads table, deposit filters, deposit-related Audit checks.

## 3. What needs schema changes

### Supabase (live tables) — the ONLY real DB migrations
- **`leads` — ALTER TABLE add columns:** `closed_date`, `closed_by_sales_rep`, `booking_confirmed_date`, `deposit_required` (bool), `deposit_collected` (bool), `deposit_amount` (numeric), `deposit_payment_method`, `deposit_reference`, `deposit_collected_date`, `deposit_status` (enum text), `proposal_sent_date`, `quote_sent_date`. Mirror in `src/lib/leadsDb.ts` mapping.
- **`jobs` — add** `deposit_applied` (numeric) so a lead's collected deposit carries into the job and reduces `amount_due` without double-counting. (Keep existing `deposit_collected` boolean used by cancellation flow; reconcile naming.)
- `webhook_events`, `profiles` — no change.

### localStorage store / `types.ts` (no DB migration; additive types)
- **`CareMember` add:** contractStartDate, contractEndDate, contractDurationMonths (computed), ghlContractLink. (memberLifetimeVisits, memberLifetimeValue, churn, duration = **computed**, no storage.)
- **`Expense` add:** month (derived), bankBucket.
- **`FinanceSettings` add:** profitMarginTarget (default 0.40), defaultBankBuckets (list), marketing channel-split config.
- **New `Overhead` type + `overhead[]` in AppData:** id, name, category, vendor, amount, paymentFrequency (Weekly/Biweekly/Monthly/Quarterly/Yearly/One-Time), dueDate, nextChargeDate, paymentMethod, bankBucket, autoAddToExpenses (bool), activeStatus, notes.
- **New `KpiTargets` type in AppData:** solo/duo daily revenue + job counts, mobile weekly revenue, ceramic daily, shop daily, mobile tint daily, in-shop tint daily, monthly goal (no tint), monthly goal (with tint), future monthly goal. Seeded with meeting defaults, editable.
- **New `ServiceCatalogItem` type + `serviceCatalog[]`:** id, serviceName, category, price (reference), description, active. Seeded from `productsServices.csv`. Replaces reliance on two disconnected free lists; drives service→category auto-fill.
- **Bank buckets:** Main Revenue, Payroll, Gas, Tools and Chemicals, Overhead, Marketing, Taxes, Profit, Other — as a managed list; used on Expense.bankBucket, Overhead.bankBucket, and a payment-method→bucket map for revenue.

> If/when Care Club, Finance, Overhead, KPI targets move to Supabase (deferred), each becomes a new table. **Recommendation: keep them localStorage for this revision** to match current architecture and avoid scope creep.

### ⚠️ Service Catalog data caveat (needs a decision)
The CSV keys each service by a unique **ID** but the same **Name** appears under multiple categories (e.g. *Paint Panel Only Polish* is in both "Exterior Car Detailing Services" and "Add ons"; *Glass Ceramic Coating* in "Ceramic Coatings" and "Add ons"; *Kids Car Seat Detail* in "Interior" and "Add ons"). Also prices are frequently **per vehicle size** (`Coupe/Sedan: $100, SUV/Truck: $110, Large SUV: $115`).
- **Auto-fill rule recommendation:** the **main job service** maps to its **primary service category** (never "Add ons"); "Add ons" is a *separate* add-on picker feeding `addOnsValue`, not the main category. Catalog entries key on service ID (unique), not name.
- **Pricing recommendation:** store category/name/active for mapping now; treat price as reference text (keep size tiers as a string) — full size-tier price modeling can wait.

## 4. Recommended build order

I mostly agree with your proposed order, with **two changes**: put **Service Catalog first** (it feeds category-based reporting everywhere), and slot **Sales close/deposit** after Finance (it's the only Supabase migration and touches Finance).

0. **Service Catalog + service→category auto-fill** (foundation; seed from CSV; Settings management; deactivate-not-delete). Enables consistent categories in Jobs/Leads/Visits/Operations/Finance/Payroll/Quality/Marketing.
1. **Care Club metrics + Active Member cards** (data model mostly exists → fast, high-visibility win).
2. **Daily Expenses** (relabel + `month`/`bankBucket` + grouping views — low effort).
3. **Overhead / Marketing recurring calendar** (new entity; feeds expenses via auto-add).
4. **Finance calculations + Bank Buckets + marketing breakdown/duplicate warning + profit-margin target** (consumes buckets from 2 & 3).
5. **Sales Dashboard close/deposit tracking** (the one Supabase `leads` migration; wire deposit into Finance/Job).
6. **Overview KPI Targets** (new goals model; uses service-category actuals from step 0).
7. **KPI Settings** (make targets editable; depends on 6).

**Dependencies:** 0 → (6,7) for category-based targets; 2,3 → 4 for buckets; 5 → 4 for deposit-as-collected. 1 is independent and can run in parallel.

## 5. What can be built now

All of these are additive, match current architecture, and need no outside input:
- Service Catalog seed + mapping + auto-fill + Settings CRUD (deactivate-only).
- Care Club churn/cancellation/duration/lifetime metrics + Active Member cards + View Visit History (uses existing CareVisit data).
- Daily Expenses relabel + bankBucket/month + grouping views.
- Overhead Calendar entity + views + auto-add-to-expenses suggestion.
- Bank Bucket tracking + suggested weekly transfers.
- Finance: profit-margin target, net revenue / estimated tax surfaced app-wide, marketing channel-split KPIs + duplicate warning.
- Overview KPI Targets section + editable KPI Settings (seed with meeting defaults).
- Contract fields (contractStart/End/Duration, ghlContractLink) — fields buildable now.

## 6. What should wait (needs input or a decision)

| Item | Blocker |
|---|---|
| GHL contract link + contract dates **data** | Tony to confirm where contracts live in GHL and provide start/end dates. (Fields build now; population later.) |
| Deposit → Finance reconciliation | **Decision:** does a collected deposit count as "collected revenue" *before* the job completes? Recommendation: yes, but it is part of the job's eventual `amountPaid` (deposit_applied), never additive. Confirm. |
| Meta funnel "single campaign" naming | Marketing duplicate detection + channel grouping needs Tony's campaign naming convention (stages 1–4 = one campaign). |
| Moving Care Club / Finance / Overhead to Supabase | **Decision:** keep localStorage this revision (recommended) vs migrate now. Only needed if multi-user real-time editing is required. |
| Full per-vehicle-size price modeling | Decide single price vs size tiers (see §3 caveat). Mapping ships now regardless. |
| Overhead expense list | Tony to send the comprehensive monthly/weekly overhead list to seed the calendar. |

---

## Answers to specific questions

**Care Club — tables/schema needed:** No new Supabase tables required (Care Club is localStorage). Add 4 fields to `CareMember` (contractStartDate, contractEndDate, contractDurationMonths, ghlContractLink). All new metrics (churn, cancellation rate, avg duration, avg visits/member, lifetime visits, lifetime value) are **computed** from existing `careMembers` + `careVisits` — no storage. `CareVisit` already has all requested visit fields. If later migrated to Supabase: new `care_members`, `care_visits`, `care_perks`, `care_club_leads` tables.

**Sales close/deposit — Leads, Jobs, or both?** **Primary home = `leads`** (the sales dashboard measures rep *closing*, which happens at the lead stage before a job exists). Lead already carries quoteAmount, bookedDate, bookedJobValue, assignedSalesRep. When a Job is later created from the lead, **carry the deposit into the job** via `deposit_applied` (reduces amount_due). Keep Job's existing cancellation `depositCollected` boolean, reconciled with the new Lead deposit fields.

**Effect on Sales / Finance / Payroll:**
- **Sales:** New dashboard reads entirely off Leads — leads closed, close rate, deposit collection rate, closed revenue, average closed deal. Booked→auto-fill defaults (closedDate=today, bookingConfirmedDate=today, closedBySalesRep=assignedSalesRep) reduce data entry.
- **Finance:** Deposits are early cash. Rule: deposit counts once, as part of the job's `amountPaid` (via deposit_applied) — **never double-counted**. Closed revenue (leads) is a *pipeline* figure separate from completed/collected revenue (jobs).
- **Payroll:** **No change to commission timing.** Sales commission still triggers on **completed + paid Jobs** (DEFAULT_PAY_RULES: 6% + $400 base guarantee). Closing a lead is informational for the sales dashboard and does not pay commission until the job completes.

**New Audit checks (Sales):** booked lead missing closedDate / bookingConfirmedDate / bookedJobValue; deposit marked collected but amount = 0; deposit required but not collected; deposit collected but missing payment method; deposit collected but missing reference.

---

# v2.1 Corrections (authoritative)

Reviewed and corrected by owner. This section supersedes the original where they conflict.

## Storage model — Supabase-first for business data

localStorage is **no longer** an acceptable long-term home for shared business data now that the app has auth + multiple users (Tony, Candice, Haley, VAs must see the same numbers).

### → Supabase NOW (this revision)
| Table | Replaces (localStorage) | Notes |
|---|---|---|
| `service_catalog` | `services` list + `jobCategories` dropdown | Seeded from `productsServices.csv`, keyed by CSV **service ID** |
| `care_members` | `careMembers` | + contractStartDate, contractEndDate, contractDurationMonths, ghlContractLink |
| `care_visits` | `careVisits` | model already complete |
| `care_perks` | `carePerks` | — |
| `expenses` | `expenses` | + `month`, `bank_bucket` |
| `overhead_calendar` | *(new)* | recurring payments; auto-add-to-expenses |
| `finance_settings` | `financeSettings` | single-row; + profitMarginTarget, defaultBankBuckets |
| `kpi_targets` | *(new)* | single-row; seeded with meeting defaults |
| `leads` (ALTER) | live table | add close/deposit columns |
| `jobs` (ALTER) | live table | add deposit_applied, main_service_id, service_category, add_ons |

### → Stay localStorage TEMPORARILY (acceptable, next wave)
- `marketing` spend, `payroll_payments` — business data but lower concurrent-edit risk; migrate right after this revision.
- `dropdowns` (non-service), `pay_rules` + history, team lists (`sources`, `salesReps`, `technicians`, `units`) — **configuration**, low churn, single-admin edited. Can stay local longer.
- Note: once `service_catalog` is live, the Jobs/Leads service + category pickers read from it, not from the old `services`/`jobCategories` lists.

## Service Catalog (corrected)

- **Source of truth:** `productsServices.csv`, keyed by the CSV **service ID** (unique). Never key on name — names repeat across categories (*Black Trim Restorer*, *Engine Bay Detail*, *Carpet Shampoo* each appear as both a main service and an Add-on).
- **Full category list (do not drop any):** Exterior Car Detailing Services, Ceramic Coatings Services, Full Car Detailing Services, **Gift Cards**, Add ons, Call back, Paint Correction Services, Interior Car Detailing Services, **5280 Care Club**, Window Tint Services.
- **Gift Cards** and **5280 Care Club** are included. They may be flagged `active_for_job_reporting = false` if we intentionally exclude them from job/category reporting — but they are **not deleted or ignored** by default.
- Each catalog row: `id` (CSV ID), `service_name`, `category`, `price` (reference — keep size tiers as text), `description`, `active`, `active_for_job_reporting`. **Deactivate-only**, never delete used entries.

## Main service vs add-on (corrected)

- The **main job service controls the job category** (auto-filled from that service's catalog category).
- **Add-ons never overwrite the main category.** Example: main = Ceramic Coating + add-on = Black Trim Restorer → category stays **Ceramic Coatings Services**.
- Job gets: `main_service_id` (→ catalog), derived `service_category`, and `add_ons` (jsonb list of {serviceId, name, price}) tracked **separately** from `addOnsValue`.

## Deposit rule (corrected)

- Deposit fields live **mainly on Leads** (deposits are part of closing).
- On Job creation, carry the deposit as `deposit_applied`.
- **No double-counting:** `Amount Paid = deposit_applied + remaining payment`. `Total Revenue` is unchanged by the deposit. Deposit collected is simply the first slice of Amount Paid.

## Sales dashboard (corrected)

Show: Leads Closed Today/Week, Confirmed Bookings Today/Week, Deposit Collected Today/Week, Closed Revenue Today/Week, Average Closed Deal, Deposit Collection Rate.
**Payroll is NOT triggered by Closed Date** — sales commission remains based on **completed + paid jobs** only.

## KPI target logic (corrected — uses category + job_type + unit)

| Target | Filter |
|---|---|
| Solo mobile | `job_type = Solo` AND unit ≠ Shop (mobile) |
| Duo mobile | `job_type = Duo` AND unit ≠ Shop (mobile) |
| Ceramic | `service_category = Ceramic Coatings Services` |
| Shop revenue | `job_location_unit = Shop` |
| Mobile tint | `service_category = Window Tint Services` AND unit ≠ Shop |
| In-shop tint | `service_category = Window Tint Services` AND unit = Shop |

**Prerequisite:** `job_type` must carry `Solo`/`Duo` values and `unit` must distinguish Shop vs mobile (Unit 1/Unit 2). If job_type isn't yet Solo/Duo, add that as a small classification step before KPI targets. (Trainee labeling from the meeting is a related but separate change.)

---

# Pre-coding answers

### What should be Supabase now
`service_catalog`, `care_members`, `care_visits`, `care_perks`, `expenses`, `overhead_calendar`, `finance_settings`, `kpi_targets` — plus ALTERs on `leads` and `jobs`. (Finance + Care Club move to Supabase this revision, as requested.)

### What can safely stay localStorage temporarily
`marketing`, `payroll_payments` (migrate in the immediate next wave), and pure config: non-service `dropdowns`, `pay_rules` (+history), team lists (`sources`, `salesReps`, `technicians`, `units`).

### SQL migrations needed (in order)
1. `ALTER TABLE leads` add: closed_date, closed_by_sales_rep, booking_confirmed_date, deposit_required, deposit_collected, deposit_amount, deposit_payment_method, deposit_reference, deposit_collected_date, deposit_status, proposal_sent_date, quote_sent_date.
2. `ALTER TABLE jobs` add: deposit_applied, main_service_id, service_category, add_ons (jsonb). (Keep legacy `services`/`category` during transition.)
3. `CREATE TABLE service_catalog` (id PK = CSV id, service_name, category, price text, description, active, active_for_job_reporting).
4. `CREATE TABLE care_members`, `care_visits`, `care_perks`.
5. `CREATE TABLE expenses` (+ month, bank_bucket).
6. `CREATE TABLE overhead_calendar`.
7. `CREATE TABLE finance_settings` (single row).
8. `CREATE TABLE kpi_targets` (single row).
All new tables: RLS on, service-role access via `/api/*` routes, matching the existing `leads`/`jobs` pattern. Each needs a one-time importer that pushes current localStorage data up, mirroring `migrateLeadsToCloud`.

### Recommended build order
0. **Supabase foundation** — write `schema.sql` for all 8 tables + the 2 ALTERs; build data-access mappers (`careDb.ts`, `expensesDb.ts`, `overheadDb.ts`, `serviceCatalogDb.ts`, `financeSettingsDb.ts`, `kpiTargetsDb.ts`) + `/api` routes; add one-time migrate buttons in Settings.
1. **Service Catalog** — seed from CSV by ID, auto-fill category, main-vs-add-on rule, Settings CRUD (deactivate-only).
2. **Care Club** — churn/cancellation/duration/lifetime metrics + Active Member cards + contract fields (Supabase-backed).
3. **Daily Expenses** — relabel + month/bank_bucket + grouping views.
4. **Overhead Calendar** — entity + views + auto-add-to-expenses.
5. **Finance** — bank buckets, marketing channel-split + duplicate warning, profit-margin target, net/tax surfaced.
6. **Sales close/deposit** — leads ALTER live, deposit_applied carry into jobs.
7. **Overview KPI Targets** — category/job_type/unit logic.
8. **KPI Settings** — editable kpi_targets.

### Risks if Care Club & Finance stay localStorage
- **Data divergence:** each browser holds its own copy — Candice's expenses/members never reach Tony or the VAs. No shared truth.
- **Data loss:** cache clear, new device, or new browser wipes everything; only defense is manual JSON export.
- **Concurrent overwrite:** two people editing = last-writer-wins with no merge or history.
- **Decision risk:** payroll and finance decisions get made on stale/partial per-device data.
- **No audit trail / no backup / no access control** on sensitive financial + member data sitting unencrypted per device.
- **Blocks the stated goal:** VAs on different machines can't participate. This is exactly why Finance + Care Club are being moved to Supabase now.
