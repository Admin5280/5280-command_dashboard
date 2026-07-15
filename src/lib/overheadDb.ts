import { SupabaseClient } from "@supabase/supabase-js";
import { Overhead } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Data-access layer for the Finance overhead / recurring-payments calendar.

const isUuid = (s?: string) =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

function rowToOverhead(r: any): Overhead {
  return {
    id: r.id, name: r.name || "", category: r.category || "", vendor: r.vendor || "", amount: Number(r.amount) || 0,
    paymentFrequency: (r.payment_frequency || "Monthly") as Overhead["paymentFrequency"], dueDate: r.due_date || "",
    nextChargeDate: r.next_charge_date || "", paymentMethod: r.payment_method || "", bankBucket: r.bank_bucket || "",
    autoAddToExpenses: !!r.auto_add_to_expenses, activeStatus: r.active_status !== false, notes: r.notes || "",
    createdAt: r.created_at || "", updatedAt: r.updated_at || "",
  };
}
function overheadToRow(o: Partial<Overhead>): any {
  return {
    name: o.name || "", category: o.category || "", vendor: o.vendor || "", amount: o.amount || 0,
    payment_frequency: o.paymentFrequency || "Monthly", due_date: o.dueDate || "", next_charge_date: o.nextChargeDate || "",
    payment_method: o.paymentMethod || "", bank_bucket: o.bankBucket || "", auto_add_to_expenses: !!o.autoAddToExpenses,
    active_status: o.activeStatus !== false, notes: o.notes || "", updated_at: new Date().toISOString(),
  };
}

export async function listOverhead(sb: SupabaseClient): Promise<Overhead[]> {
  const { data, error } = await sb.from("overhead_calendar").select("*").order("next_charge_date", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToOverhead);
}
export async function createOverhead(sb: SupabaseClient, o: Partial<Overhead>): Promise<Overhead> {
  const row = overheadToRow(o);
  if (isUuid(o.id)) row.id = o.id;
  const { data, error } = await sb.from("overhead_calendar").insert(row).select().single();
  if (error) throw error;
  return rowToOverhead(data);
}
export async function updateOverhead(sb: SupabaseClient, id: string, o: Partial<Overhead>): Promise<Overhead> {
  const { data, error } = await sb.from("overhead_calendar").update(overheadToRow(o)).eq("id", id).select().single();
  if (error) throw error;
  return rowToOverhead(data);
}
export async function deleteOverhead(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("overhead_calendar").delete().eq("id", id);
  if (error) throw error;
}
