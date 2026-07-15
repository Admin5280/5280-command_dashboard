import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { migrateCare } from "@/lib/careDb";
import { requireRole } from "@/lib/authServer";
import { CareMember, CarePerk, CareVisit } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/care/migrate { members, visits, perks } → one-time push (links preserved, deduped)
export async function POST(req: NextRequest) {
  const gate = await requireRole(["Owner", "Admin"]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  try {
    const { members, visits, perks } = (await req.json()) as { members: CareMember[]; visits: CareVisit[]; perks: CarePerk[] };
    const result = await migrateCare(sb, members || [], visits || [], perks || []);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
