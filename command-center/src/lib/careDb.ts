import { SupabaseClient } from "@supabase/supabase-js";
import { CareMember, CarePerk, CareVisit } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Data-access layer for Care Club (members / visits / perks) on Supabase.
// Mirrors the leadsDb/jobsDb pattern: snake_case rows <-> camelCase types,
// list/create/update/delete + a link-preserving one-time migration.

const isUuid = (s?: string) =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/* ---------------- members ---------------- */
function rowToMember(r: any): CareMember {
  return {
    id: r.id, memberNumber: r.member_number == null ? "" : Number(r.member_number),
    leadId: r.lead_id || "", customerId: r.customer_id || "", ghlContactId: r.ghl_contact_id || "",
    ghlContactLink: r.ghl_contact_link || "", customerName: r.customer_name || "", phone: r.phone || "", email: r.email || "",
    address: r.address || "", zip: r.zip || "", offerType: (r.offer_type || "Standard Tier") as CareMember["offerType"],
    memberTier: (r.member_tier || "Standard") as CareMember["memberTier"], paymentPlan: (r.payment_plan || "Monthly") as CareMember["paymentPlan"],
    memberStatus: (r.member_status || "Lead") as CareMember["memberStatus"],
    signupDate: r.signup_date || "", startDate: r.start_date || "", renewalDate: r.renewal_date || "", cancelDate: r.cancel_date || "",
    primaryVehicle: r.primary_vehicle || "", secondVehicle: r.second_vehicle || "", additionalVehicles: Number(r.additional_vehicles) || 0,
    monthlyRate: Number(r.monthly_rate) || 0, secondVehicleRate: Number(r.second_vehicle_rate) || 0, onboardingFee: Number(r.onboarding_fee) || 0,
    amountDueToday: Number(r.amount_due_today) || 0, totalContractValue: Number(r.total_contract_value) || 0,
    amountPaid: Number(r.amount_paid) || 0, amountDue: Number(r.amount_due) || 0,
    paymentStatus: (r.payment_status || "Unpaid") as CareMember["paymentStatus"], paymentMethod: r.payment_method || "",
    assignedSalesRep: r.assigned_sales_rep || "", assignedFounderTech: r.assigned_founder_tech || "", preferredUnit: r.preferred_unit || "",
    lastDetailDate: r.last_detail_date || "", nextDetailDate: r.next_detail_date || "",
    visitsThisMonth: Number(r.visits_this_month) || 0, visitsThisYear: Number(r.visits_this_year) || 0, perksUsedThisYear: Number(r.perks_used_this_year) || 0,
    source: r.source || "", notes: r.notes || "", createdAt: r.created_at || "", updatedAt: r.updated_at || "",
    ghlContractLink: r.ghl_contract_link || "", contractStartDate: r.contract_start_date || "",
    contractEndDate: r.contract_end_date || "", contractDurationMonths: Number(r.contract_duration_months) || 0,
  };
}
function memberToRow(m: Partial<CareMember>): any {
  return {
    member_number: (m.memberNumber === "" || m.memberNumber == null) ? null : Number(m.memberNumber),
    lead_id: m.leadId || "", customer_id: m.customerId || "", ghl_contact_id: m.ghlContactId || "", ghl_contact_link: m.ghlContactLink || "",
    ghl_contract_link: m.ghlContractLink || "", customer_name: m.customerName || "", phone: m.phone || "", email: m.email || "",
    address: m.address || "", zip: m.zip || "", offer_type: m.offerType || "", member_tier: m.memberTier || "", payment_plan: m.paymentPlan || "",
    member_status: m.memberStatus || "Lead", signup_date: m.signupDate || "", start_date: m.startDate || "", renewal_date: m.renewalDate || "",
    cancel_date: m.cancelDate || "", contract_start_date: m.contractStartDate || "", contract_end_date: m.contractEndDate || "",
    contract_duration_months: m.contractDurationMonths || 0, primary_vehicle: m.primaryVehicle || "", second_vehicle: m.secondVehicle || "",
    additional_vehicles: m.additionalVehicles || 0, monthly_rate: m.monthlyRate || 0, second_vehicle_rate: m.secondVehicleRate || 0,
    onboarding_fee: m.onboardingFee || 0, amount_due_today: m.amountDueToday || 0, total_contract_value: m.totalContractValue || 0,
    amount_paid: m.amountPaid || 0, amount_due: m.amountDue || 0, payment_status: m.paymentStatus || "", payment_method: m.paymentMethod || "",
    assigned_sales_rep: m.assignedSalesRep || "", assigned_founder_tech: m.assignedFounderTech || "", preferred_unit: m.preferredUnit || "",
    last_detail_date: m.lastDetailDate || "", next_detail_date: m.nextDetailDate || "", visits_this_month: m.visitsThisMonth || 0,
    visits_this_year: m.visitsThisYear || 0, perks_used_this_year: m.perksUsedThisYear || 0, source: m.source || "", notes: m.notes || "",
    updated_at: new Date().toISOString(),
  };
}
const memberKey = (m: CareMember) => String(m.memberNumber || m.leadId || `${m.customerName}|${m.phone}`).toLowerCase();

