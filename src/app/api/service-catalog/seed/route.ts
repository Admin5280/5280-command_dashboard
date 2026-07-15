import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { seedServiceCatalog } from "@/lib/serviceCatalogDb";
import { requireRole } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/service-catalog/seed → insert new services + refresh descriptive fields
// from the bundled productsServices.csv seed. Manual active flags are preserved.
export async function POST() {
  const gate = await requireRole(["Owner", "Admin"]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await seedServiceCatalog(sb)) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
