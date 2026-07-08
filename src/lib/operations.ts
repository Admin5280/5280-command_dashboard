import { Job } from "./types";
import { completed as completedJobs, canceled as canceledJobs } from "./metrics";
import { safeDiv, sum } from "./format";

export type OpsTone = "good" | "warn" | "danger" | "neutral";

/* ---------------- shared status logic (Operations version: adds redo% + negatives) ---------------- */
export function opsStatus(callbackPct: number, avgRating: number, negatives: number, reviewPct: number, redoPct: number):
  { status: string; tone: OpsTone } {
  if (callbackPct > 0.10 || (avgRating > 0 && avgRating < 4.5) || negatives > 0 || redoPct > 0.05) return { status: "Critical", tone: "danger" };
  if ((callbackPct >= 0.05 && callbackPct <= 0.10) || (avgRating > 0 && avgRating < 4.8)) return { status: "Needs Review", tone: "warn" };
  if (reviewPct >= 0.50 && callbackPct < 0.05 && avgRating >= 4.8) return { status: "Excellent", tone: "good" };
  return { status: "—", tone: "neutral" };
}

const isShop = (j: Job) => /shop/i.test(j.unit) || j.jobType === "Shop";
const avg = (rows: Job[]) => { const rated = rows.filter((j) => (j.rating || 0) > 0); return rated.length ? sum(rated, (j) => j.rating) / rated.length : 0; };

/* ---------------- top KPIs ---------------- */
export interface OpsKpis {
  completedJobs: number; canceledJobs: number; production: number; avgTicket: number;
  solo: number; duo: number; shop: number; mobile: number; tips: number; upsells: number; upsellRate: number;
  callbacks: number; callbackPct: number; redos: number; redoPct: number; reviewPct: number; qualityIssues: number;
}
export function opsKpis(jobs: Job[]): OpsKpis {
  const comp = completedJobs(jobs);
  const production = sum(comp, (j) => j.totalRevenue);
  const callbacks = sum(comp, (j) => j.callbackCount || 0);
  const redos = sum(comp, (j) => j.redoCount || 0);
  const upsells = sum(comp, (j) => j.techUpsellAmount || 0);
  const reviews = comp.filter((j) => j.reviewReceived).length;
  const qualityIssues = comp.filter((j) =>
    ["Needs Review", "Critical", "Open"].includes(j.qualityStatus) || (!j.qualityStatus && (j.callbackCount || 0) > 0)).length;
  return {
    completedJobs: comp.length, canceledJobs: canceledJobs(jobs).length, production, avgTicket: safeDiv(production, comp.length),
    solo: comp.filter((j) => j.jobType === "Solo").length, duo: comp.filter((j) => j.jobType === "Duo").length,
    shop: comp.filter(isShop).length, mobile: comp.filter((j) => !isShop(j)).length,
    tips: sum(comp, (j) => j.tip || 0), upsells, upsellRate: safeDiv(upsells, production),
    callbacks, callbackPct: safeDiv(callbacks, comp.length), redos, redoPct: safeDiv(redos, comp.length),
    reviewPct: safeDiv(reviews, comp.length), qualityIssues,
  };
}