export async function listMembers(sb: SupabaseClient): Promise<CareMember[]> {
  const { data, error } = await sb.from("care_members").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToMember);
}
export async function createMember(sb: SupabaseClient, m: Partial<CareMember>): Promise<CareMember> {
  const row = memberToRow(m);
  if (isUuid(m.id)) row.id = m.id;
  const { data, error } = await sb.from("care_members").insert(row).select().single();
  if (error) throw error;
  return rowToMember(data);
}
export async function updateMember(sb: SupabaseClient, id: string, m: Partial<CareMember>): Promise<CareMember> {
  const { data, error } = await sb.from("care_members").update(memberToRow(m)).eq("id", id).select().single();
  if (error) throw error;
  return rowToMember(data);
}
export async function deleteMember(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("care_members").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- visits ---------------- */
function rowToVisit(r: any): CareVisit {
  return {
    id: r.id, memberId: r.member_id || "", leadId: r.lead_id || "", urableJobId: r.urable_job_id || "", urableJobLink: r.urable_job_link || "",
    ghlContactLink: r.ghl_contact_link || "", customerName: r.customer_name || "", vehicle: r.vehicle || "", visitDate: r.visit_date || "",
    serviceType: (r.service_type || "Other") as CareVisit["serviceType"], visitStatus: (r.visit_status || "Scheduled") as CareVisit["visitStatus"],
    tech: r.tech || "", unit: r.unit || "", bonusServiceUsed: r.bonus_service_used || "", addOnSold: r.add_on_sold || "",
    addOnRevenue: Number(r.add_on_revenue) || 0, tip: Number(r.tip) || 0, notes: r.notes || "",
  };
}
function visitToRow(v: Partial<CareVisit>): any {
  return {
    member_id: isUuid(v.memberId) ? v.memberId : null, lead_id: v.leadId || "", urable_job_id: v.urableJobId || "", urable_job_link: v.urableJobLink || "",
    ghl_contact_link: v.ghlContactLink || "", customer_name: v.customerName || "", vehicle: v.vehicle || "", visit_date: v.visitDate || "",
    service_type: v.serviceType || "Other", visit_status: v.visitStatus || "Scheduled", tech: v.tech || "", unit: v.unit || "",
    bonus_service_used: v.bonusServiceUsed || "", add_on_sold: v.addOnSold || "", add_on_revenue: v.addOnRevenue || 0, tip: v.tip || 0,
    notes: v.notes || "", updated_at: new Date().toISOString(),
  };
}
export async function listVisits(sb: SupabaseClient): Promise<CareVisit[]> {
  const { data, error } = await sb.from("care_visits").select("*").order("visit_date", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToVisit);
}
export async function createVisit(sb: SupabaseClient, v: Partial<CareVisit>): Promise<CareVisit> {
  const row = visitToRow(v);
  if (isUuid(v.id)) row.id = v.id;
  const { data, error } = await sb.from("care_visits").insert(row).select().single();
  if (error) throw error;
  return rowToVisit(data);
}
export async function updateVisit(sb: SupabaseClient, id: string, v: Partial<CareVisit>): Promise<CareVisit> {
  const { data, error } = await sb.from("care_visits").update(visitToRow(v)).eq("id", id).select().single();
  if (error) throw error;
  return rowToVisit(data);
}
export async function deleteVisit(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("care_visits").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- perks ---------------- */
function rowToPerk(r: any): CarePerk {
  return {
    id: r.id, memberId: r.member_id || "", customerName: r.customer_name || "", offerType: (r.offer_type || "Standard Tier") as CarePerk["offerType"],
    perkName: r.perk_name || "", perkValue: Number(r.perk_value) || 0, eligibleDate: r.eligible_date || "", usedDate: r.used_date || "",
    status: (r.status || "Available") as CarePerk["status"], urableJobId: r.urable_job_id || "", urableJobLink: r.urable_job_link || "", notes: r.notes || "",
  };
}
function perkToRow(p: Partial<CarePerk>): any {
  return {
    member_id: isUuid(p.memberId) ? p.memberId : null, customer_name: p.customerName || "", offer_type: p.offerType || "", perk_name: p.perkName || "",
    perk_value: p.perkValue || 0, eligible_date: p.eligibleDate || "", used_date: p.usedDate || "", status: p.status || "Available",
    urable_job_id: p.urableJobId || "", urable_job_link: p.urableJobLink || "", notes: p.notes || "", updated_at: new Date().toISOString(),
  };
}
export async function listPerks(sb: SupabaseClient): Promise<CarePerk[]> {
  const { data, error } = await sb.from("care_perks").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToPerk);
}
export async function createPerk(sb: SupabaseClient, p: Partial<CarePerk>): Promise<CarePerk> {
  const row = perkToRow(p);
  if (isUuid(p.id)) row.id = p.id;
  const { data, error } = await sb.from("care_perks").insert(row).select().single();
  if (error) throw error;
  return rowToPerk(data);
}
export async function updatePerk(sb: SupabaseClient, id: string, p: Partial<CarePerk>): Promise<CarePerk> {
  const { data, error } = await sb.from("care_perks").update(perkToRow(p)).eq("id", id).select().single();
  if (error) throw error;
  return rowToPerk(data);
}
export async function deletePerk(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("care_perks").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- one-time migration (members + visits + perks, links preserved) ---------------- */
export interface CareMigrateResult { members: number; visits: number; perks: number; skipped: number; errors: number }
export async function migrateCare(
  sb: SupabaseClient, members: CareMember[], visits: CareVisit[], perks: CarePerk[],
): Promise<CareMigrateResult> {
  const existing = await listMembers(sb);
  const keyToCloudId = new Map<string, string>(existing.map((m) => [memberKey(m), m.id]));
  const idMap = new Map<string, string>();           // local member id -> cloud member id
  let mMigrated = 0, vMigrated = 0, pMigrated = 0, skipped = 0, errors = 0;

  for (const m of members) {
    const k = memberKey(m);
    if (keyToCloudId.has(k)) { idMap.set(m.id, keyToCloudId.get(k)!); skipped++; continue; }
    try {
      const row = memberToRow(m); row.created_at = m.createdAt || new Date().toISOString();
      if (isUuid(m.id)) row.id = m.id;
      const { data, error } = await sb.from("care_members").insert(row).select("id").single();
      if (error) throw error;
      idMap.set(m.id, data.id); keyToCloudId.set(k, data.id); mMigrated++;
    } catch { errors++; }
  }

  const existingVisits = await listVisits(sb);
  const vSeen = new Set(existingVisits.map((v) => `${v.memberId}|${v.visitDate}|${v.serviceType}|${v.urableJobId}`));
  for (const v of visits) {
    const cloudMember = idMap.get(v.memberId) || (isUuid(v.memberId) ? v.memberId : "");
    const sig = `${cloudMember}|${v.visitDate}|${v.serviceType}|${v.urableJobId}`;
    if (vSeen.has(sig)) { skipped++; continue; }
    try {
      const row = visitToRow({ ...v, memberId: cloudMember }); if (isUuid(v.id)) row.id = v.id;
      const { error } = await sb.from("care_visits").insert(row); if (error) throw error;
      vSeen.add(sig); vMigrated++;
    } catch { errors++; }
  }

  const existingPerks = await listPerks(sb);
  const pSeen = new Set(existingPerks.map((p) => `${p.memberId}|${p.perkName}|${p.eligibleDate}`));
  for (const p of perks) {
    const cloudMember = idMap.get(p.memberId) || (isUuid(p.memberId) ? p.memberId : "");
    const sig = `${cloudMember}|${p.perkName}|${p.eligibleDate}`;
    if (pSeen.has(sig)) { skipped++; continue; }
    try {
      const row = perkToRow({ ...p, memberId: cloudMember }); if (isUuid(p.id)) row.id = p.id;
      const { error } = await sb.from("care_perks").insert(row); if (error) throw error;
      pSeen.add(sig); pMigrated++;
    } catch { errors++; }
  }

  return { members: mMigrated, visits: vMigrated, perks: pMigrated, skipped, errors };
}
