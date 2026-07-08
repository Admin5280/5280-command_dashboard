"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Job, JOB_TYPES, JOB_STATUSES, CANCELLATION_REASONS } from "@/lib/types";
import { completed as completedFn, canceled as canceledFn } from "@/lib/metrics";
import { opsKpis, serviceOps, techOps, unitOps } from "@/lib/operations";
import { money, pct, prettyDate, today } from "@/lib/format";
import { toCSV, download } from "@/lib/csv";
import { Badge, Button, Card, Field, Input, Kpi, LinkOut, Modal, PageHeader, Section, Select, StatusPill, Textarea } from "@/components/ui";
import { Bars, ChartCard, Donut } from "@/components/charts";

type Tab = "Operations Dashboard" | "Service Performance" | "Technician Performance" | "Unit Performance" | "Canceled Jobs" | "Quality Metrics";
const TABS: Tab[] = ["Operations Dashboard", "Service Performance", "Technician Performance", "Unit Performance", "Canceled Jobs", "Quality Metrics"];
const monthKey = (iso: string) => (iso ? iso.slice(0, 7) : "");

export default function OperationsPage() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>("Operations Dashboard");
  const [fService, setFService] = useState("All");
  const [fTech, setFTech] = useState("All");
  const [fUnit, setFUnit] = useState("All");
  const [fType, setFType] = useState("All");
  const [fStatus, setFStatus] = useState("All");
  const [fPay, setFPay] = useState("All");

  const jobs = useMemo(() => s.jobs
    .filter((j) => (!s.from && !s.to) || s.inRange(j.dateCompleted) || (!!j.cancellationDate && s.inRange(j.cancellationDate)))
    .filter((j) => fService === "All" || j.services === fService)
    .filter((j) => fTech === "All" || j.leadTech === fTech || j.helperTech === fTech)
    .filter((j) => fUnit === "All" || j.unit === fUnit)
    .filter((j) => fType === "All" || j.jobType === fType)
    .filter((j) => fStatus === "All" || j.jobStatus === fStatus)
    .filter((j) => fPay === "All" || j.paymentStatus === fPay),
    [s.jobs, s.from, s.to, fService, fTech, fUnit, fType, fStatus, fPay]);

  const kpis = useMemo(() => opsKpis(jobs), [jobs]);
  const svc = useMemo(() => serviceOps(jobs), [jobs]);
  const techs = useMemo(() => techOps(jobs, s.technicians), [jobs, s.technicians]);
  const units = useMemo(() => unitOps(jobs, s.units), [jobs, s.units]);

  const services = useMemo(() => [...new Set(s.jobs.map((j) => j.services).filter(Boolean))], [s.jobs]);
  const jobUnits = useMemo(() => [...new Set([...s.units, ...s.jobs.map((j) => j.unit).filter(Boolean)])], [s.units, s.jobs]);

  // empty state when running on live (Supabase) jobs but none exist
  if (s.jobsRemote && s.jobs.length === 0) {
    return (
      <div>
        <PageHeader title="Operations" subtitle="Control center — services, technicians, units, quality" />
        <Card className="p-10 text-center text-muted">
          <div className="text-ink font-medium mb-1">No live job data yet</div>
          Add or migrate jobs to Supabase to populate Operations.
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Operations" subtitle={`Control center · source: ${s.jobsRemote ? "Live Supabase jobs" : "local/sample jobs"}`} />

      <div className="flex flex-wrap gap-1 mb-4 border-b border-line">
        {TABS.map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === tb ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {tb}{tb === "Canceled Jobs" && kpis.canceledJobs ? ` (${kpis.canceledJobs})` : ""}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Select options={["All", ...services]} value={fService} onChange={(e) => setFService(e.target.value)} className="w-auto" />
        <Select options={["All", ...s.technicians]} value={fTech} onChange={(e) => setFTech(e.target.value)} className="w-auto" />
        <Select options={["All", ...jobUnits]} value={fUnit} onChange={(e) => setFUnit(e.target.value)} className="w-auto" />
        <Select options={["All", ...JOB_TYPES]} value={fType} onChange={(e) => setFType(e.target.value)} className="w-auto" />
        <Select options={["All", ...JOB_STATUSES]} value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-auto" />
        <Select options={["All", "Fully Paid", "Partially Paid", "Unpaid", "Refunded"]} value={fPay} onChange={(e) => setFPay(e.target.value)} className="w-auto" />
      </div>

      {tab === "Operations Dashboard" && <DashboardTab jobs={jobs} kpis={kpis} svc={svc} techs={techs} units={units} />}
      {tab === "Service Performance" && <ServiceTab rows={svc} />}
      {tab === "Technician Performance" && <TechTab rows={techs} />}
      {tab === "Unit Performance" && <UnitTab rows={units} />}
      {tab === "Canceled Jobs" && <CanceledTab jobs={jobs} />}
      {tab === "Quality Metrics" && <QualityTab svc={svc} techs={techs} kpis={kpis} />}
    </div>
  );
}

/* ================= Dashboard tab ================= */
function DashboardTab({ jobs, kpis, svc, techs, units }: {
  jobs: Job[]; kpis: ReturnType<typeof opsKpis>; svc: ReturnType<typeof serviceOps>; techs: ReturnType<typeof techOps>; units: ReturnType<typeof unitOps>;
}) {
  const comp = completedFn(jobs);
  const byType = JOB_TYPES.map((t) => ({ name: t, value: comp.filter((j) => j.jobType === t).length }));
  const byStatus = JOB_STATUSES.map((st) => ({ name: st, value: jobs.filter((j) => j.jobStatus === st).length }));
  const serviceMix = svc.map((r) => ({ name: r.service, value: r.completed }));
  const canceledOverTime = useMemo(() => {
    const g: Record<string, number> = {};
    canceledFn(jobs).forEach((j) => { const m = monthKey(j.cancellationDate || j.dateCompleted); if (m) g[m] = (g[m] || 0) + 1; });
    return Object.entries(g).sort().map(([name, value]) => ({ name, value }));
  }, [jobs]);
  const qualityBreakdown = ["Excellent", "Needs Review", "Critical", "—"].map((st) => ({ name: st, value: svc.filter((r) => r.status === st).length }));

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
        <Kpi label="Completed Jobs" value={String(kpis.completedJobs)} tone="blue" />
        <Kpi label="Canceled Jobs" value={String(kpis.canceledJobs)} tone={kpis.canceledJobs ? "danger" : "good"} />
        <Kpi label="Production Revenue" value={money(kpis.production)} tone="gold" />
        <Kpi label="Average Ticket" value={money(kpis.avgTicket)} tone="gold" />
        <Kpi label="Solo Jobs" value={String(kpis.solo)} tone="blue" />
        <Kpi label="Duo Jobs" value={String(kpis.duo)} tone="blue" />
        <Kpi label="Shop Jobs" value={String(kpis.shop)} tone="blue" />
        <Kpi label="Mobile Jobs" value={String(kpis.mobile)} tone="blue" />
        <Kpi label="Total Tips" value={money(kpis.tips)} tone="gold" />
        <Kpi label="Total Upsells" value={money(kpis.upsells)} tone="gold" />
        <Kpi label="Upsell Rate" value={pct(kpis.upsellRate)} tone="blue" />
        <Kpi label="Callback Count" value={String(kpis.callbacks)} tone={kpis.callbacks ? "warn" : "good"} />
        <Kpi label="Callback %" value={pct(kpis.callbackPct)} tone={kpis.callbackPct > 0.10 ? "danger" : kpis.callbackPct >= 0.05 ? "warn" : "good"} />
        <Kpi label="Redo Count" value={String(kpis.redos)} tone={kpis.redos ? "warn" : "good"} />
        <Kpi label="Redo %" value={pct(kpis.redoPct)} tone={kpis.redoPct > 0.05 ? "danger" : "good"} />
        <Kpi label="Review %" value={pct(kpis.reviewPct)} tone="blue" />
        <Kpi label="Quality Issues Open" value={String(kpis.qualityIssues)} tone={kpis.qualityIssues ? "danger" : "good"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <ChartCard title="Revenue by Service"><Bars data={svc.map((r) => ({ name: r.service, value: r.revenue }))} xKey="name" yKey="value" money color="#F5C542" /></ChartCard>
        <ChartCard title="Jobs by Service"><Bars data={svc.map((r) => ({ name: r.service, value: r.completed }))} xKey="name" yKey="value" color="#1683E2" /></ChartCard>
        <ChartCard title="Average Ticket by Service"><Bars data={svc.map((r) => ({ name: r.service, value: +r.avgTicket.toFixed(0) }))} xKey="name" yKey="value" money color="#0A66B2" /></ChartCard>
        <ChartCard title="Revenue by Technician"><Bars data={techs.map((r) => ({ name: r.tech, value: r.production }))} xKey="name" yKey="value" money color="#F5C542" /></ChartCard>
        <ChartCard title="Jobs by Technician"><Bars data={techs.map((r) => ({ name: r.tech, value: r.completed }))} xKey="name" yKey="value" color="#1683E2" /></ChartCard>
        <ChartCard title="Callbacks by Technician"><Bars data={techs.map((r) => ({ name: r.tech, value: r.callbacks }))} xKey="name" yKey="value" color="#F5C542" /></ChartCard>
        <ChartCard title="Callbacks by Service"><Bars data={svc.map((r) => ({ name: r.service, value: r.callbacks }))} xKey="name" yKey="value" color="#F5C542" /></ChartCard>
        <ChartCard title="Callback % by Service"><Bars data={svc.map((r) => ({ name: r.service, value: +(r.callbackPct * 100).toFixed(1) }))} xKey="name" yKey="value" color="#F5C542" /></ChartCard>
        <ChartCard title="Review % by Service"><Bars data={svc.map((r) => ({ name: r.service, value: +(r.reviewPct * 100).toFixed(0) }))} xKey="name" yKey="value" color="#1683E2" /></ChartCard>
        <ChartCard title="Revenue by Unit"><Bars data={units.map((r) => ({ name: r.unit.split(" | ")[0], value: r.revenue }))} xKey="name" yKey="value" money color="#F5C542" /></ChartCard>
        <ChartCard title="Jobs by Unit"><Bars data={units.map((r) => ({ name: r.unit.split(" | ")[0], value: r.completed }))} xKey="name" yKey="value" color="#1683E2" /></ChartCard>
        <ChartCard title="Solo vs Duo (Job Type)" height={220}><Donut data={byType} /></ChartCard>
        <ChartCard title="Job Status" height={220}><Donut data={byStatus} /></ChartCard>
        <ChartCard title="Service Mix" height={220}><Donut data={serviceMix} /></ChartCard>
        <ChartCard title="Quality Status (services)" height={220}><Donut data={qualityBreakdown} /></ChartCard>
        <ChartCard title="Canceled Jobs Over Time"><Bars data={canceledOverTime} xKey="name" yKey="value" color="#E11A22" /></ChartCard>
      </div>
    </div>
  );
}

/* ================= Service Performance tab ================= */
function ServiceTab({ rows }: { rows: ReturnType<typeof serviceOps> }) {
  const heads = ["Service", "Completed", "Canceled", "Revenue", "Avg Ticket", "Upsells", "Tips", "Callbacks", "Callback %", "Redo", "Redo %", "Requests", "Reviews", "Review %", "Avg Rating", "Status"];
  return (
    <Section title="Service Performance" actions={<Button onClick={() => download(`service-performance-${today()}.csv`, toCSV(rows as unknown as Record<string, unknown>[]))}>Export CSV</Button>}>
      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">{heads.map((h) => <th key={h} className="text-left font-medium px-2 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.service} className="border-b border-line/60">
                <td className="px-2 py-2 font-medium text-ink">{r.service}</td>
                <td className="px-2 py-2 tabular-nums">{r.completed}</td>
                <td className="px-2 py-2 tabular-nums">{r.canceled || "—"}</td>
                <td className="px-2 py-2 tabular-nums text-gold">{money(r.revenue)}</td>
                <td className="px-2 py-2 tabular-nums">{money(r.avgTicket)}</td>
                <td className="px-2 py-2 tabular-nums">{money(r.upsells)}</td>
                <td className="px-2 py-2 tabular-nums">{money(r.tips)}</td>
                <td className="px-2 py-2 tabular-nums">{r.callbacks}</td>
                <td className={`px-2 py-2 tabular-nums ${r.callbackPct > 0.10 ? "text-danger" : r.callbackPct >= 0.05 ? "text-gold" : "text-muted"}`}>{pct(r.callbackPct)}</td>
                <td className="px-2 py-2 tabular-nums">{r.redos}</td>
                <td className="px-2 py-2 tabular-nums">{pct(r.redoPct)}</td>
                <td className="px-2 py-2 tabular-nums">{r.reviewRequests}</td>
                <td className="px-2 py-2 tabular-nums">{r.reviewsReceived}</td>
                <td className="px-2 py-2 tabular-nums text-accent">{pct(r.reviewPct)}</td>
                <td className="px-2 py-2 tabular-nums">{r.avgRating ? `${r.avgRating.toFixed(2)}★` : "—"}</td>
                <td className="px-2 py-2"><StatusPill label={r.status} tone={r.tone === "neutral" ? "warn" : r.tone} /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={heads.length} className="px-3 py-8 text-center text-muted">No completed jobs in range.</td></tr>}
          </tbody>
        </table>
      </Card>
    </Section>
  );
}

