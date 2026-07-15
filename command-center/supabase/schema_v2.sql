-- =====================================================================
-- 5280 Command Center — Supabase schema v2 (App Revision Plan v2.1)
-- Moves Care Club + Finance + Service Catalog + KPI Targets to Supabase,
-- and adds Sales close/deposit tracking to leads/jobs.
--
-- Run in Supabase → SQL Editor → New query → Run. Safe to re-run
-- (idempotent: "if not exists" / "add column if not exists").
--
-- Security model matches Phase 1: RLS ON, NO public policies. Only the
-- service-role key (used server-side by the Next.js /api routes) reads/writes.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- 1. ALTER TABLE leads — Sales close + deposit tracking
-- =====================================================================
alter table public.leads add column if not exists closed_date            text default '';
alter table public.leads add column if not exists closed_by_sales_rep    text default '';
alter table public.leads add column if not exists booking_confirmed_date text default '';
alter table public.leads add column if not exists deposit_required       boolean default false;
alter table public.leads add column if not exists deposit_collected      boolean default false;
alter table public.leads add column if not exists deposit_amount         numeric default 0;
alter table public.leads add column if not exists deposit_payment_method text default '';
alter table public.leads add column if not exists deposit_reference      text default '';
alter table public.leads add column if not exists deposit_collected_date text default '';
alter table public.leads add column if not exists deposit_status         text default 'Not Required'; -- Not Required|Required|Collected|Partially Collected|Waived|Refunded
alter table public.leads add column if not exists proposal_sent_date     text default '';
alter table public.leads add column if not exists quote_sent_date        text default '';

create index if not exists leads_closed_date_idx           on public.leads (closed_date);
create index if not exists leads_booking_confirmed_idx     on public.leads (booking_confirmed_date);
create index if not exists leads_deposit_status_idx        on public.leads (deposit_status);

-- =====================================================================
-- 2. ALTER TABLE jobs — deposit carry + service catalog linkage
--    (jobs table already exists in your Supabase; only add columns.)
-- =====================================================================
alter table public.jobs add column if not exists deposit_applied   numeric default 0;   -- carried from the lead's collected deposit
alter table public.jobs add column if not exists main_service_id   text default '';      -- FK-by-convention to service_catalog.id (CSV id)
alter table public.jobs add column if not exists service_category  text default '';      -- derived from main service's catalog category
alter table public.jobs add column if not exists add_ons           jsonb default '[]';   -- [{ "serviceId","name","price" }], tracked separately from add_ons_value

create index if not exists jobs_service_category_idx on public.jobs (service_category);
create index if not exists jobs_main_service_id_idx  on public.jobs (main_service_id);
-- Rule (enforced in app code, not DB): main service sets service_category;
-- add-ons NEVER overwrite it. amount_paid = deposit_applied + remaining payment;
-- total_revenue is unchanged by the deposit (no double-count).

-- =====================================================================
-- 3. service_catalog — seeded from productsServices.csv, keyed by CSV id
-- =====================================================================
create table if not exists public.service_catalog (
  id                       text primary key,            -- CSV service ID (unique, stable internal key)
  service_name             text default '',
  category                 text default '',             -- one of the 10 CSV categories (incl. Gift Cards, 5280 Care Club)
  price                    text default '',             -- reference; may hold size tiers e.g. "Coupe/Sedan: $100, SUV/Truck: $110"
  description              text default '',
  is_addon                 boolean default false,       -- true when category = 'Add ons'
  active                   boolean default true,        -- deactivate-only; never delete used entries
  active_for_job_reporting boolean default true,        -- Gift Cards / 5280 Care Club may be false
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);
create index if not exists service_catalog_category_idx on public.service_catalog (category);
create index if not exists service_catalog_active_idx   on public.service_catalog (active);

