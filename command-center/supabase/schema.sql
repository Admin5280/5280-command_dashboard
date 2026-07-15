-- =====================================================================
-- 5280 Command Center — Supabase schema (Phase 1: Leads + webhook log)
-- Run this in Supabase → SQL Editor → New query → Run.
-- RLS is ON with no public policies: only the service-role key (used
-- server-side by the Next.js API routes) can read/write. Safe with no login.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- leads ----------
create table if not exists public.leads (
  id                  uuid primary key default gen_random_uuid(),
  lead_id             text unique not null,          -- LD-YYYYMMDD-#### (GHL) or L-#### (manual)
  ghl_contact_id      text,
  ghl_contact_link    text default '',
  date_created        text default '',               -- yyyy-mm-dd
  customer_name       text default '',
  phone               text default '',
  email               text default '',
  raw_source          text default '',
  possible_source     text default '',
  confirmed_source    text default '',
  source_review_status text default 'Needs Review',
  service_interest    text default '',
  claim_status        text default 'Unclaimed',
  assigned_sales_rep  text default '',
  status              text default 'New Lead',
  next_follow_up      text default '',
  quote_amount        numeric default 0,
  booked_date         text default '',
  booked_job_value    numeric default 0,
  notes               text default '',
  customer_id         text default '',
  maintenance_id      text default '',
  origin              text default 'manual',          -- 'ghl' | 'manual'
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists leads_ghl_contact_id_idx on public.leads (ghl_contact_id);
create index if not exists leads_phone_idx           on public.leads (phone);
create index if not exists leads_email_idx           on public.leads (email);
create index if not exists leads_created_at_idx      on public.leads (created_at desc);

-- ---------- webhook_events (powers the Settings testing panel + audit) ----------
create table if not exists public.webhook_events (
  id              uuid primary key default gen_random_uuid(),
  source          text default 'ghl',
  status          text not null,      -- created | updated | duplicate | unauthorized | error | received
  lead_id         text,
  ghl_contact_id  text,
  duplicate       boolean default false,
  message         text default '',
  payload         jsonb,
  created_at      timestamptz default now()
);

create index if not exists webhook_events_created_at_idx on public.webhook_events (created_at desc);

-- ---------- security: RLS on, no public policies (service role only) ----------
alter table public.leads          enable row level security;
alter table public.webhook_events enable row level security;
