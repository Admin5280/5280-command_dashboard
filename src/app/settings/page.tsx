"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { BASE_PAY_TYPES, BasePayType, PayRules, TechBasePayRule } from "@/lib/types";
import { prettyDate, today } from "@/lib/format";
import { ROLES } from "@/lib/permissions";
import { useAuth } from "@/components/AuthProvider";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Section, Select, StatusPill, Textarea } from "@/components/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
function UserManagement() {
  const { can, configured } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const blankNew = { name: "", email: "", phone: "", role: "Viewer", department: "", active: true, commissionPct: 6, tech_base_pay_type: "None", tech_base_pay_amount: 0, notes: "" };
  const [nu, setNu] = useState<any>(blankNew);
  const [adding, setAdding] = useState(false);

  const load = () => fetch("/api/users").then((r) => r.json()).then((j) => setUsers(j.users || [])).catch(() => {});
  useEffect(() => { if (configured && can("manageUsers")) load(); /* eslint-disable-next-line */ }, [configured]);

  if (!configured) return <Card className="p-4 text-sm text-muted">User management activates once Supabase Auth is configured (env vars set + you&apos;re logged in).</Card>;
  if (!can("manageUsers")) return null;

  async function addUser() {
    setMsg("Creating user…");
    const res = await fetch("/api/users", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...nu, default_commission_rate: (nu.commissionPct || 0) / 100 }) });
    const j = await res.json();
    if (!res.ok) { setMsg(`✕ ${j.error}`); return; }
    setMsg(`✓ Created ${nu.email}. Temporary password: ${j.tempPassword} — share it with them (they can reset it later).`);
    setNu(blankNew); setAdding(false); load();
  }
  async function saveUser() {
    if (!editing) return;
    const res = await fetch(`/api/users/${editing.id}`, { method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...editing, default_commission_rate: (editing.commissionPct ?? (editing.default_commission_rate * 100)) / 100 }) });
    const j = await res.json();
    if (!res.ok) { setMsg(`✕ ${j.error}`); return; }
    setEditing(null); setMsg("✓ Saved."); load();
  }
  async function deleteUser(u: any) {
    if (!confirm(`Delete ${u.email}? This removes their login.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    const j = await res.json();
    if (!res.ok) { setMsg(`✕ ${j.error}`); return; }
    setMsg("✓ User deleted."); load();
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink">Users &amp; Roles</h3>
        <Button variant="accent" onClick={() => setAdding((a) => !a)}>{adding ? "Close" : "+ Invite User"}</Button>
      </div>
      {msg && <div className="mb-3 text-xs text-ink bg-base border border-line rounded-lg px-3 py-2">{msg}</div>}

      {adding && (
        <div className="bg-base border border-line rounded-lg p-3 mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Field label="Name"><Input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={nu.phone} onChange={(e) => setNu({ ...nu, phone: e.target.value })} /></Field>
          <Field label="Role"><Select options={ROLES as unknown as string[]} value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })} /></Field>
          <Field label="Department"><Input value={nu.department} onChange={(e) => setNu({ ...nu, department: e.target.value })} /></Field>
          <Field label="Active"><Select options={["Yes", "No"]} value={nu.active ? "Yes" : "No"} onChange={(e) => setNu({ ...nu, active: e.target.value === "Yes" })} /></Field>
          <Field label="Commission %"><Input type="number" value={nu.commissionPct} onChange={(e) => setNu({ ...nu, commissionPct: +e.target.value })} /></Field>
          <Field label="Tech Base Pay Type"><Select options={BASE_PAY_TYPES as unknown as string[]} value={nu.tech_base_pay_type} onChange={(e) => setNu({ ...nu, tech_base_pay_type: e.target.value })} /></Field>
          <Field label="Tech Base Pay Amount"><Input type="number" value={nu.tech_base_pay_amount} onChange={(e) => setNu({ ...nu, tech_base_pay_amount: +e.target.value })} /></Field>
          <div className="sm:col-span-3"><Field label="Notes"><Input value={nu.notes} onChange={(e) => setNu({ ...nu, notes: e.target.value })} /></Field></div>
          <div className="sm:col-span-3"><Button variant="accent" onClick={addUser}>Create User</Button></div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
            {["Name", "Email", "Role", "Dept", "Active", "Commission", "Base Pay", ""].map((h) => <th key={h} className="text-left font-medium px-2 py-2">{h}</th>)}
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line/60">
                <td className="px-2 py-2 text-ink">{u.name || "—"}</td>
                <td className="px-2 py-2 text-muted text-xs">{u.email}</td>
                <td className="px-2 py-2"><Badge value={u.role} /></td>
                <td className="px-2 py-2 text-muted">{u.department || "—"}</td>
                <td className="px-2 py-2">{u.active ? <span className="text-good">Active</span> : <span className="text-danger">Disabled</span>}</td>
                <td className="px-2 py-2 tabular-nums">{Math.round((u.default_commission_rate || 0) * 100)}%</td>
                <td className="px-2 py-2 text-xs">{u.tech_base_pay_type === "None" ? "—" : `${u.tech_base_pay_type} $${u.tech_base_pay_amount}`}</td>
                <td className="px-2 py-2 text-right"><Button variant="ghost" onClick={() => setEditing({ ...u, commissionPct: Math.round((u.default_commission_rate || 0) * 100) })}>Edit</Button></td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={8} className="px-2 py-4 text-center text-muted">No users yet. Invite one above.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit ${editing.email}` : ""}>
        {editing && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Name"><Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Phone"><Input value={editing.phone || ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
              <Field label="Role"><Select options={ROLES as unknown as string[]} value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} /></Field>
              <Field label="Department"><Input value={editing.department || ""} onChange={(e) => setEditing({ ...editing, department: e.target.value })} /></Field>
              <Field label="Active"><Select options={["Yes", "No"]} value={editing.active ? "Yes" : "No"} onChange={(e) => setEditing({ ...editing, active: e.target.value === "Yes" })} /></Field>
              <Field label="Commission %"><Input type="number" value={editing.commissionPct} onChange={(e) => setEditing({ ...editing, commissionPct: +e.target.value })} /></Field>
              <Field label="Tech Base Pay Type"><Select options={BASE_PAY_TYPES as unknown as string[]} value={editing.tech_base_pay_type || "None"} onChange={(e) => setEditing({ ...editing, tech_base_pay_type: e.target.value })} /></Field>
              <Field label="Tech Base Pay Amount"><Input type="number" value={editing.tech_base_pay_amount || 0} onChange={(e) => setEditing({ ...editing, tech_base_pay_amount: +e.target.value })} /></Field>
              <div className="sm:col-span-3"><Field label="Notes"><Textarea rows={2} value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field></div>
            </div>
            <div className="flex justify-between gap-2 mt-4">
              <Button onClick={() => deleteUser(editing)}>Delete User</Button>
              <div className="flex gap-2">
                <Button onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="accent" onClick={saveUser}>Save</Button>
              </div>
            </div>
          </>
        )}
      </Modal>
    </Card>
  );
}

