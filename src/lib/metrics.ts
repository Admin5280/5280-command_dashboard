import { Job, Lead, MarketingSpend } from "./types";
import { groupBy, safeDiv, sum } from "./format";

/** A "completed" job = a production row with a completion date. */
export const completed = (jobs: Job[]) => jobs.filter((j) => !!j.dateCompleted);
export const revenue = (j: Job) => j.totalRevenue || 0;
export const bookedLeads = (leads: Lead[]) => leads.filter((l) => l.status === "Booked" || l.status === "Care Club Sold");

export interface Overview {
  totalLeads: number; bookedJobs: number; completedJobs: number; closeRate: number;
  bookedRevenue: number; completedRevenue: number; collectedRevenue: number; amountDue: number;
  avgTicket: number; adSpend: number; cpl: number; cpbj: number; roas: number;
  tips: number; upsells: number; upsellRate: number;
}

export function overview(leads: Lead[], jobs: Job[], marketing: MarketingSpend[]): Overview {
  const comp = completed(jobs);
  const totalLeads = leads.length;
  const booked = bookedLeads(leads).length;
  const completedRevenue = sum(comp, revenue);
  const adSpend = sum(marketing, (m) => m.spend);
  const upsells = sum(comp, (j) => j.techUpsellAmount);
  return {
    totalLeads,
    bookedJobs: booked,
    completedJobs: comp.length,
    closeRate: safeDiv(booked, totalLeads),
    bookedRevenue: sum(leads, (l) => l.bookedJobValue),
    completedRevenue,
    collectedRevenue: sum(comp, (j) => j.amountPaid),
    amountDue: sum(comp, (j) => j.amountDue),
    avgTicket: safeDiv(completedRevenue, comp.length),
    adSpend,
    cpl: safeDiv(adSpend, totalLeads),
    cpbj: safeDiv(adSpend, booked),
    roas: safeDiv(completedRevenue, adSpend),
    tips: sum(comp, (j) => j.tip),
    upsells,
    upsellRate: safeDiv(upsells, completedRevenue),
  };
}

export function byGroup<T>(rows: T[], key: (r: T) => string, val: (r: T) => number) {
  const g = groupBy(rows, key);
  return Object.entries(g).map(([label, items]) => ({ label, value: sum(items, val) })).sort((a, b) => b.value - a.value);
}
export function countByGroup<T>(rows: T[], key: (r: T) => string) {
  return byGroup(rows, key, () => 1);
}
