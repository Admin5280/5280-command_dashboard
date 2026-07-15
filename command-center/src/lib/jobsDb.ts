import { SupabaseClient } from "@supabase/supabase-js";
import { Job, jobTotalRevenue } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function rowToJob(r: any): Job {
  return {
    id: r.id, leadId: r.lead_id || "", urableJobId: r.urable_job_id || "", urableJobLink: r.urable_job_link || "",
    ghlContactLink: r.ghl_contact_link || "", dateCompleted: r.date_job_completed || "", customerName: r.customer_name || "",
    phone: r.phone || "", email: r.email || "", address: r.address || "", zip: r.zip_code || "", category: r.category || "",
    services: r.services || "", unit: r.job_location_unit || "", assigneesRaw: r.assignees_raw || "", leadTech: r.lead_tech || "",
    helperTech: r.helper_tech || "", assigneeCount: Number(r.assignee_count) || 1, jobType: (r.job_type || "Solo") as Job["jobType"],
    jobStatus: (r.job_status || "Booked") as Job["jobStatus"],
    subtotal: Number(r.subtotal) || 0, upsellAddOns: "", techUpsellAmount: Number(r.technician_upsell_amount) || 0,
    discount: Number(r.discount) || 0, tip: Number(r.tip) || 0, addOnsValue: Number(r.add_ons_value) || 0,
    totalRevenue: Number(r.total_revenue) || 0, salesTotalRevenue: Number(r.sales_total_revenue) || 0,
    amountPaid: Number(r.amount_paid) || 0, amountDue: Number(r.amount_due) || 0,
    paymentStatus: (r.payment_status || "") as Job["paymentStatus"], paymentMethod: r.payment_method || "Stripe",
    confirmedSource: r.confirmed_source || "", assignedSalesRep: r.assigned_sales_rep || "",
    techPayStatus: (r.tech_pay_status || "Pending Review") as Job["techPayStatus"],
    salesCommissionStatus: (r.sales_commission_status || "Pending Review") as Job["salesCommissionStatus"],
    reviewRequestStatus: (r.review_request_status || "Not Sent") as Job["reviewRequestStatus"],
    reviewReceived: !!r.review_received, rating: Number(r.rating) || 0, reviewNegative: !!r.review_negative,
    callbackCount: Number(r.callback_count) || 0, redoCount: Number(r.redo_count) || 0, qualityStatus: r.quality_status || "",
    cancellationDate: r.cancellation_date || "", cancellationReason: (r.cancellation_reason || "") as Job["cancellationReason"],
    canceledBy: r.canceled_by || "", depositCollected: !!r.deposit_collected, refundNeeded: !!r.refund_needed,
    cancellationNotes: r.cancellation_notes || "",
    processingFee: Number(r.processing_fee) || 0, netReceived: Number(r.net_received) || 0, paymentReference: r.payment_reference || "",
    checkNumber: r.check_number || "", zelleReference: r.zelle_reference || "", stripePayoutId: r.stripe_payout_id || "",
    refundAmount: Number(r.refund_amount) || 0, refundReason: r.refund_reason || "", financeNotes: r.finance_notes || "",
    adminNotes: r.admin_notes || "", customerId: r.customer_id || "",
    historical: !!r.historical, createdAt: r.created_at || "", updatedAt: r.updated_at || "",
    mainServiceId: r.main_service_id || "", serviceCategory: r.service_category || "",
    addOns: Array.isArray(r.add_ons) ? r.add_ons : [], depositApplied: Number(r.deposit_applied) || 0,
  };
}

