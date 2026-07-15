import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireRole } from "@/lib/authServer";
import { Role } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /api/users → list all profiles (Owner/Admin only)
export async function GET() {
  const gate = await requireRole(["Owner", "Admin"]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  const { data, error } = await admin.from("profiles").select("*").order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: String(error.message) }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

// POST /api/users → invite/create a user (Owner/Admin only). Returns a temp password to share.
export async function POST(req: NextRequest) {
  const gate = await requireRole(["Owner", "Admin"]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });

  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  // temp password the owner shares; user can reset later
  const tempPassword = `52${Math.random().toString(36).slice(2, 10)}!Aa`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password: tempPassword, email_confirm: true, user_metadata: { name: body.name || "" },
  });
  if (createErr || !created?.user) return NextResponse.json({ error: createErr?.message || "Could not create user" }, { status: 400 });

  // the trigger created a base profile; fill in the rest
  const patch: any = {
    name: body.name || "", email, phone: body.phone || "", role: (body.role as Role) || "Viewer",
    department: body.department || "", active: body.active !== false,
    default_commission_rate: body.default_commission_rate ?? 0.06,
    tech_base_pay_type: body.tech_base_pay_type || "None", tech_base_pay_amount: body.tech_base_pay_amount ?? 0,
    notes: body.notes || "", updated_at: new Date().toISOString(),
  };
  await admin.from("profiles").update(patch).eq("id", created.user.id);

  return NextResponse.json({ ok: true, id: created.user.id, tempPassword });
}
