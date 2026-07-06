"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  CareClubLead, CareMember, CARE_LEAD_STATUSES, CARE_OFFERS_PRESENTED, RECOMMENDED_TIERS, CARE_LOST_REASONS,
  OFFER_TYPES, MEMBER_TIERS, PAYMENT_PLANS, MEMBER_STATUSES, CARE_PAYMENT_STATUSES, CARE_UNITS,
} from "@/lib/types";
import { careKpis, careLeadKpis, pricingFor, recommendedTierValue, memberDraftFromCareLead } from "@/lib/careClub";
import { money, prettyDate, today, groupBy, sum, pct } from "@/lib/format";
import { toCSV, download } from "@/lib/csv";
import { Badge, Button, Card, Field, Input, Kpi, LinkOut, Modal, PageHeader, Section, Select, Table, Textarea, Col } from "@/components/ui";
import { Bars, ChartCard, Donut, Gauge, TrendLine } from "@/components/charts";

type Tab = "Dashboard" | "Care Club Leads" | "Active Members" | "Visits" | "Perks";
const TABS: Tab[] = ["Dashboard", "Care Club Leads", "Active Members", "Visits", "Perks"];
const monthKey = (iso: string) => (iso ? iso.slice(0, 7) : "");

const memberBlank = (): Omit<CareMember, "id"> => ({
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

export default function CareClubPage() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>("Dashboard");

  const k = useMemo(() => careKpis(s.careMembers, s.from, s.to), [s.careMembers, s.from, s.to]);
  const clk = useMemo(() => careLeadKpis(s.careClubLeads), [s.careClubLeads]);

  // ---- member modal (shared: also used for "create member from care lead") ----
  const [mOpen, setMOpen] = useState(false);
  const [mEditing, setMEditing] = useState<CareMember | null>(null);
  const [mForm, setMForm] = useState<Omit<CareMember, "id">>(memberBlank());
  function openNewMember() { setMEditing(null); setMForm(memberBlank()); setMOpen(true); }
  function openEditMember(m: CareMember) { setMEditing(m); const { id, ...rest } = m; setMForm(rest); setMOpen(true); }
  function openMemberFromCareLead(cl: CareClubLead) { setMEditing(null); setMForm(memberDraftFromCareLead(cl)); setMOpen(true); }
  function saveMember() {
    if (!mForm.customerName.trim()) return;
    const payload = { ...mForm, updatedAt: today() };
    if (mEditing) s.updateMember({ ...payload, id: mEditing.id }); else s.addMember(payload);
    setMOpen(false);
  }
  const setM = (patch: Partial<Omit<CareMember, "id">>) => setMForm((f) => ({ ...f, ...patch }));
  function applyPricing(offer = mForm.offerType, plan = mForm.paymentPlan) {
    const p = pricingFor(offer, plan);
    setM({ offerType: offer, paymentPlan: plan, monthlyRate: p.monthlyRate, secondVehicleRate: p.secondRate,
      onboardingFee: p.onboarding, amountDueToday: p.dueToday || p.total, totalContractValue: p.total || p.year1Pay });
  }

  return (
    <div>
      <PageHeader title="Care Club" subtitle="Sales pipeline → membership · leads follow the same Lead ID through the journey" actions={
        tab === "Active Members" ? <Button variant="accent" onClick={openNewMember}>+ Add Member</Button> : undefined
      } />

      <div className="flex flex-wrap gap-1 mb-5 border-b border-line">
        {TABS.map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === tb ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {tb}{tb === "Care Club Leads" && clk.total ? ` (${clk.total})` : ""}
          </button>
        ))}
      </div>

      {tab === "Dashboard" && <DashboardTab k={k} clk={clk} />}
      {tab === "Care Club Leads" && <LeadsTab onEditMember={openEditMember} onCreateMember={openMemberFromCareLead} />}
      {tab === "Active Members" && <MembersTab onEdit={openEditMember} />}
      {tab === "Visits" && <VisitsTab />}
      {tab === "Perks" && <PerksTab />}

      {/* member modal */}
      <Modal open={mOpen} onClose={() => setMOpen(false)} title={mEditing ? "Edit Member" : "Add Care Club Member"}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Member #"><Input type="number" value={mForm.memberNumber} onChange={(e) => setM({ memberNumber: e.target.value === "" ? "" : +e.target.value })} /></Field>
          <Field label="Customer Name"><Input value={mForm.customerName} onChange={(e) => setM({ customerName: e.target.value })} /></Field>
          <Field label="Phone"><Input value={mForm.phone} onChange={(e) => setM({ phone: e.target.value })} /></Field>
          <Field label="Offer Type"><Select options={OFFER_TYPES as unknown as string[]} value={mForm.offerType} onChange={(e) => applyPricing(e.target.value as CareMember["offerType"], mForm.paymentPlan)} /></Field>
          <Field label="Member Tier"><Select options={MEMBER_TIERS as unknown as string[]} value={mForm.memberTier} onChange={(e) => setM({ memberTier: e.target.value as CareMember["memberTier"] })} /></Field>
          <Field label="Payment Plan"><Select options={PAYMENT_PLANS as unknown as string[]} value={mForm.paymentPlan} onChange={(e) => applyPricing(mForm.offerType, e.target.value as CareMember["paymentPlan"])} /></Field>
          <Field label="Member Status"><Select options={MEMBER_STATUSES as unknown as string[]} value={mForm.memberStatus} onChange={(e) => setM({ memberStatus: e.target.value as CareMember["memberStatus"] })} /></Field>
          <Field label="Payment Status"><Select options={CARE_PAYMENT_STATUSES as unknown as string[]} value={mForm.paymentStatus} onChange={(e) => setM({ paymentStatus: e.target.value as CareMember["paymentStatus"] })} /></Field>
          <Field label="Primary Vehicle"><Input value={mForm.primaryVehicle} onChange={(e) => setM({ primaryVehicle: e.target.value })} /></Field>
          <Field label="Monthly Rate"><Input type="number" value={mForm.monthlyRate} onChange={(e) => setM({ monthlyRate: +e.target.value })} /></Field>
          <Field label="Amount Paid"><Input type="number" value={mForm.amountPaid} onChange={(e) => setM({ amountPaid: +e.target.value })} /></Field>
          <Field label="Amount Due"><Input type="number" value={mForm.amountDue} onChange={(e) => setM({ amountDue: +e.target.value })} /></Field>
          <Field label="Assigned Sales Rep"><Select options={s.salesReps} value={mForm.assignedSalesRep} onChange={(e) => setM({ assignedSalesRep: e.target.value })} /></Field>
          <Field label="Founder Tech"><Select options={["", ...s.technicians]} value={mForm.assignedFounderTech} onChange={(e) => setM({ assignedFounderTech: e.target.value })} /></Field>
          <Field label="Signup Date"><Input type="date" value={mForm.signupDate} onChange={(e) => setM({ signupDate: e.target.value })} /></Field>
          <Field label="Start Date"><Input type="date" value={mForm.startDate} onChange={(e) => setM({ startDate: e.target.value })} /></Field>
          <Field label="Next Detail Date"><Input type="date" value={mForm.nextDetailDate} onChange={(e) => setM({ nextDetailDate: e.target.value })} /></Field>
          <Field label="Original Lead ID"><Input value={mForm.leadId} onChange={(e) => setM({ leadId: e.target.value })} /></Field>
          <Field label="GHL Contact Link"><Input value={mForm.ghlContactLink} onChange={(e) => setM({ ghlContactLink: e.target.value })} /></Field>
          <Field label="Source"><Select options={["", ...s.sources]} value={mForm.source} onChange={(e) => setM({ source: e.target.value })} /></Field>
          <div className="sm:col-span-3"><Field label="Notes"><Textarea rows={2} value={mForm.notes} onChange={(e) => setM({ notes: e.target.value })} /></Field></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={() => setMOpen(false)}>Cancel</Button>
          <Button variant="accent" onClick={saveMember}>{mEditing ? "Save Changes" : "Add Member"}</Button>
        </div>
      </Modal>
    </div>
  );
}

