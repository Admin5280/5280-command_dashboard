"use client";

import { ReactNode, useEffect } from "react";
import { money } from "@/lib/format";

/* ---------- layout ---------- */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-surface border border-line rounded-xl shadow-card ${className}`}>{children}</div>;
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-ink uppercase tracking-wide">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/* ---------- KPI ---------- */
export function Kpi({ label, value, sub, tone = "default", icon }: {
  label: string; value: string; sub?: string; tone?: "default" | "good" | "warn" | "accent" | "gold" | "blue" | "danger"; icon?: ReactNode;
}) {
  const toneCls = { default: "text-ink", good: "text-good", warn: "text-gold", accent: "text-accent",
    gold: "text-gold", blue: "text-accent", danger: "text-danger" }[tone];
  const ring = tone === "gold" ? "border-gold/25" : tone === "danger" ? "border-danger/30" : "border-line";
  return (
    <Card className={`p-4 border ${ring}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">{icon && <span className="text-accent">{icon}</span>}{label}</div>
      <div className={`text-2xl font-bold mt-1 ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </Card>
  );
}

/* ---------- buttons / inputs ---------- */
export function Button({ children, onClick, variant = "default", type = "button", className = "" }: {
  children: ReactNode; onClick?: () => void; variant?: "default" | "accent" | "ghost" | "danger"; type?: "button" | "submit"; className?: string;
}) {
  const v = {
    default: "bg-surface2 text-ink border border-line hover:border-muted",
    accent: "bg-accent text-white hover:bg-accent2 border border-transparent",
    ghost: "bg-transparent text-muted hover:text-ink border border-transparent",
    danger: "bg-transparent text-accent2 hover:bg-accent/10 border border-line",
  }[variant];
  return (
    <button type={type} onClick={onClick} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${v} ${className}`}>
      {children}
    </button>
  );
}

const fieldCls = "w-full bg-base border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-muted focus:border-accent focus:outline-none";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldCls} ${props.className ?? ""}`} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldCls} ${props.className ?? ""}`} />;
}
export function Select({ options, ...props }: { options: string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${fieldCls} ${props.className ?? ""}`}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/* ---------- status badge ---------- */
const BADGE: Record<string, string> = {
  // green — active / paid / positive
  "Booked": "bg-good/15 text-good", "Completed": "bg-good/15 text-good", "Active": "bg-good/15 text-good",
  "Paid": "bg-good/15 text-good", "Fully Paid": "bg-good/15 text-good", "Won Back": "bg-good/15 text-good",
  // gold/amber — in progress / pending
  "In Progress": "bg-gold/15 text-gold", "Estimate Sent": "bg-gold/15 text-gold", "Contacted": "bg-gold/15 text-gold",
  "Quoted": "bg-gold/15 text-gold", "Pending Signup": "bg-gold/15 text-gold", "Pending Review": "bg-gold/15 text-gold",
  "Scheduled": "bg-gold/15 text-gold", "Paused": "bg-gold/15 text-gold", "Partially Paid": "bg-gold/15 text-gold",
  // blue — new / neutral operational
  "New Lead": "bg-accent/15 text-accent", "New": "bg-accent/15 text-accent", "Care Club Sold": "bg-accent/15 text-accent",
  "Available": "bg-accent/15 text-accent", "Used": "bg-accent/15 text-accent",
  // red — warnings / past due / negative
  "Lost": "bg-danger/15 text-danger", "Canceled": "bg-danger/15 text-danger", "Past Due": "bg-danger/15 text-danger",
  "Unpaid": "bg-danger/15 text-danger", "No Show": "bg-danger/15 text-danger", "Expired": "bg-danger/15 text-danger",
  "No Response": "bg-white/10 text-muted",
};
export function Badge({ value }: { value: string }) {
  if (!value) return <span className="text-muted">—</span>;
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[value] ?? "bg-white/10 text-muted"}`}>{value}</span>;
}

export function WarnPill({ flags }: { flags: string[] }) {
  if (!flags.length) return <span className="text-good text-xs">✓</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((f) => <span key={f} className="inline-block px-1.5 py-0.5 rounded bg-danger/15 text-danger text-[10px] font-semibold whitespace-nowrap">⚠ {f}</span>)}
    </span>
  );
}

export function LinkOut({ href, label = "open" }: { href: string; label?: string }) {
  if (!href) return <span className="text-muted">—</span>;
  return <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline whitespace-nowrap">{label} ↗</a>;
}

/* ---------- table ---------- */
export interface Col<T> { key: string; label: string; render?: (row: T) => ReactNode; className?: string; }
export function Table<T extends { id: string }>({ cols, rows, empty = "No records yet." }: { cols: Col<T>[]; rows: T[]; empty?: string }) {
  if (!rows.length) return <Card className="p-8 text-center text-sm text-muted">{empty}</Card>;
  return (
    <Card className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {cols.map((c) => (
              <th key={c.key} className="text-left font-medium text-muted px-3 py-2.5 whitespace-nowrap text-xs uppercase tracking-wide">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line/60 hover:bg-surface2/50">
              {cols.map((c) => (
                <td key={c.key} className={`px-3 py-2 whitespace-nowrap ${c.className ?? ""}`}>
                  {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ---------- horizontal bar list (simple chart) ---------- */
export function BarList({ data, money: isMoney = false }: { data: { label: string; value: number }[]; money?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <Card className="p-6 text-center text-sm text-muted">No data.</Card>;
  return (
    <Card className="p-4 space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[minmax(90px,150px)_1fr_auto] items-center gap-3">
          <span className="text-xs text-muted truncate" title={d.label}>{d.label}</span>
          <div className="h-2.5 bg-base rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="text-xs tabular-nums text-ink w-16 text-right">{isMoney ? money(d.value) : d.value.toLocaleString()}</span>
        </div>
      ))}
    </Card>
  );
}

/* ---------- modal ---------- */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-surface border border-line rounded-2xl shadow-card w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <h3 className="font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink text-lg leading-none">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
