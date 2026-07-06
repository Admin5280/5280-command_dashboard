import { Job, PayRules, TechPayRule, TechRole, salesCommissionable } from "./types";
import { completed } from "./metrics";

/** Per-technician, per-job pay line. */
export interface TechPayLine {
  tech: string;
  role: TechRole;
  jobId: string;
  urableJobId: string;
  customerName: string;
  date: string;
  jobType: string;
  production: number;  // subtotal used for commission
  commission: number;
  upsell: number;
  tip: number;
  total: number;
}

const ruleFor = (rules: PayRules, role: TechRole): TechPayRule =>
  rules.tech.find((r) => r.role === role) ?? { role, commissionPct: 0, upsellPct: 0, tipPct: 0 };

/**
 * Break a job into pay lines. A job with a helper is a Duo (Lead + Helper);
 * otherwise the single tech is paid at the Solo rate. Tech upsell $ is credited
 * to the lead tech only (it's a single job-level figure).
 */
export function jobPayLines(j: Job, rules: PayRules): TechPayLine[] {
  const lines: TechPayLine[] = [];
  const hasHelper = !!j.helperTech;
  const base = (tech: string, role: TechRole, isLead: boolean): TechPayLine => {
    const r = ruleFor(rules, role);
    const commission = (j.subtotal || 0) * r.commissionPct;
    const upsell = isLead ? (j.techUpsellAmount || 0) * r.upsellPct : 0;
    const tip = (j.tip || 0) * r.tipPct;
    return {
      tech, role, jobId: j.id, urableJobId: j.urableJobId, customerName: j.customerName,
      date: j.dateCompleted, jobType: j.jobType, production: j.subtotal || 0,
      commission, upsell, tip, total: commission + upsell + tip,
    };
  };
  if (j.leadTech) lines.push(base(j.leadTech, hasHelper ? "Duo Lead" : "Solo", true));
  if (hasHelper) lines.push(base(j.helperTech, "Helper", false));
  return lines;
}

export interface TechPayRow {
  tech: string; jobs: number; production: number; commission: number; upsell: number; tips: number; total: number;
}

/** Aggregate tech pay across completed jobs, grouped by technician. */
export function techPayroll(jobs: Job[], rules: PayRules): TechPayRow[] {
  const lines = completed(jobs).flatMap((j) => jobPayLines(j, rules));
  const by: Record<string, TechPayRow> = {};
  for (const l of lines) {
    const row = (by[l.tech] ||= { tech: l.tech, jobs: 0, production: 0, commission: 0, upsell: 0, tips: 0, total: 0 });
    row.jobs += 1;
    row.production += l.production;
    row.commission += l.commission;
    row.upsell += l.upsell;
    row.tips += l.tip;
    row.total += l.total;
  }
  return Object.values(by).sort((a, b) => b.total - a.total);
}

export interface SalesPayRow {
  rep: string; completedJobs: number; paidJobs: number; commissionable: number;
  commission: number; base: number; total: number; basePaid: boolean;
}

/** Sales commission: pct of commissionable revenue on completed & paid jobs,
 *  plus a base guarantee that (optionally) requires ≥1 completed-paid job. */
export function salesPayroll(jobs: Job[], reps: string[], rules: PayRules): SalesPayRow[] {
  const comp = completed(jobs);
  const r = rules.sales;
  return reps.map((rep) => {
    const mine = comp.filter((j) => j.assignedSalesRep === rep);
    const paid = mine.filter((j) => j.paymentStatus === "Fully Paid");
    const commissionable = paid.reduce((a, j) => a + salesCommissionable(j), 0);
    const commission = commissionable * r.commissionPct;
    const basePaid = r.requireCompletedPaidJob ? paid.length > 0 : true;
    const base = basePaid ? r.baseGuarantee : 0;
    return { rep, completedJobs: mine.length, paidJobs: paid.length, commissionable, commission, base, total: commission + base, basePaid };
  }).filter((row) => row.completedJobs > 0 || row.total > 0).sort((a, b) => b.total - a.total);
}
