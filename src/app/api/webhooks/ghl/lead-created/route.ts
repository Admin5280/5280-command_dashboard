import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { upsertFromGhl, logWebhookEvent, GhlLeadPayload } from "@/lib/leadsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sb = supabaseAdmin();

  // 1) auth — shared secret header
  const secret = req.headers.get("x-5280-webhook-secret");
  const expected = process.env.GHL_WEBHOOK_SECRET;
  if (!expected || !secret || secret !== expected) {
    await logWebhookEvent(sb, { status: "unauthorized", message: "Missing or invalid webhook secret" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) db must be configured
  if (!sb) {
    return NextResponse.json({ error: "Supabase not configured on server" }, { status: 500 });
  }

  // 3) parse payload
  let payload: GhlLeadPayload;
  try {
    payload = (await req.json()) as GhlLeadPayload;
  } catch {
    await logWebhookEvent(sb, { status: "error", message: "Invalid JSON body" });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 4) upsert (dedupe by contact id → phone → email) + log
  try {
    const { lead, duplicate } = await upsertFromGhl(sb, payload);
    await logWebhookEvent(sb, {
      status: duplicate ? "duplicate" : "created", lead_id: lead.leadId,
      ghl_contact_id: payload.ghlContactId ?? null, duplicate, message: duplicate ? "Updated existing lead" : "Created new lead", payload,
    });
    return NextResponse.json({ ok: true, leadId: lead.leadId, duplicate });
  } catch (e) {
    await logWebhookEvent(sb, { status: "error", ghl_contact_id: payload.ghlContactId ?? null, message: String(e), payload });
    return NextResponse.json({ error: "Failed to process lead", detail: String(e) }, { status: 500 });
  }
}
