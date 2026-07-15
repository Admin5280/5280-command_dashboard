import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireRole } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

// PATCH /api/users/[id] → update a profile (Owner/Admin only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireRole(["Owner", "Admin"]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });

  const b = await req.json();
  const patch: any = { updated_at: new Date().toISOString() };
  for (const k of ["name", "phone", "role", "department", "active", "default_commission_rate", "tech_base_pay_type", "tech_base_pay_amount", "notes"]) {
    if (k in b) patch[k] = b[k];
  }
  const { data, error } = await admin.from("profiles").update(patch).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: String(error.message) }, { status: 500 });
  return NextResponse.json({ user: data });
}

// DELETE /api/users/[id] → remove a user (Owner only)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireRole(["Owner"]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  const { error } = await admin.auth.admin.deleteUser(params.id); // profile cascades
  if (error) return NextResponse.json({ error: String(error.message) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
