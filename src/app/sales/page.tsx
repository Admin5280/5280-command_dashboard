"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { money, pct, safeDiv, groupBy, sum } from "@/lib/format";
import { byGroup } from "@/lib/metrics";
import { Card, PageHeader, Section, BarList } from "@/components/ui";

export default function SalesPage() {
  const s = useStore();
  const leads = useMemo(() => s.leads.filter((l) => s.inRange(l.dateCreated)), [s.leads, s.from, s.to]);
  const isBooked = (st: string) => st === "Booked" || st === "Care Club Sold";

  const reps = useMemo(() => {
    const g = groupBy(leads, (l) => l.assignedSalesRep);
    return s.salesReps.map((rep) => {
      const items = g[rep] ?? [];
      const booked = items.filter((l) => isBooked(l.status));
      const lost = items.filter((l) => l.status === "Lost").length;
      return {
        rep, leads: items.length, booked: booked.length,
        close: safeDiv(booked.length, items.length),
        revenue: sum(booked, (l) => l.bookedJobValue || l.quoteAmount), lost,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [leads, s.salesReps]);

  const lostLeads = leads.filter((l) => l.status === "Lost");

  return (
    <div>
      <PageHeader title="Sales" subtitle="Per-rep performance (from lead data)" />

      <Section title="Sales Rep Performance">
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              {["Sales Rep", "Leads", "Booked", "Close Rate", "Booked Revenue", "Lost"].map((h) => (
                <th key={h} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>))}
            </tr></thead>
            <tbody>
              {reps.map((r) => (
                <tr key={r.rep} className="border-b border-line/60">
                  <td className="px-3 py-2 font-medium text-ink">{r.rep}</td>
                  <td className="px-3 py-2 tabular-nums">{r.leads}</td>
                  <td className="px-3 py-2 tabular-nums">{r.booked}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(r.close)}</td>
                  <td className="px-3 py-2 tabular-nums text-gold">{money(r.revenue)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.lost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <Section title="Leads by Rep"><BarList data={byGroup(leads, (l) => l.assignedSalesRep, () => 1)} /></Section>
        <Section title="Booked Revenue by Rep"><BarList data={reps.map((r) => ({ label: r.rep, value: r.revenue }))} money /></Section>
      </div>

      <Section title={`Lost Leads (${lostLeads.length})`}>
        {lostLeads.length ? (
          <Card className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                {["Customer", "Rep", "Confirmed Source", "Quote", "Reason / Notes"].map((h) => (
                  <th key={h} className="text-left font-medium px-3 py-2.5">{h}</th>))}
              </tr></thead>
              <tbody>
                {lostLeads.map((l) => (
                  <tr key={l.id} className="border-b border-line/60">
                    <td className="px-3 py-2 text-ink">{l.customerName}</td>
                    <td className="px-3 py-2">{l.assignedSalesRep || "—"}</td>
                    <td className="px-3 py-2">{l.confirmedSource || <span className="text-danger">⚠ review</span>}</td>
                    <td className="px-3 py-2 tabular-nums">{money(l.quoteAmount)}</td>
                    <td className="px-3 py-2 text-muted">{l.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : <Card className="p-6 text-center text-sm text-muted">No lost leads in range. 🎉</Card>}
      </Section>
    </div>
  );
}
