import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { listServiceCatalog, createServiceItem } from "@/lib/serviceCatalogDb";
import { requireRole } from "@/lib/authServer";
import { ServiceCatalogItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const READ = ["Owner", "Admin", "Manager", "Sales Rep", "VA", "Finance", "Technician", "Viewer"] as const;
const WRITE = ["Owner", "Admin"] as const;

export async function GET() {
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ configured: false, catalog: [] });
  const gate = await requireRole([...READ]);
  if ("error" in gate) return NextResponse.json({ configured: true, catalog: [], error: gate.error }, { status: gate.status });
  try {
    return NextResponse.json({ configured: true, catalog: await listServiceCatalog(sb) });
  } catch (e) {
    return NextResponse.json({ configured: true, catalog: [], error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireRole([...WRITE]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  try {
    const body = (await req.json()) as Partial<ServiceCatalogItem>;
    if (!body.id) return NextResponse.json({ error: "id is required for a catalog entry" }, { status: 400 });
    return NextResponse.json({ item: await createServiceItem(sb, body) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