/* ================= Technician Performance tab ================= */
function TechTab({ rows }: { rows: ReturnType<typeof techOps> }) {
  const heads = ["Technician", "Completed", "Solo", "Lead", "Helper", "Production", "Avg Ticket", "Upsells", "Tips", "Callbacks", "Callback %", "Redo", "Review %", "Avg Rating", "Quality"];
  return (
    <Section title="Technician Performance" actions={<Button onClick={() => download(`technician-performance-${today()}.csv`, toCSV(rows as unknown as Record<string, unknown>[]))}>Export CSV</Button>}>
      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">{heads.map((h) => <th key={h} className="text-left font-medium px-2 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tech} className="border-b border-line/60">
                <td className="px-2 py-2 font-medium text-ink">{r.tech}</td>
                <td className="px-2 py-2 tabular-nums">{r.completed}</td>
                <td className="px-2 py-2 tabular-nums">{r.solo}</td>
                <td className="px-2 py-2 tabular-nums">{r.leadJobs}</td>
                <td className="px-2 py-2 tabular-nums">{r.helperJobs}</td>
                <td className="px-2 py-2 tabular-nums text-gold">{money(r.production)}</td>
                <td className="px-2 py-2 tabular-nums">{money(r.avgTicket)}</td>
                <td className="px-2 py-2 tabular-nums">{money(r.upsells)}</td>
                <td className="px-2 py-2 tabular-nums">{money(r.tips)}</td>
                <td className="px-2 py-2 tabular-nums">{r.callbacks}</td>
                <td className={`px-2 py-2 tabular-nums ${r.callbackPct > 0.10 ? "text-danger" : r.callbackPct >= 0.05 ? "text-gold" : "text-muted"}`}>{pct(r.callbackPct)}</td>
                <td className="px-2 py-2 tabular-nums">{r.redos}</td>
                <td className="px-2 py-2 tabular-nums text-accent">{pct(r.reviewPct)}</td>
                <td className="px-2 py-2 tabular-nums">{r.avgRating ? `${r.avgRating.toFixed(2)}★` : "—"}</td>
                <td className="px-2 py-2"><StatusPill label={r.status} tone={r.tone === "neutral" ? "warn" : r.tone} /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={heads.length} className="px-3 py-8 text-center text-muted">No technician production in range.</td></tr>}
          </tbody>
        </table>
      </Card>
    </Section>
  );
}

