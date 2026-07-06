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

/* ---------------- Marketing (auto-calculated from leads & jobs by Confirmed Source) ---------------- */
export interface MarketingRow {
  channel: string; spend: number; leads: number; bookings: number; completed: number; revenue: number;
  cpl: number; cpb: number; roas: number; bookingRate: number;
}
export function marketingByChannel(
  marketing: MarketingSpend[], leads: Lead[], jobs: Job[], from: string, to: string,
): MarketingRow[] {
  const inR = (iso: string) => !!iso && (!from || iso >= from) && (!to || iso <= to);
  const channels = new Set<string>();
  marketing.forEach((m) => m.channel && channels.add(m.channel));
  leads.forEach((l) => l.confirmedSource && channels.add(l.confirmedSource));
  jobs.forEach((j) => j.confirmedSource && channels.add(j.confirmedSource));
  return [...channels].map((ch) => {
    const spend = sum(marketing.filter((m) => m.channel === ch && inR(m.date)), (m) => m.spend);
    const chLeads = leads.filter((l) => l.confirmedSource === ch && inR(l.dateCreated)).length;
    const bookings = leads.filter((l) => l.confirmedSource === ch && (l.status === "Booked" || l.status === "Care Club Sold") && inR(l.bookedDate)).length;
    const compJobs = jobs.filter((j) => j.confirmedSource === ch && inR(j.dateCompleted));
    const revenue = sum(compJobs, (j) => j.totalRevenue);
    return {
      channel: ch, spend, leads: chLeads, bookings, completed: compJobs.length, revenue,
      cpl: safeDiv(spend, chLeads), cpb: safeDiv(spend, bookings), roas: safeDiv(revenue, spend), bookingRate: safeDiv(bookings, chLeads),
    };
  }).filter((r) => r.spend || r.leads || r.completed || r.revenue).sort((a, b) => b.revenue - a.revenue);
}

export function byGroup<T>(rows: T[], key: (r: T) => string, val: (r: T) => number) {
  const g = groupBy(rows, key);
  return Object.entries(g).map(([label, items]) => ({ label, value: sum(items, val) })).sort((a, b) => b.value - a.value);
}
export function countByGroup<T>(rows: T[], key: (r: T) => string) {
  return byGroup(rows, key, () => 1);
}
