"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Job, Lead } from "@/lib/types";
import { leadFlags, bookedNotInJobs, completedJobsMissingCareLead, dupCareLeadsBy, soldCareLeadsWithoutMember } from "@/lib/guardrails";
import { careAudit } from "@/lib/careClub";
import { serviceQuality } from "@/lib/quality";
import { completed, marketingByChannel } from "@/lib/metrics";
import { money, sum, today } from "@/lib/format";
import { Card, Kpi, PageHeader, Section } from "@/components/ui";

interface Row { name: string; count: number; sample: string; href?: string; }

export default function AuditPage() {
  const s = useStore();
  const leadIds = useMemo(() => new Set(s.leads.map((l) => l.leadId).filter(Boolean)), [s.leads]);

  const leadChecks = useMemo<Row[]>(() => {
    const names = ["DUP LEAD ID", "REVIEW SOURCE", "NEEDS SALES REP"];
    return names.map((n) => {
      const hits = s.leads.filter((l) => leadFlags(l, s.leads).includes(n));
      return { name: n, count: hits.length, sample: hits.slice(0, 6).map((l) => l.leadId || l.customerName).join(", "), href: "/leads" };
    });
  }, [s.leads]);

  const jobChecks = useMemo<Row[]>(() => {
    const defs: { name: string; test: (j: Job) => boolean }[] = [
      { name: "Missing Urable Job ID", test: (j) => !j.urableJobId },
      { name: "Missing Urable Job Link", test: (j) => !j.urableJobLink },
      { name: "Missing Lead Tech", test: (j) => !j.leadTech },
      { name: "Missing Job Location / Unit", test: (j) => !j.unit },
      { name: "Missing Payment Status", test: (j) => !j.paymentStatus },
      { name: "Missing Revenue", test: (j) => !(j.totalRevenue > 0) },
      { name: "Missing Sales Rep", test: (j) => !j.assignedSalesRep },
      { name: "Lead ID does not match a lead", test: (j) => !j.leadId || !leadIds.has(j.leadId) },
      { name: "Missing Tech Pay Status", test: (j) => !j.techPayStatus },
      { name: "Missing Sales Commission Status", test: (j) => !j.salesCommissionStatus },
      { name: "Missing Job Status", test: (j) => !j.jobStatus },
      { name: "Completed jobs missing review request", test: (j) => j.jobStatus === "Completed" && (!j.reviewRequestStatus || j.reviewRequestStatus === "Not Sent") },
      { name: "Canceled jobs missing cancellation reason", test: (j) => j.jobStatus === "Canceled" && !j.cancellationReason },
      { name: "Refunded jobs missing notes", test: (j) => j.jobStatus === "Refunded" && !j.cancellationNotes && !j.adminNotes },
    ];
    return defs.map((d) => {
      const hits = s.jobs.filter(d.test);
      return { name: d.name, count: hits.length, sample: hits.slice(0, 6).map((j) => j.urableJobId || j.customerName).join(", "), href: "/jobs" };
    });
  }, [s.jobs, leadIds]);

  const marketingChecks = useMemo<Row[]>(() => {
    const ch = marketingByChannel(s.marketing, s.leads, s.jobs, s.from, s.to);
    const spendNoLeads = ch.filter((c) => c.spend > 0 && c.leads === 0);
    const leadsNoSpend = ch.filter((c) => c.leads > 0 && c.spend === 0);
    return [
      { name: "Channels with spend but no leads", count: spendNoLeads.length, sample: spendNoLeads.map((c) => c.channel).join(", "), href: "/marketing" },
      { name: "Channels with leads but no spend", count: leadsNoSpend.length, sample: leadsNoSpend.map((c) => c.channel).join(", "), href: "/marketing" },
    ];
  }, [s.marketing, s.leads, s.jobs, s.from, s.to]);

  const careLeadChecks = useMemo<Row[]>(() => {
    const missing = completedJobsMissingCareLead(s.jobs, s.careClubLeads);
    const dupOrig = dupCareLeadsBy(s.careClubLeads, "originalLeadId");
    const dupUrable = dupCareLeadsBy(s.careClubLeads, "urableJobId");
    const noRep = s.careClubLeads.filter((c) => !c.assignedCareRep && !["Sold", "Lost", "Not Interested"].includes(c.pipelineStatus));
    const noFollow = s.careClubLeads.filter((c) => !c.followUpDate && !["Sold", "Lost", "Not Interested"].includes(c.pipelineStatus));
    const soldNoMember = soldCareLeadsWithoutMember(s.careClubLeads, s.careMembers);
    const memNoLead = s.careMembers.filter((m) => !m.leadId);
    const memNoGhl = s.careMembers.filter((m) => !m.ghlContactLink);
    return [
      { name: "Completed jobs missing Care Club Lead", count: missing.length, sample: missing.slice(0, 6).map((j) => j.urableJobId || j.customerName).join(", "), href: "/jobs" },
      { name: "Duplicate Care Club Leads (Original Lead ID)", count: dupOrig.length, sample: dupOrig.slice(0, 6).map((c) => c.originalLeadId).join(", "), href: "/care-club" },
      { name: "Duplicate Care Club Leads (Urable Job ID)", count: dupUrable.length, sample: dupUrable.slice(0, 6).map((c) => c.urableJobId).join(", "), href: "/care-club" },
      { name: "Care Club Lead missing assigned rep", count: noRep.length, sample: noRep.slice(0, 6).map((c) => c.careLeadId).join(", "), href: "/care-club" },
      { name: "Care Club Lead missing follow-up date", count: noFollow.length, sample: noFollow.slice(0, 6).map((c) => c.careLeadId).join(", "), href: "/care-club" },
      { name: "Sold Care Club Lead but no Member exists", count: soldNoMember.length, sample: soldNoMember.slice(0, 6).map((c) => c.careLeadId).join(", "), href: "/care-club" },
      { name: "Care Club Member missing Original Lead ID", count: memNoLead.length, sample: memNoLead.slice(0, 6).map((m) => m.customerName).join(", "), href: "/care-club" },
      { name: "Care Club Member missing GHL Contact Link", count: memNoGhl.length, sample: memNoGhl.slice(0, 6).map((m) => m.customerName).join(", "), href: "/care-club" },
    ];
  }, [s.jobs, s.careClubLeads, s.careMembers]);

  const claimChecks = useMemo<Row[]>(() => {
    const t = today();
    const repSet = new Set(s.salesReps);
    const oldUnclaimed = s.leads.filter((l) => l.claimStatus === "Unclaimed" && l.dateCreated && l.dateCreated < t);
    const inactiveRep = s.leads.filter((l) => l.assignedSalesRep && !repSet.has(l.assignedSalesRep));
    const bookedUnclaimed = s.leads.filter((l) => (l.status === "Booked" || l.status === "Care Club Sold") && l.claimStatus === "Unclaimed");
    const blankRep = s.leads.filter((l) => !l.assignedSalesRep);
    const overdue = s.leads.filter((l) => l.nextFollowUp && l.nextFollowUp < t && !["Booked", "Completed Job", "Care Club Sold", "Lost"].includes(l.status));
    const overdueByRep = Object.entries(overdue.reduce<Record<string, number>>((a, l) => { const r = l.assignedSalesRep || "Unassigned"; a[r] = (a[r] || 0) + 1; return a; }, {}))
      .map(([r, n]) => `${r}: ${n}`).join(", ");
    return [
      { name: "Unclaimed leads older than 24 hours", count: oldUnclaimed.length, sample: oldUnclaimed.slice(0, 6).map((l) => l.leadId).join(", "), href: "/leads" },
      { name: "Leads assigned to inactive sales reps", count: inactiveRep.length, sample: [...new Set(inactiveRep.map((l) => l.assignedSalesRep))].join(", "), href: "/leads" },
      { name: "Booked leads still Unclaimed", count: bookedUnclaimed.length, sample: bookedUnclaimed.slice(0, 6).map((l) => l.leadId).join(", "), href: "/leads" },
      { name: "Leads with Assigned Sales Rep blank", count: blankRep.length, sample: blankRep.slice(0, 6).map((l) => l.leadId).join(", "), href: "/leads" },
      { name: "Follow-ups overdue (by rep)", count: overdue.length, sample: overdueByRep, href: "/sales" },
    ];
  }, [s.leads, s.salesReps]);

  const qualityChecks = useMemo<Row[]>(() => {
    const q = serviceQuality(s.jobs, s.from, s.to);
    const cbHigh = q.filter((r) => r.callbackPct > 0.10);
    const revLow = q.filter((r) => r.completed > 0 && r.reviewPct < 0.30);
    const ratingLow = q.filter((r) => r.avgRating > 0 && r.avgRating < 4.5);
    const neg = q.filter((r) => r.negativeReviews > 0);
    const cbJobs = s.jobs.filter((j) => j.services === "Callback");
    const cbNoUrable = cbJobs.filter((j) => !j.urableJobId);
    const cbNoNotes = cbJobs.filter((j) => !j.adminNotes);
    return [
      { name: "Services with callback % above 10%", count: cbHigh.length, sample: cbHigh.map((r) => r.service).join(", "), href: "/quality" },
      { name: "Services with review % below 30%", count: revLow.length, sample: revLow.map((r) => r.service).join(", "), href: "/quality" },
      { name: "Services with average rating below 4.5", count: ratingLow.length, sample: ratingLow.map((r) => `${r.service} (${r.avgRating.toFixed(1)})`).join(", "), href: "/quality" },
      { name: "Services with negative reviews", count: neg.length, sample: neg.map((r) => r.service).join(", "), href: "/quality" },
      { name: "Callback jobs missing Urable Job ID", count: cbNoUrable.length, sample: cbNoUrable.slice(0, 6).map((j) => j.customerName).join(", "), href: "/jobs" },
      { name: "Callback jobs missing resolution notes", count: cbNoNotes.length, sample: cbNoNotes.slice(0, 6).map((j) => j.customerName).join(", "), href: "/jobs" },
    ];
  }, [s.jobs, s.from, s.to]);

  const [failedWebhooks, setFailedWebhooks] = useState(0);
  useEffect(() => {
    fetch("/api/webhooks/status").then((r) => r.json())
      .then((j) => setFailedWebhooks((j.events || []).filter((e: { status: string }) => e.status === "error" || e.status === "unauthorized").length))
      .catch(() => {});
  }, []);

  const ghlChecks = useMemo<Row[]>(() => {
    const ghl = s.leads.filter((l) => l.origin === "ghl");
    const dupBy = (field: keyof Lead) => {
      const counts: Record<string, number> = {};
      s.leads.forEach((l) => { const v = String(l[field] || ""); if (v) counts[v] = (counts[v] || 0) + 1; });
      return s.leads.filter((l) => { const v = String(l[field] || ""); return v && counts[v] > 1; });
    };
    const noContactId = ghl.filter((l) => !l.ghlContactId);
    const noContact = ghl.filter((l) => !l.phone && !l.email);
    const needsReview = ghl.filter((l) => !l.confirmedSource);
    const dupContact = dupBy("ghlContactId");
    const dupPhone = dupBy("phone");
    const dupEmail = dupBy("email");
    return [
      { name: "GHL leads missing GHL Contact ID", count: noContactId.length, sample: noContactId.slice(0, 6).map((l) => l.leadId).join(", "), href: "/leads" },
      { name: "Webhook leads missing phone AND email", count: noContact.length, sample: noContact.slice(0, 6).map((l) => l.leadId).join(", "), href: "/leads" },
      { name: "GHL leads needing source review", count: needsReview.length, sample: needsReview.slice(0, 6).map((l) => l.leadId).join(", "), href: "/leads" },
      { name: "Duplicate leads by GHL Contact ID", count: dupContact.length, sample: [...new Set(dupContact.map((l) => l.ghlContactId))].slice(0, 6).join(", "), href: "/leads" },
      { name: "Duplicate leads by phone", count: dupPhone.length, sample: [...new Set(dupPhone.map((l) => l.phone))].slice(0, 6).join(", "), href: "/leads" },
      { name: "Duplicate leads by email", count: dupEmail.length, sample: [...new Set(dupEmail.map((l) => l.email))].slice(0, 6).join(", "), href: "/leads" },
      { name: "Webhook failed records (recent)", count: failedWebhooks, sample: failedWebhooks ? "see Settings → GHL Webhook panel" : "", href: "/settings" },
    ];
  }, [s.leads, failedWebhooks]);

  const bookedGap = useMemo(() => bookedNotInJobs(s.leads, s.jobs), [s.leads, s.jobs]);
  const careChecks = useMemo(() => careAudit(s.careMembers, s.careVisits, s.jobs), [s.careMembers, s.careVisits, s.jobs]);

  // reconciliation
  const comp = completed(s.jobs);
  const totalRev = sum(comp, (j) => j.totalRevenue);
  const collected = sum(comp, (j) => j.amountPaid);
  const due = sum(comp, (j) => j.amountDue);
  const revMismatch = Math.round(totalRev - (collected + due));
  const payMismatch = comp.filter((j) =>
    (j.paymentStatus === "Fully Paid" && j.amountDue > 0) ||
    (j.paymentStatus === "Unpaid" && j.amountPaid > 0));

  const allRows = [...leadChecks, ...ghlChecks, ...jobChecks, ...claimChecks, ...qualityChecks, ...marketingChecks, ...careLeadChecks];
  const openIssues = sum(allRows, (r) => r.count) + bookedGap.length + sum(careChecks, (c) => c.count) + payMismatch.length + (revMismatch !== 0 ? 1 : 0);

  const CheckTable = ({ rows }: { rows: Row[] }) => (
    <Card className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
          {["Check", "Issues", "Affected Records", "Fix"].map((h) => <th key={h} className="text-left font-medium px-3 py-2.5">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-line/60">
              <td className="px-3 py-2 font-medium text-ink">{r.name}</td>
              <td className="px-3 py-2 tabular-nums">
                {r.count === 0 ? <span className="text-good">✓ 0</span> : <span className="text-danger font-semibold">{r.count}</span>}
              </td>
              <td className="px-3 py-2 text-muted text-xs">{r.sample || "—"}</td>
              <td className="px-3 py-2">{r.count > 0 && r.href ? <Link href={r.href} className="text-accent hover:underline text-xs">Fix ↗</Link> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );

  const ReconCard = ({ label, ok, detail }: { label: string; ok: boolean; detail: string }) => (
    <Card className={`p-4 border ${ok ? "border-line" : "border-danger/40"}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <span className={ok ? "text-good" : "text-danger"}>{ok ? "✓" : "⚠"}</span>{label}
      </div>
      <div className="text-xs text-muted mt-1">{detail}</div>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Audit" subtitle="Data-integrity guardrails, reconciliation, marketing & Care Club pipeline checks" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Open Issues" value={openIssues.toLocaleString()} tone={openIssues > 0 ? "danger" : "good"} />
        <Kpi label="Lead Issues" value={sum(leadChecks, (r) => r.count).toLocaleString()} tone="blue" />
        <Kpi label="Job Issues" value={sum(jobChecks, (r) => r.count).toLocaleString()} tone="blue" />
        <Kpi label="Care Club Issues" value={(sum(careLeadChecks, (r) => r.count) + sum(careChecks, (c) => c.count)).toLocaleString()} tone="blue" />
      </div>

      <Section title="Lead Guardrails"><CheckTable rows={leadChecks} /></Section>
      <Section title="GHL / Webhook Intake Checks"><CheckTable rows={ghlChecks} /></Section>
      <Section title="Sales & Claim Checks"><CheckTable rows={claimChecks} /></Section>
      <Section title="Job Health & Payroll Readiness"><CheckTable rows={jobChecks} /></Section>
      <Section title="Quality & Reputation Checks"><CheckTable rows={qualityChecks} /></Section>
      <Section title="Marketing Checks"><CheckTable rows={marketingChecks} /></Section>
      <Section title="Care Club Pipeline Checks"><CheckTable rows={careLeadChecks} /></Section>

      <Section title="Reconciliation">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ReconCard ok={revMismatch === 0} label="Revenue balances"
            detail={`Total ${money(totalRev)} = Collected ${money(collected)} + Due ${money(due)}${revMismatch !== 0 ? ` · off by ${money(revMismatch)}` : ""}`} />
          <ReconCard ok={payMismatch.length === 0} label="Payment status consistent"
            detail={payMismatch.length ? `${payMismatch.length} job(s) with status/balance mismatch` : "No status/balance conflicts"} />
          <ReconCard ok={bookedGap.length === 0} label="Booked leads converted"
            detail={bookedGap.length ? `${bookedGap.length} booked lead(s) have no job yet: ${bookedGap.slice(0, 5).map((l) => l.leadId).join(", ")}` : "Every booked lead has a job"} />
        </div>
      </Section>

      <Section title="Care Club Member Checks">
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              {["Check", "Issues"].map((h) => <th key={h} className="text-left font-medium px-3 py-2.5">{h}</th>)}
            </tr></thead>
            <tbody>
              {careChecks.map((c) => (
                <tr key={c.name} className="border-b border-line/60">
                  <td className="px-3 py-2 font-medium text-ink">{c.name}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {c.count === 0 ? <span className="text-good">✓ 0</span> : <span className="text-danger font-semibold">{c.count}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>
    </div>
  );
}
