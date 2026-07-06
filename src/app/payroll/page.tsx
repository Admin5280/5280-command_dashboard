"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { JOB_PAYMENT_STATUSES } from "@/lib/types";
import { techPayroll, salesPayroll, techReport, salesReport, TechReport, SalesReport } from "@/lib/pay";
import { money, pct, prettyDate, sum, today } from "@/lib/format";
import { toCSV, download } from "@/lib/csv";
import { openPrintWindow, printHeader, printSignature } from "@/lib/print";
import { Badge, Button, Card, Field, Input, Kpi, PageHeader, Section, Select } from "@/components/ui";

const PAY_FILTER = ["Fully Paid", "Partially Paid", "Unpaid", "All"];

export default function PayrollPage() {
  const s = useStore();
  const jobs = useMemo(() => s.jobs.filter((j) => s.inRange(j.dateCompleted)), [s.jobs, s.from, s.to]);

  const tech = useMemo(() => techPayroll(jobs, s.payRules, s.techBasePay), [jobs, s.payRules, s.techBasePay]);
  const sales = useMemo(() => salesPayroll(jobs, s.salesReps, s.payRules), [jobs, s.salesReps, s.payRules]);
  const techTotal = sum(tech, (t) => t.total);
  const salesTotal = sum(sales, (r) => r.total);

  return (
    <div>
      <PageHeader title="Payroll" subtitle="Commission, base pay & printable pay-period reports" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Tech Pay (range)" value={money(techTotal)} tone="gold" />
        <Kpi label="Sales Pay (range)" value={money(salesTotal)} tone="gold" />
        <Kpi label="Total Payroll" value={money(techTotal + salesTotal)} tone="gold" />
        <Kpi label="Techs / Reps Paid" value={`${tech.length} / ${sales.filter((x) => x.total > 0).length}`} tone="blue" />
      </div>

      <TechnicianReport />
      <SalesRepReport />

      <Section title="Quick Summary — Technicians (date range)">
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              {["Technician", "Jobs", "Commission", "Upsell", "Tips", "Base Pay", "Total"].map((h) => <th key={h} className="text-left font-medium px-3 py-2.5">{h}</th>)}
            </tr></thead>
            <tbody>
              {tech.map((t) => (
                <tr key={t.tech} className="border-b border-line/60">
                  <td className="px-3 py-2 font-medium text-ink">{t.tech}</td>
                  <td className="px-3 py-2 tabular-nums">{t.jobs}</td>
                  <td className="px-3 py-2 tabular-nums">{money(t.commission)}</td>
                  <td className="px-3 py-2 tabular-nums">{money(t.upsell)}</td>
                  <td className="px-3 py-2 tabular-nums">{money(t.tips)}</td>
                  <td className="px-3 py-2 tabular-nums">{money(t.basePay)}</td>
                  <td className="px-3 py-2 tabular-nums text-gold font-semibold">{money(t.total)}</td>
                </tr>
              ))}
              {!tech.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted">No completed jobs in range.</td></tr>}
            </tbody>
          </table>
        </Card>
      </Section>
    </div>
  );
}

/* ---------------- Technician report ---------------- */
function TechnicianReport() {
  const s = useStore();
  const [tech, setTech] = useState(s.technicians[0] ?? "");
  const [from, setFrom] = useState(s.from);
  const [to, setTo] = useState(s.to);
  const [payFilter, setPayFilter] = useState("Fully Paid");
  const [hours, setHours] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [deductions, setDeductions] = useState(0);

  const r = useMemo<TechReport>(() => techReport(s.jobs, tech, from, to, payFilter, s.payRules, s.techBasePay, { hours, hourlyRate, deductions }),
    [s.jobs, tech, from, to, payFilter, s.payRules, s.techBasePay, hours, hourlyRate, deductions]);

  const period = `${from || "start"} → ${to || "today"}`;

  function exportCSV() {
    const rows = r.lineItems.map((i) => ({
      Date: i.date, Customer: i.customerName, "Urable Job ID": i.urableJobId, Service: i.service, "Job Type": i.jobType, Role: i.role,
      Subtotal: i.subtotal, "Tech Upsell": i.techUpsell, Tip: i.tip, "Base Commission": i.baseCommission.toFixed(2),
      "Upsell Commission": i.upsellCommission.toFixed(2), "Tip Payout": i.tipPayout.toFixed(2), "Base Pay Applied": i.basePayApplied.toFixed(2),
      "Total Tech Pay": i.totalFromJob.toFixed(2), "Payment Status": i.paymentStatus, "Tech Pay Status": i.techPayStatus, "Urable Link": i.urableJobLink,
    }));
    download(`tech-payroll-${tech}-${today()}.csv`, toCSV(rows as unknown as Record<string, unknown>[]));
  }

  function print() {
    const cards = [
      ["Total Jobs", String(r.totalJobs)], ["Solo", String(r.soloJobs)], ["Lead", String(r.leadJobs)], ["Helper", String(r.helperJobs)],
      ["Base Commission", money(r.baseCommission)], ["Upsell Commission", money(r.upsellCommission)], ["Tip Payout", money(r.tipPayout)],
      [`Base Pay (${r.basePayType})`, money(r.basePayEarned)], ["Hours", String(r.hours)], ["Hourly Rate", money(r.hourlyRate)],
      ["Hourly Pay", money(r.hourlyPay)], ["Deductions", money(r.deductions)],
    ].map(([l, v]) => `<div class="card"><div class="l">${l}</div><div class="v">${v}</div></div>`).join("");
    const rowsHtml = r.lineItems.map((i) => `<tr>
      <td>${prettyDate(i.date)}</td><td>${i.customerName}</td><td>${i.urableJobId}</td><td>${i.service}</td><td>${i.role}</td>
      <td class="n">${money(i.subtotal)}</td><td class="n">${money(i.techUpsell)}</td><td class="n">${money(i.tip)}</td>
      <td class="n">${money(i.baseCommission)}</td><td class="n">${money(i.upsellCommission)}</td><td class="n">${money(i.tipPayout)}</td>
      <td class="n">${money(i.basePayApplied)}</td><td class="n gold">${money(i.totalFromJob)}</td><td>${i.paymentStatus}</td></tr>`).join("");
    const body = printHeader(`Technician Payroll Report`) +
      `<h2>${r.tech}</h2><div class="meta"><b>Pay Period:</b> ${period}</div><div class="meta"><b>Payment Filter:</b> ${r.paymentFilter}</div>` +
      `<div class="grid">${cards}</div>` +
      `<div class="card" style="grid-column:1/-1;margin:6px 0"><div class="l">Total Payout</div><div class="v gold">${money(r.totalPayout)}</div></div>` +
      `<h2>Job Line Items</h2><table><thead><tr>
        <th>Date</th><th>Customer</th><th>Urable ID</th><th>Service</th><th>Role</th>
        <th class="n">Subtotal</th><th class="n">Upsell</th><th class="n">Tip</th>
        <th class="n">Base Comm</th><th class="n">Upsell Comm</th><th class="n">Tip Pay</th><th class="n">Base Pay</th><th class="n">Total</th><th>Payment</th>
      </tr></thead><tbody>${rowsHtml || `<tr><td colspan="14">No jobs in period.</td></tr>`}</tbody></table>` +
      printSignature();
    openPrintWindow(`Technician Payroll — ${r.tech}`, body);
  }

  return (
    <Section title="Technician Payroll Report">
      <Card className="p-4 mb-3">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <Field label="Technician"><Select options={s.technicians} value={tech} onChange={(e) => setTech(e.target.value)} /></Field>
          <Field label="Period Start"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Period End"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Payment Filter"><Select options={PAY_FILTER} value={payFilter} onChange={(e) => setPayFilter(e.target.value)} /></Field>
          <Field label="Hours"><Input type="number" value={hours} onChange={(e) => setHours(+e.target.value)} /></Field>
          <Field label="Hourly Rate"><Input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(+e.target.value)} /></Field>
          <Field label="Deductions"><Input type="number" value={deductions} onChange={(e) => setDeductions(+e.target.value)} /></Field>
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="accent" onClick={print}>Print Payroll</Button>
          <Button onClick={exportCSV}>Export Payroll CSV</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-3">
        <Kpi label="Total Jobs" value={`${r.totalJobs}`} sub={`${r.soloJobs} solo · ${r.leadJobs} lead · ${r.helperJobs} helper`} tone="blue" />
        <Kpi label="Base Commission" value={money(r.baseCommission)} tone="gold" />
        <Kpi label="Upsell Commission" value={money(r.upsellCommission)} tone="gold" />
        <Kpi label="Tip Payout" value={money(r.tipPayout)} tone="gold" />
        <Kpi label={`Base Pay (${r.basePayType})`} value={money(r.basePayEarned)} tone="gold" />
        <Kpi label="Hourly Pay" value={money(r.hourlyPay)} tone="gold" sub={`${r.hours}h × ${money(r.hourlyRate)}`} />
        <Kpi label="Deductions" value={money(r.deductions)} tone={r.deductions > 0 ? "danger" : "default"} />
        <Kpi label="Total Payout" value={money(r.totalPayout)} tone="gold" />
      </div>

      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
            {["Date", "Customer", "Urable", "Service", "Type", "Role", "Subtotal", "Upsell", "Tip", "Base Comm", "Upsell Comm", "Tip Pay", "Base Pay", "Total", "Payment", "Pay Status"].map((h) => (
              <th key={h} className="text-left font-medium px-2 py-2 whitespace-nowrap">{h}</th>))}
          </tr></thead>
          <tbody>
            {r.lineItems.map((i) => (
              <tr key={i.jobId} className="border-b border-line/60">
                <td className="px-2 py-2 text-muted whitespace-nowrap">{prettyDate(i.date)}</td>
                <td className="px-2 py-2 text-ink">{i.customerName}</td>
                <td className="px-2 py-2 font-mono text-xs">{i.urableJobId || "—"}</td>
                <td className="px-2 py-2">{i.service}</td>
                <td className="px-2 py-2">{i.jobType}</td>
                <td className="px-2 py-2">{i.role}</td>
                <td className="px-2 py-2 tabular-nums text-muted">{money(i.subtotal)}</td>
                <td className="px-2 py-2 tabular-nums">{money(i.techUpsell)}</td>
                <td className="px-2 py-2 tabular-nums">{money(i.tip)}</td>
                <td className="px-2 py-2 tabular-nums">{money(i.baseCommission)}</td>
                <td className="px-2 py-2 tabular-nums">{money(i.upsellCommission)}</td>
                <td className="px-2 py-2 tabular-nums">{money(i.tipPayout)}</td>
                <td className="px-2 py-2 tabular-nums">{money(i.basePayApplied)}</td>
                <td className="px-2 py-2 tabular-nums text-gold font-semibold">{money(i.totalFromJob)}</td>
                <td className="px-2 py-2"><Badge value={i.paymentStatus} /></td>
                <td className="px-2 py-2"><Badge value={i.techPayStatus} /></td>
              </tr>
            ))}
            {!r.lineItems.length && <tr><td colSpan={16} className="px-3 py-6 text-center text-muted">No jobs for {tech} in this period.</td></tr>}
          </tbody>
        </table>
      </Card>
    </Section>
  );
}