/* ================= Dashboard tab ================= */
function DashboardTab({ k, clk }: { k: ReturnType<typeof careKpis>; clk: ReturnType<typeof careLeadKpis> }) {
  const s = useStore();
  const members = s.careMembers;
  const cl = s.careClubLeads;

  const byPlan = useMemo(() => Object.entries(groupBy(members.filter((m) => m.memberStatus === "Active"), (m) => m.paymentPlan)).map(([name, v]) => ({ name, value: v.length })), [members]);
  const byTier = useMemo(() => Object.entries(groupBy(members.filter((m) => m.memberStatus === "Active"), (m) => m.memberTier)).map(([name, v]) => ({ name, value: v.length })), [members]);

  const clByStatus = useMemo(() => Object.entries(groupBy(cl, (l) => l.pipelineStatus)).map(([name, v]) => ({ name, value: v.length })), [cl]);
  const clOverTime = useMemo(() => Object.entries(groupBy(cl.filter((l) => l.createdAt), (l) => monthKey(l.createdAt))).sort().map(([month, v]) => ({ month, count: v.length })), [cl]);
  const closeByRep = useMemo(() => Object.entries(groupBy(cl.filter((l) => l.assignedCareRep), (l) => l.assignedCareRep))
    .map(([name, v]) => ({ name, value: Math.round((v.filter((l) => l.pipelineStatus === "Sold").length / v.length) * 100) })), [cl]);
  const soldByOffer = useMemo(() => Object.entries(groupBy(cl.filter((l) => l.pipelineStatus === "Sold"), (l) => l.offerPresented)).map(([name, v]) => ({ name, value: v.length })), [cl]);
  const valueByTier = useMemo(() => Object.entries(groupBy(cl.filter((l) => !["Sold", "Lost", "Not Interested"].includes(l.pipelineStatus)), (l) => l.recommendedTier))
    .map(([name, v]) => ({ name, value: sum(v, (l) => recommendedTierValue(l.recommendedTier)) })), [cl]);
  const bySrv = useMemo(() => Object.entries(groupBy(cl.filter((l) => l.completedService), (l) => l.completedService)).map(([name, v]) => ({ name, value: v.length })), [cl]);

  return (
    <div>
      <Section title="Care Club Pipeline">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <Kpi label="Care Club Leads" value={String(clk.total)} tone="blue" />
          <Kpi label="New Leads" value={String(clk.fresh)} tone="blue" />
          <Kpi label="Contacted" value={String(clk.contacted)} tone="blue" />
          <Kpi label="Offers Sent" value={String(clk.offersSent)} tone="blue" />
          <Kpi label="Sold" value={String(clk.sold)} tone="good" />
          <Kpi label="Close Rate" value={pct(clk.closeRate)} tone="blue" />
          <Kpi label="Pipeline Value" value={money(clk.pipelineValue)} tone="gold" />
          <Kpi label="Follow-Ups Due" value={String(clk.followUpsDue)} tone={clk.followUpsDue > 0 ? "warn" : "default"} />
          <Kpi label="No Response" value={String(clk.noResponse)} tone={clk.noResponse > 0 ? "warn" : "default"} />
          <Kpi label="Active Members" value={String(k.active)} tone="blue" />
          <Kpi label="MRR" value={money(k.mrr)} tone="gold" />
          <Kpi label="Founding Spots Left" value={String(k.foundingRemaining)} tone={k.foundingRemaining < 20 ? "danger" : "default"} />
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
        <ChartCard title="Care Club Leads by Status" height={220}><Donut data={clByStatus} /></ChartCard>
        <ChartCard title="Leads Created Over Time"><TrendLine data={clOverTime} xKey="month" yKey="count" color="#1683E2" /></ChartCard>
        <ChartCard title="Close Rate by Sales Rep (%)"><Bars data={closeByRep} xKey="name" yKey="value" color="#22C55E" /></ChartCard>
        <ChartCard title="Sold by Offer Type" height={220}><Donut data={soldByOffer} /></ChartCard>
        <ChartCard title="Pipeline Value by Recommended Tier"><Bars data={valueByTier} xKey="name" yKey="value" money color="#F5C542" /></ChartCard>
        <ChartCard title="Leads by Completed Service"><Bars data={bySrv} xKey="name" yKey="value" color="#0A66B2" /></ChartCard>
      </div>

      <Section title="Membership Health">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <Kpi label="Active Members" value={String(k.active)} tone="blue" />
          <Kpi label="Founding Filled" value={`${k.foundingFilled}/100`} tone="blue" />
          <Kpi label="Founders 25" value={`${k.founders25Filled}/25`} tone="blue" />
          <Kpi label="ARR" value={money(k.arr)} tone="gold" />
          <Kpi label="Cash Collected" value={money(k.cashCollected)} tone="gold" />
          <Kpi label="Past Due" value={String(k.pastDue)} tone={k.pastDue > 0 ? "danger" : "good"} />
          <Kpi label="Renewals (30d)" value={String(k.renewalsDue)} tone={k.renewalsDue > 0 ? "warn" : "default"} />
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
        <Gauge value={k.foundingFilled} max={100} label="Founding 100 Fill" color="#1683E2" />
        <Gauge value={k.founders25Filled} max={25} label="Founders 25 Fill" color="#F5C542" />
        <ChartCard title="Active by Payment Plan" height={200}><Donut data={byPlan} /></ChartCard>
        <ChartCard title="Active by Tier" height={200}><Donut data={byTier} /></ChartCard>
      </div>
    </div>
  );
}

