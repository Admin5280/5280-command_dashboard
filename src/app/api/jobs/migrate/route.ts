import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { migrateJobs } from "@/lib/jobsDb";
import { requireRole } from "@/lib/authServer";
import { Job } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/jobs/migrate { jobs: Job[] } → one-time push of localStorage jobs (deduped)
export async function POST(req: NextRequest) {
  const gate = await requireRole(["Owner", "Admin", "Manager"]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  try {
    const { jobs } = (await req.json()) as { jobs: Job[] };
    const result = await migrateJobs(sb, Array.isArray(jobs) ? jobs : []);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
