"use client";

import { useState } from "react";
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-base">
      {/* desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* mobile drawer */}
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
