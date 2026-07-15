import { SupabaseClient } from "@supabase/supabase-js";
import { ServiceCatalogItem } from "./types";
import { SERVICE_CATALOG_SEED } from "./serviceCatalogSeed";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Data-access layer for the Service Catalog (seeded from productsServices.csv, keyed by CSV id).

function rowToItem(r: any): ServiceCatalogItem {
  return {
    id: r.id, serviceName: r.service_name || "", category: r.category || "", price: r.price || "",
    description: r.description || "", isAddon: !!r.is_addon, active: r.active !== false,
    activeForJobReporting: r.active_for_job_reporting !== false, createdAt: r.created_at || "", updatedAt: r.updated_at || "",
  };
}
function itemToRow(i: Partial<ServiceCatalogItem>): any {
  return {
    service_name: i.serviceName || "", category: i.category || "", price: i.price || "", description: i.description || "",
    is_addon: !!i.isAddon, active: i.active !== false, active_for_job_reporting: i.activeForJobReporting !== false,
    updated_at: new Date().toISOString(),
  };
}

export async function listServiceCatalog(sb: SupabaseClient): Promise<ServiceCatalogItem[]> {
  const { data, error } = await sb.from("service_catalog").select("*").order("category", { ascending: true }).order("service_name", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToItem);
}
/** Update descriptive fields / active flags for one catalog entry (deactivate-only; never hard-delete used entries). */
export async function updateServiceItem(sb: SupabaseClient, id: string, i: Partial<ServiceCatalogItem>): Promise<ServiceCatalogItem> {
  const { data, error } = await sb.from("service_catalog").update(itemToRow(i)).eq("id", id).select().single();
  if (error) throw error;
  return rowToItem(data);
}
/** Add a new (non-CSV) catalog entry. Requires a client-provided stable id. */
export async function createServiceItem(sb: SupabaseClient, i: Partial<ServiceCatalogItem>): Promise<ServiceCatalogItem> {
  const { data, error } = await sb.from("service_catalog").insert({ id: i.id, ...itemToRow(i) }).select().single();
  if (error) throw error;
  return rowToItem(data);
}

/**
 * Seed / sync from the bundled CSV. Inserts new services; refreshes descriptive
 * fields on existing ones; PRESERVES manual active / active_for_job_reporting flags.
 */
export async function seedServiceCatalog(sb: SupabaseClient): Promise<{ inserted: number; updated: number; total: number }> {
  const existing = await listServiceCatalog(sb);
  const byId = new Map(existing.map((e) => [e.id, e]));
  let inserted = 0, updated = 0;
  for (const s of SERVICE_CATALOG_SEED) {
    const prior = byId.get(s.id);
    if (prior) {
      const { error } = await sb.from("service_catalog").update({
        service_name: s.serviceName, category: s.category, price: s.price, description: s.description,
        is_addon: s.isAddon, updated_at: new Date().toISOString(), // active flags left as-is
      }).eq("id", s.id);
      if (!error) updated++;
    } else {
      const { error } = await sb.from("service_catalog").insert({
        id: s.id, service_name: s.serviceName, category: s.category, price: s.price, description: s.description,
        is_addon: s.isAddon, active: true, active_for_job_reporting: true,
      });
      if (!error) inserted++;
    }
  }
  return { inserted, updated, total: SERVICE_CATALOG_SEED.length };
}
