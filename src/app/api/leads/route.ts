import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { listLeads, createLead } from "@/lib/leadsDb";
import { Lead } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/leads → { configured, leads }. When Supabase is not configured the
// client falls back to localStorage/sample data.
export async function GET() {
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false, leads: [] });
  try {
    return NextResponse.json({ configured: true, leads: await listLeads(sb) });
  } catch (e) {
    return NextResponse.json({ configured: true, leads: [], error: String(e) }, { status: 500 });
  }
}

// POST /api/leads → create a manual lead
export async function POST(req: NextRequest) {
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  try {
    const body = (await req.json()) as Partial<Lead>;
    return NextResponse.json({ lead: await createLead(sb, { ...body, origin: body.origin || "manual" }) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
