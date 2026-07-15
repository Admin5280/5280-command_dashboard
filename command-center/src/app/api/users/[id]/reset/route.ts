import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireRole } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

// POST /api/users/[id]/reset  { mode: "temp" | "email" }
//  - "temp": set a new temporary password (reliable, no email needed) and return it to share
//  - "email": generate a Supabase recovery link the admin can send
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireRole(["Owner", "Admin"]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const mode = body.mode || "temp";

  // look up the user's email
  const { data: prof } = await admin.from("profiles").select("email").eq("id", params.id).single();
  const email = prof?.email as string | undefined;

  if (mode === "email") {
    if (!email) return NextResponse.json({ error: "No email on file" }, { status: 400 });
    const site = process.env.NEXT_PUBLIC_SUPABASE_URL ? "https://5280-command-dashboard.vercel.app/login" : undefined;
    const { data, error } = await (admin.auth.admin as any).generateLink({ type: "recovery", email, options: site ? { redirectTo: site } : undefined });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, link: data?.properties?.action_link || data?.action_link || "" });
  }

  // temp password path
  const tempPassword = `52${Math.random().toString(36).slice(2, 10)}!Aa`;
  const { error } = await admin.auth.admin.updateUserById(params.id, { password: tempPassword });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, tempPassword });
}