/* ---------------- Service performance ---------------- */
export interface ServiceOpsRow {
  service: string; completed: number; canceled: number; revenue: number; avgTicket: number; upsells: number; tips: number;
  callbacks: number; callbackPct: number; redos: number; redoPct: number; reviewRequests: number; reviewsReceived: number;
  reviewPct: number; avgRating: number; status: string; tone: OpsTone;
}
export function serviceOps(jobs: Job[]): ServiceOpsRow[] {
  const comp = completedJobs(jobs);
  const canc = canceledJobs(jobs);
  const services = [...new Set(jobs.map((j) => j.services || "—").filter(Boolean))];
  return services.map((service) => {
    const items = comp.filter((j) => (j.services || "—") === service);
    const revenue = sum(items, (j) => j.totalRevenue);
    const callbacks = sum(items, (j) => j.callbackCount || 0);
    const redos = sum(items, (j) => j.redoCount || 0);
    const reviewsReceived = items.filter((j) => j.reviewReceived).length;
    const negatives = items.filter((j) => j.reviewNegative).length;
    const callbackPct = safeDiv(callbacks, items.length);
    const redoPct = safeDiv(redos, items.length);
    const reviewPct = safeDiv(reviewsReceived, items.length);
    const avgRating = avg(items);
    const { status, tone } = opsStatus(callbackPct, avgRating, negatives, reviewPct, redoPct);
    return {
      service, completed: items.length, canceled: canc.filter((j) => (j.services || "—") === service).length,
      revenue, avgTicket: safeDiv(revenue, items.length), upsells: sum(items, (j) => j.techUpsellAmount || 0), tips: sum(items, (j) => j.tip || 0),
      callbacks, callbackPct, redos, redoPct,
      reviewRequests: items.filter((j) => j.reviewRequestStatus && j.reviewRequestStatus !== "Not Sent").length,
      reviewsReceived, reviewPct, avgRating, status, tone,
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

/* ---------------- Technician performance ---------------- */
export interface TechOpsRow {
  tech: string; completed: number; solo: number; leadJobs: number; helperJobs: number; production: number; avgTicket: number;
  upsells: number; tips: number; callbacks: number; callbackPct: number; redos: number; reviewPct: number; avgRating: number;
  status: string; tone: OpsTone;
}
export function techOps(jobs: Job[], technicians: string[]): TechOpsRow[] {
  const comp = completedJobs(jobs);
  const names = [...new Set([...technicians, ...jobs.flatMap((j) => [j.leadTech, j.helperTech]).filter(Boolean)])];
  return names.map((tech) => {
    const mine = comp.filter((j) => j.leadTech === tech || j.helperTech === tech);
    const production = sum(mine, (j) => j.totalRevenue);
    const callbacks = sum(mine, (j) => j.callbackCount || 0);
    const reviewsReceived = mine.filter((j) => j.reviewReceived).length;
    const negatives = mine.filter((j) => j.reviewNegative).length;
    const redos = sum(mine, (j) => j.redoCount || 0);
    const callbackPct = safeDiv(callbacks, mine.length);
    const reviewPct = safeDiv(reviewsReceived, mine.length);
    const avgRating = avg(mine);
    const { status, tone } = opsStatus(callbackPct, avgRating, negatives, reviewPct, safeDiv(redos, mine.length));
    return {
      tech, completed: mine.length,
      solo: mine.filter((j) => j.jobType === "Solo" && j.leadTech === tech).length,
      leadJobs: mine.filter((j) => j.leadTech === tech).length, helperJobs: mine.filter((j) => j.helperTech === tech).length,
      production, avgTicket: safeDiv(production, mine.length), upsells: sum(mine.filter((j) => j.leadTech === tech), (j) => j.techUpsellAmount || 0),
      tips: sum(mine, (j) => j.tip || 0), callbacks, callbackPct, redos, reviewPct, avgRating, status, tone,
    };
  }).filter((r) => r.completed > 0).sort((a, b) => b.production - a.production);
}

/* ---------------- Unit performance ---------------- */
export interface UnitOpsRow {
  unit: string; jobs: number; completed: number; canceled: number; revenue: number; avgTicket: number;
  upsells: number; tips: number; callbacks: number; callbackPct: number;
}
export function unitOps(jobs: Job[], units: string[]): UnitOpsRow[] {
  const names = [...new Set([...units, "Future Unit", ...jobs.map((j) => j.unit).filter(Boolean)])];
  return names.map((unit) => {
    const all = jobs.filter((j) => j.unit === unit);
    const comp = completedJobs(all);
    const revenue = sum(comp, (j) => j.totalRevenue);
    const callbacks = sum(comp, (j) => j.callbackCount || 0);
    return {
      unit, jobs: all.length, completed: comp.length, canceled: canceledJobs(all).length, revenue,
      avgTicket: safeDiv(revenue, comp.length), upsells: sum(comp, (j) => j.techUpsellAmount || 0), tips: sum(comp, (j) => j.tip || 0),
      callbacks, callbackPct: safeDiv(callbacks, comp.length),
    };
  }).filter((r) => r.jobs > 0).sort((a, b) => b.revenue - a.revenue);
}