/* ================= Unit Performance tab ================= */
function UnitTab({ rows }: { rows: ReturnType<typeof unitOps> }) {
  const heads = ["Unit", "Jobs", "Completed", "Canceled", "Revenue", "Avg Ticket", "Upsells", "Tips", "Callbacks", "Callback %"];
  return (
    <Section title="Unit Performance" actions={<Button onClick={() => download(`unit-performance-${today()}.csv`, toCSV(rows as unknown as Record<string, unknown>[]))}>Export CSV</Button>}>
      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">{heads.map((h) => <th key={h} className="text-left font-medium px-2 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.unit} className="border-b border-line/60">
                <td className="px-2 py-2 font-medium text-ink">{r.unit}</td>
                <td className="px-2 py-2 tabular-nums">{r.jobs}</td>
                <td className="px-2 py-2 tabular-nums">{r.completed}</td>
                <td className="px-2 py-2 tabular-nums">{r.canceled || "—"}</td>
                <td className="px-2 py-2 tabular-nums text-gold">{money(r.revenue)}</td>
                <td className="px-2 py-2 tabular-nums">{money(r.avgTicket)}</td>
                <td className="px-2 py-2 tabular-nums">{money(r.upsells)}</td>
                <td className="px-2 py-2 tabular-nums">{money(r.tips)}</td>
                <td className="px-2 py-2 tabular-nums">{r.callbacks}</td>
                <td className={`px-2 py-2 tabular-nums ${r.callbackPct > 0.10 ? "text-danger" : "text-muted"}`}>{pct(r.callbackPct)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={heads.length} className="px-3 py-8 text-center text-muted">No unit activity in range.</td></tr>}
          </tbody>
        </table>
      </Card>
    </Section>
  );
}

