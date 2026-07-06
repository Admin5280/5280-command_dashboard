"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  CareMember, OFFER_TYPES, MEMBER_TIERS, PAYMENT_PLANS, MEMBER_STATUSES, CARE_PAYMENT_STATUSES, CARE_UNITS,
} from "@/lib/types";
import { careKpis, pricingFor } from "@/lib/careClub";
import { money, prettyDate, today, groupBy, sum } from "@/lib/format";
import { toCSV, download } from "@/lib/csv";
import { Badge, Button, Card, Field, Input, Kpi, Modal, PageHeader, Section, Select, Table, Textarea, Col } from "@/components/ui";
import { Bars, ChartCard, Donut, Gauge, TrendLine } from "@/components/charts";

const blank = (): Omit<CareMember, "id"> => ({
  memberNumber: "", leadId: "", customerId: "", ghlContactId: "", ghlContactLink: "",
  customerName: "", phone: "", email: "", address: "", zip: "",
  offerType: "Founding 100 Charter Offer", memberTier: "Founding 100", paymentPlan: "Monthly", memberStatus: "Active",
  signupDate: today(), startDate: today(), renewalDate: "", cancelDate: "",
  primaryVehicle: "", secondVehicle: "", additionalVehicles: 0,
  monthlyRate: 245, secondVehicleRate: 0, onboardingFee: 245, amountDueToday: 490,
  totalContractValue: 3185, amountPaid: 0, amountDue: 0, paymentStatus: "Unpaid", paymentMethod: "Stripe",
  assignedSalesRep: "Haley Brasil Soares", assignedFounderTech: "", preferredUnit: CARE_UNITS[1],
  lastDetailDate: "", nextDetailDate: "", visitsThisMonth: 0, visitsThisYear: 0, perksUsedThisYear: 0,
  source: "", notes: "", createdAt: today(), updatedAt: today(),
});

function monthKey(iso: string) { return iso ? iso.slice(0, 7) : ""; }

