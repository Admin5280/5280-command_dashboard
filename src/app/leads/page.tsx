"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Lead, LEAD_STATUSES, LEAD_SOURCES, SOURCE_REVIEW_STATUSES, CLAIM_STATUSES } from "@/lib/types";
import { leadFlags } from "@/lib/guardrails";
import { memberFromLead } from "@/lib/careClub";
import { money, prettyDate, today } from "@/lib/format";
import { toCSV, download } from "@/lib/csv";
import { Badge, Button, Card, ClaimPill, Field, Input, LinkOut, Modal, PageHeader, Section, Select, StatusPill, Table, Textarea, WarnPill, Col } from "@/components/ui";

const blank = (leadId: string): Omit<Lead, "id"> => ({
  leadId, ghlContactId: "", ghlContactLink: "", dateCreated: today(), customerName: "", phone: "", email: "",
  rawSource: "", possibleSource: "", confirmedSource: "", sourceReviewStatus: "Needs Review", serviceInterest: "Mobile Detail",
  claimStatus: "Unclaimed", assignedSalesRep: "", status: "New Lead", nextFollowUp: "", quoteAmount: 0,
  bookedDate: "", bookedJobValue: 0, notes: "", customerId: "", maintenanceId: "", origin: "manual",
});

export default function LeadsPage() {
  const s = useStore();
  const router = useRouter();

  function createMember(l: Lead) {
    if (s.careMembers.some((m) => m.leadId === l.leadId && l.leadId)) {
      if (!confirm(`A member already exists for ${l.leadId}. Create another?`)) return;
    }
    s.addMember(memberFromLead(l));
    router.push("/care-club");
  }
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<Omit<Lead, "id">>(blank(""));
  const [fSource, setFSource] = useState("All");
  const [fStatus, setFStatus] = useState("All");
  const [fClaim, setFClaim] = useState("All");
  const [fRep, setFRep] = useState("All");
  const [quick, setQuick] = useState("All Leads");
  const [q, setQ] = useState("");
  const t = today();

  const careLeadIds = useMemo(() => new Set(s.careClubLeads.map((c) => c.originalLeadId).filter(Boolean)), [s.careClubLeads]);

  const searchText = (l: Lead) =>
    `${l.leadId} ${l.customerName} ${l.phone} ${l.email} ${l.ghlContactId} ${l.confirmedSource} ${l.serviceInterest} ${l.assignedSalesRep} ${l.status} ${l.notes}`.toLowerCase();

  const openStatus = (st: string) => !["Booked", "Completed Job", "Care Club Sold", "Lost"].includes(st);
  const quickMatch = (l: Lead) => {
    switch (quick) {
      case "Unclaimed": return l.claimStatus === "Unclaimed";
      case "Claimed": return l.claimStatus === "Claimed";
      case "Assigned To Me": return !!s.currentRep && l.assignedSalesRep === s.currentRep;
      case "Booked": return l.status === "Booked" || l.status === "Care Club Sold";
      case "Needs Follow-Up": return l.status === "Follow-Up Needed" || l.status === "No Response" || (!!l.nextFollowUp && l.nextFollowUp <= t && openStatus(l.status));
      case "Needs Source Review": return !l.confirmedSource;
      case "Imported from GHL": return l.origin === "ghl";
      case "Manual Entry": return l.origin !== "ghl";
      default: return true;
    }
  };

  const rows = useMemo(() => s.leads
    .filter((l) => s.inRange(l.dateCreated))
    .filter((l) => fSource === "All" || l.confirmedSource === fSource || l.rawSource === fSource)
    .filter((l) => fStatus === "All" || l.status === fStatus)
    .filter((l) => fClaim === "All" || l.claimStatus === fClaim)
    .filter((l) => fRep === "All" || l.assignedSalesRep === fRep)
    .filter(quickMatch)
    .filter((l) => !q || searchText(l).includes(q.toLowerCase())),
    [s.leads, s.from, s.to, fSource, fStatus, fClaim, fRep, quick, s.currentRep, q]);

  const booked = useMemo(() => s.leads.filter((l) => l.status === "Booked" || l.status === "Care Club Sold"), [s.leads]);

  function nextLeadId() {
    const nums = s.leads.map((l) => +(l.leadId.match(/L-(\d+)/)?.[1] ?? 0));
    return `L-${Math.max(2000, ...nums) + 1}`;
  }
  function openNew() { setEditing(null); setForm(blank(nextLeadId())); setOpen(true); }
  function openEdit(l: Lead) { setEditing(l); const { id, ...rest } = l; setForm(rest); setOpen(true); }
  function save() {
    if (!form.customerName.trim()) return;
    const payload = { ...form, leadId: form.leadId || nextLeadId() };
    if (editing) s.updateLead({ ...payload, id: editing.id }); else s.addLead(payload);
    setOpen(false);
  }
  const set = (k: keyof Omit<Lead, "id">, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const cols: Col<Lead>[] = [
    { key: "leadId", label: "Lead ID", render: (l) => (
      <div className="flex flex-col gap-1">
        <span className="text-accent font-mono text-xs">{l.leadId}</span>
        <StatusPill label={l.origin === "ghl" ? "GHL" : "Manual"} tone={l.origin === "ghl" ? "info" : "neutral"} />
      </div>
    ) },
    { key: "customerName", label: "Customer", render: (l) => <span className="font-medium text-ink">{l.customerName}</span> },
    { key: "phone", label: "Phone" },
    { key: "confirmedSource", label: "Confirmed Source", render: (l) => l.confirmedSource ? l.confirmedSource : <span className="text-danger text-xs">⚠ review</span> },
    { key: "serviceInterest", label: "Service" },
    { key: "status", label: "Lead Status", render: (l) => (
      <div className="flex flex-col gap-1">
        <Badge value={l.status} />
        {l.leadId && careLeadIds.has(l.leadId) && <span className="text-[10px] text-accent">→ Moved to Care Club Pipeline</span>}
      </div>
    ) },
    { key: "claimStatus", label: "Claim", render: (l) => <ClaimPill status={l.claimStatus} /> },
    { key: "assignedSalesRep", label: "Rep" },
    { key: "quoteAmount", label: "Quote", render: (l) => <span className="tabular-nums">{money(l.quoteAmount)}</span> },
    { key: "ghl", label: "GHL", render: (l) => <LinkOut href={l.ghlContactLink} /> },
    { key: "flags", label: "Checks", render: (l) => <WarnPill flags={leadFlags(l, s.leads)} /> },
    { key: "_", label: "", render: (l) => (
      <div className="flex gap-1 justify-end">
        <Button variant="ghost" onClick={() => openEdit(l)}>Edit</Button>
        <Button variant="ghost" onClick={() => confirm(`Delete ${l.customerName}?`) && s.deleteLead(l.id)}>✕</Button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Leads" subtitle={`${rows.length} shown · Confirmed Source is the reporting source`} actions={
        <>
          <Button onClick={() => download(`leads-${today()}.csv`, toCSV(rows as unknown as Record<string, unknown>[]))}>Export CSV</Button>
          <Button variant="accent" onClick={openNew}>+ Add Lead</Button>
        </>
      } />

      {/* Booked Leads View */}
      <Section title={`Booked Leads — ready to create a job (${booked.length})`}>
        {booked.length ? (
          <Card className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                {["Lead ID", "Customer", "Phone", "Confirmed Source", "Service", "Sales Rep", "Booked Date", "Booked Value", "Action"].map((h) => (
                  <th key={h} className="text-left font-medium px-3 py-2">{h}</th>))}
              </tr></thead>
              <tbody>
                {booked.map((l) => (
                  <tr key={l.id} className="border-b border-line/60">
                    <td className="px-3 py-2 font-mono text-xs text-accent">{l.leadId}</td>
                    <td className="px-3 py-2 text-ink">{l.customerName}</td>
                    <td className="px-3 py-2">{l.phone}</td>
                    <td className="px-3 py-2">{l.confirmedSource || <span className="text-danger">⚠ review</span>}</td>
                    <td className="px-3 py-2">{l.serviceInterest}</td>
                    <td className="px-3 py-2">{l.assignedSalesRep || <span className="text-danger">⚠ needs rep</span>}</td>
                    <td className="px-3 py-2">{prettyDate(l.bookedDate)}</td>
                    <td className="px-3 py-2 tabular-nums text-gold">{money(l.bookedJobValue)}</td>
                    <td className="px-3 py-2">
                      <Button variant="ghost" onClick={() => createMember(l)} className="text-accent">
                        {l.status === "Care Club Sold" ? "→ Create Member" : "→ Care Club"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : <Card className="p-6 text-center text-sm text-muted">No booked leads yet.</Card>}
      </Section>

      <Section title="All Leads">
        <div className="flex flex-wrap gap-2 mb-3">
          {["All Leads", "Unclaimed", "Claimed", "Assigned To Me", "Booked", "Needs Follow-Up", "Needs Source Review", "Imported from GHL", "Manual Entry"].map((qb) => (
            <button key={qb} onClick={() => setQuick(qb)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${quick === qb ? "bg-accent text-white border-transparent" : "bg-surface2 text-muted border-line hover:text-ink"}`}>
              {qb}{qb === "Assigned To Me" && !s.currentRep ? " (pick rep in Sales)" : ""}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <Select options={["All", ...LEAD_SOURCES]} value={fSource} onChange={(e) => setFSource(e.target.value)} className="w-auto" />
          <Select options={["All", ...LEAD_STATUSES]} value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="w-auto" />
          <Select options={["All", ...CLAIM_STATUSES]} value={fClaim} onChange={(e) => setFClaim(e.target.value)} className="w-auto" />
          <Select options={["All", ...s.salesReps]} value={fRep} onChange={(e) => setFRep(e.target.value)} className="w-auto" />
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
        </div>
        <Table cols={cols} rows={rows} empty="No leads match." />
      </Section>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Lead" : "Add Lead"}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Lead ID"><Input value={form.leadId} onChange={(e) => set("leadId", e.target.value)} /></Field>
          <Field label="Date Created"><Input type="date" value={form.dateCreated} onChange={(e) => set("dateCreated", e.target.value)} /></Field>
          <Field label="Customer Name"><Input value={form.customerName} onChange={(e) => set("customerName", e.target.value)} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Service Interest"><Select options={s.services} value={form.serviceInterest} onChange={(e) => set("serviceInterest", e.target.value)} /></Field>
          <Field label="Raw Source (reference)"><Input value={form.rawSource} onChange={(e) => set("rawSource", e.target.value)} placeholder="e.g. Direct Call" /></Field>
          <Field label="Possible Source"><Select options={["", ...LEAD_SOURCES]} value={form.possibleSource} onChange={(e) => set("possibleSource", e.target.value)} /></Field>
          <Field label="Confirmed Source (final)"><Select options={["", ...LEAD_SOURCES]} value={form.confirmedSource} onChange={(e) => set("confirmedSource", e.target.value)} /></Field>
          <Field label="Source Review Status"><Select options={SOURCE_REVIEW_STATUSES as unknown as string[]} value={form.sourceReviewStatus} onChange={(e) => set("sourceReviewStatus", e.target.value)} /></Field>
          <Field label="Claim Status"><Select options={CLAIM_STATUSES as unknown as string[]} value={form.claimStatus} onChange={(e) => set("claimStatus", e.target.value)} /></Field>
          <Field label="Assigned Sales Rep"><Select options={["", ...s.salesReps]} value={form.assignedSalesRep} onChange={(e) => set("assignedSalesRep", e.target.value)} /></Field>
          <Field label="Lead Status"><Select options={LEAD_STATUSES as unknown as string[]} value={form.status} onChange={(e) => set("status", e.target.value)} /></Field>
          <Field label="Next Follow-Up"><Input type="date" value={form.nextFollowUp} onChange={(e) => set("nextFollowUp", e.target.value)} /></Field>
          <Field label="Quote Amount"><Input type="number" value={form.quoteAmount} onChange={(e) => set("quoteAmount", +e.target.value)} /></Field>
          <Field label="Booked Date"><Input type="date" value={form.bookedDate} onChange={(e) => set("bookedDate", e.target.value)} /></Field>
          <Field label="Booked Job Value"><Input type="number" value={form.bookedJobValue} onChange={(e) => set("bookedJobValue", +e.target.value)} /></Field>
          <Field label="GHL Contact ID"><Input value={form.ghlContactId} onChange={(e) => set("ghlContactId", e.target.value)} /></Field>
          <Field label="GHL Contact Link"><Input value={form.ghlContactLink} onChange={(e) => set("ghlContactLink", e.target.value)} /></Field>
          <Field label="Customer ID"><Input value={form.customerId} onChange={(e) => set("customerId", e.target.value)} /></Field>
          <Field label="Maintenance ID"><Input value={form.maintenanceId} onChange={(e) => set("maintenanceId", e.target.value)} /></Field>
          <div className="sm:col-span-3"><Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="accent" onClick={save}>{editing ? "Save Changes" : "Add Lead"}</Button>
        </div>
      </Modal>
    </div>
  );
}
