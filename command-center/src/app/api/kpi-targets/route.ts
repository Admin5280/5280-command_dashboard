import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getKpiTargets, saveKpiTargets } from "@/lib/kpiTargetsDb";
import { requireRole } from "@/lib/authServer";
import { KpiTargets } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false, targets: null });
  const gate = await requireRole(["Owner", "Admin", "Manager", "Sales Rep", "VA", "Finance", "Technician", "Viewer"]);
  if ("error" in gate) return NextResponse.json({ configured: true, targets: null, error: gate.error }, { status: gate.status });
  try {
    return NextResponse.json({ configured: true, targets: await getKpiTargets(sb) });
  } catch (e) {
    return NextResponse.json({ configured: true, targets: null, error: String(e) }, { status: 500 });
  }
}

// PUT /api/kpi-targets → upsert the single 'default' row
export async function PUT(req: NextRequest) {
  const gate = await requireRole(["Owner", "Admin"]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  try {
    const body = (await req.json()) as KpiTargets;
    return NextResponse.json({ targets: await saveKpiTargets(sb, body) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
