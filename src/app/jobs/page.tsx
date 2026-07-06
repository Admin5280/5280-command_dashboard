"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Job, Lead, JOB_TYPES, JOB_PAYMENT_STATUSES, PAYMENT_METHODS, PAY_STATUSES, COMMISSION_STATUSES,
  CARE_UNITS, jobTotalRevenue } from "@/lib/types";
import { jobHealth } from "@/lib/guardrails";
import { money, prettyDate, today } from "@/lib/format";
import { toCSV, download } from "@/lib/csv";
import { Badge, Button, Field, Input, LinkOut, Modal, PageHeader, Section, Select, StatusPill, Table, Textarea, Col } from "@/components/ui";

const blank = (): Omit<Job, "id"> => ({
  leadId: "", urableJobId: "", urableJobLink: "", ghlContactLink: "", dateCompleted: today(),
  customerName: "", phone: "", email: "", address: "", zip: "", category: "", services: "",
  unit: "", assigneesRaw: "", leadTech: "", helperTech: "", assigneeCount: 1, jobType: "Solo",
  subtotal: 0, upsellAddOns: "", techUpsellAmount: 0, discount: 0, tip: 0, addOnsValue: 0,
  totalRevenue: 0, salesTotalRevenue: 0, amountPaid: 0, amountDue: 0, paymentStatus: "Fully Paid", paymentMethod: "Stripe",
  confirmedSource: "", assignedSalesRep: "", techPayStatus: "Pending Review", salesCommissionStatus: "Pending Review",
  adminNotes: "", customerId: "", historical: false, createdAt: today(), updatedAt: today(),
});

