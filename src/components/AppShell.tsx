"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useStore } from "@/lib/store";

export function DateFilter() {
  const { from, to, setRange } = useStore();
  return (
    <div className="flex items-center gap-1.5">
      <input type="date" value={from} onChange={(e) => setRange(e.target.value, to)}
        className="bg-surface border border-line rounded-lg px-2 py-1.5 text-xs text-ink" />
      <span className="text-muted text-xs">→</span>
      <input type="date" value={to} onChange={(e) => setRange(from, e.target.value)}
        className="bg-surface border border-line rounded-lg px-2 py-1.5 text-xs text-ink" />
      {(from || to) && (
        <button onClick={() => setRange("", "")} className="text-xs text-muted hover:text-ink px-1">clear</button>
      )}
    </div>
  );
}

/** Shows Tony (and everyone) which data is live vs mock vs manual. */
export function DataMode() {
  const { jobs, careMembers, leadsRemote, jobsRemote } = useStore();

  const jobsPill = useMemo(() => {
    if (jobsRemote) return { label: "Live Jobs", tone: "good" as const };
    if (!jobs.length) return { label: "No Jobs", tone: "neutral" as const };
    const mock = jobs.some((j) => /^j\d+$/.test(j.id));
    const manual = jobs.some((j) => !/^j\d+$/.test(j.id));
    if (mock && manual) return { label: "Mixed Jobs", tone: "warn" as const };
    if (mock) return { label: "Mock Jobs", tone: "danger" as const };
    return { label: "Manual Jobs", tone: "good" as const };
  }, [jobs, jobsRemote]);

  const carePill = useMemo(() => {
    if (!careMembers.length) return { label: "No Care Club", tone: "neutral" as const };
    return careMembers.some((m) => /^cm\d+$/.test(m.id))
      ? { label: "Mock Care Club", tone: "danger" as const }
      : { label: "Manual Care Club", tone: "warn" as const };
  }, [careMembers]);

  const pill = (label: string, tone: "good" | "warn" | "danger" | "neutral") => {
    const cls = { good: "bg-good/15 text-good", warn: "bg-gold/15 text-gold", danger: "bg-danger/15 text-danger", neutral: "bg-white/10 text-muted" }[tone];
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{label}</span>;
  };

  return (
    <div className="hidden md:flex items-center gap-1.5" title="Live = Supabase cloud. Mock = sample data. Manual = you entered it locally.">
      <span className="text-[10px] uppercase tracking-wide text-muted">Data</span>
      {pill(leadsRemote ? "Live Leads" : "Local Leads", leadsRemote ? "good" : "warn")}
      {pill(jobsPill.label, jobsPill.tone)}
      {pill(carePill.label, carePill.tone)}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready } = useStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // login page renders bare (no sidebar / header)
  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="min-h-screen flex bg-base">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-base/90 backdrop-blur border-b border-line px-4 py-2.5 flex items-center gap-3">
          <button className="md:hidden text-ink text-xl px-1" onClick={() => setOpen(true)} aria-label="Menu">☰</button>
          <DataMode />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:block text-[11px] uppercase tracking-wide text-muted">Date range</span>
            <DateFilter />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          {ready ? children : <div className="text-muted text-sm animate-pulse py-20 text-center">Loading…</div>}
        </main>
      </div>
    </div>
  );
}