export default function CareClubPage() {
  const s = useStore();
  const members = useMemo(() => s.careMembers, [s.careMembers]);
  const k = useMemo(() => careKpis(members, s.from, s.to), [members, s.from, s.to]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CareMember | null>(null);
  const [form, setForm] = useState<Omit<CareMember, "id">>(blank());
  const [fStatus, setFStatus] = useState("All");
  const [fOffer, setFOffer] = useState("All");
  const [fPlan, setFPlan] = useState("All");
  const [q, setQ] = useState("");

  const rows = useMemo(() => members
    .filter((m) => fStatus === "All" || m.memberStatus === fStatus)
    .filter((m) => fOffer === "All" || m.offerType === fOffer)
    .filter((m) => fPlan === "All" || m.paymentPlan === fPlan)
    .filter((m) => !q || `${m.customerName} ${m.phone} ${m.email} ${m.memberNumber} ${m.primaryVehicle}`.toLowerCase().includes(q.toLowerCase())),
    [members, fStatus, fOffer, fPlan, q]);

  // charts
  const byPlan = useMemo(() => Object.entries(groupBy(members.filter((m) => m.memberStatus === "Active"), (m) => m.paymentPlan)).map(([name, v]) => ({ name, value: v.length })), [members]);
  const byTier = useMemo(() => Object.entries(groupBy(members.filter((m) => m.memberStatus === "Active"), (m) => m.memberTier)).map(([name, v]) => ({ name, value: v.length })), [members]);
  const mrrByTier = useMemo(() => Object.entries(groupBy(members.filter((m) => m.memberStatus === "Active" && m.paymentPlan === "Monthly"), (m) => m.memberTier))
    .map(([name, v]) => ({ name, value: sum(v, (m) => m.monthlyRate + m.secondVehicleRate) })), [members]);
  const signups = useMemo(() => {
    const g = groupBy(members.filter((m) => m.signupDate), (m) => monthKey(m.signupDate));
    return Object.entries(g).sort().map(([month, v]) => ({ month, signups: v.length, revenue: sum(v, (m) => m.amountPaid) }));
  }, [members]);
  const perksByType = useMemo(() => Object.entries(groupBy(s.carePerks.filter((p) => p.status === "Used"), (p) => p.perkName)).map(([name, v]) => ({ name, value: v.length })), [s.carePerks]);

  const t = today();
  const pastDue = members.filter((m) => m.memberStatus === "Past Due" || m.paymentStatus === "Past Due");
  const renewals = members.filter((m) => m.renewalDate && m.renewalDate >= t).sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
  const overdue = members.filter((m) => m.memberStatus === "Active" && m.nextDetailDate && m.nextDetailDate < t);
  const upcomingVisits = s.careVisits.filter((v) => v.visitStatus === "Scheduled").sort((a, b) => a.visitDate.localeCompare(b.visitDate));

  function openNew() { setEditing(null); setForm(blank()); setOpen(true); }
  function openEdit(m: CareMember) { setEditing(m); const { id, ...rest } = m; setForm(rest); setOpen(true); }
  function save() {
    if (!form.customerName.trim()) return;
    const payload = { ...form, updatedAt: today() };
    if (editing) s.updateMember({ ...payload, id: editing.id }); else s.addMember(payload);
    setOpen(false);
  }
  const set = (patch: Partial<Omit<CareMember, "id">>) => setForm((f) => ({ ...f, ...patch }));
  // auto-fill rates from pricing when offer/plan changes
  function applyPricing(offer = form.offerType, plan = form.paymentPlan) {
    const p = pricingFor(offer, plan);
    set({ offerType: offer, paymentPlan: plan, monthlyRate: p.monthlyRate, secondVehicleRate: p.secondRate,
      onboardingFee: p.onboarding, amountDueToday: p.dueToday || p.total, totalContractValue: p.total || p.year1Pay });
  }

  const cols: Col<CareMember>[] = [
    { key: "memberNumber", label: "#", render: (m) => <span className="text-gold font-semibold">{m.memberNumber || "—"}</span> },
    { key: "customerName", label: "Member", render: (m) => <span className="font-medium text-ink">{m.customerName}</span> },
    { key: "memberTier", label: "Tier" },
    { key: "paymentPlan", label: "Plan" },
    { key: "memberStatus", label: "Status", render: (m) => <Badge value={m.memberStatus} /> },
    { key: "monthlyRate", label: "Monthly", render: (m) => <span className="tabular-nums">{m.paymentPlan === "Monthly" ? money(m.monthlyRate + m.secondVehicleRate) : "—"}</span> },
    { key: "amountPaid", label: "Paid", render: (m) => <span className="tabular-nums text-good">{money(m.amountPaid)}</span> },
    { key: "amountDue", label: "Due", render: (m) => <span className={`tabular-nums ${m.amountDue > 0 ? "text-danger" : "text-muted"}`}>{money(m.amountDue)}</span> },
    { key: "nextDetailDate", label: "Next Detail", render: (m) => <span className={m.nextDetailDate && m.nextDetailDate < t ? "text-danger" : "text-muted"}>{prettyDate(m.nextDetailDate)}</span> },
    { key: "ghl", label: "GHL", render: (m) => m.ghlContactLink ? <a href={m.ghlContactLink} target="_blank" className="text-accent hover:underline">open ↗</a> : <span className="text-muted">—</span> },
    { key: "_", label: "", render: (m) => (
      <div className="flex gap-1 justify-end">
        <Button variant="ghost" onClick={() => openEdit(m)}>Edit</Button>
        <Button variant="ghost" onClick={() => confirm(`Delete ${m.customerName}?`) && s.deleteMember(m.id)}>✕</Button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Care Club" subtitle="Membership control center · founding cohort, MRR & visit usage" actions={
        <>
          <Button onClick={() => download(`care-club-members-${today()}.csv`, toCSV(rows as unknown as Record<string, unknown>[]))}>Export CSV</Button>
          <Button variant="accent" onClick={openNew}>+ Add Member</Button>
        </>
      } />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
        <Kpi label="Active Members" value={String(k.active)} tone="blue" />
        <Kpi label="Founding Filled" value={`${k.foundingFilled}/100`} tone="blue" />
        <Kpi label="Founding Remaining" value={String(k.foundingRemaining)} tone={k.foundingRemaining < 20 ? "danger" : "default"} />
        <Kpi label="Founders 25 Filled" value={`${k.founders25Filled}/25`} tone="blue" />
        <Kpi label="MRR" value={money(k.mrr)} tone="gold" />
        <Kpi label="ARR" value={money(k.arr)} tone="gold" />
        <Kpi label="Cash Collected" value={money(k.cashCollected)} tone="gold" />
        <Kpi label="Amount Due" value={money(k.amountDue)} tone={k.amountDue > 0 ? "danger" : "default"} />
        <Kpi label="Avg Rev / Member" value={money(k.avgRevPerMember)} tone="gold" />
        <Kpi label="Visits This Month" value={String(k.visitsThisMonth)} tone="blue" />
        <Kpi label="Overdue Details" value={String(k.overdueDetails)} tone={k.overdueDetails > 0 ? "danger" : "good"} />
        <Kpi label="Past Due Members" value={String(k.pastDue)} tone={k.pastDue > 0 ? "danger" : "good"} />
        <Kpi label="Renewals Due (30d)" value={String(k.renewalsDue)} tone={k.renewalsDue > 0 ? "warn" : "default"} />
        <Kpi label="PIF Members" value={String(k.pif)} tone="blue" />
      </div>

      {/* gauges + donuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Gauge value={k.foundingFilled} max={100} label="Founding 100 Fill" color="#1683E2" />
        <Gauge value={k.founders25Filled} max={25} label="Founders 25 Fill" color="#F5C542" />
        <ChartCard title="Active by Payment Plan" height={200}><Donut data={byPlan} /></ChartCard>
        <ChartCard title="Active by Tier" height={200}><Donut data={byTier} /></ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ChartCard title="MRR by Tier"><Bars data={mrrByTier} xKey="name" yKey="value" money color="#F5C542" /></ChartCard>
        <ChartCard title="Signups Over Time"><TrendLine data={signups} xKey="month" yKey="signups" color="#1683E2" /></ChartCard>
        <ChartCard title="Care Club Revenue Over Time"><TrendLine data={signups} xKey="month" yKey="revenue" color="#22C55E" money /></ChartCard>
      </div>

      {/* member table + filters */}
      <Section title={`Members (${rows.length})`}>
        <div className="flex flex-wrap gap-2 mb-3">
          <Select options={["All", ...MEMBER_STATUSES]} value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-auto" />
          <Select options={["All", ...OFFER_TYPES]} value={fOffer} onChange={(e) => setFOffer(e.target.value)} className="w-auto" />
          <Select options={["All", ...PAYMENT_PLANS]} value={fPlan} onChange={(e) => setFPlan(e.target.value)} className="w-auto" />
          <Input placeholder="Search member / phone / vehicle…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
        </div>
        <Table cols={cols} rows={rows} empty="No members match." />
      </Section>

      {/* operational tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title={`Past Due (${pastDue.length})`}>
          <MiniTable rows={pastDue.map((m) => ({ id: m.id, a: m.customerName, b: money(m.amountDue), c: m.paymentStatus }))} heads={["Member", "Amount Due", "Status"]} />
        </Section>
        <Section title={`Renewals Due (${renewals.length})`}>
          <MiniTable rows={renewals.slice(0, 8).map((m) => ({ id: m.id, a: m.customerName, b: prettyDate(m.renewalDate), c: m.memberTier }))} heads={["Member", "Renewal", "Tier"]} />
        </Section>
        <Section title={`Overdue Details (${overdue.length})`}>
          <MiniTable rows={overdue.map((m) => ({ id: m.id, a: m.customerName, b: prettyDate(m.nextDetailDate), c: m.assignedFounderTech || "—" }))} heads={["Member", "Was Due", "Tech"]} />
        </Section>
        <Section title={`Upcoming Visits (${upcomingVisits.length})`}>
          <MiniTable rows={upcomingVisits.slice(0, 8).map((v) => ({ id: v.id, a: v.customerName, b: prettyDate(v.visitDate), c: v.serviceType }))} heads={["Member", "Date", "Service"]} />
        </Section>
        <Section title="Perks Used by Type"><Card className="p-4"><div style={{ height: 220 }}><Bars data={perksByType} xKey="name" yKey="value" color="#0A66B2" /></div></Card></Section>
      </div>

      {/* member modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Member" : "Add Care Club Member"}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Member #"><Input type="number" value={form.memberNumber} onChange={(e) => set({ memberNumber: e.target.value === "" ? "" : +e.target.value })} /></Field>
          <Field label="Customer Name"><Input value={form.customerName} onChange={(e) => set({ customerName: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="Offer Type"><Select options={OFFER_TYPES as unknown as string[]} value={form.offerType} onChange={(e) => applyPricing(e.target.value as CareMember["offerType"], form.paymentPlan)} /></Field>
          <Field label="Member Tier"><Select options={MEMBER_TIERS as unknown as string[]} value={form.memberTier} onChange={(e) => set({ memberTier: e.target.value as CareMember["memberTier"] })} /></Field>
          <Field label="Payment Plan"><Select options={PAYMENT_PLANS as unknown as string[]} value={form.paymentPlan} onChange={(e) => applyPricing(form.offerType, e.target.value as CareMember["paymentPlan"])} /></Field>
          <Field label="Member Status"><Select options={MEMBER_STATUSES as unknown as string[]} value={form.memberStatus} onChange={(e) => set({ memberStatus: e.target.value as CareMember["memberStatus"] })} /></Field>
          <Field label="Payment Status"><Select options={CARE_PAYMENT_STATUSES as unknown as string[]} value={form.paymentStatus} onChange={(e) => set({ paymentStatus: e.target.value as CareMember["paymentStatus"] })} /></Field>
          <Field label="Primary Vehicle"><Input value={form.primaryVehicle} onChange={(e) => set({ primaryVehicle: e.target.value })} /></Field>
          <Field label="Monthly Rate"><Input type="number" value={form.monthlyRate} onChange={(e) => set({ monthlyRate: +e.target.value })} /></Field>
          <Field label="2nd Vehicle Rate"><Input type="number" value={form.secondVehicleRate} onChange={(e) => set({ secondVehicleRate: +e.target.value })} /></Field>
          <Field label="Total Contract Value"><Input type="number" value={form.totalContractValue} onChange={(e) => set({ totalContractValue: +e.target.value })} /></Field>
          <Field label="Amount Paid"><Input type="number" value={form.amountPaid} onChange={(e) => set({ amountPaid: +e.target.value })} /></Field>
          <Field label="Amount Due"><Input type="number" value={form.amountDue} onChange={(e) => set({ amountDue: +e.target.value })} /></Field>
          <Field label="Assigned Sales Rep"><Select options={s.salesReps} value={form.assignedSalesRep} onChange={(e) => set({ assignedSalesRep: e.target.value })} /></Field>
          <Field label="Founder Tech"><Select options={["", ...s.technicians]} value={form.assignedFounderTech} onChange={(e) => set({ assignedFounderTech: e.target.value })} /></Field>
          <Field label="Preferred Unit"><Select options={CARE_UNITS} value={form.preferredUnit} onChange={(e) => set({ preferredUnit: e.target.value })} /></Field>
          <Field label="Signup Date"><Input type="date" value={form.signupDate} onChange={(e) => set({ signupDate: e.target.value })} /></Field>
          <Field label="Renewal Date"><Input type="date" value={form.renewalDate} onChange={(e) => set({ renewalDate: e.target.value })} /></Field>
          <Field label="Next Detail Date"><Input type="date" value={form.nextDetailDate} onChange={(e) => set({ nextDetailDate: e.target.value })} /></Field>
          <Field label="Lead ID"><Input value={form.leadId} onChange={(e) => set({ leadId: e.target.value })} /></Field>
          <Field label="GHL Contact Link"><Input value={form.ghlContactLink} onChange={(e) => set({ ghlContactLink: e.target.value })} /></Field>
          <Field label="Source"><Select options={["", ...s.sources]} value={form.source} onChange={(e) => set({ source: e.target.value })} /></Field>
          <div className="sm:col-span-3"><Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="accent" onClick={save}>{editing ? "Save Changes" : "Add Member"}</Button>
        </div>
      </Modal>
    </div>
  );
}

function MiniTable({ rows, heads }: { rows: { id: string; a: string; b: string; c: string }[]; heads: string[] }) {
  if (!rows.length) return <Card className="p-6 text-center text-sm text-muted">None. ✓</Card>;
  return (
    <Card className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
          {heads.map((h) => <th key={h} className="text-left font-medium px-3 py-2">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line/60">
              <td className="px-3 py-2 text-ink">{r.a}</td>
              <td className="px-3 py-2 tabular-nums">{r.b}</td>
              <td className="px-3 py-2 text-muted">{r.c}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
