"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppData, CareClubLead, CareMember, CarePerk, CareVisit, Expense, FinanceSettings, Job, Lead, MarketingSpend, PayRules, PayrollPayment, TechBasePayRule } from "./types";
import { sampleData } from "./sampleData";
import { careLeadFromJob, defaultPerksForMember } from "./careClub";
import { uid } from "./format";

const KEY = "5280-command-center:v1";

type SettingKind = "sources" | "services" | "salesReps" | "technicians" | "units";

interface Store extends AppData {
  ready: boolean;
  // global date filter (used by dashboards)
  from: string;
  to: string;
  setRange: (from: string, to: string) => void;
  inRange: (iso: string) => boolean;
  // "current user" sales rep (shared by Sales dashboard + Leads "Assigned To Me")
  currentRep: string;
  setCurrentRep: (rep: string) => void;
  // leads are served from Supabase when the server is configured
  leadsRemote: boolean;
  migrateLeadsToCloud: () => Promise<{ ok: boolean; count?: number; error?: string }>;
  // jobs are served from Supabase when the server is configured
  jobsRemote: boolean;
  migrateJobsToCloud: () => Promise<{ ok: boolean; found?: number; migrated?: number; skipped?: number; errors?: number; error?: string }>;

  addLead: (l: Omit<Lead, "id">) => void;
  updateLead: (l: Lead) => void;
  deleteLead: (id: string) => void;

  addJob: (j: Omit<Job, "id">) => void;
  updateJob: (j: Job) => void;
  deleteJob: (id: string) => void;

  addMarketing: (m: Omit<MarketingSpend, "id">) => void;
  updateMarketing: (m: MarketingSpend) => void;
  deleteMarketing: (id: string) => void;

  addExpense: (e: Omit<Expense, "id">) => void;
  updateExpense: (e: Expense) => void;
  deleteExpense: (id: string) => void;

  addPayrollPayment: (p: Omit<PayrollPayment, "id">) => void;
  updatePayrollPayment: (p: PayrollPayment) => void;
  deletePayrollPayment: (id: string) => void;

  setFinanceSettings: (s: FinanceSettings) => void;

  addMember: (m: Omit<CareMember, "id">) => void;
  updateMember: (m: CareMember) => void;
  deleteMember: (id: string) => void;
  addVisit: (v: Omit<CareVisit, "id">) => void;
  updateVisit: (v: CareVisit) => void;
  deleteVisit: (id: string) => void;
  addPerk: (p: Omit<CarePerk, "id">) => void;
  updatePerk: (p: CarePerk) => void;
  deletePerk: (id: string) => void;

  addCareLead: (c: Omit<CareClubLead, "id">) => void;
  updateCareLead: (c: CareClubLead) => void;
  deleteCareLead: (id: string) => void;

  addBasePay: (r: Omit<TechBasePayRule, "id">) => void;
  updateBasePay: (r: TechBasePayRule) => void;
  deleteBasePay: (id: string) => void;

  addSetting: (kind: SettingKind, value: string) => void;
  removeSetting: (kind: SettingKind, value: string) => void;

  setPayRules: (rules: PayRules) => void;

  exportJSON: () => void;
  importJSON: (json: string) => boolean;
  resetSample: () => void;
  clearAll: () => void;
}

const Ctx = createContext<Store | null>(null);

function nextCareLeadId(list: CareClubLead[]): string {
  const nums = list.map((c) => +(c.careLeadId.match(/CL-(\d+)/)?.[1] ?? 0));
  return `CL-${Math.max(3000, ...nums) + 1}`;
}

