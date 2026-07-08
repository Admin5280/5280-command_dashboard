import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { listJobs, createJob } from "@/lib/jobsDb";
import { requireRole } from "@/lib/authServer";
import { Job } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JOB_WRITE_ROLES = ["Owner", "Admin", "Manager", "VA", "Finance"] as const;

// GET /api/jobs → { configured, jobs } (any signed-in user; falls back to local when unconfigured)
export async function GET() {
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false, jobs: [] });
  const gate = await requireRole(["Owner", "Admin", "Manager", "Sales Rep", "VA", "Finance", "Technician", "Viewer"]);
  if ("error" in gate) return NextResponse.json({ configured: true, jobs: [], error: gate.error }, { status: gate.status });
  try {
    return NextResponse.json({ configured: true, jobs: await listJobs(sb) });
  } catch (e) {
    return NextResponse.json({ configured: true, jobs: [], error: String(e) }, { status: 500 });
  }
}

// POST /api/jobs → create a job
export async function POST(req: NextRequest) {
  const gate = await requireRole([...JOB_WRITE_ROLES]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  try {
    const body = (await req.json()) as Partial<Job>;
    return NextResponse.json({ job: await createJob(sb, body) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