/* ================= Care Club Leads tab ================= */
function LeadsTab({ onEditMember, onCreateMember }: { onEditMember: (m: CareMember) => void; onCreateMember: (cl: CareClubLead) => void }) {
  const s = useStore();
  const t = today();
  const [fStatus, setFStatus] = useState("All");
  const [fRep, setFRep] = useState("All");
  const [fSrv, setFSrv] = useState("All");
  const [fSource, setFSource] = useState("All");
  const [fOffer, setFOffer] = useState("All");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CareClubLead | null>(null);

  const services = useMemo(() => [...new Set(s.careClubLeads.map((l) => l.completedService).filter(Boolean))], [s.careClubLeads]);
  const rows = useMemo(() => s.careClubLeads
    .filter((l) => fStatus === "All" || l.pipelineStatus === fStatus)
    .filter((l) => fRep === "All" || l.assignedCareRep === fRep)
    .filter((l) => fSrv === "All" || l.completedService === fSrv)
    .filter((l) => fSource === "All" || l.confirmedSource === fSource)
    .filter((l) => fOffer === "All" || l.offerPresented === fOffer)
    .filter((l) => !q || `${l.originalLeadId} ${l.careLeadId} ${l.customerName} ${l.phone} ${l.email} ${l.vehicle} ${l.urableJobId} ${l.ghlContactLink} ${l.notes}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.completedJobDate || "").localeCompare(a.completedJobDate || "")),
    [s.careClubLeads, fStatus, fRep, fSrv, fSource, fOffer, q]);

  const buckets = {
    "New": s.careClubLeads.filter((l) => l.pipelineStatus === "New Care Club Lead").length,
    "Follow-Up Needed": s.careClubLeads.filter((l) => l.pipelineStatus === "Follow-Up Needed").length,
    "Interested": s.careClubLeads.filter((l) => l.pipelineStatus === "Interested").length,
    "Sold": s.careClubLeads.filter((l) => l.pipelineStatus === "Sold").length,
    "Lost / NI": s.careClubLeads.filter((l) => ["Lost", "Not Interested"].includes(l.pipelineStatus)).length,
  };

  function setStatus(cl: CareClubLead, status: CareClubLead["pipelineStatus"]) {
    const patch: CareClubLead = { ...cl, pipelineStatus: status, updatedAt: t, lastContactDate: t };
    if (status === "Sold") patch.closeDate = t;
    s.updateCareLead(patch);
    if (status === "Sold" && confirm(`Mark ${cl.customerName} as Sold — create the Care Club Member now?`)) onCreateMember(patch);
  }
  function openEdit(cl: CareClubLead) { setForm({ ...cl }); setOpen(true); }
  function saveLead() { if (form) { s.updateCareLead({ ...form, updatedAt: t }); setOpen(false); } }
  const set = (patch: Partial<CareClubLead>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const cols: Col<CareClubLead>[] = [
    { key: "careLeadId", label: "Care Lead", render: (l) => <div><div className="font-mono text-xs text-accent">{l.careLeadId}</div><div className="font-mono text-[10px] text-muted">{l.originalLeadId}</div></div> },
    { key: "customerName", label: "Customer", render: (l) => <div><div className="font-medium text-ink">{l.customerName}</div><div className="text-xs text-muted">{l.vehicle}</div></div> },
    { key: "completedService", label: "Completed Job", render: (l) => <div><div>{l.completedService}</div><div className="text-xs text-muted">{prettyDate(l.completedJobDate)} · {money(l.completedJobRevenue)}</div></div> },
    { key: "confirmedSource", label: "Source" },
    { key: "assignedCareRep", label: "Care Rep", render: (l) => l.assignedCareRep || <span className="text-danger text-xs">⚠ unassigned</span> },
    { key: "recommendedTier", label: "Rec. Tier", render: (l) => <div><div className="text-xs">{l.recommendedTier}</div><div className="text-xs text-gold tabular-nums">{recommendedTierValue(l.recommendedTier) ? money(recommendedTierValue(l.recommendedTier)) : ""}</div></div> },
    { key: "followUpDate", label: "Follow-Up", render: (l) => <span className={l.followUpDate && l.followUpDate <= t && !["Sold", "Lost", "Not Interested"].includes(l.pipelineStatus) ? "text-danger" : "text-muted"}>{prettyDate(l.followUpDate) || "—"}</span> },
    { key: "pipelineStatus", label: "Status", render: (l) => (
      <select value={l.pipelineStatus} onChange={(e) => setStatus(l, e.target.value as CareClubLead["pipelineStatus"])}
        className="bg-base border border-line rounded px-2 py-1 text-xs text-ink">
        {CARE_LEAD_STATUSES.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    ) },
    { key: "links", label: "Links", render: (l) => (
      <div className="flex gap-2 text-xs whitespace-nowrap">
        {l.ghlContactLink && <a href={l.ghlContactLink} target="_blank" rel="noreferrer" className="text-accent hover:underline">GHL</a>}
        {l.urableJobLink && <a href={l.urableJobLink} target="_blank" rel="noreferrer" className="text-accent hover:underline">Urable</a>}
      </div>
    ) },
    { key: "_", label: "", render: (l) => (
      <div className="flex gap-1 justify-end whitespace-nowrap">
        <Button variant="ghost" onClick={() => openEdit(l)}>Edit</Button>
        {l.pipelineStatus === "Sold" && <Button variant="ghost" onClick={() => onCreateMember(l)} className="text-good">+ Member</Button>}
      </div>
    ) },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(buckets).map(([label, n]) => (
          <Card key={label} className="px-4 py-2"><div className="text-[11px] uppercase tracking-wide text-muted">{label}</div><div className="text-lg font-bold text-ink">{n}</div></Card>
        ))}
      </div>

      <Section title={`Care Club Leads (${rows.length})`} actions={
        <Button onClick={() => download(`care-club-leads-${t}.csv`, toCSV(rows as unknown as Record<string, unknown>[]))}>Export CSV</Button>
      }>
        <div className="flex flex-wrap gap-2 mb-3">
          <Select options={["All", ...CARE_LEAD_STATUSES]} value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-auto" />
          <Select options={["All", ...s.salesReps]} value={fRep} onChange={(e) => setFRep(e.target.value)} className="w-auto" />
          <Select options={["All", ...services]} value={fSrv} onChange={(e) => setFSrv(e.target.value)} className="w-auto" />
          <Select options={["All", ...s.sources]} value={fSource} onChange={(e) => setFSource(e.target.value)} className="w-auto" />
          <Select options={["All", ...CARE_OFFERS_PRESENTED]} value={fOffer} onChange={(e) => setFOffer(e.target.value)} className="w-auto" />
          <Input placeholder="Search name / phone / vehicle / Urable…" value={q} onChange={(e) => setQ(e.target.value)} className="w-72" />
        </div>
        <Table cols={cols} rows={rows} empty="No Care Club leads. They are created automatically when a job is completed." />
      </Section>

      <Modal open={open} onClose={() => setOpen(false)} title={`Edit Care Club Lead · ${form?.careLeadId ?? ""}`}>
        {form && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Customer Name"><Input value={form.customerName} onChange={(e) => set({ customerName: e.target.value })} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
              <Field label="Email"><Input value={form.email} onChange={(e) => set({ email: e.target.value })} /></Field>
              <Field label="Vehicle"><Input value={form.vehicle} onChange={(e) => set({ vehicle: e.target.value })} /></Field>
              <Field label="Original Lead ID"><Input value={form.originalLeadId} onChange={(e) => set({ originalLeadId: e.target.value })} /></Field>
              <Field label="Urable Job ID"><Input value={form.urableJobId} onChange={(e) => set({ urableJobId: e.target.value })} /></Field>
              <Field label="Confirmed Source"><Input value={form.confirmedSource} onChange={(e) => set({ confirmedSource: e.target.value })} /></Field>
              <Field label="Original Sales Rep"><Input value={form.originalSalesRep} onChange={(e) => set({ originalSalesRep: e.target.value })} /></Field>
              <Field label="Assigned Care Rep"><Select options={["", ...s.salesReps]} value={form.assignedCareRep} onChange={(e) => set({ assignedCareRep: e.target.value })} /></Field>
              <Field label="Assigned Founder Tech"><Select options={["", ...s.technicians]} value={form.assignedFounderTech} onChange={(e) => set({ assignedFounderTech: e.target.value })} /></Field>
              <Field label="Pipeline Status"><Select options={CARE_LEAD_STATUSES as unknown as string[]} value={form.pipelineStatus} onChange={(e) => set({ pipelineStatus: e.target.value as CareClubLead["pipelineStatus"] })} /></Field>
              <Field label="Offer Presented"><Select options={CARE_OFFERS_PRESENTED as unknown as string[]} value={form.offerPresented} onChange={(e) => set({ offerPresented: e.target.value as CareClubLead["offerPresented"] })} /></Field>
              <Field label="Recommended Tier"><Select options={RECOMMENDED_TIERS as unknown as string[]} value={form.recommendedTier} onChange={(e) => set({ recommendedTier: e.target.value as CareClubLead["recommendedTier"] })} /></Field>
              <Field label="Follow-Up Date"><Input type="date" value={form.followUpDate} onChange={(e) => set({ followUpDate: e.target.value })} /></Field>
              <Field label="Last Contact Date"><Input type="date" value={form.lastContactDate} onChange={(e) => set({ lastContactDate: e.target.value })} /></Field>
              <Field label="Close Date"><Input type="date" value={form.closeDate} onChange={(e) => set({ closeDate: e.target.value })} /></Field>
              <Field label="Lost Reason"><Select options={["", ...CARE_LOST_REASONS]} value={form.lostReason} onChange={(e) => set({ lostReason: e.target.value as CareClubLead["lostReason"] })} /></Field>
              <Field label="GHL Contact Link"><Input value={form.ghlContactLink} onChange={(e) => set({ ghlContactLink: e.target.value })} /></Field>
              <div className="sm:col-span-3"><Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field></div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button onClick={() => set({ pipelineStatus: "Contacted", lastContactDate: t })}>Mark Contacted</Button>
              <Button onClick={() => set({ pipelineStatus: "Offer Sent" })}>Mark Offer Sent</Button>
              <Button onClick={() => set({ pipelineStatus: "Follow-Up Needed" })}>Follow-Up</Button>
              <Button onClick={() => set({ pipelineStatus: "Interested" })}>Interested</Button>
              <Button onClick={() => set({ pipelineStatus: "Sold", closeDate: t })}>Mark Sold</Button>
              <Button onClick={() => set({ pipelineStatus: "Lost" })}>Mark Lost</Button>
              <div className="flex-1" />
              {form.pipelineStatus === "Sold" && <Button variant="accent" onClick={() => { saveLead(); onCreateMember(form); }}>Create Member</Button>}
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button onClick={() => { if (confirm("Delete this Care Club lead?")) { s.deleteCareLead(form.id); setOpen(false); } }}>Delete</Button>
              <Button variant="accent" onClick={saveLead}>Save Changes</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ================= Active Members tab ================= */
function MembersTab({ onEdit }: { onEdit: (m: CareMember) => void }) {
  const s = useStore();
  const t = today();
  const [fStatus, setFStatus] = useState("All");
  const [fOffer, setFOffer] = useState("All");
  const [fPlan, setFPlan] = useState("All");
  const [q, setQ] = useState("");
  const rows = useMemo(() => s.careMembers
    .filter((m) => fStatus === "All" || m.memberStatus === fStatus)
    .filter((m) => fOffer === "All" || m.offerType === fOffer)
    .filter((m) => fPlan === "All" || m.paymentPlan === fPlan)
    .filter((m) => !q || `${m.customerName} ${m.phone} ${m.email} ${m.memberNumber} ${m.primaryVehicle}`.toLowerCase().includes(q.toLowerCase())),
    [s.careMembers, fStatus, fOffer, fPlan, q]);

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
    { key: "leadId", label: "Lead ID", render: (m) => <span className="font-mono text-xs text-muted">{m.leadId || "—"}</span> },
    { key: "ghl", label: "GHL", render: (m) => <LinkOut href={m.ghlContactLink} /> },
    { key: "_", label: "", render: (m) => (
      <div className="flex gap-1 justify-end">
        <Button variant="ghost" onClick={() => onEdit(m)}>Edit</Button>
        <Button variant="ghost" onClick={() => confirm(`Delete ${m.customerName}?`) && s.deleteMember(m.id)}>✕</Button>
      </div>
    ) },
  ];

  return (
    <Section title={`Active Members (${rows.length})`} actions={
      <Button onClick={() => download(`care-club-members-${t}.csv`, toCSV(rows as unknown as Record<string, unknown>[]))}>Export CSV</Button>
    }>
      <div className="flex flex-wrap gap-2 mb-3">
        <Select options={["All", ...MEMBER_STATUSES]} value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-auto" />
        <Select options={["All", ...OFFER_TYPES]} value={fOffer} onChange={(e) => setFOffer(e.target.value)} className="w-auto" />
        <Select options={["All", ...PAYMENT_PLANS]} value={fPlan} onChange={(e) => setFPlan(e.target.value)} className="w-auto" />
        <Input placeholder="Search member / phone / vehicle…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
      </div>
      <Table cols={cols} rows={rows} empty="No members match." />
    </Section>
  );
}

/* ================= Visits tab ================= */
function VisitsTab() {
  const s = useStore();
  const cols: Col<(typeof s.careVisits)[number]>[] = [
    { key: "visitDate", label: "Date", render: (v) => <span className="text-muted">{prettyDate(v.visitDate)}</span> },
    { key: "customerName", label: "Member", render: (v) => <span className="text-ink">{v.customerName}</span> },
    { key: "vehicle", label: "Vehicle" },
    { key: "serviceType", label: "Service" },
    { key: "visitStatus", label: "Status", render: (v) => <Badge value={v.visitStatus} /> },
    { key: "tech", label: "Tech", render: (v) => v.tech || <span className="text-danger text-xs">⚠ none</span> },
    { key: "addOnRevenue", label: "Add-On $", render: (v) => <span className="tabular-nums">{money(v.addOnRevenue)}</span> },
    { key: "tip", label: "Tip", render: (v) => <span className="tabular-nums">{money(v.tip)}</span> },
    { key: "urable", label: "Urable", render: (v) => <LinkOut href={v.urableJobLink} /> },
  ];
  return <Section title={`Visits (${s.careVisits.length})`}><Table cols={cols} rows={s.careVisits} empty="No visits logged." /></Section>;
}

/* ================= Perks tab ================= */
function PerksTab() {
  const s = useStore();
  const cols: Col<(typeof s.carePerks)[number]>[] = [
    { key: "customerName", label: "Member", render: (p) => <span className="text-ink">{p.customerName}</span> },
    { key: "perkName", label: "Perk" },
    { key: "perkValue", label: "Value", render: (p) => <span className="tabular-nums text-gold">{money(p.perkValue)}</span> },
    { key: "status", label: "Status", render: (p) => <Badge value={p.status} /> },
    { key: "eligibleDate", label: "Eligible", render: (p) => <span className="text-muted">{prettyDate(p.eligibleDate)}</span> },
    { key: "usedDate", label: "Used", render: (p) => <span className="text-muted">{prettyDate(p.usedDate)}</span> },
    { key: "urable", label: "Urable", render: (p) => <LinkOut href={p.urableJobLink} /> },
  ];
  return <Section title={`Perks (${s.carePerks.length})`}><Table cols={cols} rows={s.carePerks} empty="No perks logged." /></Section>;
}
