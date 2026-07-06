"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { money, safeDiv, groupBy, sum } from "@/lib/format";
import { completed, revenue, countByGroup } from "@/lib/metrics";
import { Card, Kpi, PageHeader, Section, BarList } from "@/components/ui";

export default function OperationsPage() {
  const s = useStore();
  const jobs = useMemo(() => s.jobs.filter((j) => s.inRange(j.dateCompleted)), [s.jobs, s.from, s.to]);
  const comp = completed(jobs);

  const techs = useMemo(() => {
    const g = groupBy(comp, (j) => j.leadTech);
    return s.technicians.map((tech) => {
      const items = g[tech] ?? [];
      const rev = sum(items, revenue);
      return {
        tech, jobs: items.length, production: rev, avg: safeDiv(rev, items.length),
        tips: sum(items, (j) => j.tip), upsells: sum(items, (j) => j.techUpsellAmount),
      };
    }).sort((a, b) => b.production - a.production);
  }, [comp, s.technicians]);

  const avgJob = safeDiv(sum(comp, revenue), comp.length);

  return (
    <div>
      <PageHeader title="Operations" subtitle="Production by technician (completed jobs)" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Completed Jobs" value={comp.length.toLocaleString()} tone="blue" />
        <Kpi label="Average Job Value" value={money(avgJob)} tone="gold" />
        <Kpi label="Total Tips" value={money(sum(comp, (j) => j.tip))} tone="gold" />
        <Kpi label="Tech Upsells" value={money(sum(comp, (j) => j.techUpsellAmount))} tone="gold" />
      </div>

      <Section title="By Lead Technician">
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              {["Technician", "Jobs", "Production", "Avg Job", "Tips", "Upsells"].map((h) => (
                <th key={h} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>))}
            </tr></thead>
            <tbody>
              {techs.map((t) => (
                <tr key={t.tech} className="border-b border-line/60">
                  <td className="px-3 py-2 font-medium text-ink">{t.tech}</td>
                  <td className="px-3 py-2 tabular-nums">{t.jobs}</td>
                  <td className="px-3 py-2 tabular-nums text-gold">{money(t.production)}</td>
                  <td className="px-3 py-2 tabular-nums">{money(t.avg)}</td>
                  <td className="px-3 py-2 tabular-nums">{money(t.tips)}</td>
                  <td className="px-3 py-2 tabular-nums">{money(t.upsells)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Production by Tech"><BarList data={techs.map((t) => ({ label: t.tech, value: t.production }))} money /></Section>
        <Section title="Payment Status Breakdown"><BarList data={countByGroup(jobs, (j) => j.paymentStatus)} /></Section>
      </div>
    </div>
  );
}
