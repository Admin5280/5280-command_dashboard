"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Expense, FinanceSettings, PayrollPayment, Overhead, BANK_BUCKETS, PAYMENT_FREQUENCIES } from "@/lib/types";
import {
  financeKpis, paymentBreakdown, jobProcessingFee, jobNetReceived, FinanceInput,
  expenseRollup, expensesByBucket, expensesByMethod, expensesByCategory, expensesByDay, expensesByMonth,
  overheadMonthlyTotal, overheadMonthlyAmount, overheadDueWithin, overheadOverdue, marketingBreakdown, suggestedTransfers,
} from "@/lib/finance";
import { techPayroll, salesPayroll } from "@/lib/pay";
import { careKpis } from "@/lib/careClub";
import { money, pct, prettyDate, today, sum } from "@/lib/format";
import { toCSV, download } from "@/lib/csv";
import { Badge, BarList, Button, Card, Field, Input, Kpi, PageHeader, Section, Select, StatusPill, Table, Textarea, Col } from "@/components/ui";
import { Bars, ChartCard, Donut } from "@/components/charts";

type Tab = "Dashboard" | "Daily Expenses" | "Expense Breakdown" | "Overhead Calendar" | "Bank Buckets" | "Revenue" | "Payments" | "Payroll Costs" | "Weekly P&L" | "Monthly P&L" | "Settings";
const TABS: Tab[] = ["Dashboard", "Daily Expenses", "Expense Breakdown", "Overhead Calendar", "Bank Buckets", "Revenue", "Payments", "Payroll Costs", "Weekly P&L", "Monthly P&L", "Settings"];

export default function FinancePage() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>("Dashboard");

  // compute finance KPIs for an arbitrary date range + overhead
  function kpisFor(from: string, to: string, overhead: number) {
    const anyRange = !from && !to;
    const inR = (iso: string) => !!iso && (!from || iso >= from) && (!to || iso <= to);
    const jobs = s.jobs.filter((j) => anyRange || inR(j.dateCompleted));
    const leads = s.leads.filter((l) => anyRange || inR(l.bookedDate));
    const expenses = s.expenses.filter((e) => anyRange || inR(e.date));
    const marketing = s.marketing.filter((m) => anyRange || inR(m.date));
    const careCash = careKpis(s.careMembers, from, to).cashCollected;
    const input: FinanceInput = { jobs, leads, expenses, marketing, payRules: s.payRules, techBasePay: s.techBasePay, salesReps: s.salesReps, fs: s.financeSettings, careCash, overhead };
    return { k: financeKpis(input), jobs, leads, expenses, marketing };
  }

  return (
    <div>
      <PageHeader title="Finance" subtitle="Weekly & monthly financial report — revenue, expenses, payroll, P&L" />

      <div className="flex flex-wrap gap-1 mb-4 border-b border-line">
        {TABS.map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === tb ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>{tb}</button>
        ))}
      </div>

      {tab === "Dashboard" && <DashboardTab kpisFor={kpisFor} />}
      {tab === "Daily Expenses" && <ExpensesTab />}
      {tab === "Expense Breakdown" && <ExpenseBreakdownTab />}
      {tab === "Overhead Calendar" && <OverheadTab />}
      {tab === "Bank Buckets" && <BankBucketsTab kpisFor={kpisFor} />}
      {tab === "Revenue" && <RevenueTab />}
      {tab === "Payments" && <PaymentsTab />}
      {tab === "Payroll Costs" && <PayrollCostsTab />}
      {tab === "Weekly P&L" && <PnlTab mode="week" kpisFor={kpisFor} />}
      {tab === "Monthly P&L" && <PnlTab mode="month" kpisFor={kpisFor} />}
      {tab === "Settings" && <SettingsTab />}
    </div>
  );
}

type KpisFor = (from: string, to: string, overhead: number) => { k: ReturnType<typeof financeKpis>; jobs: import("@/lib/types").Job[]; leads: import("@/lib/types").Lead[]; expenses: Expense[]; marketing: import("@/lib/types").MarketingSpend[] };

