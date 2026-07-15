import { Job, Lead, Expense, FinanceSettings, PayRules, TechBasePayRule, MarketingSpend, Overhead, EXPENSE_CATEGORIES } from "./types";
import { completed } from "./metrics";
import { techPayroll, salesPayroll } from "./pay";
import { sum, safeDiv } from "./format";

export const MARKETING_CATS = ["Marketing - Meta", "Marketing - Google Ads", "Marketing - Google LSA"];
export const COGS_CATS = ["Chemicals", "Tools & Supplies", "Gas"];
export const SOFTWARE_CATS = ["Software"];
export const VEHICLE_CATS = ["Vehicle Payment", "Vehicle Insurance"];
export const FINANCE_METHODS = ["Stripe", "Card", "Cash", "Zelle", "Check", "Bank Transfer", "Other"];

/** Processing fee for a job — manual if set, else Stripe/Card estimate from settings. */
export function jobProcessingFee(j: Job, fs: FinanceSettings): number {
  if ((j.processingFee || 0) > 0) return j.processingFee;
  if ((j.paymentMethod === "Stripe" || j.paymentMethod === "Card") && (j.amountPaid || 0) > 0) {
    return j.amountPaid * fs.stripeFeePct + fs.stripeFixedFee;
  }
  return 0;
}
export function jobNetReceived(j: Job, fs: FinanceSettings): number {
  if ((j.netReceived || 0) > 0) return j.netReceived;
  return (j.amountPaid || 0) - jobProcessingFee(j, fs) - (j.refundAmount || 0);
}

/* ---------------- payment method breakdown ---------------- */
export interface PayRow {
  method: string; gross: number; fees: number; net: number; count: number; avg: number; due: number;
}
export function paymentBreakdown(jobs: Job[], fs: FinanceSettings): PayRow[] {
  return FINANCE_METHODS.map((method) => {
    const paid = jobs.filter((j) => (j.paymentMethod || "Other") === method && (j.amountPaid || 0) > 0);
    const gross = sum(paid, (j) => j.amountPaid);
    const fees = sum(paid, (j) => jobProcessingFee(j, fs));
    const due = sum(jobs.filter((j) => (j.paymentMethod || "Other") === method), (j) => j.amountDue);
    return { method, gross, fees, net: gross - fees, count: paid.length, avg: safeDiv(gross, paid.length), due };
  }).filter((r) => r.gross > 0 || r.due > 0 || r.count > 0);
}

/* ---------------- expense rollups ---------------- */
export function expenseRollup(expenses: Expense[]): Record<string, number> {
  const byCat: Record<string, number> = {};
  EXPENSE_CATEGORIES.forEach((c) => { byCat[c] = 0; });
  expenses.forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + (e.amount || 0); });
  return byCat;
}
const sumCats = (byCat: Record<string, number>, cats: string[]) => cats.reduce((a, c) => a + (byCat[c] || 0), 0);

/* ---------------- bank buckets, grouping, marketing & overhead (v2) ---------------- */
export interface Group { label: string; value: number }
const group = (rows: Expense[], key: (e: Expense) => string): Group[] => {
  const g: Record<string, number> = {};
  rows.forEach((e) => { const k = key(e) || "Unassigned"; g[k] = (g[k] || 0) + (e.amount || 0); });
  return Object.entries(g).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};
export const expensesByBucket = (expenses: Expense[]) => group(expenses, (e) => e.bankBucket || "");
export const expensesByMethod = (expenses: Expense[]) => group(expenses, (e) => e.paymentMethod || "");
export const expensesByCategory = (expenses: Expense[]) => group(expenses, (e) => e.category || "");
export const expensesByDay = (expenses: Expense[]) => group(expenses, (e) => e.date || "");
export const expensesByMonth = (expenses: Expense[]) => group(expenses, (e) => e.month || (e.date || "").slice(0, 7));

/** Normalize a recurring overhead item to a monthly amount. */
export function overheadMonthlyAmount(o: Overhead): number {
  const a = o.amount || 0;
  switch (o.paymentFrequency) {
    case "Weekly": return a * 4.3333;
    case "Biweekly": return a * 2.1667;
    case "Monthly": return a;
    case "Quarterly": return a / 3;
    case "Yearly": return a / 12;
    case "One-Time": return 0;
    default: return a;
  }
}
export const overheadMonthlyTotal = (items: Overhead[]) =>
  sum(items.filter((o) => o.activeStatus !== false), overheadMonthlyAmount);
export const overheadDueWithin = (items: Overhead[], todayStr: string, days: number) => {
  const end = new Date(new Date(todayStr + "T00:00:00").getTime() + days * 86400000).toISOString().slice(0, 10);
  return items.filter((o) => o.activeStatus !== false && o.nextChargeDate && o.nextChargeDate >= todayStr && o.nextChargeDate <= end);
};
export const overheadOverdue = (items: Overhead[], todayStr: string) =>
  items.filter((o) => o.activeStatus !== false && o.nextChargeDate && o.nextChargeDate < todayStr);