/* ---------------- Sales rep report ---------------- */
function SalesRepReport() {
  const s = useStore();
  const [rep, setRep] = useState(s.salesReps[0] ?? "");
  const [from, setFrom] = useState(s.from);
  const [to, setTo] = useState(s.to);
  const [payFilter, setPayFilter] = useState("Fully Paid");
  const [bonus, setBonus] = useState(0);
  const [deductions, setDeductions] = useState(0);

  const r = useMemo<SalesReport>(() => salesReport(s.jobs, rep, from, to, payFilter, s.payRules, { bonus, deductions }),
    [s.jobs, rep, from, to, payFilter, s.payRules, bonus, deductions]);
  const period = `${from || "start"} → ${to || "today"}`;

  function exportCSV() {
    const rows = r.lineItems.map((i) => ({
      Date: i.date, Customer: i.customerName, "Lead ID": i.leadId, "Urable Job ID": i.urableJobId, Service: i.service, "Confirmed Source": i.confirmedSource,
      "Sales Total Revenue": i.salesTotalRevenue, "Total Revenue": i.totalRevenue, "Commissionable": i.commissionable.toFixed(2),
      "Commission Rate": i.commissionRate, "Commission Earned": i.commissionEarned.toFixed(2), "Payment Status": i.paymentStatus,
      "Sales Commission Status": i.salesCommissionStatus, "GHL Link": i.ghlContactLink, "Urable Link": i.urableJobLink,
    }));
    download(`sales-payroll-${rep}-${today()}.csv`, toCSV(rows as unknown as Record<string, unknown>[]));
  }

  function print() {
    const cards = [
      ["Completed Paid Jobs", String(r.paidJobs)], ["Commissionable Revenue", money(r.commissionable)], ["Commission Rate", pct(r.commissionRate, 0)],
      ["Commission Earned", money(r.commissionEarned)], ["Weekly Base", money(r.weeklyBase)], ["Bonus", money(r.bonus)], ["Deductions", money(r.deductions)],
    ].map(([l, v]) => `<div class="card"><div class="l">${l}</div><div class="v">${v}</div></div>`).join("");
    const rowsHtml = r.lineItems.map((i) => `<tr>
      <td>${prettyDate(i.date)}</td><td>${i.customerName}</td><td>${i.leadId}</td><td>${i.urableJobId}</td><td>${i.service}</td><td>${i.confirmedSource}</td>
      <td class="n">${money(i.commissionable)}</td><td class="n">${pct(i.commissionRate, 0)}</td><td class="n gold">${money(i.commissionEarned)}</td><td>${i.paymentStatus}</td></tr>`).join("");
    const body = printHeader(`Sales Payroll Report`) +
      `<h2>${r.rep}</h2><div class="meta"><b>Pay Period:</b> ${period}</div><div class="meta"><b>Payment Filter:</b> ${r.paymentFilter}</div>` +
      `<div class="grid">${cards}</div>` +
      `<div class="card" style="grid-column:1/-1;margin:6px 0"><div class="l">Total Sales Pay</div><div class="v gold">${money(r.totalPay)}</div></div>` +
      `<h2>Saleable Jobs</h2><table><thead><tr>
        <th>Date</th><th>Customer</th><th>Lead ID</th><th>Urable ID</th><th>Service</th><th>Source</th>
        <th class="n">Commissionable</th><th class="n">Rate</th><th class="n">Commission</th><th>Payment</th>
      </tr></thead><tbody>${rowsHtml || `<tr><td colspan="10">No saleable jobs in period.</td></tr>`}</tbody></table>` +
      printSignature();
    openPrintWindow(`Sales Payroll — ${r.rep}`, body);
  }

  return (
    <Section title="Sales Payroll Report">
      <Card className="p-4 mb-3">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Field label="Sales Rep"><Select options={s.salesReps} value={rep} onChange={(e) => setRep(e.target.value)} /></Field>
          <Field label="Period Start"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Period End"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Payment Filter"><Select options={PAY_FILTER} value={payFilter} onChange={(e) => setPayFilter(e.target.value)} /></Field>
          <Field label="Bonus"><Input type="number" value={bonus} onChange={(e) => setBonus(+e.target.value)} /></Field>
          <Field label="Deductions"><Input type="number" value={deductions} onChange={(e) => setDeductions(+e.target.value)} /></Field>
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="accent" onClick={print}>Print Sales Payroll</Button>
          <Button onClick={exportCSV}>Export Sales Payroll CSV</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-3">
        <Kpi label="Completed Paid Jobs" value={`${r.paidJobs}`} tone="blue" />
        <Kpi label="Commissionable" value={money(r.commissionable)} tone="gold" />
        <Kpi label="Commission Rate" value={pct(r.commissionRate, 0)} tone="blue" />
        <Kpi label="Commission Earned" value={money(r.commissionEarned)} tone="gold" />
        <Kpi label="Weekly Base" value={money(r.weeklyBase)} tone="gold" />
        <Kpi label="Total Sales Pay" value={money(r.totalPay)} tone="gold" />
      </div>

      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
            {["Date", "Customer", "Lead ID", "Urable", "Service", "Source", "Sales Rev", "Total Rev", "Commissionable", "Rate", "Commission", "Payment", "Comm Status", "Links"].map((h) => (
              <th key={h} className="text-left font-medium px-2 py-2 whitespace-nowrap">{h}</th>))}
          </tr></thead>
          <tbody>
            {r.lineItems.map((i) => (
              <tr key={i.jobId} className="border-b border-line/60">
                <td className="px-2 py-2 text-muted whitespace-nowrap">{prettyDate(i.date)}</td>
                <td className="px-2 py-2 text-ink">{i.customerName}</td>
                <td className="px-2 py-2 font-mono text-xs text-accent">{i.leadId || "—"}</td>
                <td className="px-2 py-2 font-mono text-xs">{i.urableJobId}</td>
                <td className="px-2 py-2">{i.service}</td>
                <td className="px-2 py-2">{i.confirmedSource}</td>
                <td className="px-2 py-2 tabular-nums text-muted">{money(i.salesTotalRevenue)}</td>
                <td className="px-2 py-2 tabular-nums text-muted">{money(i.totalRevenue)}</td>
                <td className="px-2 py-2 tabular-nums">{money(i.commissionable)}</td>
                <td className="px-2 py-2 tabular-nums">{pct(i.commissionRate, 0)}</td>
                <td className="px-2 py-2 tabular-nums text-gold font-semibold">{money(i.commissionEarned)}</td>
                <td className="px-2 py-2"><Badge value={i.paymentStatus} /></td>
                <td className="px-2 py-2"><Badge value={i.salesCommissionStatus} /></td>
                <td className="px-2 py-2 text-xs whitespace-nowrap">
                  {i.ghlContactLink && <a href={i.ghlContactLink} target="_blank" rel="noreferrer" className="text-accent hover:underline">GHL</a>}
                  {i.ghlContactLink && i.urableJobLink && " · "}
                  {i.urableJobLink && <a href={i.urableJobLink} target="_blank" rel="noreferrer" className="text-accent hover:underline">Urable</a>}
                </td>
              </tr>
            ))}
            {!r.lineItems.length && <tr><td colSpan={14} className="px-3 py-6 text-center text-muted">No saleable jobs for {rep} in this period. (Needs Urable ID + commission status Eligible/Approved/Exported/Paid.)</td></tr>}
          </tbody>
        </table>
      </Card>
    </Section>
  );
}
