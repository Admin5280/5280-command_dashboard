import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { updateServiceItem } from "@/lib/serviceCatalogDb";
import { requireRole } from "@/lib/authServer";
import { ServiceCatalogItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH only — service catalog entries are deactivated (active=false), never hard-deleted, if used in records.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireRole(["Owner", "Admin"]);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const sb = supabaseAdmin();
  if (!sb) return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  try {
    const body = (await req.json()) as Partial<ServiceCatalogItem>;
    return NextResponse.json({ item: await updateServiceItem(sb, params.id, body) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
