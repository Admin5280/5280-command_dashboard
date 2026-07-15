import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { listMembers, createMember } from "@/lib/careDb";
import { requireRole } from "@/lib/authServer";
import { CareMember } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READ = ["Owner", "Admin", "Manager", "Sales Rep", "VA", "Finance", "Technician", "Viewer"] as const;
const WRITE = ["Owner", "Admin", "Manager", "Sales Rep", "VA"] as const;

export async function GET() {
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false, members: [] });
  const gate = await requireRole([...READ]);
  if ("error" in gate) return NextResponse.json({ configured: true, members: [], error: gate.error }, { status: gate.status });
  try {
    return NextResponse.json({ configured: true, members: await listMembers(sb) });
  } catch (e) {
    return NextResponse.json({ configured: true, members: [], error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireRole([...WRITE]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  try {
    const body = (await req.json()) as Partial<CareMember>;
    return NextResponse.json({ member: await createMember(sb, body) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
