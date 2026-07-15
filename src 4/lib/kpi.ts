import { Job, KpiTargets } from "./types";
import { completed } from "./metrics";
import { sum } from "./format";

/* KPI target tracking (v2). Uses job_type + unit + service_category.
   "mobile" = a unit that is not the Shop; "shop" = unit contains "Shop". */
const isShop = (j: Job) => /shop/i.test(j.unit || "");
const isMobile = (j: Job) => !!j.unit && !isShop(j);
const catOf = (j: Job) => (j.serviceCategory || j.category || "");
const isCeramic = (j: Job) => /ceramic/i.test(catOf(j));
const isTint = (j: Job) => /tint/i.test(catOf(j));

export type HitStatus = "hit" | "close" | "miss";
export interface KpiRow {
  key: string; label: string; kind: "revenue" | "jobs";
  target: number; actual: number; diff: number; pct: number; status: HitStatus; neededRemaining: number;
}
function statusOf(actual: number, target: number): HitStatus {
  if (target <= 0) return "hit";
  const p = actual / target;
  return p >= 1 ? "hit" : p >= 0.8 ? "close" : "miss";
}
function mkRow(key: string, label: string, actual: number, target: number, kind: "revenue" | "jobs" = "revenue"): KpiRow {
  return { key, label, kind, target, actual, diff: actual - target, pct: target ? actual / target : 0, status: statusOf(actual, target), neededRemaining: Math.max(0, target - actual) };
}

/** Per-unit / per-category targets, prorated across `days` in the selected range. */
export function kpiRows(jobs: Job[], t: KpiTargets, days: number): KpiRow[] {
  const comp = completed(jobs);
  const rev = (arr: Job[]) => sum(arr, (j) => j.totalRevenue || 0);
  const d = Math.max(1, days);
  const solo = comp.filter((j) => j.jobType === "Solo" && isMobile(j));
  const duo = comp.filter((j) => j.jobType === "Duo" && isMobile(j));
  const ceramic = comp.filter(isCeramic);
  const shop = comp.filter(isShop);
  const mobileTint = comp.filter((j) => isTint(j) && isMobile(j));
  const inShopTint = comp.filter((j) => isTint(j) && isShop(j));
  return [
    mkRow("solo_rev", "Solo Mobile — Revenue", rev(solo), t.soloDailyRevenue * d),
    mkRow("solo_jobs", "Solo Mobile — Jobs", solo.length, t.soloDailyJobsMin * d, "jobs"),
    mkRow("duo_rev", "Duo Mobile — Revenue", rev(duo), t.duoDailyRevenue * d),
    mkRow("duo_jobs", "Duo Mobile — Jobs", duo.length, t.duoDailyJobsMin * d, "jobs"),
    mkRow("ceramic_rev", "Ceramic — Revenue", rev(ceramic), t.ceramicDailyRevenue * d),
    mkRow("shop_rev", "Shop — Revenue", rev(shop), t.shopDailyRevenue * d),
    mkRow("mobile_tint_rev", "Mobile Tint — Revenue", rev(mobileTint), t.mobileTintDailyRevenue * d),
    mkRow("inshop_tint_rev", "In-Shop Tint — Revenue", rev(inShopTint), t.inShopTintDailyRevenue * d),
  ];
}

/** Whole-business monthly goals compared to completed revenue in range. */
export function monthlyGoalRows(completedRevenue: number, t: KpiTargets): KpiRow[] {
  return [
    mkRow("month_no_tint", "Monthly Goal — no tint", completedRevenue, t.monthlyGoalNoTint),
    mkRow("month_with_tint", "Monthly Goal — with tint", completedRevenue, t.monthlyGoalWithTint),
  ];
}

/** Inclusive day count between two yyyy-mm-dd strings; defaults to 7 when unset. */
export function rangeDays(from: string, to: string): number {
  if (!from || !to) return 7;
  const ms = new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}
