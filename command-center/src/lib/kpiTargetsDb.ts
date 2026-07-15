import { SupabaseClient } from "@supabase/supabase-js";
import { KpiTargets, DEFAULT_KPI_TARGETS } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Single-row KPI targets (id = 'default') on Supabase.

function rowToTargets(r: any): KpiTargets {
  const n = (v: any, d: number) => (v == null ? d : Number(v));
  const d = DEFAULT_KPI_TARGETS;
  return {
    soloDailyRevenue: n(r.solo_daily_revenue, d.soloDailyRevenue), soloDailyJobsMin: n(r.solo_daily_jobs_min, d.soloDailyJobsMin),
    soloDailyJobsMax: n(r.solo_daily_jobs_max, d.soloDailyJobsMax), soloDaysPerWeek: n(r.solo_days_per_week, d.soloDaysPerWeek),
    duoDailyRevenue: n(r.duo_daily_revenue, d.duoDailyRevenue), duoDailyJobsMin: n(r.duo_daily_jobs_min, d.duoDailyJobsMin),
    duoDailyJobsMax: n(r.duo_daily_jobs_max, d.duoDailyJobsMax), duoDaysPerWeek: n(r.duo_days_per_week, d.duoDaysPerWeek),
    mobileWeeklyRevenue: n(r.mobile_weekly_revenue, d.mobileWeeklyRevenue),
    ceramicDailyRevenue: n(r.ceramic_daily_revenue, d.ceramicDailyRevenue), ceramicDailyJobsMin: n(r.ceramic_daily_jobs_min, d.ceramicDailyJobsMin),
    ceramicDailyJobsMax: n(r.ceramic_daily_jobs_max, d.ceramicDailyJobsMax), shopDailyRevenue: n(r.shop_daily_revenue, d.shopDailyRevenue),
    mobileTintDailyRevenue: n(r.mobile_tint_daily_revenue, d.mobileTintDailyRevenue), mobileTintDaysPerWeek: n(r.mobile_tint_days_per_week, d.mobileTintDaysPerWeek),
    inShopTintDailyRevenue: n(r.in_shop_tint_daily_revenue, d.inShopTintDailyRevenue), inShopTintDailyJobs: n(r.in_shop_tint_daily_jobs, d.inShopTintDailyJobs),
    inShopDetailsDailyRevenue: n(r.in_shop_details_daily_revenue, d.inShopDetailsDailyRevenue),
    monthlyGoalNoTint: n(r.monthly_goal_no_tint, d.monthlyGoalNoTint), monthlyGoalWithTint: n(r.monthly_goal_with_tint, d.monthlyGoalWithTint),
    futureMonthlyGoal: n(r.future_monthly_goal, d.futureMonthlyGoal),
  };
}

export async function getKpiTargets(sb: SupabaseClient): Promise<KpiTargets | null> {
  const { data, error } = await sb.from("kpi_targets").select("*").eq("id", "default").maybeSingle();
  if (error) throw error;
  return data ? rowToTargets(data) : null;
}
export async function saveKpiTargets(sb: SupabaseClient, t: KpiTargets): Promise<KpiTargets> {
  const row = {
    id: "default", solo_daily_revenue: t.soloDailyRevenue, solo_daily_jobs_min: t.soloDailyJobsMin, solo_daily_jobs_max: t.soloDailyJobsMax,
    solo_days_per_week: t.soloDaysPerWeek, duo_daily_revenue: t.duoDailyRevenue, duo_daily_jobs_min: t.duoDailyJobsMin, duo_daily_jobs_max: t.duoDailyJobsMax,
    duo_days_per_week: t.duoDaysPerWeek, mobile_weekly_revenue: t.mobileWeeklyRevenue, ceramic_daily_revenue: t.ceramicDailyRevenue,
    ceramic_daily_jobs_min: t.ceramicDailyJobsMin, ceramic_daily_jobs_max: t.ceramicDailyJobsMax, shop_daily_revenue: t.shopDailyRevenue,
    mobile_tint_daily_revenue: t.mobileTintDailyRevenue, mobile_tint_days_per_week: t.mobileTintDaysPerWeek, in_shop_tint_daily_revenue: t.inShopTintDailyRevenue,
    in_shop_tint_daily_jobs: t.inShopTintDailyJobs, in_shop_details_daily_revenue: t.inShopDetailsDailyRevenue, monthly_goal_no_tint: t.monthlyGoalNoTint,
    monthly_goal_with_tint: t.monthlyGoalWithTint, future_monthly_goal: t.futureMonthlyGoal, updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from("kpi_targets").upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
  return rowToTargets(data);
}