/** Marketing spend split by channel family + share of revenue. */
export interface MarketingBreakdown { total: number; googleAds: number; googleLsa: number; meta: number; gbpSeo: number; other: number; pctOfRevenue: number }
export function marketingBreakdown(marketing: MarketingSpend[], completedRevenue: number): MarketingBreakdown {
  const spendWhere = (fn: (c: string) => boolean) => sum(marketing.filter((m) => fn((m.channel || "").toLowerCase())), (m) => m.spend);
  const googleAds = spendWhere((c) => c.includes("google ads") || c === "adwords");
  const googleLsa = spendWhere((c) => c.includes("lsa") || c.includes("local service"));
  const meta = spendWhere((c) => c.includes("meta") || c.includes("facebook") || c.includes("instagram"));
  const gbpSeo = spendWhere((c) => c.includes("business profile") || c.includes("gbp") || c.includes("seo") || c.includes("organic"));
  const total = sum(marketing, (m) => m.spend);
  return { total, googleAds, googleLsa, meta, gbpSeo, other: Math.max(0, total - googleAds - googleLsa - meta - gbpSeo), pctOfRevenue: safeDiv(total, completedRevenue) };
}

/** Suggested weekly bank-bucket transfers derived from finance KPIs. */
export interface BucketPlan { payroll: number; taxes: number; profit: number; overhead: number; marketing: number; gas: number; tools: number }
export function suggestedTransfers(k: FinanceKpis, fs: FinanceSettings, byCat: Record<string, number>): BucketPlan {
  const taxes = Math.max(0, k.netProfit) * (fs.taxEstimatePct || 0);
  const profit = Math.max(0, k.netRevenue) * (fs.profitMarginTarget ?? 0.4);
  return {
    payroll: k.totalPayroll, taxes, profit, overhead: k.overhead, marketing: k.marketingCost,
    gas: byCat["Gas"] || 0, tools: (byCat["Tools & Supplies"] || 0) + (byCat["Chemicals"] || 0),
  };
}

/* ---------------- finance KPIs ---------------- */
export interface FinanceKpis {
  bookedRevenue: number; completedRevenue: number; collectedRevenue: number; amountDue: number; revenueGap: number;
  stripeGross: number; stripeFees: number; stripeNet: number; cashRevenue: number; zelleRevenue: number; checkRevenue: number; cardRevenue: number;
  processingFees: number; refunds: number; netRevenue: number;
  techPayroll: number; salesPayroll: number; totalPayroll: number; totalExpenses: number; marketingCost: number; overhead: number;
  grossProfitBeforeExpenses: number; netProfit: number; profitMargin: number;
  jobRevenue: number; careClubRevenue: number; totalBusinessRevenue: number;
  // category rollups (for monthly P&L)
  cogs: number; softwareExpenses: number; vehicleExpenses: number; operatingExpenses: number;
}

export interface FinanceInput {
  jobs: Job[]; leads: Lead[]; expenses: Expense[]; marketing: MarketingSpend[];
  payRules: PayRules; techBasePay: TechBasePayRule[]; salesReps: string[]; fs: FinanceSettings;
  careCash: number; overhead: number;
}

export function financeKpis(o: FinanceInput): FinanceKpis {
  const { jobs, leads, expenses, marketing, payRules, techBasePay, salesReps, fs, careCash, overhead } = o;
  const comp = completed(jobs);
  const byMethod = (m: string) => sum(jobs.filter((j) => j.paymentMethod === m), (j) => j.amountPaid);

  const collectedRevenue = sum(jobs, (j) => j.amountPaid);
  const completedRevenue = sum(comp, (j) => j.totalRevenue);
  const bookedRevenue = sum(leads, (l) => l.bookedJobValue);
  const amountDue = sum(jobs, (j) => j.amountDue);
  const stripeGross = byMethod("Stripe");
  const stripeFees = sum(jobs.filter((j) => j.paymentMethod === "Stripe"), (j) => jobProcessingFee(j, fs));
  const processingFees = sum(jobs, (j) => jobProcessingFee(j, fs));
  const refunds = sum(jobs, (j) => j.refundAmount || 0);
  const netRevenue = collectedRevenue - processingFees - refunds;

  const tech = sum(techPayroll(jobs, payRules, techBasePay), (r) => r.total);
  const sales = sum(salesPayroll(jobs, salesReps, payRules), (r) => r.total);
  const totalPayroll = tech + sales;

  const byCat = expenseRollup(expenses);
  const marketingCost = sum(marketing, (m) => m.spend);
  const cogs = sumCats(byCat, COGS_CATS);
  const softwareExpenses = sumCats(byCat, SOFTWARE_CATS);
  const vehicleExpenses = sumCats(byCat, VEHICLE_CATS);
  const nonMarketingExpenses = sum(expenses.filter((e) => !MARKETING_CATS.includes(e.category)), (e) => e.amount);
  const operatingExpenses = nonMarketingExpenses - cogs - softwareExpenses - vehicleExpenses;
  const totalExpenses = nonMarketingExpenses + marketingCost;

  const grossProfitBeforeExpenses = netRevenue - totalPayroll;
  const netProfit = netRevenue - totalPayroll - totalExpenses - overhead;

  return {
    bookedRevenue, completedRevenue, collectedRevenue, amountDue, revenueGap: bookedRevenue - collectedRevenue,
    stripeGross, stripeFees, stripeNet: stripeGross - stripeFees,
    cashRevenue: byMethod("Cash"), zelleRevenue: byMethod("Zelle"), checkRevenue: byMethod("Check"), cardRevenue: byMethod("Card"),
    processingFees, refunds, netRevenue,
    techPayroll: tech, salesPayroll: sales, totalPayroll, totalExpenses, marketingCost, overhead,
    grossProfitBeforeExpenses, netProfit, profitMargin: safeDiv(netProfit, netRevenue),
    jobRevenue: completedRevenue, careClubRevenue: careCash, totalBusinessRevenue: completedRevenue + careCash,
    cogs, softwareExpenses, vehicleExpenses, operatingExpenses,
  };
}
