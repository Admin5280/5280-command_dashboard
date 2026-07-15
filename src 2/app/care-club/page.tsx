"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import {
  CareClubLead, CareMember, CarePerk, CareVisit, CARE_LEAD_STATUSES, CARE_OFFERS_PRESENTED, RECOMMENDED_TIERS, CARE_LOST_REASONS,
  OFFER_TYPES, MEMBER_TIERS, PAYMENT_PLANS, MEMBER_STATUSES, CARE_PAYMENT_STATUSES, PERK_STATUSES, CARE_UNITS,
  VISIT_STATUSES, SERVICE_TYPES,
} from "@/lib/types";
import { careKpis, careLeadKpis, pricingFor, recommendedTierValue, memberDraftFromCareLead, bookingStatus, daysOverdue,
  careAdvancedMetrics, memberLifetimeVisits, memberLifetimeValue, memberDurationDays } from "@/lib/careClub";
import { money, num, prettyDate, today, groupBy, sum, pct } from "@/lib/format";
import { toCSV, download } from "@/lib/csv";
import { Badge, Button, Card, Field, Input, Kpi, LinkOut, Modal, PageHeader, Section, Select, StatusPill, Table, Textarea, Col } from "@/components/ui";
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

      {tab === "Dashboard" && <DashboardTab k={k} clk={clk} onEdit={openEditMember} />}
      {tab === "Care Club Leads" && <LeadsTab onEditMember={openEditMember} onCreateMember={openMemberFromCareLead} />}
      {tab === "Active Members" && <MembersTab onEdit={openEditMember} />}
      {tab === "Visits" && <VisitsTab />}
      {tab === "Perks" && <PerksTab />}

      {/* member modal */}
      <Modal open={mOpen} onClose={() => setMOpen(false)} title={mEditing ? "Edit Member" : "Add Care Club Member"}>
        {mEditing && (() => { const b = bookingStatus({ ...mForm, id: mEditing.id } as CareMember); return (
          <div className="mb-3 flex items-center gap-2 text-xs">
            <span className="text-muted uppercase tracking-wide">Booking status</span><StatusPill label={b.status} tone={b.tone} />
          </div>
        ); })()}
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
function DashboardTab({ k, clk, onEdit }: { k: ReturnType<typeof careKpis>; clk: ReturnType<typeof careLeadKpis>; onEdit: (m: CareMember) => void }) {
  const s = useStore();
  const t = today();
  const members = s.careMembers;
  const cl = s.careClubLeads;
  const needing = useMemo(() => members.filter((m) => m.memberStatus === "Active" && ["Needs Booking", "Overdue"].includes(bookingStatus(m).status)), [members]);
  const upcoming = useMemo(() => members.filter((m) => m.memberStatus === "Active" && m.nextDetailDate && m.nextDetailDate >= t).sort((a, b) => a.nextDetailDate.localeCompare(b.nextDetailDate)), [members, t]);

  // ---- advanced membership metrics (v2) ----
  const adv = useMemo(() => careAdvancedMetrics(members, s.careVisits, s.from, s.to), [members, s.careVisits, s.from, s.to]);
  const in30 = useMemo(() => new Date(new Date(t + "T00:00:00").getTime() + 30 * 86400000).toISOString().slice(0, 10), [t]);
  const contractsEndingSoon = useMemo(() => members.filter((m) => m.contractEndDate && m.contractEndDate >= t && m.contractEndDate <= in30).length, [members, t, in30]);
  const lifetimeTotal = useMemo(() => sum(members, (m) => memberLifetimeValue(m, s.careVisits)), [members, s.careVisits]);

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

      <Section title="Scheduling & Bookings">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <Kpi label="Active Members" value={String(k.active)} tone="blue" />
          <Kpi label="Upcoming Bookings" value={String(k.upcomingBookings)} tone="good" />
          <Kpi label="Members Needing Booking" value={String(k.needingBooking)} tone={k.needingBooking > 0 ? "warn" : "good"} />
          <Kpi label="Overdue Details" value={String(k.overdueDetails)} tone={k.overdueDetails > 0 ? "danger" : "good"} />
          <Kpi label="Past Due Members" value={String(k.pastDue)} tone={k.pastDue > 0 ? "danger" : "good"} />
          <Kpi label="Visits This Month" value={String(k.visitsThisMonth)} tone="blue" />
          <Kpi label="Visits This Year" value={String(k.visitsThisYear)} tone="blue" />
        </div>
      </Section>

      <Section title={`Members Needing Next Detail (${needing.length})`}><BookingTable variant="needing" members={needing} onEdit={onEdit} /></Section>
      <Section title={`Upcoming Care Club Bookings (${upcoming.length})`}><BookingTable variant="upcoming" members={upcoming} onEdit={onEdit} /></Section>

      <Section title="Advanced Membership Metrics">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <Kpi label="MRR" value={money(k.mrr)} tone="gold" sub="Monthly recurring revenue" />
          <Kpi label="ARR" value={money(k.arr)} tone="gold" sub="Annual recurring revenue" />
          <Kpi label="Churn Rate" value={pct(adv.churnRate)} tone={adv.churnRate > 0 ? "danger" : "good"} sub="Canceled in period" />
          <Kpi label="Cancellation Rate" value={pct(adv.cancellationRate)} tone={adv.cancellationRate > 0 ? "warn" : "good"} sub="All-time canceled" />
          <Kpi label="Avg Member Duration" value={`${adv.avgDurationMonths.toFixed(1)} mo`} tone="blue" sub={`${num(Math.round(adv.avgDurationDays))} days avg`} />
          <Kpi label="Avg Visits / Member" value={adv.avgVisitsPerMember.toFixed(1)} tone="blue" />
          <Kpi label="Total Member Visits" value={String(adv.totalMemberVisits)} tone="blue" sub="Completed" />
          <Kpi label="Members Needing Booking" value={String(k.needingBooking)} tone={k.needingBooking > 0 ? "warn" : "good"} />
          <Kpi label="Overdue Details" value={String(k.overdueDetails)} tone={k.overdueDetails > 0 ? "danger" : "good"} />
          <Kpi label="Contracts Ending Soon" value={String(contractsEndingSoon)} tone={contractsEndingSoon > 0 ? "warn" : "default"} sub="Next 30 days" />
          <Kpi label="Past Due Members" value={String(k.pastDue)} tone={k.pastDue > 0 ? "danger" : "good"} />
          <Kpi label="Lifetime Totals" value={money(lifetimeTotal)} tone="gold" sub="Paid + add-ons + tips" />
        </div>
      </Section>

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
/* ================= Booking / scheduling table (shared) ================= */
function BookingTable({ variant, members, onEdit }: { variant: "upcoming" | "needing"; members: CareMember[]; onEdit: (m: CareMember) => void }) {
  const s = useStore();
  const t = today();
  const setNext = (m: CareMember, date: string) => s.updateMember({ ...m, nextDetailDate: date, updatedAt: t });
  const createVisit = (m: CareMember) => s.addVisit({ memberId: m.id, leadId: m.leadId, urableJobId: "", urableJobLink: "", ghlContactLink: m.ghlContactLink, customerName: m.customerName, vehicle: m.primaryVehicle, visitDate: m.nextDetailDate || t, serviceType: "Maintenance Detail", visitStatus: "Scheduled", tech: m.assignedFounderTech, unit: m.preferredUnit, bonusServiceUsed: "", addOnSold: "", addOnRevenue: 0, tip: 0, notes: "" });
  const markCompleted = (m: CareMember) => s.updateMember({ ...m, lastDetailDate: t, nextDetailDate: "", visitsThisMonth: (m.visitsThisMonth || 0) + 1, visitsThisYear: (m.visitsThisYear || 0) + 1, updatedAt: t });

  if (!members.length) return <Card className="p-6 text-center text-sm text-muted">None. ✓</Card>;
  const dateInput = (m: CareMember) => <input type="date" value={m.nextDetailDate} onChange={(e) => setNext(m, e.target.value)} className="bg-base border border-line rounded px-2 py-1 text-xs text-ink" />;
  const actions = (m: CareMember) => (
    <div className="flex gap-1 justify-end whitespace-nowrap">
      <Button variant="ghost" onClick={() => createVisit(m)}>+ Visit</Button>
      <Button variant="ghost" onClick={() => markCompleted(m)} className="text-good">Done</Button>
      <Button variant="ghost" onClick={() => onEdit(m)}>Edit</Button>
    </div>
  );
  const heads = variant === "upcoming"
    ? ["#", "Member", "Phone", "Vehicle", "Next Detail", "Founder Tech", "Unit", "Booking", "Last Detail", "Visits/mo", "GHL", ""]
    : ["#", "Member", "Phone", "Plan", "Founder Tech", "Last Detail", "Next Detail", "Days Overdue", "Booking", ""];
  return (
    <Card className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">{heads.map((h, i) => <th key={i} className="text-left font-medium px-2 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>
          {members.map((m) => {
            const b = bookingStatus(m);
            return variant === "upcoming" ? (
              <tr key={m.id} className="border-b border-line/60">
                <td className="px-2 py-2 text-gold font-semibold">{m.memberNumber || "—"}</td>
                <td className="px-2 py-2 text-ink">{m.customerName}</td>
                <td className="px-2 py-2">{m.phone}</td>
                <td className="px-2 py-2">{m.primaryVehicle}</td>
                <td className="px-2 py-2">{dateInput(m)}</td>
                <td className="px-2 py-2">{m.assignedFounderTech || "—"}</td>
                <td className="px-2 py-2">{m.preferredUnit ? m.preferredUnit.split(" | ")[0] : "—"}</td>
                <td className="px-2 py-2"><StatusPill label={b.status} tone={b.tone} /></td>
                <td className="px-2 py-2 text-muted">{prettyDate(m.lastDetailDate) || "—"}</td>
                <td className="px-2 py-2 tabular-nums">{m.visitsThisMonth}</td>
                <td className="px-2 py-2"><LinkOut href={m.ghlContactLink} /></td>
                <td className="px-2 py-2 text-right">{actions(m)}</td>
              </tr>
            ) : (
              <tr key={m.id} className="border-b border-line/60">
                <td className="px-2 py-2 text-gold font-semibold">{m.memberNumber || "—"}</td>
                <td className="px-2 py-2 text-ink">{m.customerName}</td>
                <td className="px-2 py-2">{m.phone}</td>
                <td className="px-2 py-2">{m.paymentPlan}</td>
                <td className="px-2 py-2">{m.assignedFounderTech || <span className="text-danger text-xs">⚠ none</span>}</td>
                <td className="px-2 py-2 text-muted">{prettyDate(m.lastDetailDate) || "—"}</td>
                <td className="px-2 py-2">{dateInput(m)}</td>
                <td className="px-2 py-2 tabular-nums text-danger">{daysOverdue(m) || "—"}</td>
                <td className="px-2 py-2"><StatusPill label={b.status} tone={b.tone} /></td>
                <td className="px-2 py-2 text-right">{actions(m)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

const memberStatusTone = (st: string): "good" | "warn" | "danger" | "info" | "neutral" =>
  st === "Active" ? "good" : st === "Past Due" ? "danger" : st === "Canceled" ? "neutral" : st === "Paused" ? "warn" : "info";

function MembersTab({ onEdit }: { onEdit: (m: CareMember) => void }) {
  const s = useStore();
  const t = today();
  const [view, setView] = useState<"cards" | "table">("cards");
  const [fStatus, setFStatus] = useState("All");
  const [fOffer, setFOffer] = useState("All");
  const [fPlan, setFPlan] = useState("All");
  const [fBooking, setFBooking] = useState("All");
  const [q, setQ] = useState("");

  // ---- per-member visit history modal + add-visit form ----
  const visitBlank = (m: CareMember): Omit<CareVisit, "id"> => ({
    memberId: m.id, leadId: m.leadId, urableJobId: "", urableJobLink: "", ghlContactLink: m.ghlContactLink,
    customerName: m.customerName, vehicle: m.primaryVehicle, visitDate: m.nextDetailDate || t,
    serviceType: "Maintenance Detail", visitStatus: "Scheduled", tech: m.assignedFounderTech, unit: m.preferredUnit,
    bonusServiceUsed: "", addOnSold: "", addOnRevenue: 0, tip: 0, notes: "",
  });
  const [vOpen, setVOpen] = useState(false);
  const [vMember, setVMember] = useState<CareMember | null>(null);
  const [vAdding, setVAdding] = useState(false);
  const [vForm, setVForm] = useState<Omit<CareVisit, "id">>({} as Omit<CareVisit, "id">);
  const setV = (patch: Partial<Omit<CareVisit, "id">>) => setVForm((f) => ({ ...f, ...patch }));
  function openVisits(m: CareMember) { setVMember(m); setVAdding(false); setVOpen(true); }
  function openAddVisit(m: CareMember) { setVMember(m); setVForm(visitBlank(m)); setVAdding(true); setVOpen(true); }
  function saveVisit() {
    if (!vMember) return;
    s.addVisit(vForm);
    setVAdding(false);
  }
  const memberVisits = useMemo(
    () => (vMember ? s.careVisits.filter((v) => v.memberId === vMember.id).sort((a, b) => (b.visitDate || "").localeCompare(a.visitDate || "")) : []),
    [vMember, s.careVisits],
  );

  const rows = useMemo(() => s.careMembers
    .filter((m) => fStatus === "All" || m.memberStatus === fStatus)
    .filter((m) => fOffer === "All" || m.offerType === fOffer)
    .filter((m) => fPlan === "All" || m.paymentPlan === fPlan)
    .filter((m) => fBooking === "All" || bookingStatus(m).status === fBooking)
    .filter((m) => !q || `${m.customerName} ${m.phone} ${m.email} ${m.memberNumber} ${m.primaryVehicle}`.toLowerCase().includes(q.toLowerCase())),
    [s.careMembers, fStatus, fOffer, fPlan, fBooking, q]);

  const needing = useMemo(() => s.careMembers.filter((m) => m.memberStatus === "Active" && ["Needs Booking", "Overdue"].includes(bookingStatus(m).status)), [s.careMembers]);
  const upcoming = useMemo(() => s.careMembers.filter((m) => m.memberStatus === "Active" && m.nextDetailDate && m.nextDetailDate >= t).sort((a, b) => a.nextDetailDate.localeCompare(b.nextDetailDate)), [s.careMembers, t]);

  const cols: Col<CareMember>[] = [
    { key: "memberNumber", label: "#", render: (m) => <span className="text-gold font-semibold">{m.memberNumber || "—"}</span> },
    { key: "customerName", label: "Member", render: (m) => <span className="font-medium text-ink">{m.customerName}</span> },
    { key: "memberTier", label: "Tier" },
    { key: "paymentPlan", label: "Plan" },
    { key: "memberStatus", label: "Status", render: (m) => <Badge value={m.memberStatus} /> },
    { key: "booking", label: "Booking", render: (m) => { const b = bookingStatus(m); return <StatusPill label={b.status} tone={b.tone} />; } },
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
    <div>
      <Section title={`Active Members (${rows.length})`} actions={
        <div className="flex gap-2">
          <div className="inline-flex rounded-lg border border-line overflow-hidden">
            {(["cards", "table"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${view === v ? "bg-accent text-white" : "bg-surface2 text-muted hover:text-ink"}`}>{v}</button>
            ))}
          </div>
          <Button onClick={() => download(`care-club-members-${t}.csv`, toCSV(rows as unknown as Record<string, unknown>[]))}>Export CSV</Button>
        </div>
      }>
        <div className="flex flex-wrap gap-2 mb-3">
          <Select options={["All", ...MEMBER_STATUSES]} value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-auto" />
          <Select options={["All", ...OFFER_TYPES]} value={fOffer} onChange={(e) => setFOffer(e.target.value)} className="w-auto" />
          <Select options={["All", ...PAYMENT_PLANS]} value={fPlan} onChange={(e) => setFPlan(e.target.value)} className="w-auto" />
          <Select options={["All", "Booked", "Needs Booking", "Overdue", "Paused", "Past Due", "Canceled", "No Detail Needed"]} value={fBooking} onChange={(e) => setFBooking(e.target.value)} className="w-auto" />
          <Input placeholder="Search member / phone / vehicle…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
        </div>
        {view === "cards" ? (
          rows.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rows.map((m) => (
                <MemberCard key={m.id} m={m} visits={s.careVisits} onEdit={onEdit} onViewVisits={openVisits} onAddVisit={openAddVisit} />
              ))}
            </div>
          ) : <Card className="p-6 text-center text-sm text-muted">No members match.</Card>
        ) : (
          <Table cols={cols} rows={rows} empty="No members match." />
        )}
      </Section>

      <Section title={`Members Needing Next Detail (${needing.length})`}><BookingTable variant="needing" members={needing} onEdit={onEdit} /></Section>
      <Section title={`Upcoming Care Club Bookings (${upcoming.length})`}><BookingTable variant="upcoming" members={upcoming} onEdit={onEdit} /></Section>

      {/* per-member visit history + add visit */}
      <Modal open={vOpen} onClose={() => setVOpen(false)} title={vMember ? `Visits · ${vMember.customerName}` : "Visits"}>
        {vMember && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-muted">
                {memberVisits.length} visit{memberVisits.length === 1 ? "" : "s"} · {memberLifetimeVisits(vMember.id, s.careVisits)} completed · Lifetime {money(memberLifetimeValue(vMember, s.careVisits))}
              </div>
              {!vAdding && <Button variant="accent" onClick={() => { setVForm(visitBlank(vMember)); setVAdding(true); }}>+ Add Visit</Button>}
            </div>

            {vAdding && (
              <Card className="p-3 mb-4">
                <div className="text-xs uppercase tracking-wide text-muted mb-2">New Visit · {vMember.customerName}</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Visit Date"><Input type="date" value={vForm.visitDate} onChange={(e) => setV({ visitDate: e.target.value })} /></Field>
                  <Field label="Service Type"><Select options={SERVICE_TYPES as unknown as string[]} value={vForm.serviceType} onChange={(e) => setV({ serviceType: e.target.value as CareVisit["serviceType"] })} /></Field>
                  <Field label="Status"><Select options={VISIT_STATUSES as unknown as string[]} value={vForm.visitStatus} onChange={(e) => setV({ visitStatus: e.target.value as CareVisit["visitStatus"] })} /></Field>
                  <Field label="Vehicle"><Input value={vForm.vehicle} onChange={(e) => setV({ vehicle: e.target.value })} /></Field>
                  <Field label="Tech"><Select options={["", ...s.technicians]} value={vForm.tech} onChange={(e) => setV({ tech: e.target.value })} /></Field>
                  <Field label="Unit"><Select options={["", ...CARE_UNITS]} value={vForm.unit} onChange={(e) => setV({ unit: e.target.value })} /></Field>
                  <Field label="Urable Job ID"><Input value={vForm.urableJobId} onChange={(e) => setV({ urableJobId: e.target.value })} /></Field>
                  <Field label="Urable Job Link"><Input value={vForm.urableJobLink} onChange={(e) => setV({ urableJobLink: e.target.value })} /></Field>
                  <Field label="Add-On Sold"><Input value={vForm.addOnSold} onChange={(e) => setV({ addOnSold: e.target.value })} /></Field>
                  <Field label="Add-On Revenue"><Input type="number" value={vForm.addOnRevenue} onChange={(e) => setV({ addOnRevenue: +e.target.value })} /></Field>
                  <Field label="Tip"><Input type="number" value={vForm.tip} onChange={(e) => setV({ tip: +e.target.value })} /></Field>
                  <div className="sm:col-span-3"><Field label="Notes"><Textarea rows={2} value={vForm.notes} onChange={(e) => setV({ notes: e.target.value })} /></Field></div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <Button onClick={() => setVAdding(false)}>Cancel</Button>
                  <Button variant="accent" onClick={saveVisit}>Save Visit</Button>
                </div>
              </Card>
            )}

            {memberVisits.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    {["Date", "Urable Job", "Service", "Status", "Tech", "Add-On $", "Tip", ""].map((h, i) => <th key={i} className="text-left font-medium px-2 py-2 whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {memberVisits.map((v) => (
                      <tr key={v.id} className="border-b border-line/60">
                        <td className="px-2 py-2 text-muted whitespace-nowrap">{prettyDate(v.visitDate) || "—"}</td>
                        <td className="px-2 py-2"><div className="flex items-center gap-2"><span className="font-mono text-xs">{v.urableJobId || "—"}</span>{v.urableJobLink && <LinkOut href={v.urableJobLink} />}</div></td>
                        <td className="px-2 py-2">{v.serviceType}</td>
                        <td className="px-2 py-2"><Badge value={v.visitStatus} /></td>
                        <td className="px-2 py-2">{v.tech || <span className="text-danger text-xs">⚠ none</span>}</td>
                        <td className="px-2 py-2 tabular-nums">{money(v.addOnRevenue)}</td>
                        <td className="px-2 py-2 tabular-nums">{money(v.tip)}</td>
                        <td className="px-2 py-2 text-right"><Button variant="ghost" onClick={() => confirm("Delete this visit?") && s.deleteVisit(v.id)}>✕</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Card className="p-6 text-center text-sm text-muted">No visits logged for this member yet.</Card>}
          </>
        )}
      </Modal>
    </div>
  );
}

/* ---- Active member card (grid view) ---- */
function MemberCard({ m, visits, onEdit, onViewVisits, onAddVisit }: {
  m: CareMember; visits: CareVisit[]; onEdit: (m: CareMember) => void; onViewVisits: (m: CareMember) => void; onAddVisit: (m: CareMember) => void;
}) {
  const b = bookingStatus(m);
  const durDays = memberDurationDays(m);
  const contractMonths = m.contractDurationMonths ?? Math.round(durDays / 30.44);
  const mrrContribution = m.paymentPlan === "Monthly" ? (m.monthlyRate || 0) + (m.secondVehicleRate || 0) : 0;
  const recentVisit = visits.filter((v) => v.memberId === m.id && v.urableJobLink).sort((a, b2) => (b2.visitDate || "").localeCompare(a.visitDate || ""))[0];
  const Row = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted">{label}</span><span className="text-xs text-ink text-right">{value}</span></div>
  );
  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-ink leading-tight">{m.customerName}</div>
          <div className="text-xs text-gold font-mono">Member #{m.memberNumber || "—"}</div>
        </div>
        <StatusPill label={m.memberStatus} tone={memberStatusTone(m.memberStatus)} />
      </div>
      <div className="text-xs text-muted">{m.offerType.replace(" Charter Offer", "")} · {m.memberTier}</div>

      <div className="grid grid-cols-1 gap-1 mt-1 border-t border-line/60 pt-2">
        <Row label="Payment Plan" value={m.paymentPlan} />
        <Row label="Monthly Rate" value={<span className="tabular-nums">{money(m.monthlyRate)}</span>} />
        <Row label="MRR Contribution" value={<span className="tabular-nums text-gold">{mrrContribution ? money(mrrContribution) : "—"}</span>} />
        <Row label="Lifetime Value" value={<span className="tabular-nums text-gold">{money(memberLifetimeValue(m, visits))}</span>} />
        <Row label="Assigned Tech" value={m.assignedFounderTech || <span className="text-danger">⚠ none</span>} />
        <Row label="Contract Duration" value={`${contractMonths} mo`} />
        <Row label="Time as Member" value={`${num(durDays)} days`} />
        <Row label="Details Completed" value={<span className="tabular-nums">{memberLifetimeVisits(m.id, visits)}</span>} />
        <Row label="Last Detail" value={prettyDate(m.lastDetailDate) || "—"} />
        <Row label="Next Detail" value={<span className={m.nextDetailDate && m.nextDetailDate < today() ? "text-danger" : ""}>{prettyDate(m.nextDetailDate) || "—"}</span>} />
        <Row label="Booking" value={<StatusPill label={b.status} tone={b.tone} />} />
      </div>

      <div className="flex items-center gap-3 text-xs mt-1 border-t border-line/60 pt-2">
        <span className="text-muted">GHL:</span>
        {m.ghlContactLink ? <LinkOut href={m.ghlContactLink} label="contact" /> : <span className="text-muted">—</span>}
        {m.ghlContractLink ? <LinkOut href={m.ghlContractLink} label="contract" /> : <span className="text-muted">no contract</span>}
      </div>

      <div className="flex flex-wrap gap-1 mt-1">
        <Button variant="accent" onClick={() => onViewVisits(m)}>View Visits</Button>
        <Button onClick={() => onAddVisit(m)}>Add Visit</Button>
        <Button variant="ghost" onClick={() => onEdit(m)}>Edit</Button>
        {recentVisit && <Button variant="ghost" onClick={() => window.open(recentVisit.urableJobLink, "_blank", "noreferrer")}>Open Urable</Button>}
      </div>
    </Card>
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
  const memberById = useMemo(() => Object.fromEntries(s.careMembers.map((m) => [m.id, m])), [s.careMembers]);
  const [fStatus, setFStatus] = useState("All");
  const [fOffer, setFOffer] = useState("All");
  const [fPlan, setFPlan] = useState("All");
  const [quick, setQuick] = useState("All");
  const [q, setQ] = useState("");

  const planOf = (p: CarePerk) => memberById[p.memberId]?.paymentPlan ?? "";
  const quickMatch = (p: CarePerk) => {
    switch (quick) {
      case "Available": return p.status === "Available";
      case "Scheduled": return p.status === "Scheduled";
      case "Used": return p.status === "Used";
      case "Expired": return p.status === "Expired";
      case "PIF Ceramic": return /ceramic/i.test(p.perkName);
      case "Founders 25 Credits": return /founders 25 credit/i.test(p.perkName);
      default: return true;
    }
  };
  const rows = useMemo(() => s.carePerks
    .filter((p) => fStatus === "All" || p.status === fStatus)
    .filter((p) => fOffer === "All" || p.offerType === fOffer)
    .filter((p) => fPlan === "All" || planOf(p) === fPlan)
    .filter(quickMatch)
    .filter((p) => !q || `${p.customerName} ${p.perkName} ${p.urableJobId} ${p.notes}`.toLowerCase().includes(q.toLowerCase())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.carePerks, memberById, fStatus, fOffer, fPlan, quick, q]);

  const cols: Col<CarePerk>[] = [
    { key: "perkName", label: "Perk", render: (p) => <span className="text-ink">{p.perkName}</span> },
    { key: "customerName", label: "Member" },
    { key: "offerType", label: "Offer", render: (p) => <span className="text-xs">{p.offerType.replace(" Charter Offer", "")}</span> },
    { key: "plan", label: "Plan", render: (p) => <span className="text-xs text-muted">{planOf(p) || "—"}</span> },
    { key: "perkValue", label: "Value", render: (p) => <span className="tabular-nums text-gold">{p.perkValue ? money(p.perkValue) : "—"}</span> },
    { key: "eligibleDate", label: "Eligible", render: (p) => <span className="text-muted">{prettyDate(p.eligibleDate) || "—"}</span> },
    { key: "usedDate", label: "Used", render: (p) => <span className="text-muted">{prettyDate(p.usedDate) || "—"}</span> },
    { key: "status", label: "Status", render: (p) => <Badge value={p.status} /> },
    { key: "urableJobId", label: "Urable ID", render: (p) => <span className="font-mono text-xs">{p.urableJobId || "—"}</span> },
    { key: "urable", label: "Link", render: (p) => <LinkOut href={p.urableJobLink} /> },
    { key: "notes", label: "Notes", render: (p) => <span className="text-muted text-xs">{p.notes || "—"}</span> },
  ];

  return (
    <Section title={`Perks (${rows.length})`} actions={<Button onClick={() => download(`care-club-perks-${today()}.csv`, toCSV(rows as unknown as Record<string, unknown>[]))}>Export CSV</Button>}>
      <div className="flex flex-wrap gap-2 mb-3">
        {["All", "Available", "Scheduled", "Used", "Expired", "PIF Ceramic", "Founders 25 Credits"].map((qb) => (
          <button key={qb} onClick={() => setQuick(qb)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${quick === qb ? "bg-accent text-white border-transparent" : "bg-surface2 text-muted border-line hover:text-ink"}`}>{qb === "PIF Ceramic" ? "PIF Ceramic Bonuses" : qb}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Select options={["All", ...PERK_STATUSES]} value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-auto" />
        <Select options={["All", ...OFFER_TYPES]} value={fOffer} onChange={(e) => setFOffer(e.target.value)} className="w-auto" />
        <Select options={["All", ...PAYMENT_PLANS]} value={fPlan} onChange={(e) => setFPlan(e.target.value)} className="w-auto" />
        <Input placeholder="Search perk / member / Urable…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
      </div>
      <Table cols={cols} rows={rows} empty="No perks match." />
    </Section>
  );
}
