import { Job, Lead } from "./types";

/** Lead warning flags (matches the workbook guardrails). */
export function leadFlags(l: Lead, leads: Lead[]): string[] {
  const f: string[] = [];
  if (l.leadId && leads.filter((x) => x.leadId === l.leadId).length > 1) f.push("DUP LEAD ID");
  if (!l.confirmedSource) f.push("REVIEW SOURCE");
  if ((l.status === "Booked" || l.status === "Care Club Sold") && !l.assignedSalesRep) f.push("NEEDS SALES REP");
  return f;
}

/** Job warning flags. */
export function jobFlags(j: Job, jobs: Job[], leads: Lead[]): string[] {
  const f: string[] = [];
  if (j.urableJobId && jobs.filter((x) => x.urableJobId === j.urableJobId).length > 1) f.push("DUP JOB ID");
  if (j.leadId && !leads.some((l) => l.leadId === j.leadId)) f.push("LEAD NOT FOUND");
  if (j.totalRevenue > 0 && !j.paymentStatus) f.push("NEEDS PAYMENT STATUS");
  if (j.dateCompleted && (!j.unit || !j.leadTech || !j.jobType)) f.push("NEEDS UNIT/TECH/TYPE");
  return f;
}

/** Booked leads that don't yet have any job (for Audit / Booked Leads view). */
export function bookedNotInJobs(leads: Lead[], jobs: Job[]): Lead[] {
  const jobLeadIds = new Set(jobs.map((j) => j.leadId).filter(Boolean));
  return leads.filter((l) => (l.status === "Booked" || l.status === "Care Club Sold") && l.leadId && !jobLeadIds.has(l.leadId));
}
