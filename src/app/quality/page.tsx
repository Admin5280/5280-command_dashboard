"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { serviceQuality, qualityTotals } from "@/lib/quality";
import { pct, today } from "@/lib/format";
import { toCSV, download } from "@/lib/csv";
import { Card, Kpi, PageHeader, Section, StatusPill, Button } from "@/components/ui";
import { Bars, ChartCard } from "@/components/charts";

export default function QualityPage() {
  const s = useStore();
  const rows = useMemo(() => serviceQuality(s.jobs, s.from, s.to), [s.jobs, s.from, s.to]);
  const totals = useMemo(() => qualityTotals(rows), [rows]);

  const callbackChart = rows.map((r) => ({ name: r.service, value: +(r.callbackPct * 100).toFixed(1) }));
  const reviewChart = rows.map((r) => ({ name: r.service, value: +(r.reviewPct * 100).toFixed(0) }));
  const ratingChart = rows.filter((r) => r.avgRating > 0).map((r) => ({ name: r.service, value: +r.avgRating.toFixed(2) }));
  const callbacksChart = rows.map((r) => ({ name: r.service, value: r.callbacks }));
  const reviewsChart = rows.map((r) => ({ name: r.service, value: r.reviewsReceived }));

  return (
    <div>
      <PageHeader title="Quality & Reputation" subtitle="Reviews, ratings, callbacks & redo tracking by service" actions={
        <Button onClick={() => download(`service-quality-${today()}.csv`, toCSV(rows as unknown as Record<string, unknown>[]))}>Export CSV</Button>
      } />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <Kpi label="Completed Jobs" value={String(totals.completed)} tone="blue" />
        <Kpi label="Review Requests" value={String(totals.reviewRequests)} tone="blue" />
        <Kpi label="Reviews Received" value={String(totals.reviewsReceived)} tone="blue" />
        <Kpi label="Review %" value={pct(totals.reviewPct)} tone="blue" />
        <Kpi label="Avg Rating" value={totals.avgRating ? `${totals.avgRating.toFixed(2)}★` : "—"} tone={totals.avgRating >= 4.8 ? "good" : totals.avgRating >= 4.5 ? "warn" : totals.avgRating > 0 ? "danger" : "default"} />
        <Kpi label="Callbacks" value={String(totals.callbacks)} tone={totals.callbacks ? "warn" : "good"} />
        <Kpi label="Callback %" value={pct(totals.callbackPct)} tone={totals.callbackPct > 0.10 ? "danger" : totals.callbackPct >= 0.05 ? "warn" : "good"} />
        <Kpi label="Negative Reviews" value={String(totals.negativeReviews)} tone={totals.negativeReviews ? "danger" : "good"} />
        <Kpi label="Redo Jobs" value={String(totals.redoJobs)} tone={totals.redoJobs ? "warn" : "good"} />
      </div>

      <Section title="Service Quality Performance">
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              {["Service", "Completed", "Requests", "Reviews", "Review %", "Avg Rating", "Callbacks", "Callback %", "Neg. Reviews", "Neg. %", "Redo Jobs", "Redo %", "Status"].map((h) => (
                <th key={h} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>))}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.service} className="border-b border-line/60">
                  <td className="px-3 py-2 font-medium text-ink">{r.service}</td>
                  <td className="px-3 py-2 tabular-nums">{r.completed}</td>
                  <td className="px-3 py-2 tabular-nums">{r.reviewRequests}</td>
                  <td className="px-3 py-2 tabular-nums">{r.reviewsReceived}</td>
                  <td className="px-3 py-2 tabular-nums text-accent">{pct(r.reviewPct)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.avgRating ? `${r.avgRating.toFixed(2)}★` : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{r.callbacks}</td>
                  <td className={`px-3 py-2 tabular-nums ${r.callbackPct > 0.10 ? "text-danger" : r.callbackPct >= 0.05 ? "text-gold" : "text-muted"}`}>{pct(r.callbackPct)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.negativeReviews}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(r.negativePct)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.redoJobs}</td>
                  <td className="px-3 py-2 tabular-nums">{pct(r.redoPct)}</td>
                  <td className="px-3 py-2"><StatusPill label={r.status} tone={r.tone} /></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={13} className="px-3 py-8 text-center text-muted">No completed jobs in range.</td></tr>}
            </tbody>
          </table>
        </Card>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ChartCard title="Callback % by Service"><Bars data={callbackChart} xKey="name" yKey="value" color="#F5C542" /></ChartCard>
        <ChartCard title="Review % by Service"><Bars data={reviewChart} xKey="name" yKey="value" color="#1683E2" /></ChartCard>
        <ChartCard title="Average Rating by Service"><Bars data={ratingChart} xKey="name" yKey="value" color="#22C55E" /></ChartCard>
        <ChartCard title="Callbacks by Service"><Bars data={callbacksChart} xKey="name" yKey="value" color="#F5C542" /></ChartCard>
        <ChartCard title="Reviews by Service"><Bars data={reviewsChart} xKey="name" yKey="value" color="#1683E2" /></ChartCard>
      </div>
    </div>
  );
}
