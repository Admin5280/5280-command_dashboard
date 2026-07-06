"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppData, CareMember, CarePerk, CareVisit, Job, Lead, MarketingSpend, PayRules } from "./types";
import { sampleData } from "./sampleData";
import { uid } from "./format";

const KEY = "5280-command-center:v1";

type SettingKind = "sources" | "services" | "salesReps" | "technicians";

interface Store extends AppData {
  ready: boolean;
  // global date filter (used by dashboards)
  from: string;
  to: string;
  setRange: (from: string, to: string) => void;
  inRange: (iso: string) => boolean;

  addLead: (l: Omit<Lead, "id">) => void;
  updateLead: (l: Lead) => void;
  deleteLead: (id: string) => void;

  addJob: (j: Omit<Job, "id">) => void;
  updateJob: (j: Job) => void;
  deleteJob: (id: string) => void;

  addMarketing: (m: Omit<MarketingSpend, "id">) => void;
  updateMarketing: (m: MarketingSpend) => void;
  deleteMarketing: (id: string) => void;

  addMember: (m: Omit<CareMember, "id">) => void;
  updateMember: (m: CareMember) => void;
  deleteMember: (id: string) => void;
  addVisit: (v: Omit<CareVisit, "id">) => void;
  updateVisit: (v: CareVisit) => void;
  deleteVisit: (id: string) => void;
  addPerk: (p: Omit<CarePerk, "id">) => void;
  updatePerk: (p: CarePerk) => void;
  deletePerk: (id: string) => void;

  addSetting: (kind: SettingKind, value: string) => void;
  removeSetting: (kind: SettingKind, value: string) => void;

  setPayRules: (rules: PayRules) => void;

  exportJSON: () => void;
  importJSON: (json: string) => boolean;
  resetSample: () => void;
  clearAll: () => void;
}

const Ctx = createContext<Store | null>(null);

function load(): AppData {
  if (typeof window === "undefined") return sampleData();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return sampleData();
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const s = sampleData();
    return {
      leads: parsed.leads ?? [],
      jobs: parsed.jobs ?? [],
      marketing: parsed.marketing ?? [],
      sources: parsed.sources ?? s.sources,
      services: parsed.services ?? s.services,
      salesReps: parsed.salesReps ?? s.salesReps,
      technicians: parsed.technicians ?? s.technicians,
      careMembers: parsed.careMembers ?? s.careMembers,
      careVisits: parsed.careVisits ?? s.careVisits,
      carePerks: parsed.carePerks ?? s.carePerks,
      payRules: parsed.payRules ?? s.payRules,
      payRulesHistory: parsed.payRulesHistory ?? s.payRulesHistory,
    };
  } catch {
    return sampleData();
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(() => sampleData());
  const [ready, setReady] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setData(load());
    setReady(true);
  }, []);

  // persist on change (only once ready so we don't clobber storage with defaults)
  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(data));
  }, [data, ready]);

  const store = useMemo<Store>(() => {
    const patch = (p: Partial<AppData>) => setData((d) => ({ ...d, ...p }));
    const inRange = (iso: string) => (!from || iso >= from) && (!to || iso <= to);

    const addTo = <K extends "leads" | "jobs" | "marketing" | "careMembers" | "careVisits" | "carePerks">(k: K, row: AppData[K][number]) =>
      setData((d) => ({ ...d, [k]: [row, ...d[k]] }));
    const upd = <K extends "leads" | "jobs" | "marketing" | "careMembers" | "careVisits" | "carePerks">(k: K, row: { id: string }) =>
      setData((d) => ({ ...d, [k]: (d[k] as { id: string }[]).map((r) => (r.id === row.id ? row : r)) as AppData[K] }));
    const del = <K extends "leads" | "jobs" | "marketing" | "careMembers" | "careVisits" | "carePerks">(k: K, id: string) =>
      setData((d) => ({ ...d, [k]: (d[k] as { id: string }[]).filter((r) => r.id !== id) as AppData[K] }));

    return {
      ...data,
      ready,
      from, to,
      setRange: (f, t) => { setFrom(f); setTo(t); },
      inRange,

      addLead: (l) => addTo("leads", { ...l, id: uid() }),
      updateLead: (l) => upd("leads", l),
      deleteLead: (id) => del("leads", id),

      addJob: (j) => addTo("jobs", { ...j, id: uid() }),
      updateJob: (j) => upd("jobs", j),
      deleteJob: (id) => del("jobs", id),

      addMarketing: (m) => addTo("marketing", { ...m, id: uid() }),
      updateMarketing: (m) => upd("marketing", m),
      deleteMarketing: (id) => del("marketing", id),

      addMember: (m) => addTo("careMembers", { ...m, id: uid() }),
      updateMember: (m) => upd("careMembers", m),
      deleteMember: (id) => del("careMembers", id),
      addVisit: (v) => addTo("careVisits", { ...v, id: uid() }),
      updateVisit: (v) => upd("careVisits", v),
      deleteVisit: (id) => del("careVisits", id),
      addPerk: (p) => addTo("carePerks", { ...p, id: uid() }),
      updatePerk: (p) => upd("carePerks", p),
      deletePerk: (id) => del("carePerks", id),

      addSetting: (kind, value) => setData((d) =>
        d[kind].includes(value.trim()) || !value.trim() ? d : { ...d, [kind]: [...d[kind], value.trim()] }),
      removeSetting: (kind, value) => setData((d) => ({ ...d, [kind]: d[kind].filter((v) => v !== value) })),

      setPayRules: (rules) => setData((d) => ({
        ...d,
        payRules: rules,
        // archive the previous version so pay history is preserved
        payRulesHistory: [{ ...d.payRules }, ...d.payRulesHistory].slice(0, 50),
      })),

      exportJSON: () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `5280-command-center-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      importJSON: (json) => {
        try {
          const p = JSON.parse(json) as AppData;
          if (!Array.isArray(p.leads) || !Array.isArray(p.jobs)) return false;
          const s = sampleData();
          patch({
            leads: p.leads, jobs: p.jobs, marketing: p.marketing ?? [],
            sources: p.sources ?? s.sources, services: p.services ?? s.services,
            salesReps: p.salesReps ?? s.salesReps, technicians: p.technicians ?? s.technicians,
            careMembers: p.careMembers ?? [], careVisits: p.careVisits ?? [], carePerks: p.carePerks ?? [],
            payRules: p.payRules ?? s.payRules, payRulesHistory: p.payRulesHistory ?? [],
          });
          return true;
        } catch { return false; }
      },
      resetSample: () => setData(sampleData()),
      clearAll: () => setData({ ...sampleData(), leads: [], jobs: [], marketing: [], careMembers: [], careVisits: [], carePerks: [] }),
    };
  }, [data, ready, from, to]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used inside <StoreProvider>");
  return c;
}
