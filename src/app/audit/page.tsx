"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { leadFlags, jobFlags, bookedNotInJobs } from "@/lib/guardrails";
import { careAudit } from "@/lib/careClub";
import { completed } from "@/lib/metrics";
import { money, sum } from "@/lib/format";
import { Card, Kpi, PageHeader, Section } from "@/components/ui";

interface Row { name: string; count: number; sample: string; }

export default function AuditPage() {
  const s = useStore();

  const leadChecks = useMemo<Row[]>(() => {
    const names = ["DUP LEAD ID", "REVIEW SOURCE", "NEEDS SALES REP"];
    return names.map((n) => {
      const hits = s.leads.filter((l) => leadFlags(l, s.leads).includes(n));
      return { name: n, count: hits.length, sample: hits.slice(0, 6).map((l) => l.leadId || l.customerName).join(", ") };
    });
  }, [s.leads]);

  const jobChecks = useMemo<Row[]>(() => {
    const names = ["DUP JOB ID", "LEAD NOT FOUND", "NEEDS PAYMENT STATUS", "NEEDS UNIT/TECH/TYPE"];
    return names.map((n) => {
      const hits = s.jobs.filter((j) => jobFlags(j, s.jobs, s.leads).includes(n));
      return { name: n, count: hits.length, sample: hits.slice(0, 6).map((j) => j.urableJobId || j.customerName).join(", ") };
    });
  }, [s.jobs, s.leads]);

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

  const openIssues =
    sum(leadChecks, (r) => r.count) + sum(jobChecks, (r) => r.count) + bookedGap.length +
    sum(careChecks, (c) => c.count) + payMismatch.length + (revMismatch !== 0 ? 1 : 0);

  const ReconCard = ({ label, ok, detail }: { label: string; ok: boolean; detail: string }) => (
    <Card className={`p-4 border ${ok ? "border-line" : "border-danger/40"}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <span className={ok ? "text-good" : "text-danger"}>{ok ? "✓" : "⚠"}</span>{label}
      </div>
      <div className="text-xs text-muted mt-1">{detail}</div>
    </Card>
  );

  const CheckTable = ({ rows }: { rows: Row[] }) => (
    <Card className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
          {["Check", "Issues", "Examples"].map((h) => <th key={h} className="text-left font-medium px-3 py-2.5">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-line/60">
              <td className="px-3 py-2 font-medium text-ink">{r.name}</td>
              <td className="px-3 py-2 tabular-nums">
                {r.count === 0 ? <span className="text-good">✓ 0</span> : <span className="text-danger font-semibold">{r.count}</span>}
              </td>
              <td className="px-3 py-2 text-muted text-xs">{r.sample || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );

  return (
    <div>
      <PageHeader title="Audit" subtitle="Data-integrity guardrails, reconciliation & Care Club checks" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Open Issues" value={openIssues.toLocaleString()} tone={openIssues > 0 ? "danger" : "good"} />
        <Kpi label="Leads Needing Review" value={sum(leadChecks, (r) => r.count).toLocaleString()} tone="blue" />
        <Kpi label="Jobs Needing Review" value={sum(jobChecks, (r) => r.count).toLocaleString()} tone="blue" />
        <Kpi label="Care Club Issues" value={sum(careChecks, (c) => c.count).toLocaleString()} tone="blue" />
      </div>

      <Section title="Lead Guardrails"><CheckTable rows={leadChecks} /></Section>
      <Section title="Job Guardrails"><CheckTable rows={jobChecks} /></Section>

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

      <Section title="Care Club Checks">
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
