"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { BASE_PAY_TYPES, BasePayType, PayRules, TechBasePayRule } from "@/lib/types";
import { today } from "@/lib/format";
import { Button, Card, Field, Input, PageHeader, Section, Select } from "@/components/ui";

type Kind = "sources" | "services" | "salesReps" | "technicians";

function EditableList({ title, kind }: { title: string; kind: Kind }) {
  const s = useStore();
  const items = s[kind];
  const [val, setVal] = useState("");
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-ink mb-3">{title}</h3>
      <div className="flex gap-2 mb-3">
        <Input placeholder={`Add ${title.toLowerCase()}…`} value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { s.addSetting(kind, val); setVal(""); } }} />
        <Button variant="accent" onClick={() => { if (val.trim()) { s.addSetting(kind, val); setVal(""); } }}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <span key={it} className="inline-flex items-center gap-1.5 bg-base border border-line rounded-full pl-3 pr-1.5 py-1 text-sm text-ink">
            {it}
            <button onClick={() => s.removeSetting(kind, it)} className="text-muted hover:text-accent2 h-4 w-4 rounded-full leading-none">✕</button>
          </span>
        ))}
        {!items.length && <span className="text-sm text-muted">None yet.</span>}
      </div>
    </Card>
  );
}

function PayRulesEditor() {
  const s = useStore();
  const [draft, setDraft] = useState<PayRules>(() => JSON.parse(JSON.stringify(s.payRules)));
  const [saved, setSaved] = useState(false);

  const setTech = (i: number, key: "commissionPct" | "upsellPct" | "tipPct", whole: number) =>
    setDraft((d) => ({ ...d, tech: d.tech.map((t, idx) => idx === i ? { ...t, [key]: whole / 100 } : t) }));
  const setSales = (key: "commissionPct" | "baseGuarantee" | "requireCompletedPaidJob", v: number | boolean) =>
    setDraft((d) => ({ ...d, sales: { ...d.sales, [key]: v } }));

  function save() {
    s.setPayRules({ ...draft, updatedAt: today() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink">Pay Rules</h3>
        <span className="text-xs text-muted">Effective {draft.effectiveDate} · last saved {s.payRules.updatedAt}</span>
      </div>

      <div className="text-xs uppercase tracking-wide text-muted mb-2">Technician (percent of production / upsell / tip)</div>
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full text-sm">
          <thead><tr className="text-xs uppercase tracking-wide text-muted border-b border-line">
            {["Role", "Commission %", "Upsell %", "Tip %"].map((h) => <th key={h} className="text-left font-medium px-2 py-1.5">{h}</th>)}
          </tr></thead>
          <tbody>
            {draft.tech.map((t, i) => (
              <tr key={t.role} className="border-b border-line/60">
                <td className="px-2 py-1.5 text-ink font-medium">{t.role}</td>
                <td className="px-2 py-1.5"><Input type="number" value={Math.round(t.commissionPct * 100)} onChange={(e) => setTech(i, "commissionPct", +e.target.value)} className="w-24" /></td>
                <td className="px-2 py-1.5"><Input type="number" value={Math.round(t.upsellPct * 100)} onChange={(e) => setTech(i, "upsellPct", +e.target.value)} className="w-24" /></td>
                <td className="px-2 py-1.5"><Input type="number" value={Math.round(t.tipPct * 100)} onChange={(e) => setTech(i, "tipPct", +e.target.value)} className="w-24" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs uppercase tracking-wide text-muted mb-2">Sales commission</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Commission %"><Input type="number" value={Math.round(draft.sales.commissionPct * 100)} onChange={(e) => setSales("commissionPct", +e.target.value / 100)} /></Field>
        <Field label="Base Guarantee ($)"><Input type="number" value={draft.sales.baseGuarantee} onChange={(e) => setSales("baseGuarantee", +e.target.value)} /></Field>
        <Field label="Base requires ≥1 paid job?">
          <select className="w-full bg-base border border-line rounded-lg px-3 py-2 text-sm text-ink" value={draft.sales.requireCompletedPaidJob ? "Yes" : "No"} onChange={(e) => setSales("requireCompletedPaidJob", e.target.value === "Yes")}>
            <option>Yes</option><option>No</option>
          </select>
        </Field>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <Button variant="accent" onClick={save}>Save Pay Rules</Button>
        {saved && <span className="text-sm text-good">✓ Saved — previous version archived to history.</span>}
        {!!s.payRulesHistory.length && <span className="text-xs text-muted">{s.payRulesHistory.length} prior version(s) archived.</span>}
      </div>
    </Card>
  );
}

function BasePayEditor() {
  const s = useStore();
  type Draft = Omit<TechBasePayRule, "id"> & { id?: string };
  const seed = (): Record<string, Draft> => {
    const map: Record<string, Draft> = {};
    for (const t of s.technicians) {
      const r = s.techBasePay.find((x) => x.technicianName === t);
      map[t] = r ? { ...r } : { technicianName: t, basePayType: "None", basePayAmount: 0, effectiveStart: "", effectiveEnd: "", active: true, notes: "" };
    }
    return map;
  };
  const [draft, setDraft] = useState<Record<string, Draft>>(seed);
  const [saved, setSaved] = useState(false);
  const upd = (tech: string, patch: Partial<Draft>) => setDraft((d) => ({ ...d, [tech]: { ...d[tech], ...patch } }));

  function save() {
    for (const t of s.technicians) {
      const row = draft[t];
      if (row.id) s.updateBasePay(row as TechBasePayRule); else s.addBasePay(row);
    }
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink">Technician Base Pay</h3>
        <span className="text-xs text-muted">Base pay is separate from commission; applied per payroll period.</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-xs uppercase tracking-wide text-muted border-b border-line">
            {["Technician", "Base Pay Type", "Amount", "Effective Start", "Effective End", "Active", "Notes"].map((h) => <th key={h} className="text-left font-medium px-2 py-1.5 whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {s.technicians.map((t) => {
              const r = draft[t];
              return (
                <tr key={t} className="border-b border-line/60">
                  <td className="px-2 py-1.5 text-ink font-medium whitespace-nowrap">{t}</td>
                  <td className="px-2 py-1.5"><Select options={BASE_PAY_TYPES as unknown as string[]} value={r.basePayType} onChange={(e) => upd(t, { basePayType: e.target.value as BasePayType })} /></td>
                  <td className="px-2 py-1.5"><Input type="number" value={r.basePayAmount} onChange={(e) => upd(t, { basePayAmount: +e.target.value })} className="w-24" /></td>
                  <td className="px-2 py-1.5"><Input type="date" value={r.effectiveStart} onChange={(e) => upd(t, { effectiveStart: e.target.value })} className="w-36" /></td>
                  <td className="px-2 py-1.5"><Input type="date" value={r.effectiveEnd} onChange={(e) => upd(t, { effectiveEnd: e.target.value })} className="w-36" /></td>
                  <td className="px-2 py-1.5"><Select options={["Yes", "No"]} value={r.active ? "Yes" : "No"} onChange={(e) => upd(t, { active: e.target.value === "Yes" })} /></td>
                  <td className="px-2 py-1.5"><Input value={r.notes} onChange={(e) => upd(t, { notes: e.target.value })} className="w-40" /></td>
                </tr>
              );
            })}
            {!s.technicians.length && <tr><td colSpan={7} className="px-2 py-4 text-center text-muted">Add technicians above first.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <Button variant="accent" onClick={save}>Save Base Pay</Button>
        {saved && <span className="text-sm text-good">✓ Saved.</span>}
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const s = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  function onImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const ok = s.importJSON(String(reader.result));
      setMsg(ok ? "✓ Backup restored." : "✕ Invalid backup file.");
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage dropdown lists, team, and data backups" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <EditableList title="Lead Sources" kind="sources" />
        <EditableList title="Services" kind="services" />
        <EditableList title="Sales Reps" kind="salesReps" />
        <EditableList title="Technicians" kind="technicians" />
      </div>

      <Section title="Pay Rules"><PayRulesEditor /></Section>

      <Section title="Technician Base Pay"><BasePayEditor /></Section>

      <Section title="Data & Backups">
        <Card className="p-4">
          {msg && <div className="mb-3 text-sm text-ink bg-base border border-line rounded-lg px-3 py-2">{msg}</div>}
          <div className="flex flex-wrap gap-2">
            <Button variant="accent" onClick={s.exportJSON}>Export JSON Backup</Button>
            <Button onClick={() => fileRef.current?.click()}>Import JSON Backup</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden"
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            <Button variant="danger" onClick={() => confirm("Reload the sample dataset? This replaces current data.") && (s.resetSample(), setMsg("Sample data loaded."))}>Reset to Sample</Button>
            <Button variant="danger" onClick={() => confirm("Delete ALL leads, jobs and marketing? This cannot be undone.") && (s.clearAll(), setMsg("All records cleared."))}>Clear All Records</Button>
          </div>
          <p className="text-xs text-muted mt-3">
            All data is stored locally in this browser (localStorage). Export a JSON backup regularly, and use it to move data to another device.
          </p>
        </Card>
      </Section>
    </div>
  );
}