/* ================= Dashboard ================= */
function DashboardTab({ kpisFor }: { kpisFor: KpisFor }) {
  const s = useStore();
  const { k, marketing } = useMemo(() => kpisFor(s.from, s.to, s.financeSettings.monthlyOverhead), [s.from, s.to, s.jobs, s.leads, s.expenses, s.marketing, s.careMembers, s.financeSettings]);
  const pay = useMemo(() => paymentBreakdown(s.jobs.filter((j) => (!s.from && !s.to) || s.inRange(j.dateCompleted)), s.financeSettings), [s.jobs, s.from, s.to, s.financeSettings]);
  const mkt = useMemo(() => marketingBreakdown(marketing, k.completedRevenue), [marketing, k.completedRevenue]);
  const estTax = Math.max(0, k.netProfit) * s.financeSettings.taxEstimatePct;

  return (
    <div>
      <Section title="Revenue">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <Kpi label="Booked Revenue" value={money(k.bookedRevenue)} tone="gold" />
          <Kpi label="Completed Revenue" value={money(k.completedRevenue)} tone="gold" />
          <Kpi label="Collected Revenue" value={money(k.collectedRevenue)} tone="gold" />
          <Kpi label="Amount Due" value={money(k.amountDue)} tone={k.amountDue > 0 ? "danger" : "good"} />
          <Kpi label="Revenue Gap" value={money(k.revenueGap)} tone={k.revenueGap > 0 ? "warn" : "good"} />
          <Kpi label="Care Club Revenue" value={money(k.careClubRevenue)} tone="gold" />
          <Kpi label="Job Revenue" value={money(k.jobRevenue)} tone="gold" />
          <Kpi label="Total Business Revenue" value={money(k.totalBusinessRevenue)} tone="gold" />
        </div>
      </Section>

      <Section title="Payments">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <Kpi label="Stripe Gross" value={money(k.stripeGross)} tone="gold" />
          <Kpi label="Stripe Fees" value={money(k.stripeFees)} tone="warn" />
          <Kpi label="Stripe Net" value={money(k.stripeNet)} tone="gold" />
          <Kpi label="Cash Revenue" value={money(k.cashRevenue)} tone="gold" />
          <Kpi label="Zelle Revenue" value={money(k.zelleRevenue)} tone="gold" />
          <Kpi label="Check Revenue" value={money(k.checkRevenue)} tone="gold" />
          <Kpi label="Card Revenue" value={money(k.cardRevenue)} tone="gold" />
          <Kpi label="Processing Fees" value={money(k.processingFees)} tone="warn" />
          <Kpi label="Refunds" value={money(k.refunds)} tone={k.refunds > 0 ? "danger" : "good"} />
          <Kpi label="Net Revenue" value={money(k.netRevenue)} tone="gold" />
        </div>
      </Section>

      <Section title="Payroll & Profit">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <Kpi label="Technician Payroll" value={money(k.techPayroll)} tone="warn" />
          <Kpi label="Sales Payroll" value={money(k.salesPayroll)} tone="warn" />
          <Kpi label="Total Payroll" value={money(k.totalPayroll)} tone="warn" />
          <Kpi label="Total Expenses" value={money(k.totalExpenses)} tone="warn" />
          <Kpi label="Overhead" value={money(k.overhead)} tone="warn" />
          <Kpi label="Estimated Tax" value={money(estTax)} tone="warn" sub={`${pct(s.financeSettings.taxEstimatePct, 0)} of net profit`} />
          <Kpi label="Net Profit" value={money(k.netProfit)} tone={k.netProfit >= 0 ? "good" : "danger"} />
          <Kpi label="Profit Margin" value={pct(k.profitMargin)} tone={k.netProfit >= 0 ? "good" : "danger"} sub={`Target ${pct(s.financeSettings.profitMarginTarget ?? 0.4, 0)}`} />
        </div>
      </Section>

      <Section title="Marketing">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <Kpi label="Marketing Spend Total" value={money(mkt.total)} tone="warn" />
          <Kpi label="Google Ads" value={money(mkt.googleAds)} tone="warn" />
          <Kpi label="Google LSA" value={money(mkt.googleLsa)} tone="warn" />
          <Kpi label="Meta" value={money(mkt.meta)} tone="warn" />
          <Kpi label="GBP / SEO" value={money(mkt.gbpSeo)} tone="warn" />
          <Kpi label="Marketing % of Revenue" value={pct(mkt.pctOfRevenue)} tone="gold" />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
        <ChartCard title="Payment Method Breakdown" height={240}><Donut data={pay.map((p) => ({ name: p.method, value: p.gross }))} /></ChartCard>
        <ChartCard title="Booked vs Collected"><Bars data={[{ name: "Booked", value: k.bookedRevenue }, { name: "Collected", value: k.collectedRevenue }, { name: "Due", value: k.amountDue }]} xKey="name" yKey="value" money color="#F5C542" /></ChartCard>
      </div>
    </div>
  );
}