/* ================= Canceled Jobs tab ================= */
function CanceledTab({ jobs }: { jobs: Job[] }) {
  const s = useStore();
  const rows = useMemo(() => canceledFn(jobs).sort((a, b) => (b.cancellationDate || b.dateCompleted).localeCompare(a.cancellationDate || a.dateCompleted)), [jobs]);
  const [edit, setEdit] = useState<Job | null>(null);
  const set = (patch: Partial<Job>) => setEdit((f) => (f ? { ...f, ...patch } : f));
  function save() { if (edit) { s.updateJob(edit); setEdit(null); } }

  const heads = ["Date", "Customer", "Lead ID", "Urable ID", "Service", "Sales Rep", "Lead Tech", "Unit", "Cancel Date", "Reason", "Canceled By", "Deposit", "Refund", "Links", ""];
  return (
    <Section title={`Canceled Jobs (${rows.length})`} actions={<Button onClick={() => download(`canceled-jobs-${today()}.csv`, toCSV(rows as unknown as Record<string, unknown>[]))}>Export CSV</Button>}>
      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">{heads.map((h) => <th key={h} className="text-left font-medium px-2 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id} className="border-b border-line/60">
                <td className="px-2 py-2 text-muted">{prettyDate(j.dateCompleted)}</td>
                <td className="px-2 py-2 text-ink">{j.customerName}</td>
                <td className="px-2 py-2 font-mono text-xs text-accent">{j.leadId || "—"}</td>
                <td className="px-2 py-2 font-mono text-xs">{j.urableJobId || "—"}</td>
                <td className="px-2 py-2">{j.services}</td>
                <td className="px-2 py-2">{j.assignedSalesRep || "—"}</td>
                <td className="px-2 py-2">{j.leadTech || "—"}</td>
                <td className="px-2 py-2">{j.unit ? j.unit.split(" | ")[0] : "—"}</td>
                <td className="px-2 py-2 text-muted">{prettyDate(j.cancellationDate) || "—"}</td>
                <td className="px-2 py-2">{j.cancellationReason || <span className="text-danger text-xs">⚠ none</span>}</td>
                <td className="px-2 py-2">{j.canceledBy || "—"}</td>
                <td className="px-2 py-2">{j.depositCollected ? "Yes" : "No"}</td>
                <td className="px-2 py-2">{j.refundNeeded ? <span className="text-danger">Yes</span> : "No"}</td>
                <td className="px-2 py-2 text-xs whitespace-nowrap">
                  {j.ghlContactLink && <a href={j.ghlContactLink} target="_blank" rel="noreferrer" className="text-accent hover:underline">GHL</a>}
                  {j.ghlContactLink && j.urableJobLink && " · "}
                  {j.urableJobLink && <a href={j.urableJobLink} target="_blank" rel="noreferrer" className="text-accent hover:underline">Urable</a>}
                </td>
                <td className="px-2 py-2 text-right"><Button variant="ghost" onClick={() => setEdit({ ...j })}>Edit</Button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={heads.length} className="px-3 py-8 text-center text-muted">No canceled jobs in range.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `Cancellation · ${edit.customerName}` : ""}>
        {edit && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Cancellation Date"><Input type="date" value={edit.cancellationDate} onChange={(e) => set({ cancellationDate: e.target.value })} /></Field>
              <Field label="Cancellation Reason"><Select options={["", ...CANCELLATION_REASONS]} value={edit.cancellationReason} onChange={(e) => set({ cancellationReason: e.target.value as Job["cancellationReason"] })} /></Field>
              <Field label="Canceled By"><Input value={edit.canceledBy} onChange={(e) => set({ canceledBy: e.target.value })} /></Field>
              <Field label="Deposit Collected"><Select options={["No", "Yes"]} value={edit.depositCollected ? "Yes" : "No"} onChange={(e) => set({ depositCollected: e.target.value === "Yes" })} /></Field>
              <Field label="Refund Needed"><Select options={["No", "Yes"]} value={edit.refundNeeded ? "Yes" : "No"} onChange={(e) => set({ refundNeeded: e.target.value === "Yes" })} /></Field>
              <div className="sm:col-span-3"><Field label="Cancellation Notes"><Textarea rows={2} value={edit.cancellationNotes} onChange={(e) => set({ cancellationNotes: e.target.value })} /></Field></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={() => setEdit(null)}>Cancel</Button>
              <Button variant="accent" onClick={save}>Save</Button>
            </div>
          </>
        )}
      </Modal>
    </Section>
  );
}

