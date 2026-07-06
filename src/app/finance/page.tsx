"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { money, pct, sum } from "@/lib/format";
import { completed, revenue, byGroup } from "@/lib/metrics";
import { careKpis } from "@/lib/careClub";
import { Kpi, PageHeader, Section, BarList } from "@/components/ui";

export default function FinancePage() {
  const s = useStore();
  const jobs = useMemo(() => s.jobs.filter((j) => s.inRange(j.dateCompleted)), [s.jobs, s.from, s.to]);
  const comp = completed(jobs);

  const totalRevenue = sum(comp, revenue);
  const collected = sum(comp, (j) => j.amountPaid);
  const due = sum(comp, (j) => j.amountDue);
  const tips = sum(comp, (j) => j.tip);
  const upsells = sum(comp, (j) => j.techUpsellAmount);
  const discounts = sum(comp, (j) => j.discount);
  const collectRate = totalRevenue ? collected / totalRevenue : 0;
  const care = useMemo(() => careKpis(s.careMembers, s.from, s.to), [s.careMembers, s.from, s.to]);

  return (
    <div>
      <PageHeader title="Finance" subtitle="Revenue, collections & outstanding balances (completed jobs)" />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <Kpi label="Total Revenue" value={money(totalRevenue)} tone="gold" />
        <Kpi label="Collected" value={money(collected)} tone="gold" sub={`${pct(collectRate)} of revenue`} />
        <Kpi label="Amount Due" value={money(due)} tone={due > 0 ? "danger" : "default"} />
        <Kpi label="Total Tips" value={money(tips)} tone="gold" />
        <Kpi label="Tech Upsells" value={money(upsells)} tone="gold" />
        <Kpi label="Discounts Given" value={money(discounts)} tone={discounts > 0 ? "warn" : "default"} />
      </div>

      <Section title="Care Club Recurring Revenue">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="MRR" value={money(care.mrr)} tone="gold" />
          <Kpi label="ARR (run-rate)" value={money(care.arr)} tone="gold" />
          <Kpi label="Membership Cash Collected" value={money(care.cashCollected)} tone="gold" />
          <Kpi label="Membership Amount Due" value={money(care.amountDue)} tone={care.amountDue > 0 ? "danger" : "default"} />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Revenue by Service"><BarList data={byGroup(comp, (j) => j.services, revenue)} money /></Section>
        <Section title="Revenue by Confirmed Source"><BarList data={byGroup(comp, (j) => j.confirmedSource, revenue)} money /></Section>
      </div>
    </div>
  );
}
