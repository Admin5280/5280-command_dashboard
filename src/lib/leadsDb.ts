import { SupabaseClient } from "@supabase/supabase-js";
import { Lead } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** GHL webhook payload (Phase 1 inbound). */
export interface GhlLeadPayload {
  ghlContactId?: string;
  ghlContactLink?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  source?: string;
  serviceInterest?: string;
  message?: string;
  tags?: string[] | string;
  dateCreated?: string;
  locationId?: string;
  opportunityId?: string;
  pipelineId?: string;
  stageId?: string;
}

/* ---------------- date helpers (America/Denver) ---------------- */
const denverFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" });
export const denverDate = () => denverFmt.format(new Date());          // yyyy-mm-dd
export const denverStamp = () => denverDate().replace(/-/g, "");       // yyyymmdd
function normDate(x?: string): string {
  if (!x) return "";
  const d = new Date(x);
  return isNaN(d.getTime()) ? "" : denverFmt.format(d);
}

/* ---------------- row <-> Lead mapping ---------------- */
function rowToLead(r: any): Lead {
  return {
    id: r.id, leadId: r.lead_id, ghlContactId: r.ghl_contact_id || "", ghlContactLink: r.ghl_contact_link || "",
    dateCreated: r.date_created || "", customerName: r.customer_name || "", phone: r.phone || "", email: r.email || "",
    rawSource: r.raw_source || "", possibleSource: r.possible_source || "", confirmedSource: r.confirmed_source || "",
    sourceReviewStatus: (r.source_review_status || "Needs Review") as Lead["sourceReviewStatus"], serviceInterest: r.service_interest || "",
    claimStatus: (r.claim_status || "Unclaimed") as Lead["claimStatus"], assignedSalesRep: r.assigned_sales_rep || "",
    status: (r.status || "New Lead") as Lead["status"], nextFollowUp: r.next_follow_up || "", quoteAmount: Number(r.quote_amount) || 0,
    bookedDate: r.booked_date || "", bookedJobValue: Number(r.booked_job_value) || 0, notes: r.notes || "",
    customerId: r.customer_id || "", maintenanceId: r.maintenance_id || "", origin: r.origin || "manual",
  };
}
function leadToRow(l: Partial<Lead>): any {
  return {
    lead_id: l.leadId, ghl_contact_id: l.ghlContactId || null, ghl_contact_link: l.ghlContactLink || "",
    date_created: l.dateCreated || "", customer_name: l.customerName || "", phone: l.phone || "", email: l.email || "",
    raw_source: l.rawSource || "", possible_source: l.possibleSource || "", confirmed_source: l.confirmedSource || "",
    source_review_status: l.sourceReviewStatus || "Needs Review", service_interest: l.serviceInterest || "",
    claim_status: l.claimStatus || "Unclaimed", assigned_sales_rep: l.assignedSalesRep || "", status: l.status || "New Lead",
    next_follow_up: l.nextFollowUp || "", quote_amount: l.quoteAmount || 0, booked_date: l.bookedDate || "",
    booked_job_value: l.bookedJobValue || 0, notes: l.notes || "", customer_id: l.customerId || "", maintenance_id: l.maintenanceId || "",
    origin: l.origin || "manual", updated_at: new Date().toISOString(),
  };
}

/* ---------------- Lead ID generator: LD-YYYYMMDD-#### ---------------- */
async function nextGhlLeadId(sb: SupabaseClient): Promise<string> {
  const prefix = `LD-${denverStamp()}-`;
  const { data } = await sb.from("leads").select("lead_id").like("lead_id", `${prefix}%`).order("lead_id", { ascending: false }).limit(1);
  let seq = 1;
  if (data && data.length) { const m = String(data[0].lead_id).match(/-(\d+)$/); if (m) seq = parseInt(m[1], 10) + 1; }
  return prefix + String(seq).padStart(4, "0");
}

/* ---------------- CRUD ---------------- */
export async function listLeads(sb: SupabaseClient): Promise<Lead[]> {
  const { data, error } = await sb.from("leads").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToLead);
}
export async function createLead(sb: SupabaseClient, lead: Partial<Lead>): Promise<Lead> {
  const { data, error } = await sb.from("leads").insert(leadToRow(lead)).select().single();
  if (error) throw error;
  return rowToLead(data);
}
export async function updateLead(sb: SupabaseClient, id: string, lead: Partial<Lead>): Promise<Lead> {
  const row = leadToRow(lead); delete row.lead_id; // never rewrite the key
  const { data, error } = await sb.from("leads").update(row).eq("id", id).select().single();
  if (error) throw error;
  return rowToLead(data);
}
export async function deleteLead(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("leads").delete().eq("id", id);
  if (error) throw error;
}
/** One-time migration: upsert existing (localStorage) leads keyed by lead_id. */
export async function migrateLeads(sb: SupabaseClient, leads: Lead[]): Promise<number> {
  if (!leads.length) return 0;
  const rows = leads.map((l) => ({ ...leadToRow(l), created_at: new Date().toISOString() }));
  const { data, error } = await sb.from("leads").upsert(rows, { onConflict: "lead_id" }).select("lead_id");
  if (error) throw error;
  return data?.length ?? 0;
}

