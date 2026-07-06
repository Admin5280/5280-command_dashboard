"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Lead, Job, CareClubLead, LEAD_STATUSES, LEAD_SOURCES, SOURCE_REVIEW_STATUSES, CLAIM_STATUSES } from "@/lib/types";
import { money, pct, prettyDate, safeDiv, groupBy, sum, today } from "@/lib/format";
import { byGroup, isConverted } from "@/lib/metrics";
import { salesPayroll } from "@/lib/pay";
import { Badge, BarList, Button, Card, ClaimPill, Field, Input, Kpi, LinkOut, Modal, PageHeader, Section, Select, Table, Textarea, Col } from "@/components/ui";

export default function SalesPage() {
  const s = useStore();
  const rep = s.currentRep;
  return (
    <div>
      <PageHeader title="Sales" subtitle="Per-rep dashboards — pick a rep to see only their pipeline" actions={
        <Select className="w-auto" options={["All Sales Reps", ...s.salesReps]}
          value={rep || "All Sales Reps"}
          onChange={(e) => s.setCurrentRep(e.target.value === "All Sales Reps" ? "" : e.target.value)} />
      } />
      {rep ? <RepDashboard rep={rep} /> : <AllReps />}
    </div>
  );
}

/* ================= All reps overview ================= */
function AllReps() {
  const s = useStore();
  const leads = useMemo(() => s.leads.filter((l) => s.inRange(l.dateCreated)), [s.leads, s.from, s.to]);

  const reps = useMemo(() => {
    const g = groupBy(leads, (l) => l.assignedSalesRep);
    return s.salesReps.map((rep) => {
      const items = g[rep] ?? [];
      const booked = items.filter((l) => isConverted(l.status));
      return {
        rep, leads: items.length, booked: booked.length, close: safeDiv(booked.length, items.length),
        revenue: sum(booked, (l) => l.bookedJobValue || l.quoteAmount), lost: items.filter((l) => l.status === "Lost").length,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [leads, s.salesReps]);

  return (
    <>
      <Section title="Sales Rep Performance">
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              {["Sales Rep", "Leads", "Booked", "Close Rate", "Booked Revenue", "Lost"].map((h) => (
                <th key={h} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>))}
            </tr></thead>
            <tbody>
              {reps.map((r) => (
                <tr key={r.rep} className="border-b border-line/60 hover:bg-surface2/50 cursor-pointer" onClick={() => s.setCurrentRep(r.rep)}>
                  <td className="px-3 py-2 font-medium text-ink">{r.rep} <span className="text-xs text-accent">view →</span></td>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Leads by Rep"><BarList data={byGroup(leads, (l) => l.assignedSalesRep, () => 1)} /></Section>
        <Section title="Booked Revenue by Rep"><BarList data={reps.map((r) => ({ label: r.rep, value: r.revenue }))} money /></Section>
      </div>
    </>
  );
}

/* ================= Single rep dashboard ================= */
function RepDashboard({ rep }: { rep: string }) {
  const s = useStore();
  const t = today();
  const openStatus = (st: string) => !["Booked", "Completed Job", "Care Club Sold", "Lost"].includes(st);

  const repLeads = useMemo(() => s.leads.filter((l) => l.assignedSalesRep === rep && s.inRange(l.dateCreated)), [s.leads, rep, s.from, s.to]);
  const unclaimedPool = useMemo(() => s.leads.filter((l) => l.claimStatus === "Unclaimed" && s.inRange(l.dateCreated)), [s.leads, s.from, s.to]);
  const repJobs = useMemo(() => s.jobs.filter((j) => j.assignedSalesRep === rep && j.dateCompleted && s.inRange(j.dateCompleted)), [s.jobs, rep, s.from, s.to]);
  const repCare = useMemo(() => s.careClubLeads.filter((c) => c.assignedCareRep === rep), [s.careClubLeads, rep]);

  const cnt = (f: (l: Lead) => boolean) => repLeads.filter(f).length;
  const booked = repLeads.filter((l) => isConverted(l.status));
  const overdue = repLeads.filter((l) => l.nextFollowUp && l.nextFollowUp < t && openStatus(l.status));
  const followUps = repLeads.filter((l) => l.status === "Follow-Up Needed" || l.status === "No Response" || (l.nextFollowUp && l.nextFollowUp <= t && openStatus(l.status)));
  const collected = sum(repJobs, (j) => j.amountPaid);
  const bookedRevenue = sum(booked, (l) => l.bookedJobValue || l.quoteAmount);
  const avgTicket = safeDiv(sum(repJobs, (j) => j.totalRevenue), repJobs.length);
  const careSold = repCare.filter((c) => c.pipelineStatus === "Sold").length;
  const jobsInRange = useMemo(() => s.jobs.filter((j) => s.inRange(j.dateCompleted)), [s.jobs, s.from, s.to]);
  const commissionDue = salesPayroll(jobsInRange, [rep], s.payRules)[0]?.total ?? 0;

  function claim(l: Lead) {
    s.updateLead({ ...l, claimStatus: "Claimed", assignedSalesRep: rep, status: l.status === "New Lead" ? "Contacted" : l.status });
  }
  function reassign(l: Lead, newRep: string) {
    if (!newRep) return;
    s.updateLead({ ...l, assignedSalesRep: newRep, claimStatus: l.assignedSalesRep ? "Reassigned" : "Assigned" });
  }

  // inline lead editing from the Sales dashboard
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const set = (patch: Partial<Lead>) => setEditLead((f) => (f ? { ...f, ...patch } : f));
  function saveEdit() { if (editLead) { s.updateLead(editLead); setEditLead(null); } }
  const editCol: Col<Lead> = { key: "edit", label: "", render: (l) => <Button variant="ghost" onClick={() => setEditLead({ ...l })}>Edit</Button> };

  const repSelect = (l: Lead) => (
    <select value={l.assignedSalesRep} onChange={(e) => reassign(l, e.target.value)}
      className="bg-base border border-line rounded px-2 py-1 text-xs text-ink" onClick={(e) => e.stopPropagation()}>
      <option value="">— assign —</option>
      {s.salesReps.map((r) => <option key={r} value={r}>{r}</option>)}
    </select>
  );

  const leadCols: Col<Lead>[] = [
    { key: "leadId", label: "Lead ID", render: (l) => <span className="font-mono text-xs text-accent">{l.leadId}</span> },
    { key: "customerName", label: "Customer", render: (l) => <span className="text-ink">{l.customerName}</span> },
    { key: "phone", label: "Phone" },
    { key: "serviceInterest", label: "Service" },
    { key: "status", label: "Status", render: (l) => <Badge value={l.status} /> },
    { key: "claimStatus", label: "Claim", render: (l) => <ClaimPill status={l.claimStatus} /> },
    { key: "nextFollowUp", label: "Follow-Up", render: (l) => <span className={l.nextFollowUp && l.nextFollowUp < t ? "text-danger" : "text-muted"}>{prettyDate(l.nextFollowUp) || "—"}</span> },
    { key: "reassign", label: "Reassign", render: repSelect },
  ];

  const jobCols: Col<Job>[] = [
    { key: "dateCompleted", label: "Date", render: (j) => <span className="text-muted">{prettyDate(j.dateCompleted)}</span> },
    { key: "customerName", label: "Customer", render: (j) => <span className="text-ink">{j.customerName}</span> },
    { key: "services", label: "Service" },
    { key: "totalRevenue", label: "Revenue", render: (j) => <span className="tabular-nums text-gold">{money(j.totalRevenue)}</span> },
    { key: "amountPaid", label: "Collected", render: (j) => <span className="tabular-nums text-good">{money(j.amountPaid)}</span> },
    { key: "paymentStatus", label: "Payment", render: (j) => <Badge value={j.paymentStatus} /> },
    { key: "urable", label: "Urable", render: (j) => <LinkOut href={j.urableJobLink} /> },
  ];

  const careCols: Col<CareClubLead>[] = [
    { key: "careLeadId", label: "Care Lead", render: (c) => <span className="font-mono text-xs text-accent">{c.careLeadId}</span> },
    { key: "customerName", label: "Customer", render: (c) => <span className="text-ink">{c.customerName}</span> },
    { key: "completedService", label: "Job" },
    { key: "pipelineStatus", label: "Status", render: (c) => <Badge value={c.pipelineStatus === "Sold" ? "Won Back" : c.pipelineStatus} /> },
    { key: "followUpDate", label: "Follow-Up", render: (c) => <span className="text-muted">{prettyDate(c.followUpDate) || "—"}</span> },
    { key: "links", label: "Links", render: (c) => <LinkOut href={c.ghlContactLink} label="GHL" /> },
  ];

  const claimCol: Col<Lead> = { key: "claim", label: "", render: (l) => <Button variant="accent" onClick={() => claim(l)}>Claim</Button> };

  return (
    <>
      <Section title={`${rep} — Dashboard`}>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <Kpi label="Assigned Leads" value={String(repLeads.length)} tone="blue" />
          <Kpi label="New Leads" value={String(cnt((l) => l.status === "New Lead"))} tone="blue" />
          <Kpi label="Unclaimed (pool)" value={String(unclaimedPool.length)} tone={unclaimedPool.length ? "warn" : "default"} />
          <Kpi label="Claimed" value={String(cnt((l) => l.claimStatus === "Claimed"))} tone="blue" />
          <Kpi label="Contacted" value={String(cnt((l) => l.status === "Contacted"))} tone="blue" />
          <Kpi label="Estimate Sent" value={String(cnt((l) => l.status === "Estimate Sent"))} tone="blue" />
          <Kpi label="Follow-Up Needed" value={String(cnt((l) => l.status === "Follow-Up Needed"))} tone="blue" />
          <Kpi label="Overdue Follow-Ups" value={String(overdue.length)} tone={overdue.length ? "danger" : "good"} />
          <Kpi label="Booked Leads" value={String(booked.length)} tone="blue" />
          <Kpi label="Completed Jobs" value={String(repJobs.length)} tone="blue" />
          <Kpi label="Collected Revenue" value={money(collected)} tone="gold" />
          <Kpi label="Booked Revenue" value={money(bookedRevenue)} tone="gold" />
          <Kpi label="Close Rate" value={pct(safeDiv(booked.length, repLeads.length))} tone="blue" />
          <Kpi label="Average Ticket" value={money(avgTicket)} tone="gold" />
          <Kpi label="Care Club Leads" value={String(repCare.length)} tone="blue" />
          <Kpi label="Care Club Sold" value={String(careSold)} tone="good" />
          <Kpi label="Care Club Close Rate" value={pct(safeDiv(careSold, repCare.length))} tone="blue" />
          <Kpi label="Commission Due" value={money(commissionDue)} tone="gold" />
        </div>
      </Section>

      <Section title={`My Lead Inbox (${repLeads.length})`}><Table cols={[...leadCols, editCol]} rows={repLeads} empty="No leads assigned to you." /></Section>
      <Section title={`My Unclaimed Leads (${unclaimedPool.length})`}><Table cols={[...leadCols.slice(0, 6), claimCol, editCol]} rows={unclaimedPool} empty="No unclaimed leads in the pool." /></Section>
      <Section title={`My Follow-Ups (${followUps.length})`}><Table cols={[...leadCols, editCol]} rows={followUps} empty="No follow-ups due. ✓" /></Section>
      <Section title={`My Booked Leads (${booked.length})`}><Table cols={[...leadCols.slice(0, 7), editCol]} rows={booked} empty="No booked leads yet." /></Section>
      <Section title={`My Completed Jobs (${repJobs.length})`}><Table cols={jobCols} rows={repJobs} empty="No completed jobs." /></Section>
      <Section title={`My Care Club Leads (${repCare.length})`}><Table cols={careCols} rows={repCare} empty="No Care Club leads assigned." /></Section>

      <Modal open={!!editLead} onClose={() => setEditLead(null)} title={editLead ? `Edit Lead · ${editLead.leadId}` : "Edit Lead"}>
        {editLead && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Customer Name"><Input value={editLead.customerName} onChange={(e) => set({ customerName: e.target.value })} /></Field>
              <Field label="Phone"><Input value={editLead.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
              <Field label="Email"><Input value={editLead.email} onChange={(e) => set({ email: e.target.value })} /></Field>
              <Field label="Service Interest"><Select options={s.services} value={editLead.serviceInterest} onChange={(e) => set({ serviceInterest: e.target.value })} /></Field>
              <Field label="Confirmed Source (final)"><Select options={["", ...LEAD_SOURCES]} value={editLead.confirmedSource} onChange={(e) => set({ confirmedSource: e.target.value })} /></Field>
              <Field label="Source Review Status"><Select options={SOURCE_REVIEW_STATUSES as unknown as string[]} value={editLead.sourceReviewStatus} onChange={(e) => set({ sourceReviewStatus: e.target.value as Lead["sourceReviewStatus"] })} /></Field>
              <Field label="Claim Status"><Select options={CLAIM_STATUSES as unknown as string[]} value={editLead.claimStatus} onChange={(e) => set({ claimStatus: e.target.value as Lead["claimStatus"] })} /></Field>
              <Field label="Assigned Sales Rep"><Select options={["", ...s.salesReps]} value={editLead.assignedSalesRep} onChange={(e) => set({ assignedSalesRep: e.target.value })} /></Field>
              <Field label="Lead Status"><Select options={LEAD_STATUSES as unknown as string[]} value={editLead.status} onChange={(e) => set({ status: e.target.value as Lead["status"] })} /></Field>
              <Field label="Next Follow-Up"><Input type="date" value={editLead.nextFollowUp} onChange={(e) => set({ nextFollowUp: e.target.value })} /></Field>
              <Field label="Quote Amount"><Input type="number" value={editLead.quoteAmount} onChange={(e) => set({ quoteAmount: +e.target.value })} /></Field>
              <Field label="Booked Date"><Input type="date" value={editLead.bookedDate} onChange={(e) => set({ bookedDate: e.target.value })} /></Field>
              <Field label="Booked Job Value"><Input type="number" value={editLead.bookedJobValue} onChange={(e) => set({ bookedJobValue: +e.target.value })} /></Field>
              <Field label="GHL Contact Link"><Input value={editLead.ghlContactLink} onChange={(e) => set({ ghlContactLink: e.target.value })} /></Field>
              <div className="sm:col-span-3"><Field label="Notes"><Textarea rows={2} value={editLead.notes} onChange={(e) => set({ notes: e.target.value })} /></Field></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={() => setEditLead(null)}>Cancel</Button>
              <Button variant="accent" onClick={saveEdit}>Save Changes</Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
