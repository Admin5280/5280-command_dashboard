import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { listOverhead, createOverhead } from "@/lib/overheadDb";
import { requireRole } from "@/lib/authServer";
import { Overhead } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READ = ["Owner", "Admin", "Manager", "Finance", "VA", "Viewer"] as const;
const WRITE = ["Owner", "Admin", "Finance"] as const;

export async function GET() {
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false, overhead: [] });
  const gate = await requireRole([...READ]);
  if ("error" in gate) return NextResponse.json({ configured: true, overhead: [], error: gate.error }, { status: gate.status });
  try {
    return NextResponse.json({ configured: true, overhead: await listOverhead(sb) });
  } catch (e) {
    return NextResponse.json({ configured: true, overhead: [], error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireRole([...WRITE]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  try {
    const body = (await req.json()) as Partial<Overhead>;
    return NextResponse.json({ overhead: await createOverhead(sb, body) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
