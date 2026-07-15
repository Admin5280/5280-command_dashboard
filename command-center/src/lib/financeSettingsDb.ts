import { SupabaseClient } from "@supabase/supabase-js";
import { FinanceSettings } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Single-row Finance settings (id = 'default') on Supabase.

function rowToSettings(r: any): FinanceSettings {
  return {
    stripeFeePct: Number(r.stripe_fee_pct) || 0, stripeFixedFee: Number(r.stripe_fixed_fee) || 0,
    taxEstimatePct: Number(r.tax_estimate_pct) || 0, monthlyOverhead: Number(r.monthly_overhead) || 0,
    defaultLast4: r.default_last_4 || "", profitMarginTarget: Number(r.profit_margin_target) || 0.40,
    defaultBankBuckets: Array.isArray(r.default_bank_buckets) ? r.default_bank_buckets : undefined,
  };
}

export async function getFinanceSettings(sb: SupabaseClient): Promise<FinanceSettings | null> {
  const { data, error } = await sb.from("finance_settings").select("*").eq("id", "default").maybeSingle();
  if (error) throw error;
  return data ? rowToSettings(data) : null;
}
export async function saveFinanceSettings(sb: SupabaseClient, s: Partial<FinanceSettings>): Promise<FinanceSettings> {
  const row: any = {
    id: "default", stripe_fee_pct: s.stripeFeePct ?? 0.029, stripe_fixed_fee: s.stripeFixedFee ?? 0.30,
    tax_estimate_pct: s.taxEstimatePct ?? 0.15, profit_margin_target: s.profitMarginTarget ?? 0.40,
    monthly_overhead: s.monthlyOverhead ?? 0, default_last_4: s.defaultLast4 ?? "", updated_at: new Date().toISOString(),
  };
  if (Array.isArray(s.defaultBankBuckets)) row.default_bank_buckets = s.defaultBankBuckets;
  const { data, error } = await sb.from("finance_settings").upsert(row, { onConflict: "id" }).select().single();
  if (error) throw error;
  return rowToSettings(data);
}
