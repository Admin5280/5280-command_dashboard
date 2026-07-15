import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getFinanceSettings, saveFinanceSettings } from "@/lib/financeSettingsDb";
import { requireRole } from "@/lib/authServer";
import { FinanceSettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false, settings: null });
  const gate = await requireRole(["Owner", "Admin", "Manager", "Finance", "VA", "Viewer"]);
  if ("error" in gate) return NextResponse.json({ configured: true, settings: null, error: gate.error }, { status: gate.status });
  try {
    return NextResponse.json({ configured: true, settings: await getFinanceSettings(sb) });
  } catch (e) {
    return NextResponse.json({ configured: true, settings: null, error: String(e) }, { status: 500 });
  }
}

// PUT /api/finance-settings → upsert the single 'default' row
export async function PUT(req: NextRequest) {
  const gate = await requireRole(["Owner", "Admin", "Finance"]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  try {
    const body = (await req.json()) as Partial<FinanceSettings>;
    return NextResponse.json({ settings: await saveFinanceSettings(sb, body) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
