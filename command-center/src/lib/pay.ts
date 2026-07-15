import { Job, PayRules, TechBasePayRule, TechPayRule, TechRole, salesCommissionable } from "./types";
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
  tech: string; jobs: number; production: number; commission: number; upsell: number; tips: number;
  basePay: number; total: number;
}

/** Aggregate tech pay across completed jobs, grouped by technician (dashboard summary). */
export function techPayroll(jobs: Job[], rules: PayRules, basePayRules: TechBasePayRule[] = []): TechPayRow[] {
  const comp = completed(jobs);
  const lines = comp.flatMap((j) => jobPayLines(j, rules));
  const by: Record<string, TechPayRow> = {};
  for (const l of lines) {
    const row = (by[l.tech] ||= { tech: l.tech, jobs: 0, production: 0, commission: 0, upsell: 0, tips: 0, basePay: 0, total: 0 });
    row.jobs += 1;
    row.production += l.production;
    row.commission += l.commission;
    row.upsell += l.upsell;
    row.tips += l.tip;
    row.total += l.total;
  }
  // add base pay per tech (on fully-paid completed jobs)
  for (const row of Object.values(by)) {
    const rule = activeBasePay(basePayRules, row.tech);
    const paid = comp.filter((j) => j.paymentStatus === "Fully Paid" && (j.leadTech === row.tech || j.helperTech === row.tech));
    row.basePay = basePayEarned(rule, paid);
    row.total += row.basePay;
  }
  return Object.values(by).sort((a, b) => b.total - a.total);
}

export interface SalesPayRow {
  rep: string; completedJobs: number; paidJobs: number; commissionable: number;
  commission: number; base: number; total: number; basePaid: boolean;
}

/** Sales commission summary across all reps (dashboard). */
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

/* ---------------- Base pay ---------------- */
export function activeBasePay(rules: TechBasePayRule[], tech: string): TechBasePayRule | undefined {
  return rules.find((r) => r.technicianName === tech && r.active && r.basePayType !== "None");
}
function ruleInRange(rule: TechBasePayRule | undefined, from: string, to: string): boolean {
  if (!rule) return false;
  if (rule.effectiveStart && to && rule.effectiveStart > to) return false;
  if (rule.effectiveEnd && from && rule.effectiveEnd < from) return false;
  return true;
}
/** Total base pay earned by a tech given their paid jobs in the period. */
export function basePayEarned(rule: TechBasePayRule | undefined, paidJobs: Job[]): number {
  if (!rule || rule.basePayType === "None" || !paidJobs.length) return 0;
  if (rule.basePayType === "Weekly Base") return rule.basePayAmount;
  if (rule.basePayType === "Daily Base") {
    const days = new Set(paidJobs.map((j) => j.dateCompleted).filter(Boolean));
    return days.size * rule.basePayAmount;
  }
  if (rule.basePayType === "Per Job Base") {
    const jobIds = new Set(paidJobs.map((j) => j.id));
    return jobIds.size * rule.basePayAmount;
  }
  return 0;
}

/* ---------------- Printable technician payroll report ---------------- */
export interface TechLineItem {
  jobId: string; date: string; customerName: string; urableJobId: string; urableJobLink: string;
  service: string; jobType: string; role: TechRole; subtotal: number; techUpsell: number; tip: number;
  baseCommission: number; upsellCommission: number; tipPayout: number; basePayApplied: number;
  totalFromJob: number; paymentStatus: string; techPayStatus: string;
}
export interface TechReport {
  tech: string; from: string; to: string; paymentFilter: string;
  totalJobs: number; soloJobs: number; leadJobs: number; helperJobs: number;
  baseCommission: number; upsellCommission: number; tipPayout: number;
  basePayType: string; basePayAmount: number; basePayEarned: number;
  weeklyBase: number; hours: number; hourlyRate: number; hourlyPay: number; deductions: number; totalPayout: number;
  lineItems: TechLineItem[];
}

