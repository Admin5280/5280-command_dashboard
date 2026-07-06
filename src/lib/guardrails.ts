import { CareClubLead, CareMember, Job, Lead } from "./types";

export type HealthTone = "good" | "warn" | "danger";
export interface JobIssue { label: string; tone: "warn" | "danger"; }

/** Lead warning flags (matches the workbook guardrails). */
export function leadFlags(l: Lead, leads: Lead[]): string[] {
  const f: string[] = [];
  if (l.leadId && leads.filter((x) => x.leadId === l.leadId).length > 1) f.push("DUP LEAD ID");
  if (!l.confirmedSource) f.push("REVIEW SOURCE");
  if ((l.status === "Booked" || l.status === "Care Club Sold") && !l.assignedSalesRep) f.push("NEEDS SALES REP");
  return f;
}

/** Job warning flags (legacy short flags, kept for compatibility). */
export function jobFlags(j: Job, jobs: Job[], leads: Lead[]): string[] {
  const f: string[] = [];
  if (j.urableJobId && jobs.filter((x) => x.urableJobId === j.urableJobId).length > 1) f.push("DUP JOB ID");
  if (j.leadId && !leads.some((l) => l.leadId === j.leadId)) f.push("LEAD NOT FOUND");
  if (j.totalRevenue > 0 && !j.paymentStatus) f.push("NEEDS PAYMENT STATUS");
  if (j.dateCompleted && (!j.unit || !j.leadTech || !j.jobType)) f.push("NEEDS UNIT/TECH/TYPE");
  return f;
}

/** All missing-field issues for a job, in priority order (critical first). */
export function jobIssues(j: Job, leads: Lead[]): JobIssue[] {
  const leadMatch = !!j.leadId && leads.some((l) => l.leadId === j.leadId);
  const out: JobIssue[] = [];
  if (!leadMatch) out.push({ label: "Needs Lead Match", tone: "danger" });
  if (!(j.totalRevenue > 0)) out.push({ label: "Needs Revenue", tone: "danger" });
  if (!j.paymentStatus) out.push({ label: "Needs Payment Status", tone: "danger" });
  if (!j.urableJobId) out.push({ label: "Needs Urable Job ID", tone: "warn" });
  if (!j.urableJobLink) out.push({ label: "Needs Urable Job Link", tone: "warn" });
  if (!j.leadTech) out.push({ label: "Needs Tech", tone: "warn" });
  if (!j.unit) out.push({ label: "Needs Unit", tone: "warn" });
  if (!j.assignedSalesRep) out.push({ label: "Needs Sales Rep", tone: "warn" });
  if (!j.customerName) out.push({ label: "Needs Customer", tone: "warn" });
  if (!j.confirmedSource) out.push({ label: "Needs Confirmed Source", tone: "warn" });
  if (!j.dateCompleted) out.push({ label: "Needs Date Completed", tone: "warn" });
  if (!j.services) out.push({ label: "Needs Service", tone: "warn" });
  if (!j.jobType) out.push({ label: "Needs Job Type", tone: "warn" });
  return out;
}

/** Single headline health status for a job. */
export function jobHealth(j: Job, leads: Lead[]): { status: string; tone: HealthTone } {
  const issues = jobIssues(j, leads);
  if (!issues.length) return { status: "Complete", tone: "good" };
  const first = issues.find((i) => i.tone === "danger") ?? issues[0];
  return { status: first.label, tone: first.tone };
}

/** Booked leads that don't yet have any job (for Audit / Booked Leads view). */
export function bookedNotInJobs(leads: Lead[], jobs: Job[]): Lead[] {
  const jobLeadIds = new Set(jobs.map((j) => j.leadId).filter(Boolean));
  return leads.filter((l) => (l.status === "Booked" || l.status === "Care Club Sold") && l.leadId && !jobLeadIds.has(l.leadId));
}

/** Completed jobs (dateCompleted set) that have no Care Club lead yet. */
export function completedJobsMissingCareLead(jobs: Job[], careLeads: CareClubLead[]): Job[] {
  const byOrig = new Set(careLeads.map((c) => c.originalLeadId).filter(Boolean));
  const byUrable = new Set(careLeads.map((c) => c.urableJobId).filter(Boolean));
  const byJobId = new Set(careLeads.map((c) => c.completedJobId).filter(Boolean));
  return jobs.filter((j) => j.dateCompleted && !byJobId.has(j.id) &&
    !(j.leadId && byOrig.has(j.leadId)) && !(j.urableJobId && byUrable.has(j.urableJobId)));
}

/** Care Club leads duplicated by a key (originalLeadId or urableJobId). */
export function dupCareLeadsBy(careLeads: CareClubLead[], key: "originalLeadId" | "urableJobId"): CareClubLead[] {
  const counts: Record<string, number> = {};
  careLeads.forEach((c) => { const v = c[key]; if (v) counts[v] = (counts[v] || 0) + 1; });
  return careLeads.filter((c) => c[key] && counts[c[key]] > 1);
}

/** Care Club leads marked Sold with no matching member. */
export function soldCareLeadsWithoutMember(careLeads: CareClubLead[], members: CareMember[]): CareClubLead[] {
  const memberLeadIds = new Set(members.map((m) => m.leadId).filter(Boolean));
  return careLeads.filter((c) => c.pipelineStatus === "Sold" && !(c.originalLeadId && memberLeadIds.has(c.originalLeadId)));
}
