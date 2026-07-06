"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { techPayroll, salesPayroll } from "@/lib/pay";
import { money, pct, sum, today } from "@/lib/format";
import { toCSV, download } from "@/lib/csv";
import { Badge, Button, Card, Kpi, PageHeader, Section } from "@/components/ui";

export default function PayrollPage() {
  const s = useStore();
  const jobs = useMemo(() => s.jobs.filter((j) => s.inRange(j.dateCompleted)), [s.jobs, s.from, s.to]);

  const tech = useMemo(() => techPayroll(jobs, s.payRules), [jobs, s.payRules]);
  const sales = useMemo(() => salesPayroll(jobs, s.salesReps, s.payRules), [jobs, s.salesReps, s.payRules]);

  const techTotal = sum(tech, (t) => t.total);
  const salesTotal = sum(sales, (r) => r.total);
  const r = s.payRules;

  return (
    <div>
      <PageHeader title="Payroll" subtitle="Commission & pay for the selected date range (completed jobs)" actions={
        <>
          <Button onClick={() => download(`tech-payroll-${today()}.csv`, toCSV(tech as unknown as Record<string, unknown>[]))}>Export Tech CSV</Button>
          <Button onClick={() => download(`sales-payroll-${today()}.csv`, toCSV(sales as unknown as Record<string, unknown>[]))}>Export Sales CSV</Button>
        </>
      } />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Tech Pay (total)" value={money(techTotal)} tone="gold" />
        <Kpi label="Sales Pay (total)" value={money(salesTotal)} tone="gold" />
        <Kpi label="Total Payroll" value={money(techTotal + salesTotal)} tone="gold" />
        <Kpi label="Techs / Reps Paid" value={`${tech.length} / ${sales.filter((x) => x.total > 0).length}`} tone="blue" />
      </div>

      <Section title="Technician Pay">
        <p className="text-xs text-muted mb-2">
          Solo {pct(r.tech[0].commissionPct, 0)} · Duo Lead {pct(r.tech[1].commissionPct, 0)} · Helper {pct(r.tech[2].commissionPct, 0)} of production,
          plus upsell &amp; tip share. Edit rates in Settings → Pay Rules.
        </p>
        {tech.length ? (
          <Card className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                {["Technician", "Jobs", "Production", "Commission", "Upsell", "Tips", "Total Pay"].map((h) => (
                  <th key={h} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>))}
              </tr></thead>
              <tbody>
                {tech.map((t) => (
                  <tr key={t.tech} className="border-b border-line/60">
                    <td className="px-3 py-2 font-medium text-ink">{t.tech}</td>
                    <td className="px-3 py-2 tabular-nums">{t.jobs}</td>
                    <td className="px-3 py-2 tabular-nums text-muted">{money(t.production)}</td>
                    <td className="px-3 py-2 tabular-nums">{money(t.commission)}</td>
                    <td className="px-3 py-2 tabular-nums">{money(t.upsell)}</td>
                    <td className="px-3 py-2 tabular-nums">{money(t.tips)}</td>
                    <td className="px-3 py-2 tabular-nums text-gold font-semibold">{money(t.total)}</td>
                  </tr>
                ))}
                <tr className="border-t border-line font-semibold">
                  <td className="px-3 py-2 text-ink">Total</td>
                  <td className="px-3 py-2 tabular-nums">{sum(tech, (t) => t.jobs)}</td>
                  <td className="px-3 py-2 tabular-nums text-muted">{money(sum(tech, (t) => t.production))}</td>
                  <td className="px-3 py-2 tabular-nums">{money(sum(tech, (t) => t.commission))}</td>
                  <td className="px-3 py-2 tabular-nums">{money(sum(tech, (t) => t.upsell))}</td>
                  <td className="px-3 py-2 tabular-nums">{money(sum(tech, (t) => t.tips))}</td>
                  <td className="px-3 py-2 tabular-nums text-gold">{money(techTotal)}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        ) : <Card className="p-6 text-center text-sm text-muted">No completed jobs with an assigned technician in range.</Card>}
      </Section>

      <Section title="Sales Commission">
        <p className="text-xs text-muted mb-2">
          {pct(r.sales.commissionPct, 0)} of commissionable revenue on completed &amp; paid jobs
          {r.sales.baseGuarantee > 0 && <> + {money(r.sales.baseGuarantee)} base{r.sales.requireCompletedPaidJob ? " (requires ≥1 completed-paid job)" : ""}</>}.
        </p>
        {sales.length ? (
          <Card className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                {["Sales Rep", "Completed", "Paid", "Commissionable", "Commission", "Base", "Total Pay"].map((h) => (
                  <th key={h} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>))}
              </tr></thead>
              <tbody>
                {sales.map((row) => (
                  <tr key={row.rep} className="border-b border-line/60">
                    <td className="px-3 py-2 font-medium text-ink">{row.rep}</td>
                    <td className="px-3 py-2 tabular-nums">{row.completedJobs}</td>
                    <td className="px-3 py-2 tabular-nums">{row.paidJobs}</td>
                    <td className="px-3 py-2 tabular-nums text-muted">{money(row.commissionable)}</td>
                    <td className="px-3 py-2 tabular-nums">{money(row.commission)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.base > 0 ? money(row.base) : <Badge value="Not Eligible" />}</td>
                    <td className="px-3 py-2 tabular-nums text-gold font-semibold">{money(row.total)}</td>
                  </tr>
                ))}
                <tr className="border-t border-line font-semibold">
                  <td className="px-3 py-2 text-ink">Total</td>
                  <td className="px-3 py-2 tabular-nums">{sum(sales, (x) => x.completedJobs)}</td>
                  <td className="px-3 py-2 tabular-nums">{sum(sales, (x) => x.paidJobs)}</td>
                  <td className="px-3 py-2 tabular-nums text-muted">{money(sum(sales, (x) => x.commissionable))}</td>
                  <td className="px-3 py-2 tabular-nums">{money(sum(sales, (x) => x.commission))}</td>
                  <td className="px-3 py-2 tabular-nums">{money(sum(sales, (x) => x.base))}</td>
                  <td className="px-3 py-2 tabular-nums text-gold">{money(salesTotal)}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        ) : <Card className="p-6 text-center text-sm text-muted">No completed jobs assigned to a sales rep in range.</Card>}
      </Section>
    </div>
  );
}