function jobToRow(j: Partial<Job>): any {
  return {
    lead_id: j.leadId || "", urable_job_id: j.urableJobId || "", urable_job_link: j.urableJobLink || "",
    ghl_contact_link: j.ghlContactLink || "", date_job_completed: j.dateCompleted || "", customer_name: j.customerName || "",
    phone: j.phone || "", email: j.email || "", address: j.address || "", zip_code: j.zip || "", category: j.category || "",
    services: j.services || "", job_location_unit: j.unit || "", assignees_raw: j.assigneesRaw || "", lead_tech: j.leadTech || "",
    helper_tech: j.helperTech || "", assignee_count: j.assigneeCount ?? 1, job_type: j.jobType || "Solo", job_status: j.jobStatus || "Booked",
    subtotal: j.subtotal || 0, technician_upsell_amount: j.techUpsellAmount || 0, discount: j.discount || 0, tip: j.tip || 0,
    add_ons_value: j.addOnsValue || 0, total_revenue: j.totalRevenue || 0, sales_total_revenue: j.salesTotalRevenue || 0,
    amount_paid: j.amountPaid || 0, amount_due: j.amountDue || 0, payment_status: j.paymentStatus || "", payment_method: j.paymentMethod || "Stripe",
    confirmed_source: j.confirmedSource || "", assigned_sales_rep: j.assignedSalesRep || "", tech_pay_status: j.techPayStatus || "Pending Review",
    sales_commission_status: j.salesCommissionStatus || "Pending Review", review_request_status: j.reviewRequestStatus || "Not Sent",
    review_received: !!j.reviewReceived, rating: j.rating || 0, review_negative: !!j.reviewNegative, callback_count: j.callbackCount || 0,
    redo_count: j.redoCount || 0, quality_status: j.qualityStatus || "", cancellation_date: j.cancellationDate || "",
    cancellation_reason: j.cancellationReason || "", canceled_by: j.canceledBy || "", deposit_collected: !!j.depositCollected,
    refund_needed: !!j.refundNeeded, cancellation_notes: j.cancellationNotes || "",
    processing_fee: j.processingFee || 0, net_received: j.netReceived || 0, payment_reference: j.paymentReference || "",
    check_number: j.checkNumber || "", zelle_reference: j.zelleReference || "", stripe_payout_id: j.stripePayoutId || "",
    refund_amount: j.refundAmount || 0, refund_reason: j.refundReason || "", finance_notes: j.financeNotes || "",
    admin_notes: j.adminNotes || "", customer_id: j.customerId || "", historical: !!j.historical, updated_at: new Date().toISOString(),
    main_service_id: j.mainServiceId || "", service_category: j.serviceCategory || "", add_ons: j.addOns || [],
    deposit_applied: j.depositApplied || 0,
  };
}

/** Recompute derived money fields before writing. */
function withDerived(j: Partial<Job>): Partial<Job> {
  const totalRevenue = jobTotalRevenue(j as Job);
  const amountPaid = (j.amountPaid === 0 && j.paymentStatus === "Fully Paid") ? totalRevenue : (j.amountPaid || 0);
  return { ...j, totalRevenue, amountPaid, amountDue: totalRevenue - amountPaid };
}

export async function listJobs(sb: SupabaseClient): Promise<Job[]> {
  const { data, error } = await sb.from("jobs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToJob);
}
export async function createJob(sb: SupabaseClient, job: Partial<Job>): Promise<Job> {
  const { data, error } = await sb.from("jobs").insert(jobToRow(withDerived(job))).select().single();
  if (error) throw error;
  return rowToJob(data);
}
export async function updateJob(sb: SupabaseClient, id: string, job: Partial<Job>): Promise<Job> {
  const { data, error } = await sb.from("jobs").update(jobToRow(withDerived(job))).eq("id", id).select().single();
  if (error) throw error;
  return rowToJob(data);
}
export async function deleteJob(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("jobs").delete().eq("id", id);
  if (error) throw error;
}

/** One-time migration of localStorage jobs. Dedupe by Urable Job ID, else Lead ID + Date + Customer. */
export async function migrateJobs(sb: SupabaseClient, jobs: Job[]): Promise<{ found: number; migrated: number; skipped: number; errors: number }> {
  const existing = await listJobs(sb);
  const urableSet = new Set(existing.map((j) => j.urableJobId).filter(Boolean));
  const comboSet = new Set(existing.map((j) => `${j.leadId}|${j.dateCompleted}|${j.customerName}`));
  let migrated = 0, skipped = 0, errors = 0;
  for (const j of jobs) {
    const dupByUrable = j.urableJobId && urableSet.has(j.urableJobId);
    const combo = `${j.leadId}|${j.dateCompleted}|${j.customerName}`;
    const dupByCombo = !j.urableJobId && comboSet.has(combo);
    if (dupByUrable || dupByCombo) { skipped++; continue; }
    try {
      await sb.from("jobs").insert(jobToRow(withDerived(j)));
      if (j.urableJobId) urableSet.add(j.urableJobId); else comboSet.add(combo);
      migrated++;
    } catch { errors++; }
  }
  return { found: jobs.length, migrated, skipped, errors };
}
