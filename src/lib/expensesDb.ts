import { SupabaseClient } from "@supabase/supabase-js";
import { Expense } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Data-access layer for Finance daily expenses on Supabase.

const isUuid = (s?: string) =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const monthOf = (d?: string) => (d && d.length >= 7 ? d.slice(0, 7) : "");

function rowToExpense(r: any): Expense {
  return {
    id: r.id, date: r.date || "", weekStart: r.week_start || "", weekEnd: r.week_end || "", month: r.month || "",
    category: r.category || "", reason: r.reason || "", vendor: r.vendor || "", amount: Number(r.amount) || 0,
    paymentMethod: r.payment_method || "", bankBucket: r.bank_bucket || "", accountLast4: r.account_last_4 || "",
    receiptLink: r.receipt_link || "", notes: r.notes || "", enteredBy: r.entered_by || "",
    createdAt: r.created_at || "", updatedAt: r.updated_at || "",
  };
}
function expenseToRow(e: Partial<Expense>): any {
  return {
    date: e.date || "", week_start: e.weekStart || "", week_end: e.weekEnd || "", month: e.month || monthOf(e.date),
    category: e.category || "", reason: e.reason || "", vendor: e.vendor || "", amount: e.amount || 0,
    payment_method: e.paymentMethod || "", bank_bucket: e.bankBucket || "", account_last_4: e.accountLast4 || "",
    receipt_link: e.receiptLink || "", notes: e.notes || "", entered_by: e.enteredBy || "", updated_at: new Date().toISOString(),
  };
}

export async function listExpenses(sb: SupabaseClient): Promise<Expense[]> {
  const { data, error } = await sb.from("expenses").select("*").order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToExpense);
}
export async function createExpense(sb: SupabaseClient, e: Partial<Expense>): Promise<Expense> {
  const row = expenseToRow(e);
  if (isUuid(e.id)) row.id = e.id;
  const { data, error } = await sb.from("expenses").insert(row).select().single();
  if (error) throw error;
  return rowToExpense(data);
}
export async function updateExpense(sb: SupabaseClient, id: string, e: Partial<Expense>): Promise<Expense> {
  const { data, error } = await sb.from("expenses").update(expenseToRow(e)).eq("id", id).select().single();
  if (error) throw error;
  return rowToExpense(data);
}
export async function deleteExpense(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

/** One-time migration. Dedupe by date + vendor + amount + category. */
export async function migrateExpenses(sb: SupabaseClient, expenses: Expense[]): Promise<{ found: number; migrated: number; skipped: number; errors: number }> {
  const existing = await listExpenses(sb);
  const seen = new Set(existing.map((e) => `${e.date}|${e.vendor}|${e.amount}|${e.category}`));
  let migrated = 0, skipped = 0, errors = 0;
  for (const e of expenses) {
    const sig = `${e.date}|${e.vendor}|${e.amount}|${e.category}`;
    if (seen.has(sig)) { skipped++; continue; }
    try {
      const row = expenseToRow(e); row.created_at = e.createdAt || new Date().toISOString();
      if (isUuid(e.id)) row.id = e.id;
      const { error } = await sb.from("expenses").insert(row); if (error) throw error;
      seen.add(sig); migrated++;
    } catch { errors++; }
  }
  return { found: expenses.length, migrated, skipped, errors };
}
