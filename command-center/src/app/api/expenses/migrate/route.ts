import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { migrateExpenses } from "@/lib/expensesDb";
import { requireRole } from "@/lib/authServer";
import { Expense } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/expenses/migrate { expenses } → one-time push of localStorage expenses (deduped)
export async function POST(req: NextRequest) {
  const gate = await requireRole(["Owner", "Admin", "Finance"]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  try {
    const { expenses } = (await req.json()) as { expenses: Expense[] };
    const result = await migrateExpenses(sb, Array.isArray(expenses) ? expenses : []);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