/* ================= Weekly Expenses ================= */
const expBlank = (): Omit<Expense, "id"> => ({
  date: today(), weekStart: "", weekEnd: "", month: today().slice(0, 7), category: "Chemicals", reason: "", vendor: "", amount: 0,
  paymentMethod: "Card", bankBucket: "", accountLast4: "", receiptLink: "", notes: "", enteredBy: "", createdAt: today(), updatedAt: today(),
});
function ExpensesTab() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<Omit<Expense, "id">>(expBlank());
  const rows = useMemo(() => s.expenses.filter((e) => s.inRange(e.date)).sort((a, b) => b.date.localeCompare(a.date)), [s.expenses, s.from, s.to]);
  const total = sum(rows, (e) => e.amount);
  const set = (patch: Partial<Expense>) => setForm((f) => ({ ...f, ...patch }));
  function openNew() { setEditing(null); setForm(expBlank()); setOpen(true); }
  function openEdit(e: Expense) { setEditing(e); const { id, ...rest } = e; setForm(rest); setOpen(true); }
  function save() { const p = { ...form, month: form.month || (form.date || "").slice(0, 7), updatedAt: today() }; if (editing) s.updateExpense({ ...p, id: editing.id }); else s.addExpense(p); setOpen(false); }

  const cols: Col<Expense>[] = [
    { key: "date", label: "Date", render: (e) => <span className="text-muted">{prettyDate(e.date)}</span> },
    { key: "category", label: "Category" },
    { key: "reason", label: "Reason" },
    { key: "vendor", label: "Vendor" },
    { key: "amount", label: "Amount", render: (e) => <span className="tabular-nums text-gold">{money(e.amount)}</span> },
    { key: "paymentMethod", label: "Method" },
    { key: "bankBucket", label: "Bucket", render: (e) => e.bankBucket ? <Badge value={e.bankBucket} /> : <span className="text-muted">—</span> },
    { key: "accountLast4", label: "Acct" },
    { key: "receiptLink", label: "Receipt", render: (e) => e.receiptLink ? <a href={e.receiptLink} target="_blank" rel="noreferrer" className="text-accent hover:underline">open ↗</a> : <span className="text-muted">—</span> },
    { key: "_", label: "", render: (e) => (
      <div className="flex gap-1 justify-end">
        <Button variant="ghost" onClick={() => openEdit(e)}>Edit</Button>
        <Button variant="ghost" onClick={() => confirm("Delete expense?") && s.deleteExpense(e.id)}>✕</Button>
      </div>
    ) },
  ];

  return (
    <Section title={`Daily Expenses — ${money(total)} in range`} actions={
      <>
        <Button onClick={() => download(`expenses-${today()}.csv`, toCSV(rows as unknown as Record<string, unknown>[]))}>Export CSV</Button>
        <Button variant="accent" onClick={openNew}>+ Add Expense</Button>
      </>
    }>
      <Table cols={cols} rows={rows} empty="No expenses in range." />
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-surface border border-line rounded-2xl shadow-card w-full max-w-2xl my-8 p-5" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-3">{editing ? "Edit Expense" : "Add Expense"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Date"><Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value, month: (e.target.value || "").slice(0, 7) })} /></Field>
              <Field label="Month (auto)"><Input value={form.month || (form.date || "").slice(0, 7)} readOnly className="text-muted" /></Field>
              <Field label="Week Start"><Input type="date" value={form.weekStart} onChange={(e) => set({ weekStart: e.target.value })} /></Field>
              <Field label="Week End"><Input type="date" value={form.weekEnd} onChange={(e) => set({ weekEnd: e.target.value })} /></Field>
              <Field label="Category"><Select options={s.optionsFor("expenseCategories")} value={form.category} onChange={(e) => set({ category: e.target.value })} /></Field>
              <Field label="Reason"><Input value={form.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
              <Field label="Vendor"><Input value={form.vendor} onChange={(e) => set({ vendor: e.target.value })} /></Field>
              <Field label="Amount"><Input type="number" value={form.amount} onChange={(e) => set({ amount: +e.target.value })} /></Field>
              <Field label="Payment Method"><Select options={s.optionsFor("financePaymentMethods")} value={form.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })} /></Field>
              <Field label="Bank Bucket"><Select options={["", ...BANK_BUCKETS]} value={form.bankBucket || ""} onChange={(e) => set({ bankBucket: e.target.value })} /></Field>
              <Field label="Account / Last 4"><Input value={form.accountLast4} onChange={(e) => set({ accountLast4: e.target.value })} /></Field>
              <Field label="Receipt Link"><Input value={form.receiptLink} onChange={(e) => set({ receiptLink: e.target.value })} /></Field>
              <Field label="Entered By"><Input value={form.enteredBy} onChange={(e) => set({ enteredBy: e.target.value })} /></Field>
              <div className="sm:col-span-3"><Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="accent" onClick={save}>{editing ? "Save" : "Add Expense"}</Button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ================= Expense Breakdown ================= */
function ExpenseBreakdownTab() {
  const s = useStore();
  const rows = useMemo(() => s.expenses.filter((e) => s.inRange(e.date)), [s.expenses, s.from, s.to]);
  const total = sum(rows, (e) => e.amount);
  const byDay = useMemo(() => expensesByDay(rows).map((g) => ({ label: prettyDate(g.label), value: g.value })), [rows]);
  const byMonth = useMemo(() => expensesByMonth(rows), [rows]);
  const byCategory = useMemo(() => expensesByCategory(rows), [rows]);
  const byMethod = useMemo(() => expensesByMethod(rows), [rows]);
  const byBucket = useMemo(() => expensesByBucket(rows), [rows]);
  return (
    <Section title={`Expense Breakdown — ${money(total)} in range (${rows.length})`}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4"><h3 className="font-semibold text-ink mb-3">By Category</h3><BarList data={byCategory} money /></Card>
        <Card className="p-4"><h3 className="font-semibold text-ink mb-3">By Bank Bucket</h3><BarList data={byBucket} money /></Card>
        <Card className="p-4"><h3 className="font-semibold text-ink mb-3">By Payment Method</h3><BarList data={byMethod} money /></Card>
        <Card className="p-4"><h3 className="font-semibold text-ink mb-3">By Month</h3><BarList data={byMonth} money /></Card>
        <Card className="p-4 lg:col-span-2"><h3 className="font-semibold text-ink mb-3">By Day</h3><BarList data={byDay} money /></Card>
      </div>
    </Section>
  );
}

/* ================= Overhead Calendar ================= */
const ohBlank = (): Omit<Overhead, "id"> => ({
  name: "", category: "Software", vendor: "", amount: 0, paymentFrequency: "Monthly", dueDate: "", nextChargeDate: "",
  paymentMethod: "Card", bankBucket: "Overhead", autoAddToExpenses: false, activeStatus: true, notes: "", createdAt: today(), updatedAt: today(),
});
function OverheadTab() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Overhead | null>(null);
  const [form, setForm] = useState<Omit<Overhead, "id">>(ohBlank());
  const set = (patch: Partial<Overhead>) => setForm((f) => ({ ...f, ...patch }));
  const items = s.overhead;
  const t = today();
  const monthly = useMemo(() => overheadMonthlyTotal(items), [items]);
  const week = useMemo(() => overheadDueWithin(items, t, 7), [items, t]);
  const month = useMemo(() => overheadDueWithin(items, t, 30), [items, t]);
  const overdue = useMemo(() => overheadOverdue(items, t), [items, t]);

  function openNew() { setEditing(null); setForm(ohBlank()); setOpen(true); }
  function openEdit(o: Overhead) { setEditing(o); const { id, ...rest } = o; setForm(rest); setOpen(true); }
  function save() { const p = { ...form, updatedAt: today() }; if (editing) s.updateOverhead({ ...p, id: editing.id }); else s.addOverhead(p); setOpen(false); }

  const cols: Col<Overhead>[] = [
    { key: "name", label: "Name", render: (o) => <span className="text-ink font-medium">{o.name}</span> },
    { key: "category", label: "Category" },
    { key: "vendor", label: "Vendor" },
    { key: "amount", label: "Amount", render: (o) => <span className="tabular-nums text-gold">{money(o.amount)}</span> },
    { key: "paymentFrequency", label: "Frequency" },
    { key: "_m", label: "Monthly", render: (o) => <span className="tabular-nums text-muted">{money(overheadMonthlyAmount(o))}</span> },
    { key: "nextChargeDate", label: "Next Charge", render: (o) => o.nextChargeDate ? <span className={o.nextChargeDate < t ? "text-danger" : "text-muted"}>{prettyDate(o.nextChargeDate)}</span> : <span className="text-muted">—</span> },
    { key: "bankBucket", label: "Bucket", render: (o) => o.bankBucket ? <Badge value={o.bankBucket} /> : <span className="text-muted">—</span> },
    { key: "activeStatus", label: "Status", render: (o) => <StatusPill label={o.activeStatus === false ? "Inactive" : "Active"} tone={o.activeStatus === false ? "neutral" : "good"} /> },
    { key: "_", label: "", render: (o) => (
      <div className="flex gap-1 justify-end">
        <Button variant="ghost" onClick={() => openEdit(o)}>Edit</Button>
        <Button variant="ghost" onClick={() => confirm("Delete overhead item?") && s.deleteOverhead(o.id)}>✕</Button>
      </div>
    ) },
  ];

  const UpcomingList = ({ title, list, tone }: { title: string; list: Overhead[]; tone: "warn" | "danger" }) => (
    <Card className="p-4">
      <h3 className="font-semibold text-ink mb-3">{title} ({list.length}) — {money(sum(list, (o) => o.amount))}</h3>
      {list.length ? (
        <div className="divide-y divide-line/60">
          {list.map((o) => (
            <div key={o.id} className="flex justify-between py-2 text-sm">
              <span className="text-ink">{o.name} <span className="text-muted">· {o.vendor || o.category}</span></span>
              <span className="flex items-center gap-3">
                <span className={`tabular-nums ${tone === "danger" ? "text-danger" : "text-muted"}`}>{o.nextChargeDate ? prettyDate(o.nextChargeDate) : "—"}</span>
                <span className="tabular-nums text-gold">{money(o.amount)}</span>
              </span>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-muted">Nothing here.</p>}
    </Card>
  );

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Monthly Overhead" value={money(monthly)} tone="warn" sub="Normalized by frequency" />
        <Kpi label="Upcoming This Week" value={money(sum(week, (o) => o.amount))} tone="warn" sub={`${week.length} item(s) · 7d`} />
        <Kpi label="Upcoming This Month" value={money(sum(month, (o) => o.amount))} tone="warn" sub={`${month.length} item(s) · 30d`} />
        <Kpi label="Overdue" value={money(sum(overdue, (o) => o.amount))} tone={overdue.length ? "danger" : "good"} sub={`${overdue.length} item(s)`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <UpcomingList title="Upcoming (next 7 days)" list={week} tone="warn" />
        <UpcomingList title="Overdue" list={overdue} tone="danger" />
      </div>

      <Section title={`Overhead Items (${items.length})`} actions={<Button variant="accent" onClick={openNew}>+ Add Overhead</Button>}>
        <Table cols={cols} rows={items} empty="No overhead items yet." />
      </Section>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-surface border border-line rounded-2xl shadow-card w-full max-w-2xl my-8 p-5" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="font-semibold text-ink mb-3">{editing ? "Edit Overhead" : "Add Overhead"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Name"><Input value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
              <Field label="Category"><Select options={s.optionsFor("expenseCategories")} value={form.category} onChange={(e) => set({ category: e.target.value })} /></Field>
              <Field label="Vendor"><Input value={form.vendor} onChange={(e) => set({ vendor: e.target.value })} /></Field>
              <Field label="Amount"><Input type="number" value={form.amount} onChange={(e) => set({ amount: +e.target.value })} /></Field>
              <Field label="Payment Frequency"><Select options={PAYMENT_FREQUENCIES as unknown as string[]} value={form.paymentFrequency} onChange={(e) => set({ paymentFrequency: e.target.value as Overhead["paymentFrequency"] })} /></Field>
              <Field label="Payment Method"><Select options={s.optionsFor("financePaymentMethods")} value={form.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })} /></Field>
              <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></Field>
              <Field label="Next Charge Date"><Input type="date" value={form.nextChargeDate} onChange={(e) => set({ nextChargeDate: e.target.value })} /></Field>
              <Field label="Bank Bucket"><Select options={["", ...BANK_BUCKETS]} value={form.bankBucket} onChange={(e) => set({ bankBucket: e.target.value })} /></Field>
              <Field label="Auto-add to Expenses"><Select options={["No", "Yes"]} value={form.autoAddToExpenses ? "Yes" : "No"} onChange={(e) => set({ autoAddToExpenses: e.target.value === "Yes" })} /></Field>
              <Field label="Active"><Select options={["Active", "Inactive"]} value={form.activeStatus === false ? "Inactive" : "Active"} onChange={(e) => set({ activeStatus: e.target.value === "Active" })} /></Field>
              <div className="sm:col-span-3"><Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="accent" onClick={save}>{editing ? "Save" : "Add Overhead"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Bank Buckets ================= */
function BankBucketsTab({ kpisFor }: { kpisFor: KpisFor }) {
  const s = useStore();
  const { k, expenses } = useMemo(() => kpisFor(s.from, s.to, s.financeSettings.monthlyOverhead), [s.from, s.to, s.jobs, s.leads, s.expenses, s.marketing, s.careMembers, s.financeSettings]);
  const byBucket = useMemo(() => expensesByBucket(expenses), [expenses]);
  const byCat = useMemo(() => expenseRollup(expenses), [expenses]);
  const plan = useMemo(() => suggestedTransfers(k, s.financeSettings, byCat), [k, s.financeSettings, byCat]);
  const bucketTotal = sum(byBucket, (b) => b.value);
  const transfers: { label: string; value: number; note: string }[] = [
    { label: "Payroll", value: plan.payroll, note: "Total payroll due" },
    { label: "Taxes", value: plan.taxes, note: `${pct(s.financeSettings.taxEstimatePct, 0)} of net profit` },
    { label: "Profit", value: plan.profit, note: `${pct(s.financeSettings.profitMarginTarget ?? 0.4, 0)} of net revenue` },
    { label: "Overhead", value: plan.overhead, note: "Prorated overhead" },
    { label: "Marketing", value: plan.marketing, note: "Marketing spend" },
    { label: "Gas", value: plan.gas, note: "Gas expenses" },
    { label: "Tools", value: plan.tools, note: "Tools & chemicals" },
  ];
  const planTotal = sum(transfers, (t) => t.value);
  return (
    <div>
      <Section title={`Expenses by Bank Bucket — ${money(bucketTotal)} in range`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4"><BarList data={byBucket} money /></Card>
          <Card className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">{["Bucket", "Amount", "% of Total"].map((h) => <th key={h} className="text-left font-medium px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {byBucket.map((b) => (
                  <tr key={b.label} className="border-b border-line/60">
                    <td className="px-3 py-2 text-ink">{b.label}</td>
                    <td className="px-3 py-2 tabular-nums text-gold">{money(b.value)}</td>
                    <td className="px-3 py-2 tabular-nums text-muted">{bucketTotal ? pct(b.value / bucketTotal) : "—"}</td>
                  </tr>
                ))}
                {!byBucket.length && <tr><td colSpan={3} className="px-3 py-8 text-center text-muted">No expenses in range.</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
      </Section>

      <Section title={`Suggested Weekly Transfers — ${money(planTotal)}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {transfers.map((t) => (
            <Kpi key={t.label} label={t.label} value={money(t.value)} tone="gold" sub={t.note} />
          ))}
        </div>
        <p className="text-xs text-muted mt-3">Move these amounts into each bank bucket to fully fund payroll, taxes, profit, overhead, marketing, gas, and tools for the selected range.</p>
      </Section>
    </div>
  );
}

/* ================= Revenue Report ================= */
function RevenueTab() {
  const s = useStore();
  const fs = s.financeSettings;
  const rows = useMemo(() => s.jobs.filter((j) => (!s.from && !s.to) || s.inRange(j.dateCompleted)).sort((a, b) => (b.dateCompleted || "").localeCompare(a.dateCompleted || "")), [s.jobs, s.from, s.to]);
  const exportRows = rows.map((j) => ({
    Date: j.dateCompleted, Customer: j.customerName, "Lead ID": j.leadId, "Urable Job ID": j.urableJobId, Service: j.services, "Job Status": j.jobStatus,
    "Completed Revenue": j.totalRevenue, "Amount Paid": j.amountPaid, "Amount Due": j.amountDue, "Payment Method": j.paymentMethod,
    "Processing Fee": jobProcessingFee(j, fs).toFixed(2), "Net Received": jobNetReceived(j, fs).toFixed(2), "Confirmed Source": j.confirmedSource, "Sales Rep": j.assignedSalesRep,
  }));
  const heads = ["Date", "Customer", "Lead ID", "Urable ID", "Service", "Status", "Completed Rev", "Paid", "Due", "Method", "Fee", "Net", "Source", "Rep", "Links"];
  return (
    <Section title={`Revenue Report (${rows.length})`} actions={<Button onClick={() => download(`revenue-report-${today()}.csv`, toCSV(exportRows as unknown as Record<string, unknown>[]))}>Export CSV</Button>}>
      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">{heads.map((h) => <th key={h} className="text-left font-medium px-2 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id} className="border-b border-line/60">
                <td className="px-2 py-2 text-muted whitespace-nowrap">{prettyDate(j.dateCompleted)}</td>
                <td className="px-2 py-2 text-ink">{j.customerName}</td>
                <td className="px-2 py-2 font-mono text-xs text-accent">{j.leadId || "—"}</td>
                <td className="px-2 py-2 font-mono text-xs">{j.urableJobId || "—"}</td>
                <td className="px-2 py-2">{j.services}</td>
                <td className="px-2 py-2"><Badge value={j.jobStatus} /></td>
                <td className="px-2 py-2 tabular-nums text-gold">{money(j.totalRevenue)}</td>
                <td className="px-2 py-2 tabular-nums text-good">{money(j.amountPaid)}</td>
                <td className={`px-2 py-2 tabular-nums ${j.amountDue > 0 ? "text-danger" : "text-muted"}`}>{money(j.amountDue)}</td>
                <td className="px-2 py-2">{j.paymentMethod}</td>
                <td className="px-2 py-2 tabular-nums text-muted">{money(jobProcessingFee(j, fs))}</td>
                <td className="px-2 py-2 tabular-nums">{money(jobNetReceived(j, fs))}</td>
                <td className="px-2 py-2">{j.confirmedSource || "—"}</td>
                <td className="px-2 py-2">{j.assignedSalesRep || "—"}</td>
                <td className="px-2 py-2 text-xs whitespace-nowrap">
                  {j.urableJobLink && <a href={j.urableJobLink} target="_blank" rel="noreferrer" className="text-accent hover:underline">Urable</a>}
                  {j.urableJobLink && j.ghlContactLink && " · "}
                  {j.ghlContactLink && <a href={j.ghlContactLink} target="_blank" rel="noreferrer" className="text-accent hover:underline">GHL</a>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={heads.length} className="px-3 py-8 text-center text-muted">No jobs in range.</td></tr>}
          </tbody>
        </table>
      </Card>
    </Section>
  );
}

/* ================= Payment Method Breakdown ================= */
function PaymentsTab() {
  const s = useStore();
  const rows = useMemo(() => paymentBreakdown(s.jobs.filter((j) => (!s.from && !s.to) || s.inRange(j.dateCompleted)), s.financeSettings), [s.jobs, s.from, s.to, s.financeSettings]);
  const heads = ["Payment Method", "Gross Collected", "Processing Fees", "Net Collected", "Payments", "Average Payment", "Amount Due"];
  return (
    <Section title="Payment Method Breakdown" actions={<Button onClick={() => download(`payments-${today()}.csv`, toCSV(rows as unknown as Record<string, unknown>[]))}>Export CSV</Button>}>
      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">{heads.map((h) => <th key={h} className="text-left font-medium px-3 py-2.5">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.method} className="border-b border-line/60">
                <td className="px-3 py-2 font-medium text-ink">{r.method}</td>
                <td className="px-3 py-2 tabular-nums text-gold">{money(r.gross)}</td>
                <td className="px-3 py-2 tabular-nums text-muted">{money(r.fees)}</td>
                <td className="px-3 py-2 tabular-nums text-good">{money(r.net)}</td>
                <td className="px-3 py-2 tabular-nums">{r.count}</td>
                <td className="px-3 py-2 tabular-nums">{money(r.avg)}</td>
                <td className={`px-3 py-2 tabular-nums ${r.due > 0 ? "text-danger" : "text-muted"}`}>{money(r.due)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={heads.length} className="px-3 py-8 text-center text-muted">No payments in range.</td></tr>}
          </tbody>
        </table>
      </Card>
    </Section>
  );
}

/* ================= Payroll Costs ================= */
function PayrollCostsTab() {
  const s = useStore();
  const jobs = useMemo(() => s.jobs.filter((j) => (!s.from && !s.to) || s.inRange(j.dateCompleted)), [s.jobs, s.from, s.to]);
  const tech = useMemo(() => techPayroll(jobs, s.payRules, s.techBasePay), [jobs, s.payRules, s.techBasePay]);
  const sales = useMemo(() => salesPayroll(jobs, s.salesReps, s.payRules), [jobs, s.salesReps, s.payRules]);
  const due = sum(tech, (t) => t.total) + sum(sales, (r) => r.total);
  const paid = sum(s.payrollPayments.filter((p) => s.inRange(p.paidDate)), (p) => p.amountPaid);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Technician Payroll Due" value={money(sum(tech, (t) => t.total))} tone="warn" />
        <Kpi label="Sales Payroll Due" value={money(sum(sales, (r) => r.total))} tone="warn" />
        <Kpi label="Payroll Paid (range)" value={money(paid)} tone="gold" />
        <Kpi label="Payroll Variance" value={money(due - paid)} tone={due - paid > 0 ? "danger" : "good"} sub="Due − Paid" />
      </div>

      <Section title="Technician Payroll (Due)">
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">{["Technician", "Jobs", "Commission", "Upsell", "Tips", "Base Pay", "Total Due"].map((h) => <th key={h} className="text-left font-medium px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {tech.map((t) => (
                <tr key={t.tech} className="border-b border-line/60">
                  <td className="px-3 py-2 text-ink">{t.tech}</td>
                  <td className="px-3 py-2 tabular-nums">{t.jobs}</td>
                  <td className="px-3 py-2 tabular-nums">{money(t.commission)}</td>
                  <td className="px-3 py-2 tabular-nums">{money(t.upsell)}</td>
                  <td className="px-3 py-2 tabular-nums">{money(t.tips)}</td>
                  <td className="px-3 py-2 tabular-nums">{money(t.basePay)}</td>
                  <td className="px-3 py-2 tabular-nums text-gold font-semibold">{money(t.total)}</td>
                </tr>
              ))}
              {!tech.length && <tr><td colSpan={7} className="px-3 py-4 text-center text-muted">No technician payroll in range.</td></tr>}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Sales Payroll (Due)">
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">{["Sales Rep", "Paid Jobs", "Commissionable", "Commission", "Base", "Total Due"].map((h) => <th key={h} className="text-left font-medium px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {sales.map((r) => (
                <tr key={r.rep} className="border-b border-line/60">
                  <td className="px-3 py-2 text-ink">{r.rep}</td>
                  <td className="px-3 py-2 tabular-nums">{r.paidJobs}</td>
                  <td className="px-3 py-2 tabular-nums text-muted">{money(r.commissionable)}</td>
                  <td className="px-3 py-2 tabular-nums">{money(r.commission)}</td>
                  <td className="px-3 py-2 tabular-nums">{money(r.base)}</td>
                  <td className="px-3 py-2 tabular-nums text-gold font-semibold">{money(r.total)}</td>
                </tr>
              ))}
              {!sales.length && <tr><td colSpan={6} className="px-3 py-4 text-center text-muted">No sales payroll in range.</td></tr>}
            </tbody>
          </table>
        </Card>
      </Section>

      <PayrollPaymentsLog />
    </div>
  );
}

const ppBlank = (): Omit<PayrollPayment, "id"> => ({
  periodStart: "", periodEnd: "", type: "Technician", name: "", totalPay: 0, amountPaid: 0, paymentMethod: "Zelle",
  checkNumber: "", zelleReference: "", paidDate: today(), payStatus: "Paid", notes: "",
});
function PayrollPaymentsLog() {
  const s = useStore();
  const [form, setForm] = useState<Omit<PayrollPayment, "id">>(ppBlank());
  const [adding, setAdding] = useState(false);
  const set = (patch: Partial<PayrollPayment>) => setForm((f) => ({ ...f, ...patch }));
  function add() { s.addPayrollPayment(form); setForm(ppBlank()); setAdding(false); }
  const rows = s.payrollPayments;
  return (
    <Section title={`Payroll Payments Log (${rows.length})`} actions={<Button variant="accent" onClick={() => setAdding((a) => !a)}>{adding ? "Close" : "+ Record Payment"}</Button>}>
      {adding && (
        <Card className="p-3 mb-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
          <Field label="Type"><Select options={["Technician", "Sales"]} value={form.type} onChange={(e) => set({ type: e.target.value as PayrollPayment["type"] })} /></Field>
          <Field label="Name"><Select options={["", ...(form.type === "Technician" ? s.technicians : s.salesReps)]} value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Period Start"><Input type="date" value={form.periodStart} onChange={(e) => set({ periodStart: e.target.value })} /></Field>
          <Field label="Period End"><Input type="date" value={form.periodEnd} onChange={(e) => set({ periodEnd: e.target.value })} /></Field>
          <Field label="Total Pay"><Input type="number" value={form.totalPay} onChange={(e) => set({ totalPay: +e.target.value })} /></Field>
          <Field label="Amount Paid"><Input type="number" value={form.amountPaid} onChange={(e) => set({ amountPaid: +e.target.value })} /></Field>
          <Field label="Method"><Select options={s.optionsFor("financePaymentMethods")} value={form.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })} /></Field>
          <Field label="Paid Date"><Input type="date" value={form.paidDate} onChange={(e) => set({ paidDate: e.target.value })} /></Field>
          <Field label="Check #"><Input value={form.checkNumber} onChange={(e) => set({ checkNumber: e.target.value })} /></Field>
          <Field label="Zelle Ref"><Input value={form.zelleReference} onChange={(e) => set({ zelleReference: e.target.value })} /></Field>
          <Field label="Pay Status"><Select options={["Paid", "Partial", "Pending"]} value={form.payStatus} onChange={(e) => set({ payStatus: e.target.value })} /></Field>
          <div className="flex items-end"><Button variant="accent" onClick={add}>Save</Button></div>
        </Card>
      )}
      <Card className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b border-line text-xs uppercase tracking-wide text-muted">{["Type", "Name", "Period", "Total", "Paid", "Method", "Check/Zelle", "Paid Date", "Status", ""].map((h) => <th key={h} className="text-left font-medium px-2 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-line/60">
                <td className="px-2 py-2">{p.type}</td>
                <td className="px-2 py-2 text-ink">{p.name}</td>
                <td className="px-2 py-2 text-muted text-xs">{prettyDate(p.periodStart)}–{prettyDate(p.periodEnd)}</td>
                <td className="px-2 py-2 tabular-nums">{money(p.totalPay)}</td>
                <td className="px-2 py-2 tabular-nums text-good">{money(p.amountPaid)}</td>
                <td className="px-2 py-2">{p.paymentMethod}</td>
                <td className="px-2 py-2 text-xs">{p.checkNumber || p.zelleReference || "—"}</td>
                <td className="px-2 py-2 text-muted">{prettyDate(p.paidDate)}</td>
                <td className="px-2 py-2"><Badge value={p.payStatus} /></td>
                <td className="px-2 py-2 text-right"><Button variant="ghost" onClick={() => s.deletePayrollPayment(p.id)}>✕</Button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={10} className="px-3 py-4 text-center text-muted">No payroll payments recorded.</td></tr>}
          </tbody>
        </table>
      </Card>
    </Section>
  );
}

/* ================= Weekly / Monthly P&L ================= */
function PnlTab({ mode, kpisFor }: { mode: "week" | "month"; kpisFor: KpisFor }) {
  const s = useStore();
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [month, setMonth] = useState("");

  const range = mode === "week" ? { from: weekStart, to: weekEnd } : { from: month ? `${month}-01` : "", to: month ? `${month}-31` : "" };
  const overhead = mode === "week" ? s.financeSettings.monthlyOverhead / 4.33 : s.financeSettings.monthlyOverhead;
  const { k } = kpisFor(range.from, range.to, overhead);

  // monthly extras
  const tax = k.netProfit > 0 ? k.netProfit * s.financeSettings.taxEstimatePct : 0;
  const finalNet = k.netProfit - tax;
  const prevMonth = month ? isoPrevMonth(month) : "";
  const prevK = mode === "month" && prevMonth ? kpisFor(`${prevMonth}-01`, `${prevMonth}-31`, s.financeSettings.monthlyOverhead).k : null;
  const growth = prevK && prevK.totalBusinessRevenue ? (k.totalBusinessRevenue - prevK.totalBusinessRevenue) / prevK.totalBusinessRevenue : 0;
  const expensePct = k.netRevenue ? (k.totalExpenses / k.netRevenue) : 0;
  const avgTicketDenom = kpisFor(range.from, range.to, 0).jobs.filter((j) => j.jobStatus === "Completed").length;

  const Row = ({ label, value, tone = "" }: { label: string; value: string; tone?: string }) => (
    <div className="flex justify-between px-3 py-2 border-b border-line/60">
      <span className="text-sm text-muted">{label}</span><span className={`text-sm tabular-nums font-medium ${tone}`}>{value}</span>
    </div>
  );

  return (
    <Section title={mode === "week" ? "Weekly P&L" : "Monthly P&L"}>
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          {mode === "week" ? (
            <>
              <Field label="Week Start"><Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} /></Field>
              <Field label="Week End"><Input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} /></Field>
            </>
          ) : (
            <Field label="Month"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
          )}
        </div>
      </Card>

      <div className="max-w-xl">
        <Card>
          {mode === "week" ? (
            <>
              <Row label="Booked Revenue" value={money(k.bookedRevenue)} />
              <Row label="Completed Revenue" value={money(k.completedRevenue)} />
              <Row label="Collected Revenue" value={money(k.collectedRevenue)} />
              <Row label="Stripe / Processing Fees" value={`- ${money(k.processingFees)}`} tone="text-gold" />
              <Row label="Refunds" value={`- ${money(k.refunds)}`} tone="text-gold" />
              <Row label="Net Revenue" value={money(k.netRevenue)} tone="text-ink" />
              <Row label="Technician Payroll" value={`- ${money(k.techPayroll)}`} tone="text-gold" />
              <Row label="Sales Payroll" value={`- ${money(k.salesPayroll)}`} tone="text-gold" />
              <Row label="Total Payroll" value={`- ${money(k.totalPayroll)}`} tone="text-gold" />
              <Row label="Expenses" value={`- ${money(k.totalExpenses)}`} tone="text-gold" />
              <Row label="Overhead (prorated)" value={`- ${money(k.overhead)}`} tone="text-gold" />
              <Row label="Net Profit" value={money(k.netProfit)} tone={k.netProfit >= 0 ? "text-good" : "text-danger"} />
              <Row label="Profit Margin" value={pct(k.profitMargin)} tone={k.netProfit >= 0 ? "text-good" : "text-danger"} />
              <Row label="Amount Due" value={money(k.amountDue)} tone="text-danger" />
            </>
          ) : (
            <>
              <Row label="Total Business Revenue" value={money(k.totalBusinessRevenue)} tone="text-gold" />
              <Row label="Job Revenue" value={money(k.jobRevenue)} />
              <Row label="Care Club Revenue" value={money(k.careClubRevenue)} />
              <Row label="Cost of Goods Sold" value={`- ${money(k.cogs)}`} tone="text-gold" />
              <Row label="Technician Payroll" value={`- ${money(k.techPayroll)}`} tone="text-gold" />
              <Row label="Sales Payroll" value={`- ${money(k.salesPayroll)}`} tone="text-gold" />
              <Row label="Marketing Expenses" value={`- ${money(k.marketingCost)}`} tone="text-gold" />
              <Row label="Software Expenses" value={`- ${money(k.softwareExpenses)}`} tone="text-gold" />
              <Row label="Vehicle Expenses" value={`- ${money(k.vehicleExpenses)}`} tone="text-gold" />
              <Row label="Operating Expenses" value={`- ${money(k.operatingExpenses)}`} tone="text-gold" />
              <Row label="Overhead" value={`- ${money(k.overhead)}`} tone="text-gold" />
              <Row label="Net Profit Before Tax" value={money(k.netProfit)} tone={k.netProfit >= 0 ? "text-good" : "text-danger"} />
              <Row label={`Estimated Tax (${pct(s.financeSettings.taxEstimatePct, 0)})`} value={`- ${money(tax)}`} tone="text-gold" />
              <Row label="Final Net Profit" value={money(finalNet)} tone={finalNet >= 0 ? "text-good" : "text-danger"} />
              <Row label="Profit Margin" value={pct(k.profitMargin)} />
              <Row label="Expense %" value={pct(expensePct)} />
              <Row label="Average Ticket" value={money(avgTicketDenom ? k.completedRevenue / avgTicketDenom : 0)} />
              <Row label="Revenue Growth vs Last Month" value={prevK ? pct(growth) : "—"} tone={growth >= 0 ? "text-good" : "text-danger"} />
            </>
          )}
        </Card>
      </div>
    </Section>
  );
}
function isoPrevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1; const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

/* ================= Finance Settings ================= */
function SettingsTab() {
  const s = useStore();
  const [d, setD] = useState<FinanceSettings & { feePctWhole: number; taxPctWhole: number; profitPctWhole: number }>({
    ...s.financeSettings, feePctWhole: Math.round(s.financeSettings.stripeFeePct * 1000) / 10, taxPctWhole: Math.round(s.financeSettings.taxEstimatePct * 100),
    profitPctWhole: Math.round((s.financeSettings.profitMarginTarget ?? 0.4) * 100),
  });
  const [saved, setSaved] = useState(false);
  function save() {
    s.setFinanceSettings({ ...s.financeSettings, stripeFeePct: d.feePctWhole / 100, stripeFixedFee: d.stripeFixedFee, taxEstimatePct: d.taxPctWhole / 100, monthlyOverhead: d.monthlyOverhead, defaultLast4: d.defaultLast4, profitMarginTarget: d.profitPctWhole / 100 });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  }
  return (
    <Section title="Finance Settings">
      <Card className="p-4 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Default Stripe Fee %"><Input type="number" step="0.1" value={d.feePctWhole} onChange={(e) => setD({ ...d, feePctWhole: +e.target.value })} /></Field>
          <Field label="Default Stripe Fixed Fee ($)"><Input type="number" step="0.01" value={d.stripeFixedFee} onChange={(e) => setD({ ...d, stripeFixedFee: +e.target.value })} /></Field>
          <Field label="Tax Estimate %"><Input type="number" value={d.taxPctWhole} onChange={(e) => setD({ ...d, taxPctWhole: +e.target.value })} /></Field>
          <Field label="Profit Margin Target %"><Input type="number" value={d.profitPctWhole} onChange={(e) => setD({ ...d, profitPctWhole: +e.target.value })} /></Field>
          <Field label="Monthly Overhead ($)"><Input type="number" value={d.monthlyOverhead} onChange={(e) => setD({ ...d, monthlyOverhead: +e.target.value })} /></Field>
          <Field label="Default Account Last 4"><Input value={d.defaultLast4} onChange={(e) => setD({ ...d, defaultLast4: e.target.value })} /></Field>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <Button variant="accent" onClick={save}>Save Finance Settings</Button>
          {saved && <span className="text-sm text-good">✓ Saved.</span>}
        </div>
        <p className="text-xs text-muted mt-3">Stripe fee is used when a job has no manual processing fee: <b>amount paid × fee% + fixed fee</b>. Expense categories &amp; payment methods are managed in code/Settings dropdowns.</p>
      </Card>
    </Section>
  );
}
