import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { migrateLeads } from "@/lib/leadsDb";
import { requireRole } from "@/lib/authServer";
import { LEAD_WRITE_ROLES } from "@/lib/permissions";
import { Lead } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leads/migrate  { leads: Lead[] } → one-time push of localStorage leads
export async function POST(req: NextRequest) {
  const gate = await requireRole(LEAD_WRITE_ROLES);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  try {
    const { leads } = (await req.json()) as { leads: Lead[] };
    const count = await migrateLeads(sb, Array.isArray(leads) ? leads : []);
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
