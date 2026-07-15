"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { MarketingSpend } from "@/lib/types";
import { money, pct, prettyDate, today } from "@/lib/format";
import { marketingByChannel } from "@/lib/metrics";
import { toCSV, download } from "@/lib/csv";
import { Button, Card, Field, Input, Modal, PageHeader, Section, Select, Table, Textarea, Col, BarList } from "@/components/ui";

const blank = (): Omit<MarketingSpend, "id"> => ({
  date: today(), channel: "Google Ads", campaign: "", spend: 0, leads: 0, bookedJobs: 0, revenue: 0, notes: "",
});

export default function MarketingPage() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingSpend | null>(null);
  const [form, setForm] = useState<Omit<MarketingSpend, "id">>(blank());

  const rows = useMemo(() => s.marketing.filter((m) => s.inRange(m.date)), [s.marketing, s.from, s.to]);
  const channels = useMemo(() => marketingByChannel(s.marketing, s.leads, s.jobs, s.from, s.to),
    [s.marketing, s.leads, s.jobs, s.from, s.to]);

  function openNew() { setEditing(null); setForm(blank()); setOpen(true); }
  function openEdit(m: MarketingSpend) { setEditing(m); const { id, ...rest } = m; setForm(rest); setOpen(true); }
  function save() { if (editing) s.updateMarketing({ ...form, id: editing.id }); else s.addMarketing(form); setOpen(false); }
  const set = (k: keyof Omit<MarketingSpend, "id">, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const cols: Col<MarketingSpend>[] = [
    { key: "date", label: "Date", render: (m) => <span className="text-muted">{prettyDate(m.date)}</span> },
    { key: "channel", label: "Channel" },
    { key: "campaign", label: "Campaign" },
    { key: "spend", label: "Spend", render: (m) => <span className="tabular-nums text-gold">{money(m.spend)}</span> },
    { key: "notes", label: "Notes", render: (m) => <span className="text-muted text-xs">{m.notes || "—"}</span> },
    { key: "_", label: "", render: (m) => (
      <div className="flex gap-1 justify-end">
        <Button variant="ghost" onClick={() => openEdit(m)}>Edit</Button>
        <Button variant="ghost" onClick={() => confirm("Delete this row?") && s.deleteMarketing(m.id)}>✕</Button>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Marketing" subtitle="Enter spend only — leads, bookings, jobs & revenue are calculated from Confirmed Source" actions={
        <>
          <Button onClick={() => download(`marketing-${today()}.csv`, toCSV(channels as unknown as Record<string, unknown>[]))}>Export CSV</Button>
          <Button variant="accent" onClick={openNew}>+ Add Spend</Button>
        </>
      } />

      <Section title="Performance by Channel">
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              {["Channel", "Spend", "Leads", "Booked", "Completed", "Revenue", "CPL", "Cost / Booked", "ROAS", "Booking Rate"].map((h) => (
                <th key={h} className="text-left font-medium px-3 py-2.5 whitespace-nowrap">{h}</th>))}
            </tr></thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.channel} className="border-b border-line/60">
                  <td className="px-3 py-2 font-medium text-ink">{c.channel}</td>
                  <td className="px-3 py-2 tabular-nums text-gold">{money(c.spend)}</td>
                  <td className="px-3 py-2 tabular-nums">{c.leads}</td>
                  <td className="px-3 py-2 tabular-nums">{c.bookings}</td>
                  <td className="px-3 py-2 tabular-nums">{c.completed}</td>
                  <td className="px-3 py-2 tabular-nums text-gold">{money(c.revenue)}</td>
                  <td className="px-3 py-2 tabular-nums">{c.leads ? money(c.cpl) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{c.bookings ? money(c.cpb) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-good">{c.spend ? `${c.roas.toFixed(2)}x` : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{c.leads ? pct(c.bookingRate) : "—"}</td>
                </tr>
              ))}
              {!channels.length && <tr><td colSpan={10} className="px-3 py-8 text-center text-muted">No channel activity in range.</td></tr>}
            </tbody>
          </table>
        </Card>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <Section title="Spend by Channel"><BarList data={channels.map((c) => ({ label: c.channel, value: c.spend }))} money /></Section>
        <Section title="Revenue by Channel"><BarList data={channels.map((c) => ({ label: c.channel, value: c.revenue }))} money /></Section>
        <Section title="Leads by Channel"><BarList data={channels.map((c) => ({ label: c.channel, value: c.leads }))} /></Section>
        <Section title="Booked Jobs by Channel"><BarList data={channels.map((c) => ({ label: c.channel, value: c.bookings }))} /></Section>
        <Section title="Completed Jobs by Channel"><BarList data={channels.map((c) => ({ label: c.channel, value: c.completed }))} /></Section>
      </div>

      <Section title="Spend Log"><Table cols={cols} rows={rows} empty="No marketing spend rows yet." /></Section>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit Marketing Spend" : "Add Marketing Spend"}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
          <Field label="Channel"><Select options={s.sources} value={form.channel} onChange={(e) => set("channel", e.target.value)} /></Field>
          <Field label="Campaign Name"><Input value={form.campaign} onChange={(e) => set("campaign", e.target.value)} /></Field>
          <Field label="Spend"><Input type="number" value={form.spend} onChange={(e) => set("spend", +e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field></div>
        </div>
        <p className="text-xs text-muted mt-3">Leads, bookings, completed jobs, and revenue are calculated automatically from records whose <b>Confirmed Source</b> matches this channel.</p>
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="accent" onClick={save}>{editing ? "Save Changes" : "Add Spend"}</Button>
        </div>
      </Modal>
    </div>
  );
}