/* ================= Quality Metrics tab ================= */
function QualityTab({ svc, techs, kpis }: { svc: ReturnType<typeof serviceOps>; techs: ReturnType<typeof techOps>; kpis: ReturnType<typeof opsKpis> }) {
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Callback %" value={pct(kpis.callbackPct)} tone={kpis.callbackPct > 0.10 ? "danger" : kpis.callbackPct >= 0.05 ? "warn" : "good"} />
        <Kpi label="Redo %" value={pct(kpis.redoPct)} tone={kpis.redoPct > 0.05 ? "danger" : "good"} />
        <Kpi label="Review %" value={pct(kpis.reviewPct)} tone="blue" />
        <Kpi label="Quality Issues Open" value={String(kpis.qualityIssues)} tone={kpis.qualityIssues ? "danger" : "good"} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
        <ChartCard title="Callbacks by Service"><Bars data={svc.map((r) => ({ name: r.service, value: r.callbacks }))} xKey="name" yKey="value" color="#F5C542" /></ChartCard>
        <ChartCard title="Callbacks by Technician"><Bars data={techs.map((r) => ({ name: r.tech, value: r.callbacks }))} xKey="name" yKey="value" color="#F5C542" /></ChartCard>
        <ChartCard title="Callback % by Service"><Bars data={svc.map((r) => ({ name: r.service, value: +(r.callbackPct * 100).toFixed(1) }))} xKey="name" yKey="value" color="#F5C542" /></ChartCard>
        <ChartCard title="Callback % by Technician"><Bars data={techs.map((r) => ({ name: r.tech, value: +(r.callbackPct * 100).toFixed(1) }))} xKey="name" yKey="value" color="#F5C542" /></ChartCard>
        <ChartCard title="Redo % by Service"><Bars data={svc.map((r) => ({ name: r.service, value: +(r.redoPct * 100).toFixed(1) }))} xKey="name" yKey="value" color="#E11A22" /></ChartCard>
        <ChartCard title="Review % by Service"><Bars data={svc.map((r) => ({ name: r.service, value: +(r.reviewPct * 100).toFixed(0) }))} xKey="name" yKey="value" color="#1683E2" /></ChartCard>
        <ChartCard title="Avg Rating by Service"><Bars data={svc.filter((r) => r.avgRating > 0).map((r) => ({ name: r.service, value: +r.avgRating.toFixed(2) }))} xKey="name" yKey="value" color="#22C55E" /></ChartCard>
        <ChartCard title="Avg Rating by Technician"><Bars data={techs.filter((r) => r.avgRating > 0).map((r) => ({ name: r.tech, value: +r.avgRating.toFixed(2) }))} xKey="name" yKey="value" color="#22C55E" /></ChartCard>
      </div>

      <Section title="Service Quality Status">
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              {["Service", "Completed", "Callback %", "Redo %", "Review %", "Avg Rating", "Status"].map((h) => <th key={h} className="text-left font-medium px-2 py-2">{h}</th>)}
            </tr></thead>
            <tbody>
              {svc.map((r) => (
                <tr key={r.service} className="border-b border-line/60">
                  <td className="px-2 py-2 text-ink">{r.service}</td>
                  <td className="px-2 py-2 tabular-nums">{r.completed}</td>
                  <td className="px-2 py-2 tabular-nums">{pct(r.callbackPct)}</td>
                  <td className="px-2 py-2 tabular-nums">{pct(r.redoPct)}</td>
                  <td className="px-2 py-2 tabular-nums">{pct(r.reviewPct)}</td>
                  <td className="px-2 py-2 tabular-nums">{r.avgRating ? `${r.avgRating.toFixed(2)}★` : "—"}</td>
                  <td className="px-2 py-2"><StatusPill label={r.status} tone={r.tone === "neutral" ? "warn" : r.tone} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>
    </div>
  );
}