/** When a job is completed, ensure a Care Club lead exists and move its original lead into the pipeline. */
function completeJobEffects(d: AppData, job: Job): Partial<AppData> {
  if (!job.dateCompleted) return {};
  const patch: Partial<AppData> = {};
  const exists = d.careClubLeads.some((cl) =>
    cl.completedJobId === job.id ||
    (job.leadId && cl.originalLeadId === job.leadId) ||
    (job.urableJobId && cl.urableJobId === job.urableJobId));
  if (!exists) {
    const lead = d.leads.find((l) => l.leadId === job.leadId);
    const careLeadId = nextCareLeadId(d.careClubLeads);
    patch.careClubLeads = [{ ...careLeadFromJob(job, lead, careLeadId), id: uid() }, ...d.careClubLeads];
  }
  let changed = false;
  const leads = d.leads.map((l) => {
    if (l.leadId && l.leadId === job.leadId && l.status === "Booked") { changed = true; return { ...l, status: "Completed Job" as const }; }
    return l;
  });
  if (changed) patch.leads = leads;
  return patch;
}

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
      expenses: parsed.expenses ?? [],
      financeSettings: parsed.financeSettings ?? s.financeSettings,
      payrollPayments: parsed.payrollPayments ?? [],
      sources: parsed.sources ?? s.sources,
      services: parsed.services ?? s.services,
      salesReps: parsed.salesReps ?? s.salesReps,
      technicians: parsed.technicians ?? s.technicians,
      units: parsed.units ?? s.units,
      careMembers: parsed.careMembers ?? s.careMembers,
      careVisits: parsed.careVisits ?? s.careVisits,
      carePerks: parsed.carePerks ?? s.carePerks,
      careClubLeads: parsed.careClubLeads ?? s.careClubLeads,
      techBasePay: parsed.techBasePay ?? s.techBasePay,
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
  const [currentRep, setCurrentRepState] = useState("");
  const [leadsRemote, setLeadsRemote] = useState(false);
  const [jobsRemote, setJobsRemote] = useState(false);

  // hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setData(load());
    try { setCurrentRepState(localStorage.getItem("5280-current-rep") ?? ""); } catch { /* ignore */ }
    setReady(true);
  }, []);

  // if the server has Supabase configured, leads live there — load them and switch to remote mode
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetch("/api/leads").then((r) => r.json()).then((j) => {
      if (!cancelled && j && j.configured && Array.isArray(j.leads)) {
        setData((d) => ({ ...d, leads: j.leads }));
        setLeadsRemote(true);
      }
    }).catch(() => { /* stay on localStorage */ });
    return () => { cancelled = true; };
  }, [ready]);

  // if Supabase is configured, jobs live there too — load them and switch to remote mode
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetch("/api/jobs").then((r) => r.json()).then((j) => {
      if (!cancelled && j && j.configured && Array.isArray(j.jobs)) {
        setData((d) => ({ ...d, jobs: j.jobs }));
        setJobsRemote(true);
      }
    }).catch(() => { /* stay on localStorage */ });
    return () => { cancelled = true; };
  }, [ready]);

  // persist on change (only once ready so we don't clobber storage with defaults)
  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(data));
  }, [data, ready]);

  const store = useMemo<Store>(() => {
    const patch = (p: Partial<AppData>) => setData((d) => ({ ...d, ...p }));
    const inRange = (iso: string) => (!from || iso >= from) && (!to || iso <= to);

    type Coll = "leads" | "jobs" | "marketing" | "careMembers" | "careVisits" | "carePerks" | "careClubLeads" | "techBasePay" | "expenses" | "payrollPayments";
    const addTo = <K extends Coll>(k: K, row: AppData[K][number]) =>
      setData((d) => ({ ...d, [k]: [row, ...d[k]] }));
    const upd = <K extends Coll>(k: K, row: { id: string }) =>
      setData((d) => ({ ...d, [k]: (d[k] as { id: string }[]).map((r) => (r.id === row.id ? row : r)) as AppData[K] }));
    const del = <K extends Coll>(k: K, id: string) =>
      setData((d) => ({ ...d, [k]: (d[k] as { id: string }[]).filter((r) => r.id !== id) as AppData[K] }));

    const pushLeadRemote = (l: Lead) =>
      fetch(`/api/leads/${l.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(l) }).catch(() => {});

    return {
      ...data,
      ready,
      from, to,
      setRange: (f, t) => { setFrom(f); setTo(t); },
      inRange,
      currentRep,
      setCurrentRep: (rep) => { setCurrentRepState(rep); try { localStorage.setItem("5280-current-rep", rep); } catch { /* ignore */ } },
      leadsRemote,
      migrateLeadsToCloud: async () => {
        try {
          const res = await fetch("/api/leads/migrate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leads: data.leads }) });
          const j = await res.json();
          if (!res.ok) return { ok: false, error: j.error || "Migration failed" };
          const refreshed = await fetch("/api/leads").then((r) => r.json());
          if (refreshed?.configured && Array.isArray(refreshed.leads)) { setData((d) => ({ ...d, leads: refreshed.leads })); setLeadsRemote(true); }
          return { ok: true, count: j.count };
        } catch (e) { return { ok: false, error: String(e) }; }
      },
      jobsRemote,
      migrateJobsToCloud: async () => {
        try {
          const res = await fetch("/api/jobs/migrate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobs: data.jobs }) });
          const j = await res.json();
          if (!res.ok) return { ok: false, error: j.error || "Migration failed" };
          const refreshed = await fetch("/api/jobs").then((r) => r.json());
          if (refreshed?.configured && Array.isArray(refreshed.jobs)) { setData((d) => ({ ...d, jobs: refreshed.jobs })); setJobsRemote(true); }
          return { ok: true, found: j.found, migrated: j.migrated, skipped: j.skipped, errors: j.errors };
        } catch (e) { return { ok: false, error: String(e) }; }
      },

      addLead: (l) => {
        if (leadsRemote) {
          const temp = { ...l, id: uid() } as Lead;
          setData((d) => ({ ...d, leads: [temp, ...d.leads] }));
          fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(l) })
            .then((r) => r.json()).then(({ lead }) => { if (lead) setData((d) => ({ ...d, leads: d.leads.map((x) => (x.id === temp.id ? lead : x)) })); }).catch(() => {});
        } else addTo("leads", { ...l, id: uid() });
      },
      updateLead: (l) => { upd("leads", l); if (leadsRemote) pushLeadRemote(l); },
      deleteLead: (id) => { del("leads", id); if (leadsRemote) fetch(`/api/leads/${id}`, { method: "DELETE" }).catch(() => {}); },

      addJob: (j) => {
        const job = { ...j, id: uid() };
        if (leadsRemote) { const eff = completeJobEffects(data, job); (eff.leads ?? []).forEach((nl) => { const b = data.leads.find((x) => x.id === nl.id); if (b && b.status !== nl.status) pushLeadRemote(nl); }); }
        setData((d) => ({ ...d, jobs: [job, ...d.jobs], ...completeJobEffects(d, job) }));
        if (jobsRemote) fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(j) })
          .then((r) => r.json()).then(({ job: saved }) => { if (saved) setData((d) => ({ ...d, jobs: d.jobs.map((x) => (x.id === job.id ? saved : x)) })); }).catch(() => {});
      },
      updateJob: (j) => {
        if (leadsRemote) { const eff = completeJobEffects({ ...data, jobs: data.jobs.map((r) => (r.id === j.id ? j : r)) }, j); (eff.leads ?? []).forEach((nl) => { const b = data.leads.find((x) => x.id === nl.id); if (b && b.status !== nl.status) pushLeadRemote(nl); }); }
        setData((d) => { const jobs = d.jobs.map((r) => (r.id === j.id ? j : r)); return { ...d, jobs, ...completeJobEffects({ ...d, jobs }, j) }; });
        if (jobsRemote) fetch(`/api/jobs/${j.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(j) }).catch(() => {});
      },
      deleteJob: (id) => { del("jobs", id); if (jobsRemote) fetch(`/api/jobs/${id}`, { method: "DELETE" }).catch(() => {}); },

      addMarketing: (m) => addTo("marketing", { ...m, id: uid() }),
      updateMarketing: (m) => upd("marketing", m),
      deleteMarketing: (id) => del("marketing", id),

      addExpense: (e) => addTo("expenses", { ...e, id: uid() }),
      updateExpense: (e) => upd("expenses", e),
      deleteExpense: (id) => del("expenses", id),

      addPayrollPayment: (p) => addTo("payrollPayments", { ...p, id: uid() }),
      updatePayrollPayment: (p) => upd("payrollPayments", p),
      deletePayrollPayment: (id) => del("payrollPayments", id),

      setFinanceSettings: (fs) => setData((d) => ({ ...d, financeSettings: fs })),

      addMember: (m) => setData((d) => {
        const member = { ...m, id: uid() };
        // auto-create default perks for the member's offer/plan (no duplicates)
        const have = new Set(d.carePerks.filter((p) => p.memberId === member.id).map((p) => p.perkName));
        const newPerks = defaultPerksForMember(member).filter((p) => !have.has(p.perkName)).map((p) => ({ ...p, id: uid() }));
        return { ...d, careMembers: [member, ...d.careMembers], carePerks: [...newPerks, ...d.carePerks] };
      }),
      updateMember: (m) => upd("careMembers", m),
      deleteMember: (id) => del("careMembers", id),
      addVisit: (v) => addTo("careVisits", { ...v, id: uid() }),
      updateVisit: (v) => upd("careVisits", v),
      deleteVisit: (id) => del("careVisits", id),
      addPerk: (p) => addTo("carePerks", { ...p, id: uid() }),
      updatePerk: (p) => upd("carePerks", p),
      deletePerk: (id) => del("carePerks", id),

      addCareLead: (c) => addTo("careClubLeads", { ...c, id: uid() }),
      updateCareLead: (c) => upd("careClubLeads", c),
      deleteCareLead: (id) => del("careClubLeads", id),

      addBasePay: (r) => addTo("techBasePay", { ...r, id: uid() }),
      updateBasePay: (r) => upd("techBasePay", r),
      deleteBasePay: (id) => del("techBasePay", id),

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
            expenses: p.expenses ?? [], financeSettings: p.financeSettings ?? s.financeSettings, payrollPayments: p.payrollPayments ?? [],
            sources: p.sources ?? s.sources, services: p.services ?? s.services,
            salesReps: p.salesReps ?? s.salesReps, technicians: p.technicians ?? s.technicians, units: p.units ?? s.units,
            careMembers: p.careMembers ?? [], careVisits: p.careVisits ?? [], carePerks: p.carePerks ?? [],
            careClubLeads: p.careClubLeads ?? [], techBasePay: p.techBasePay ?? s.techBasePay,
            payRules: p.payRules ?? s.payRules, payRulesHistory: p.payRulesHistory ?? [],
          });
          return true;
        } catch { return false; }
      },
      resetSample: () => setData(sampleData()),
      clearAll: () => setData({ ...sampleData(), leads: [], jobs: [], marketing: [], expenses: [], payrollPayments: [], careMembers: [], careVisits: [], carePerks: [], careClubLeads: [] }),
    };
  }, [data, ready, from, to, currentRep, leadsRemote, jobsRemote]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be used inside <StoreProvider>");
  return c;
}
