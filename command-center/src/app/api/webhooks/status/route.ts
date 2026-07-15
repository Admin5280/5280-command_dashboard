import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { latestWebhookEvents } from "@/lib/leadsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/webhooks/status → { configured, events } for the Settings testing panel + Audit
export async function GET() {
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false, events: [] });
  try {
    return NextResponse.json({ configured: true, events: await latestWebhookEvents(sb, 25) });
  } catch (e) {
    return NextResponse.json({ configured: true, events: [], error: String(e) }, { status: 500 });
  }
}