const WEBHOOK_URL = "https://5280-command-dashboard.vercel.app/api/webhooks/ghl/lead-created";
interface WebhookEventLite { status: string; lead_id: string | null; duplicate: boolean; message: string; created_at: string; }

function CloudPanel() {
  const s = useStore();
  const [events, setEvents] = useState<WebhookEventLite[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => fetch("/api/webhooks/status").then((r) => r.json())
    .then((j) => { setConfigured(!!j.configured); setEvents(j.events || []); }).catch(() => setConfigured(false));
  useEffect(() => { refresh(); }, []);

  async function migrate() {
    setBusy(true); setMsg("Migrating leads to Supabase…");
    const r = await s.migrateLeadsToCloud();
    setMsg(r.ok ? `✓ Migrated ${r.count} lead(s) to Supabase.` : `✕ ${r.error}`);
    setBusy(false);
  }

  const last = events[0];
  const lastCreated = events.find((e) => e.status === "created");
  const lastDup = events.find((e) => e.duplicate);
  const lastErr = events.find((e) => e.status === "error" || e.status === "unauthorized");
  const fmt = (e?: WebhookEventLite) => e ? `${prettyDate(e.created_at.slice(0, 10))} · ${e.status}${e.lead_id ? ` · ${e.lead_id}` : ""}${e.message ? ` · ${e.message}` : ""}` : "—";

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink">GHL Webhook & Cloud Leads</h3>
        <StatusPill label={configured === null ? "checking…" : configured ? "Supabase connected" : "Supabase not configured"} tone={configured ? "good" : configured === null ? "neutral" : "warn"} />
      </div>

      <div className="text-xs text-muted mb-3">
        Leads storage: <b className={s.leadsRemote ? "text-good" : "text-gold"}>{s.leadsRemote ? "Cloud (Supabase)" : "Local (this browser)"}</b>.
        {!s.leadsRemote && " Add the Supabase env vars in Vercel, then reload."}
      </div>

      <div className="bg-base border border-line rounded-lg p-3 mb-3">
        <div className="text-xs uppercase tracking-wide text-muted mb-1">Webhook endpoint (POST)</div>
        <code className="text-xs text-accent break-all">{WEBHOOK_URL}</code>
        <div className="text-xs text-muted mt-2">Header required: <code className="text-ink">x-5280-webhook-secret</code> = your <code className="text-ink">GHL_WEBHOOK_SECRET</code></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <div className="bg-base border border-line rounded-lg p-2"><div className="text-[10px] uppercase text-muted">Last webhook received</div><div className="text-xs text-ink">{fmt(last)}</div></div>
        <div className="bg-base border border-line rounded-lg p-2"><div className="text-[10px] uppercase text-muted">Last webhook status</div><div className="text-xs text-ink">{last?.status ?? "—"}</div></div>
        <div className="bg-base border border-line rounded-lg p-2"><div className="text-[10px] uppercase text-muted">Last lead created</div><div className="text-xs text-ink">{fmt(lastCreated)}</div></div>
        <div className="bg-base border border-line rounded-lg p-2"><div className="text-[10px] uppercase text-muted">Last duplicate detected</div><div className="text-xs text-ink">{fmt(lastDup)}</div></div>
        <div className="bg-base border border-line rounded-lg p-2 sm:col-span-2"><div className="text-[10px] uppercase text-muted">Last webhook error</div><div className={`text-xs ${lastErr ? "text-danger" : "text-ink"}`}>{fmt(lastErr)}</div></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={refresh}>Refresh</Button>
        <Button variant="accent" onClick={() => { if (!busy) migrate(); }}>{busy ? "Migrating…" : "Migrate current leads → Supabase"}</Button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </Card>
  );
}