-- =====================================================================
-- 4. care_members
-- =====================================================================
create table if not exists public.care_members (
  id                    uuid primary key default gen_random_uuid(),
  member_number         text default '',
  lead_id               text default '',
  customer_id           text default '',
  ghl_contact_id        text default '',
  ghl_contact_link      text default '',
  ghl_contract_link     text default '',                -- NEW: GHL contract storage link
  customer_name         text default '',
  phone                 text default '',
  email                 text default '',
  address               text default '',
  zip                   text default '',
  offer_type            text default '',
  member_tier           text default '',
  payment_plan          text default '',
  member_status         text default 'Pending',         -- Pending|Active|Paused|Canceled
  signup_date           text default '',
  start_date            text default '',
  renewal_date          text default '',
  cancel_date           text default '',
  contract_start_date   text default '',                -- NEW
  contract_end_date     text default '',                -- NEW
  contract_duration_months numeric default 0,           -- NEW (may also be computed in app)
  primary_vehicle       text default '',
  second_vehicle        text default '',
  additional_vehicles   text default '',
  monthly_rate          numeric default 0,
  second_vehicle_rate   numeric default 0,
  onboarding_fee        numeric default 0,
  amount_due_today      numeric default 0,
  total_contract_value  numeric default 0,
  amount_paid           numeric default 0,
  amount_due            numeric default 0,
  payment_status        text default '',
  payment_method        text default '',
  assigned_sales_rep    text default '',
  assigned_founder_tech text default '',
  preferred_unit        text default '',
  last_detail_date      text default '',
  next_detail_date      text default '',
  visits_this_month     numeric default 0,
  visits_this_year      numeric default 0,
  perks_used_this_year  numeric default 0,
  source                text default '',
  notes                 text default '',
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);
create index if not exists care_members_status_idx     on public.care_members (member_status);
create index if not exists care_members_lead_id_idx    on public.care_members (lead_id);
create index if not exists care_members_next_detail_idx on public.care_members (next_detail_date);
-- Note: member_lifetime_visits, member_lifetime_value, churn_rate,
-- cancellation_rate, avg_member_duration, avg_visits_per_member, MRR, ARR
-- are COMPUTED in app code from care_members + care_visits — not stored.

