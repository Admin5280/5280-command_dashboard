"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { overview, byGroup, countByGroup, completed, revenue, marketingByChannel } from "@/lib/metrics";
import { careKpis } from "@/lib/careClub";
import { kpiRows, monthlyGoalRows, rangeDays } from "@/lib/kpi";
import { money, num, pct } from "@/lib/format";
import { Kpi, PageHeader, Section, BarList, StatusPill } from "@/components/ui";

export default function Overview() {
  const s = useStore();
  const leads = useMemo(() => s.leads.filter((l) => s.inRange(l.dateCreated)), [s.leads, s.from, s.to]);
  const jobs = useMemo(() => s.jobs.filter((j) => s.inRange(j.dateCompleted)), [s.jobs, s.from, s.to]);
  const mkt = useMemo(() => s.marketing.filter((m) => s.inRange(m.date)), [s.marketing, s.from, s.to]);
  const o = useMemo(() => overview(leads, jobs, mkt), [leads, jobs, mkt]);

  const revBySource = useMemo(() => byGroup(completed(jobs), (j) => j.confirmedSource, revenue), [jobs]);
  const leadsByStatus = useMemo(() => countByGroup(leads, (l) => l.status), [leads]);
  const jobsByTech = useMemo(() => byGroup(completed(jobs), (j) => j.leadTech, revenue), [jobs]);
  const care = useMemo(() => careKpis(s.careMembers, s.from, s.to), [s.careMembers, s.from, s.to]);
  const mktByChannel = useMemo(() => marketingByChannel(s.marketing, s.leads, s.jobs, s.from, s.to), [s.marketing, s.leads, s.jobs, s.from, s.to]);
  const kpiDays = useMemo(() => rangeDays(s.from, s.to), [s.from, s.to]);
  const kpiTargetRows = useMemo(() => [...kpiRows(jobs, s.kpiTargets, kpiDays), ...monthlyGoalRows(o.completedRevenue, s.kpiTargets)], [jobs, s.kpiTargets, kpiDays, o.completedRevenue]);

  return (
    <div>
      <PageHeader title="Overview" subtitle="Key performance for the selected date range" />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <Kpi label="Total Leads" value={o.totalLeads.toLocaleString()} tone="blue" />
        <Kpi label="Booked Jobs" value={o.bookedJobs.toLocaleString()} tone="blue" />
        <Kpi label="Close Rate" value={pct(o.closeRate)} tone="blue" />
        <Kpi label="Jobs Completed" value={o.completedJobs.toLocaleString()} tone="blue" />
        <Kpi label="Completed Revenue" value={money(o.completedRevenue)} tone="gold" />
        <Kpi label="Collected" value={money(o.collectedRevenue)} tone="gold" />
        <Kpi label="Amount Due" value={money(o.amountDue)} tone={o.amountDue > 0 ? "danger" : "default"} />
        <Kpi label="Average Ticket" value={money(o.avgTicket)} tone="gold" />
        <Kpi label="Ad Spend" value={money(o.adSpend)} tone="gold" />
        <Kpi label="Cost / Lead" value={money(o.cpl)} />
        <Kpi label="Cost / Booked Job" value={money(o.cpbj)} />
        <Kpi label="ROAS" value={`${o.roas.toFixed(2)}x`} tone={o.roas >= 1 ? "good" : "warn"} />
        <Kpi label="Total Tips" value={money(o.tips)} tone="gold" />
        <Kpi label="Tech Upsells" value={money(o.upsells)} tone="gold" sub={`${pct(o.upsellRate)} of revenue`} />
        <Kpi label="Booked Revenue" value={money(o.bookedRevenue)} tone="gold" />
      </div>

      <Section title={`KPI Targets — ${kpiDays} day(s) in range`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-muted text-xs uppercase tracking-wide">
                <th className="py-2 pr-3">Target Area</th><th className="pr-3">Target</th><th className="pr-3">Actual</th>
                <th className="pr-3">Difference</th><th className="pr-3">Progress</th><th className="pr-3">Needed</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {kpiTargetRows.map((r) => {
                const f = (n: number) => (r.kind === "jobs" ? num(n) : money(n));
                const tone = r.status === "hit" ? "good" : r.status === "close" ? "warn" : "danger";
                return (
                  <tr key={r.key} className="border-t border-line/50">
                    <td className="py-2 pr-3 text-ink">{r.label}</td>
                    <td className="pr-3 tabular-nums">{f(r.target)}</td>
                    <td className="pr-3 tabular-nums text-gold">{f(r.actual)}</td>
                    <td className={`pr-3 tabular-nums ${r.diff >= 0 ? "text-good" : "text-danger"}`}>{r.diff >= 0 ? "+" : ""}{f(r.diff)}</td>
                    <td className="pr-3 tabular-nums">{pct(r.pct)}</td>
                    <td className="pr-3 tabular-nums text-muted">{r.neededRemaining > 0 ? f(r.neededRemaining) : "—"}</td>
                    <td><StatusPill label={r.status === "hit" ? "On Target" : r.status === "close" ? "Close" : "Below"} tone={tone} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-2">Daily targets are prorated across the {kpiDays} day(s) in the selected range. Edit targets in Settings → KPI Targets. <span className="text-good">Green</span> = on target · <span className="text-gold">Gold</span> = close (≥80%) · <span className="text-danger">Red</span> = below.</p>
      </Section>

      <Section title="Care Club Membership">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Kpi label="Active Members" value={care.active.toLocaleString()} tone="blue" />
          <Kpi label="MRR" value={money(care.mrr)} tone="gold" sub={`ARR ${money(care.arr)}`} />
          <Kpi label="Cash Collected" value={money(care.cashCollected)} tone="gold" />
          <Kpi label="Founding 100" value={`${care.foundingFilled}/100`} tone="blue" sub={`${care.foundingRemaining} left`} />
          <Kpi label="Past Due" value={care.pastDue.toLocaleString()} tone={care.pastDue > 0 ? "danger" : "default"} />
          <Kpi label="Renewals (30d)" value={care.renewalsDue.toLocaleString()} tone={care.renewalsDue > 0 ? "warn" : "default"} />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Revenue by Confirmed Source"><BarList data={revBySource} money /></Section>
        <Section title="Leads by Status"><BarList data={leadsByStatus} /></Section>
        <Section title="Revenue by Lead Tech"><BarList data={jobsByTech} money /></Section>
        <Section title="Bookings by Channel"><BarList data={mktByChannel.map((c) => ({ label: c.channel, value: c.bookings }))} /></Section>
      </div>
    </div>
  );
}