type Kind = "sources" | "services" | "salesReps" | "technicians" | "units";

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
  // edits are keyed by tech name and merged over the live store data, so
  // technicians added in the list above appear here immediately (no crash, no reload).
  const [edits, setEdits] = useState<Record<string, Partial<Draft>>>({});
  const [saved, setSaved] = useState(false);

  const rowFor = (t: string): Draft => {
    const existing = s.techBasePay.find((x) => x.technicianName === t);
    const base: Draft = existing
      ? { ...existing }
      : { technicianName: t, basePayType: "None", basePayAmount: 0, effectiveStart: "", effectiveEnd: "", active: true, notes: "" };
    return { ...base, ...edits[t] };
  };
  const upd = (tech: string, patch: Partial<Draft>) => setEdits((e) => ({ ...e, [tech]: { ...e[tech], ...patch } }));

  function save() {
    for (const t of s.technicians) {
      const row = rowFor(t);
      if (row.id) s.updateBasePay(row as TechBasePayRule); else s.addBasePay({ ...row });
    }
    setEdits({});
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
              const r = rowFor(t);
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
      <PageHeader title="Settings" subtitle="Manage users, dropdown lists, team, pay rules, and data backups" />

      <Section title="User Management"><UserManagement /></Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <EditableList title="Lead Sources" kind="sources" />
        <EditableList title="Services" kind="services" />
        <EditableList title="Sales Reps" kind="salesReps" />
        <EditableList title="Technicians" kind="technicians" />
        <EditableList title="Job Locations / Units" kind="units" />
      </div>

      <Section title="GHL Webhook & Cloud Leads"><CloudPanel /></Section>

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