export function techReport(
  jobs: Job[], tech: string, from: string, to: string, paymentFilter: string,
  rules: PayRules, basePayRules: TechBasePayRule[],
  extras: { hours: number; hourlyRate: number; deductions: number },
): TechReport {
  const inR = (iso: string) => !!iso && (!from || iso >= from) && (!to || iso <= to);
  const mine = jobs.filter((j) => inR(j.dateCompleted) &&
    (paymentFilter === "All" || j.paymentStatus === paymentFilter) &&
    (j.leadTech === tech || j.helperTech === tech));

  const rule = activeBasePay(basePayRules, tech);
  const ruleOk = ruleInRange(rule, from, to);
  // daily-base: which dates get the base applied on their first job
  const dailyDates = new Set<string>();

  const items: TechLineItem[] = mine.map((j) => {
    const line = jobPayLines(j, rules).find((l) => l.tech === tech);
    const role = line?.role ?? "Solo";
    let basePayApplied = 0;
    if (ruleOk && rule && j.paymentStatus === "Fully Paid") {
      if (rule.basePayType === "Per Job Base") basePayApplied = rule.basePayAmount;
      else if (rule.basePayType === "Daily Base" && j.dateCompleted && !dailyDates.has(j.dateCompleted)) {
        dailyDates.add(j.dateCompleted); basePayApplied = rule.basePayAmount;
      }
    }
    const baseCommission = line?.commission ?? 0;
    const upsellCommission = line?.upsell ?? 0;
    const tipPayout = line?.tip ?? 0;
    return {
      jobId: j.id, date: j.dateCompleted, customerName: j.customerName, urableJobId: j.urableJobId, urableJobLink: j.urableJobLink,
      service: j.services, jobType: j.jobType, role, subtotal: j.subtotal, techUpsell: j.techUpsellAmount, tip: j.tip,
      baseCommission, upsellCommission, tipPayout, basePayApplied,
      totalFromJob: baseCommission + upsellCommission + tipPayout + basePayApplied,
      paymentStatus: j.paymentStatus, techPayStatus: j.techPayStatus,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));

  const paidJobs = mine.filter((j) => j.paymentStatus === "Fully Paid");
  const earned = ruleOk ? basePayEarned(rule, paidJobs) : 0;
  const baseCommission = items.reduce((a, i) => a + i.baseCommission, 0);
  const upsellCommission = items.reduce((a, i) => a + i.upsellCommission, 0);
  const tipPayout = items.reduce((a, i) => a + i.tipPayout, 0);
  const hourlyPay = (extras.hours || 0) * (extras.hourlyRate || 0);

  return {
    tech, from, to, paymentFilter,
    totalJobs: items.length,
    soloJobs: items.filter((i) => i.role === "Solo").length,
    leadJobs: items.filter((i) => i.role === "Duo Lead").length,
    helperJobs: items.filter((i) => i.role === "Helper").length,
    baseCommission, upsellCommission, tipPayout,
    basePayType: rule?.basePayType ?? "None", basePayAmount: rule?.basePayAmount ?? 0, basePayEarned: earned,
    weeklyBase: earned,
    hours: extras.hours || 0, hourlyRate: extras.hourlyRate || 0, hourlyPay,
    deductions: extras.deductions || 0,
    totalPayout: baseCommission + upsellCommission + tipPayout + earned + hourlyPay - (extras.deductions || 0),
    lineItems: items,
  };
}

/* ---------------- Printable sales payroll report ---------------- */
export interface SalesLineItem {
  jobId: string; date: string; customerName: string; leadId: string; urableJobId: string; urableJobLink: string;
  service: string; confirmedSource: string; salesTotalRevenue: number; totalRevenue: number; commissionable: number;
  commissionRate: number; commissionEarned: number; paymentStatus: string; salesCommissionStatus: string; ghlContactLink: string;
}
export interface SalesReport {
  rep: string; from: string; to: string; paymentFilter: string;
  paidJobs: number; commissionable: number; commissionRate: number; commissionEarned: number;
  weeklyBase: number; bonus: number; deductions: number; totalPay: number;
  lineItems: SalesLineItem[];
}

const SALEABLE_STATUSES = ["Eligible", "Approved", "Exported", "Paid"];

export function salesReport(
  jobs: Job[], rep: string, from: string, to: string, paymentFilter: string,
  rules: PayRules, extras: { bonus: number; deductions: number },
): SalesReport {
  const inR = (iso: string) => !!iso && (!from || iso >= from) && (!to || iso <= to);
  const rate = rules.sales.commissionPct;
  const saleable = jobs.filter((j) =>
    j.assignedSalesRep === rep &&
    inR(j.dateCompleted) &&
    (paymentFilter === "All" || j.paymentStatus === paymentFilter) &&
    !!j.urableJobId &&
    SALEABLE_STATUSES.includes(j.salesCommissionStatus));

  const items: SalesLineItem[] = saleable.map((j) => {
    const commissionable = salesCommissionable(j);
    return {
      jobId: j.id, date: j.dateCompleted, customerName: j.customerName, leadId: j.leadId, urableJobId: j.urableJobId, urableJobLink: j.urableJobLink,
      service: j.services, confirmedSource: j.confirmedSource, salesTotalRevenue: j.salesTotalRevenue, totalRevenue: j.totalRevenue,
      commissionable, commissionRate: rate, commissionEarned: commissionable * rate,
      paymentStatus: j.paymentStatus, salesCommissionStatus: j.salesCommissionStatus, ghlContactLink: j.ghlContactLink,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));

  const commissionable = items.reduce((a, i) => a + i.commissionable, 0);
  const commissionEarned = items.reduce((a, i) => a + i.commissionEarned, 0);
  const hasPaid = saleable.some((j) => j.paymentStatus === "Fully Paid");
  const weeklyBase = rules.sales.requireCompletedPaidJob ? (hasPaid ? rules.sales.baseGuarantee : 0) : rules.sales.baseGuarantee;

  return {
    rep, from, to, paymentFilter,
    paidJobs: items.length, commissionable, commissionRate: rate, commissionEarned,
    weeklyBase, bonus: extras.bonus || 0, deductions: extras.deductions || 0,
    totalPay: commissionEarned + weeklyBase + (extras.bonus || 0) - (extras.deductions || 0),
    lineItems: items,
  };
}
