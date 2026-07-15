import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { listExpenses, createExpense } from "@/lib/expensesDb";
import { requireRole } from "@/lib/authServer";
import { Expense } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READ = ["Owner", "Admin", "Manager", "Finance", "VA", "Viewer"] as const;
const WRITE = ["Owner", "Admin", "Finance"] as const;

export async function GET() {
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false, expenses: [] });
  const gate = await requireRole([...READ]);
  if ("error" in gate) return NextResponse.json({ configured: true, expenses: [], error: gate.error }, { status: gate.status });
  try {
    return NextResponse.json({ configured: true, expenses: await listExpenses(sb) });
  } catch (e) {
    return NextResponse.json({ configured: true, expenses: [], error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireRole([...WRITE]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  try {
    const body = (await req.json()) as Partial<Expense>;
    return NextResponse.json({ expense: await createExpense(sb, body) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