export default function JobsPage() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [form, setForm] = useState<Omit<Job, "id">>(blank());
  const [custQ, setCustQ] = useState("");
  const [fTech, setFTech] = useState("All");
  const [fType, setFType] = useState("All");
  const [fPay, setFPay] = useState("All");
  const [fHealth, setFHealth] = useState("All");

  const rows = useMemo(() => s.jobs
    .filter((j) => s.inRange(j.dateCompleted))
    .filter((j) => fTech === "All" || j.leadTech === fTech || j.helperTech === fTech)
    .filter((j) => fType === "All" || j.jobType === fType)
    .filter((j) => fPay === "All" || j.paymentStatus === fPay)
    .filter((j) => fHealth === "All" || (fHealth === "Complete" ? jobHealth(j, s.leads).status === "Complete" : jobHealth(j, s.leads).status !== "Complete")),
    [s.jobs, s.leads, s.from, s.to, fTech, fType, fPay, fHealth]);

  const total = jobTotalRevenue(form);
  const due = total - (form.amountPaid || 0);

  // customer/lead search for the Add Job modal
  const custMatches = useMemo(() => {
    const q = custQ.trim().toLowerCase();
    if (!q) return [];
    return s.leads.filter((l) =>
      `${l.leadId} ${l.customerName} ${l.phone} ${l.email}`.toLowerCase().includes(q)).slice(0, 8);
  }, [custQ, s.leads]);

  function openNew() { setEditing(null); setForm(blank()); setCustQ(""); setOpen(true); }
  function openEdit(j: Job) { setEditing(j); const { id, ...rest } = j; setForm(rest); setCustQ(""); setOpen(true); }
  function save() {
    const totalRevenue = jobTotalRevenue(form);
    const payload: Omit<Job, "id"> = { ...form, totalRevenue, updatedAt: today() };
    if (payload.amountPaid === 0 && payload.paymentStatus === "Fully Paid") payload.amountPaid = totalRevenue;
    payload.amountDue = totalRevenue - payload.amountPaid;
    if (editing) s.updateJob({ ...payload, id: editing.id }); else s.addJob(payload);
    setOpen(false);
  }
  const set = (patch: Partial<Omit<Job, "id">>) => setForm((f) => ({ ...f, ...patch }));

  // auto-fill identity fields from a selected lead; keep the same Lead ID
  function selectLead(l: Lead) {
    set({
      leadId: l.leadId, customerName: l.customerName, phone: l.phone, email: l.email,
      confirmedSource: l.confirmedSource, assignedSalesRep: l.assignedSalesRep,
      ghlContactLink: l.ghlContactLink, customerId: l.customerId,
      services: form.services || l.serviceInterest,
    });
    setCustQ("");
  }

  const cols: Col<Job>[] = [
    { key: "health", label: "Status", render: (j) => { const h = jobHealth(j, s.leads); return <StatusPill label={h.status} tone={h.tone} />; } },
    { key: "leadId", label: "Lead ID", render: (j) => <span className="font-mono text-xs text-accent">{j.leadId || "—"}</span> },
    { key: "urableJobId", label: "Urable ID", render: (j) => <span className="font-mono text-xs">{j.urableJobId || "—"}</span> },
    { key: "dateCompleted", label: "Completed", render: (j) => <span className="text-muted">{prettyDate(j.dateCompleted)}</span> },
    { key: "customerName", label: "Customer", render: (j) => <span className="font-medium text-ink">{j.customerName}</span> },
    { key: "services", label: "Service" },
    { key: "leadTech", label: "Lead Tech" },
    { key: "jobType", label: "Type" },
    { key: "totalRevenue", label: "Total", render: (j) => <span className="tabular-nums text-gold">{money(j.totalRevenue)}</span> },
    { key: "amountDue", label: "Due", render: (j) => <span className={`tabular-nums ${j.amountDue > 0 ? "text-danger" : "text-muted"}`}>{money(j.amountDue)}</span> },
    { key: "paymentStatus", label: "Payment", render: (j) => <Badge value={j.paymentStatus} /> },
    { key: "urable", label: "Urable", render: (j) => <LinkOut href={j.urableJobLink} /> },
    { key: "_", label: "", render: (j) => (
      <div className="flex gap-1 justify-end">
        <Button variant="ghost" onClick={() => openEdit(j)}>Edit</Button>
        <Button variant="ghost" onClick={() => confirm(`Delete job for ${j.customerName}?`) && s.deleteJob(j.id)}>✕</Button>
      </div>
    ) },
  ];

  const health = editing ? jobHealth({ ...form, id: editing.id } as Job, s.leads) : jobHealth({ ...form, id: "" } as Job, s.leads);

  return (
    <div>
      <PageHeader title="Jobs" subtitle={`${rows.length} shown · production data (source of truth for revenue & pay)`} actions={
        <>
          <Button onClick={() => download(`jobs-${today()}.csv`, toCSV(rows as unknown as Record<string, unknown>[]))}>Export CSV</Button>
          <Button variant="accent" onClick={openNew}>+ Add Job</Button>
        </>
      } />

      <Section title="All Jobs">
        <div className="flex flex-wrap gap-2 mb-3">
          <Select options={["All", ...s.technicians]} value={fTech} onChange={(e) => setFTech(e.target.value)} className="w-auto" />
          <Select options={["All", ...JOB_TYPES]} value={fType} onChange={(e) => setFType(e.target.value)} className="w-auto" />
          <Select options={["All", ...JOB_PAYMENT_STATUSES]} value={fPay} onChange={(e) => setFPay(e.target.value)} className="w-auto" />
          <Select options={["All", "Complete", "Needs Review"]} value={fHealth} onChange={(e) => setFHealth(e.target.value)} className="w-auto" />
        </div>
        <Table cols={cols} rows={rows} empty="No jobs match." />
      </Section>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Job" : "Add Job"}>
        {/* customer search */}
        <div className="mb-4 bg-base border border-line rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Find customer / lead (name · phone · email · Lead ID)</span>
            <StatusPill label={health.status} tone={health.tone} />
          </div>
          <div className="relative mt-1">
            <Input placeholder="Search to auto-fill from a lead…" value={custQ} onChange={(e) => setCustQ(e.target.value)} />
            {custMatches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-surface border border-line rounded-lg shadow-card max-h-60 overflow-y-auto">
                {custMatches.map((l) => (
                  <button key={l.id} onClick={() => selectLead(l)}
                    className="w-full text-left px-3 py-2 hover:bg-surface2/60 border-b border-line/50 last:border-0">
                    <div className="text-sm text-ink">{l.customerName} <span className="font-mono text-xs text-accent ml-1">{l.leadId}</span></div>
                    <div className="text-xs text-muted">{l.phone} · {l.email || "no email"} · {l.confirmedSource || "source?"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {form.leadId && <div className="text-xs text-good mt-2">Linked to {form.leadId} — {form.customerName || "?"}. Lead ID stays with this job.</div>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Lead ID (from lead)"><Input value={form.leadId} onChange={(e) => set({ leadId: e.target.value })} placeholder="L-2001" /></Field>
          <Field label="Urable Job ID"><Input value={form.urableJobId} onChange={(e) => set({ urableJobId: e.target.value })} /></Field>
          <Field label="Urable Job Link"><Input value={form.urableJobLink} onChange={(e) => set({ urableJobLink: e.target.value })} /></Field>
          <Field label="Date Completed"><Input type="date" value={form.dateCompleted} onChange={(e) => set({ dateCompleted: e.target.value })} /></Field>
          <Field label="Customer Name"><Input value={form.customerName} onChange={(e) => set({ customerName: e.target.value })} /></Field>
          <Field label="Confirmed Source (from lead)"><Input value={form.confirmedSource} onChange={(e) => set({ confirmedSource: e.target.value })} /></Field>
          <Field label="Assigned Sales Rep"><Select options={["", ...s.salesReps]} value={form.assignedSalesRep} onChange={(e) => set({ assignedSalesRep: e.target.value })} /></Field>
          <Field label="Services"><Select options={form.services && !s.services.includes(form.services) ? [form.services, ...s.services] : s.services} value={form.services || s.services[0]} onChange={(e) => set({ services: e.target.value })} /></Field>
          <Field label="Category"><Input value={form.category} onChange={(e) => set({ category: e.target.value })} /></Field>
          <Field label="Job Location / Unit"><Select options={["", ...CARE_UNITS]} value={form.unit} onChange={(e) => set({ unit: e.target.value })} /></Field>
          <Field label="Lead Tech"><Select options={["", ...s.technicians]} value={form.leadTech} onChange={(e) => set({ leadTech: e.target.value })} /></Field>
          <Field label="Helper Tech"><Select options={["", ...s.technicians]} value={form.helperTech} onChange={(e) => set({ helperTech: e.target.value })} /></Field>
          <Field label="Job Type"><Select options={JOB_TYPES as unknown as string[]} value={form.jobType} onChange={(e) => set({ jobType: e.target.value as Job["jobType"] })} /></Field>
          <Field label="Subtotal"><Input type="number" value={form.subtotal} onChange={(e) => set({ subtotal: +e.target.value })} /></Field>
          <Field label="Technician Upsell $"><Input type="number" value={form.techUpsellAmount} onChange={(e) => set({ techUpsellAmount: +e.target.value })} /></Field>
          <Field label="Tip"><Input type="number" value={form.tip} onChange={(e) => set({ tip: +e.target.value })} /></Field>
          <Field label="Add-Ons Value"><Input type="number" value={form.addOnsValue} onChange={(e) => set({ addOnsValue: +e.target.value })} /></Field>
          <Field label="Discount"><Input type="number" value={form.discount} onChange={(e) => set({ discount: +e.target.value })} /></Field>
          <Field label="Total Revenue (auto)"><div className="px-3 py-2 rounded-lg bg-base border border-line text-gold font-semibold tabular-nums">{money(total)}</div></Field>
          <Field label="Sales Total Revenue"><Input type="number" value={form.salesTotalRevenue} onChange={(e) => set({ salesTotalRevenue: +e.target.value })} placeholder="blank = use Total" /></Field>
          <Field label="Amount Paid"><Input type="number" value={form.amountPaid} onChange={(e) => set({ amountPaid: +e.target.value })} /></Field>
          <Field label="Amount Due (auto)"><div className={`px-3 py-2 rounded-lg bg-base border border-line tabular-nums ${due > 0 ? "text-danger" : "text-muted"}`}>{money(due)}</div></Field>
          <Field label="Payment Status"><Select options={JOB_PAYMENT_STATUSES as unknown as string[]} value={form.paymentStatus} onChange={(e) => set({ paymentStatus: e.target.value as Job["paymentStatus"] })} /></Field>
          <Field label="Payment Method"><Select options={PAYMENT_METHODS} value={form.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })} /></Field>
          <Field label="Tech Pay Status"><Select options={PAY_STATUSES as unknown as string[]} value={form.techPayStatus} onChange={(e) => set({ techPayStatus: e.target.value as Job["techPayStatus"] })} /></Field>
          <Field label="Sales Commission Status"><Select options={COMMISSION_STATUSES as unknown as string[]} value={form.salesCommissionStatus} onChange={(e) => set({ salesCommissionStatus: e.target.value as Job["salesCommissionStatus"] })} /></Field>
          <Field label="Historical?"><Select options={["No", "Yes"]} value={form.historical ? "Yes" : "No"} onChange={(e) => set({ historical: e.target.value === "Yes" })} /></Field>
          <div className="sm:col-span-3"><Field label="Admin Notes"><Textarea rows={2} value={form.adminNotes} onChange={(e) => set({ adminNotes: e.target.value })} /></Field></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="accent" onClick={save}>{editing ? "Save Changes" : "Add Job"}</Button>
        </div>
      </Modal>
    </div>
  );
}