-- =====================================================================
-- 5. care_visits
-- =====================================================================
create table if not exists public.care_visits (
  id                 uuid primary key default gen_random_uuid(),
  member_id          uuid,                               -- -> care_members.id
  lead_id            text default '',
  urable_job_id      text default '',
  urable_job_link    text default '',
  ghl_contact_link   text default '',
  customer_name      text default '',
  vehicle            text default '',
  visit_date         text default '',
  service_type       text default '',
  visit_status       text default '',
  tech               text default '',
  unit               text default '',
  bonus_service_used text default '',
  add_on_sold        text default '',
  add_on_revenue     numeric default 0,
  tip                numeric default 0,
  notes              text default '',
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists care_visits_member_id_idx  on public.care_visits (member_id);
create index if not exists care_visits_visit_date_idx on public.care_visits (visit_date);
create index if not exists care_visits_urable_idx     on public.care_visits (urable_job_id);

-- =====================================================================
-- 6. care_perks
-- =====================================================================
create table if not exists public.care_perks (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid,                                  -- -> care_members.id
  customer_name   text default '',
  offer_type      text default '',
  perk_name       text default '',
  perk_value      numeric default 0,
  eligible_date   text default '',
  used_date       text default '',
  status          text default '',
  urable_job_id   text default '',
  urable_job_link text default '',
  notes           text default '',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists care_perks_member_id_idx on public.care_perks (member_id);

-- =====================================================================
-- 7. expenses — DAILY logging (Finance)
-- =====================================================================
create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  date            text default '',                       -- yyyy-mm-dd (per-transaction, daily)
  week_start      text default '',
  week_end        text default '',
  month           text default '',                       -- NEW: yyyy-mm for monthly rollups
  category        text default '',
  reason          text default '',
  vendor          text default '',
  amount          numeric default 0,
  payment_method  text default '',
  bank_bucket     text default '',                       -- NEW: Main Revenue|Payroll|Gas|Tools and Chemicals|Overhead|Marketing|Taxes|Profit|Other
  account_last_4  text default '',                       -- "Account Number or Last 4"
  receipt_link    text default '',
  notes           text default '',
  entered_by      text default '',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists expenses_date_idx        on public.expenses (date);
create index if not exists expenses_month_idx       on public.expenses (month);
create index if not exists expenses_category_idx    on public.expenses (category);
create index if not exists expenses_bank_bucket_idx on public.expenses (bank_bucket);

-- =====================================================================
-- 8. overhead_calendar — recurring payments (rent, insurance, software…)
-- =====================================================================
create table if not exists public.overhead_calendar (
  id                  uuid primary key default gen_random_uuid(),
  name                text default '',
  category            text default '',
  vendor              text default '',
  amount              numeric default 0,
  payment_frequency   text default 'Monthly',            -- Weekly|Biweekly|Monthly|Quarterly|Yearly|One-Time
  due_date            text default '',
  next_charge_date    text default '',
  payment_method      text default '',
  bank_bucket         text default '',
  auto_add_to_expenses boolean default false,            -- if true, create/suggest an expense on the due date
  active_status       boolean default true,
  notes               text default '',
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index if not exists overhead_next_charge_idx on public.overhead_calendar (next_charge_date);
create index if not exists overhead_active_idx      on public.overhead_calendar (active_status);

-- =====================================================================
-- 9. finance_settings — single-row config
-- =====================================================================
create table if not exists public.finance_settings (
  id                    text primary key default 'default' check (id = 'default'),
  stripe_fee_pct        numeric default 0.029,
  stripe_fixed_fee      numeric default 0.30,
  tax_estimate_pct      numeric default 0.15,
  profit_margin_target  numeric default 0.40,            -- NEW: default 40%
  monthly_overhead      numeric default 0,
  default_last_4        text default '',
  default_bank_buckets  jsonb default '["Main Revenue","Payroll","Gas","Tools and Chemicals","Overhead","Marketing","Taxes","Profit","Other"]',
  marketing_channel_map jsonb default '{}',              -- optional: expense-category/source -> marketing channel
  updated_at            timestamptz default now()
);
insert into public.finance_settings (id) values ('default') on conflict (id) do nothing;

-- =====================================================================
-- 10. kpi_targets — single-row config (Overview targets), seeded w/ meeting defaults
-- =====================================================================
create table if not exists public.kpi_targets (
  id                          text primary key default 'default' check (id = 'default'),
  solo_daily_revenue          numeric default 800,
  solo_daily_jobs_min         numeric default 2,
  solo_daily_jobs_max         numeric default 3,
  solo_days_per_week          numeric default 7,
  duo_daily_revenue           numeric default 1000,
  duo_daily_jobs_min          numeric default 3,
  duo_daily_jobs_max          numeric default 4,
  duo_days_per_week           numeric default 6,
  mobile_weekly_revenue       numeric default 11000,
  ceramic_daily_revenue       numeric default 1000,
  ceramic_daily_jobs_min      numeric default 1,
  ceramic_daily_jobs_max      numeric default 2,
  shop_daily_revenue          numeric default 1000,
  mobile_tint_daily_revenue   numeric default 600,
  mobile_tint_days_per_week   numeric default 6,
  in_shop_tint_daily_revenue  numeric default 1200,
  in_shop_tint_daily_jobs     numeric default 2,
  in_shop_details_daily_revenue numeric default 600,
  monthly_goal_no_tint        numeric default 70000,
  monthly_goal_with_tint      numeric default 86000,
  future_monthly_goal         numeric default 150000,
  extra                       jsonb default '{}',        -- room for future targets without a migration
  updated_at                  timestamptz default now()
);
insert into public.kpi_targets (id) values ('default') on conflict (id) do nothing;

-- =====================================================================
-- Security: RLS ON, no public policies (service role only) for every new table
-- =====================================================================
alter table public.service_catalog   enable row level security;
alter table public.care_members       enable row level security;
alter table public.care_visits        enable row level security;
alter table public.care_perks         enable row level security;
alter table public.expenses           enable row level security;
alter table public.overhead_calendar  enable row level security;
alter table public.finance_settings   enable row level security;
alter table public.kpi_targets        enable row level security;

-- Done.