/* ---------------- payload normalization (accepts GHL camelCase OR native snake_case) ---------------- */
function getPath(o: any, path: string): unknown {
  return path.split(".").reduce((a: any, k) => (a == null ? a : a[k]), o);
}
function pick(p: any, keys: string[]): string {
  for (const k of keys) {
    const v = k.includes(".") ? getPath(p, k) : p?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}
interface NormLead {
  ghlContactId: string; ghlContactLink: string; fullName: string; firstName: string; lastName: string;
  phone: string; email: string; source: string; serviceInterest: string; message: string;
  tags: unknown; dateCreated: string; opportunityId: string; pipelineId: string; stageId: string;
}
function normalizePayload(p: any): NormLead {
  const c = p?.contact ?? {}; // some GHL payloads nest fields under "contact"
  return {
    ghlContactId: pick(p, ["ghlContactId", "contact_id", "contactId"]) || pick(c, ["id", "contact_id"]),
    ghlContactLink: pick(p, ["ghlContactLink", "contact_link"]),
    fullName: pick(p, ["fullName", "full_name", "name", "contact_name"]) || pick(c, ["full_name", "name"]),
    firstName: pick(p, ["firstName", "first_name"]) || pick(c, ["first_name"]),
    lastName: pick(p, ["lastName", "last_name"]) || pick(c, ["last_name"]),
    phone: pick(p, ["phone", "phone_number"]) || pick(c, ["phone"]),
    email: pick(p, ["email", "email_address"]) || pick(c, ["email"]),
    source: pick(p, ["source", "contact_source", "attributionSource.sessionSource", "contact.attributionSource.sessionSource"]),
    serviceInterest: pick(p, ["serviceInterest", "service_interest", "type_of_detail"]),
    message: pick(p, ["message", "notes", "last_message"]) || pick(c, ["notes"]),
    tags: p?.tags ?? c?.tags,
    dateCreated: pick(p, ["dateCreated", "date_created", "date_added"]),
    opportunityId: pick(p, ["opportunityId", "opportunity_id"]),
    pipelineId: pick(p, ["pipelineId", "pipeline_id"]),
    stageId: pick(p, ["stageId", "stage_id"]),
  };
}

/* ---------------- GHL upsert (dedupe by contact id → phone → email) ---------------- */
async function findDuplicate(sb: SupabaseClient, n: NormLead): Promise<any | null> {
  const tryBy = async (col: string, val?: string) => {
    if (!val) return null;
    const { data } = await sb.from("leads").select("*").eq(col, val).limit(1);
    return data && data[0] ? data[0] : null;
  };
  return (await tryBy("ghl_contact_id", n.ghlContactId)) || (await tryBy("phone", n.phone)) || (await tryBy("email", n.email));
}
function buildNotes(n: NormLead): string {
  const tags = Array.isArray(n.tags) ? n.tags.join(", ") : (n.tags ? String(n.tags) : "");
  return [
    n.message ? `Message: ${n.message}` : "",
    tags ? `Tags: ${tags}` : "",
    n.opportunityId ? `Opportunity: ${n.opportunityId}` : "",
    n.pipelineId ? `Pipeline: ${n.pipelineId}` : "",
    n.stageId ? `Stage: ${n.stageId}` : "",
  ].filter(Boolean).join(" | ");
}

export async function upsertFromGhl(sb: SupabaseClient, p: GhlLeadPayload): Promise<{ lead: Lead; duplicate: boolean }> {
  const n = normalizePayload(p);
  const name = (n.fullName || `${n.firstName} ${n.lastName}`).trim();
  const notes = buildNotes(n);
  const dup = await findDuplicate(sb, n);

  if (dup) {
    const priorNote = dup.notes ? `${dup.notes} | ` : "";
    const patch = {
      customer_name: name || dup.customer_name,
      phone: n.phone || dup.phone, email: n.email || dup.email,
      ghl_contact_id: n.ghlContactId || dup.ghl_contact_id,
      ghl_contact_link: n.ghlContactLink || dup.ghl_contact_link,
      raw_source: n.source || dup.raw_source,
      service_interest: n.serviceInterest || dup.service_interest,
      notes: `${priorNote}Updated from GHL webhook.${notes ? " " + notes : ""}`,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await sb.from("leads").update(patch).eq("id", dup.id).select().single();
    if (error) throw error;
    return { lead: rowToLead(data), duplicate: true };
  }

  const row = {
    lead_id: await nextGhlLeadId(sb),
    ghl_contact_id: n.ghlContactId || null, ghl_contact_link: n.ghlContactLink || "",
    date_created: normDate(n.dateCreated) || denverDate(), customer_name: name, phone: n.phone || "", email: n.email || "",
    raw_source: n.source || "", confirmed_source: "", source_review_status: "Needs Review", service_interest: n.serviceInterest || "",
    claim_status: "Unclaimed", assigned_sales_rep: "", status: "New Lead", notes, origin: "ghl",
  };
  const { data, error } = await sb.from("leads").insert(row).select().single();
  if (error) throw error;
  return { lead: rowToLead(data), duplicate: false };
}

/* ---------------- webhook event log ---------------- */
export interface WebhookEvent {
  id: string; source: string; status: string; lead_id: string | null; ghl_contact_id: string | null;
  duplicate: boolean; message: string; created_at: string;
}
export async function logWebhookEvent(sb: SupabaseClient | null, e: Partial<WebhookEvent> & { payload?: unknown }): Promise<void> {
  if (!sb) return;
  try {
    await sb.from("webhook_events").insert({
      source: "ghl", status: e.status, lead_id: e.lead_id ?? null, ghl_contact_id: e.ghl_contact_id ?? null,
      duplicate: !!e.duplicate, message: e.message ?? "", payload: e.payload ?? null,
    });
  } catch { /* logging must never break the webhook */ }
}
export async function latestWebhookEvents(sb: SupabaseClient, n = 25): Promise<WebhookEvent[]> {
  const { data } = await sb.from("webhook_events").select("*").order("created_at", { ascending: false }).limit(n);
  return (data || []) as WebhookEvent[];
}
