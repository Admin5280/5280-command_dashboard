import {
  CareClubLead, CareMember, CarePerk, CareVisit, Job, Lead, OfferType, PaymentPlan, RecommendedTier,
} from "./types";
import { sum, today } from "./format";

/* ---------------- Pricing matrix (from the Care Club offer sheet) ---------------- */
export interface Pricing {
  monthlyRate: number; onboarding: number; dueToday: number; secondRate: number; total: number;
  year1Pay: number; year1Value: number; mult: number; savings: number; ceramic?: string;
}
const P = (o: Partial<Pricing>): Pricing =>
  ({ monthlyRate: 0, onboarding: 0, dueToday: 0, secondRate: 0, total: 0, year1Pay: 0, year1Value: 0, mult: 0, savings: 0, ...o });

export const PRICING: Record<OfferType, Record<PaymentPlan, Pricing>> = {
  "Founding 100 Charter Offer": {
    "Monthly": P({ monthlyRate: 245, onboarding: 245, dueToday: 490, secondRate: 195, year1Pay: 3185, year1Value: 12770, mult: 4.0, savings: 9585 }),
    "12-Week Plan": P({ total: 660, monthlyRate: 220, year1Pay: 2640, year1Value: 12770, mult: 4.8, savings: 10130 }),
    "6-Month Pay-in-Full": P({ total: 1225, year1Pay: 2450, year1Value: 13970, mult: 5.7, savings: 11520, ceramic: "Free 1-Year Ceramic + Stage 1 Paint Correction" }),
    "12-Month Pay-in-Full": P({ total: 2550, year1Pay: 2550, year1Value: 14520, mult: 5.7, savings: 11970, ceramic: "Free 3-Year Ceramic + Stage 1 Paint Correction + Anniversary Detail" }),
  },
  "Standard Tier": {
    "Monthly": P({ monthlyRate: 295, onboarding: 295, dueToday: 590, secondRate: 245, year1Pay: 3835, year1Value: 11350, mult: 3.0, savings: 7515 }),
    "12-Week Plan": P({ total: 795, monthlyRate: 265, year1Pay: 3180, year1Value: 11350, mult: 3.6, savings: 8170 }),
    "6-Month Pay-in-Full": P({ total: 1475, year1Pay: 2950, year1Value: 12550, mult: 4.3, savings: 9600, ceramic: "Free 1-Year Ceramic + Stage 1 Paint Correction" }),
    "12-Month Pay-in-Full": P({ total: 2950, year1Pay: 2950, year1Value: 13620, mult: 4.6, savings: 10670, ceramic: "Free 3-Year Ceramic + Stage 1 Paint Correction + Monthly Bonus Upgrade + Anniversary Detail" }),
  },
};
export const pricingFor = (offer: OfferType, plan: PaymentPlan) => PRICING[offer][plan];

/* ---------------- Perks catalog ---------------- */
export const PERKS_CATALOG: Record<OfferType, { name: string; value: number }[]> = {
  "Founding 100 Charter Offer": [
    { name: "First-Day Reset", value: 400 }, { name: "Monthly Bonus Service", value: 720 },
    { name: "Winter Prep Pack", value: 250 }, { name: "Spill Response", value: 250 }, { name: "Salt Strip", value: 150 },
    { name: "Founding Welcome Kit", value: 200 }, { name: "Forever Rate", value: 600 },
    { name: "7 Day First Detail Promise", value: 300 }, { name: "Founder Tech", value: 400 },
    { name: "Auto-Pilot Scheduling", value: 400 }, { name: "25% Add-On Discount", value: 0 }, { name: "20% Premium Service Discount", value: 0 },
  ],
  "Standard Tier": [
    { name: "First-Day Reset", value: 400 }, { name: "Quarterly Bonus Service", value: 200 },
    { name: "Winter Prep Pack", value: 250 }, { name: "Spill Response", value: 250 }, { name: "Salt Strip", value: 150 },
    { name: "Welcome Kit Lite", value: 100 }, { name: "7 Day First Detail Promise", value: 300 },
    { name: "Master Tech Assigned", value: 300 }, { name: "Auto-Pilot Scheduling", value: 300 },
    { name: "25% Add-On Discount", value: 0 }, { name: "20% Premium Service Discount", value: 0 },
  ],
};
export const FOUNDERS25_PERK = { name: "Founders 25 Credit", value: 500 };
export const PIF_CERAMIC = { "6-Month Pay-in-Full": 1200, "12-Month Pay-in-Full": 1500 } as Record<string, number>;

/* ---------------- KPI helpers ---------------- */
const isFounding = (m: CareMember) => m.offerType === "Founding 100 Charter Offer";
const inRange = (iso: string, from: string, to: string) => !!iso && (!from || iso >= from) && (!to || iso <= to);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

export interface CareKpis {
  active: number; foundingFilled: number; foundingRemaining: number; founders25Filled: number; founders25Remaining: number;
  standard: number; monthly: number; pif: number; mrr: number; arr: number; cashCollected: number; amountDue: number;
  avgRevPerMember: number; visitsThisMonth: number; pastDue: number; renewalsDue: number; overdueDetails: number;
}

export function careKpis(members: CareMember[], from: string, to: string): CareKpis {
  const active = members.filter((m) => m.memberStatus === "Active");
  const foundingFilled = members.filter((m) => isFounding(m) && ["Active", "Pending Signup", "Paused"].includes(m.memberStatus)).length;
  const founders25Filled = members.filter((m) => isFounding(m) && +m.memberNumber >= 1 && +m.memberNumber <= 25).length;
  const monthly = active.filter((m) => m.paymentPlan === "Monthly");
  const mrr = sum(monthly, (m) => (m.monthlyRate || 0) + (m.secondVehicleRate || 0));
  const cashCollected = sum(members.filter((m) => inRange(m.signupDate, from, to)), (m) => m.amountPaid);
  const t = today();
  const in30 = addDays(new Date(t + "T00:00:00"), 30).toISOString().slice(0, 10);
  return {
    active: active.length,
    foundingFilled, foundingRemaining: Math.max(0, 100 - foundingFilled),
    founders25Filled, founders25Remaining: Math.max(0, 25 - founders25Filled),
    standard: active.filter((m) => m.offerType === "Standard Tier").length,
    monthly: monthly.length,
    pif: active.filter((m) => m.paymentPlan !== "Monthly").length,
    mrr, arr: mrr * 12, cashCollected,
    amountDue: sum(members, (m) => m.amountDue),
    avgRevPerMember: active.length ? cashCollected / active.length : 0,
    visitsThisMonth: sum(active, (m) => m.visitsThisMonth),
    pastDue: members.filter((m) => m.memberStatus === "Past Due" || m.paymentStatus === "Past Due").length,
    renewalsDue: members.filter((m) => m.renewalDate && m.renewalDate >= t && m.renewalDate <= in30).length,
    overdueDetails: active.filter((m) => m.nextDetailDate && m.nextDetailDate < t).length,
  };
}

/** Build a draft Care Club member from a booked/sold lead (Founding Monthly defaults). */
export function memberFromLead(l: Lead): Omit<CareMember, "id"> {
  const price = pricingFor("Founding 100 Charter Offer", "Monthly");
  const t = today();
  return {
    memberNumber: "", leadId: l.leadId, customerId: l.customerId, ghlContactId: l.ghlContactId, ghlContactLink: l.ghlContactLink,
    customerName: l.customerName, phone: l.phone, email: l.email, address: "", zip: "",
    offerType: "Founding 100 Charter Offer", memberTier: "Founding 100", paymentPlan: "Monthly", memberStatus: "Pending Signup",
    signupDate: l.bookedDate || t, startDate: "", renewalDate: "", cancelDate: "",
    primaryVehicle: "", secondVehicle: "", additionalVehicles: 0,
    monthlyRate: price.monthlyRate, secondVehicleRate: 0, onboardingFee: price.onboarding, amountDueToday: price.dueToday,
    totalContractValue: price.year1Pay, amountPaid: 0, amountDue: price.year1Pay, paymentStatus: "Unpaid", paymentMethod: "Stripe",
    assignedSalesRep: l.assignedSalesRep, assignedFounderTech: "", preferredUnit: "",
    lastDetailDate: "", nextDetailDate: "", visitsThisMonth: 0, visitsThisYear: 0, perksUsedThisYear: 0,
    source: l.confirmedSource, notes: `Created from lead ${l.leadId}. ${l.notes}`.trim(), createdAt: t, updatedAt: t,
  };
}

/* ---------------- Care Club sales pipeline ---------------- */
const REC_MAP: Record<Exclude<RecommendedTier, "Unknown">, { offer: OfferType; plan: PaymentPlan }> = {
  "Founding Monthly": { offer: "Founding 100 Charter Offer", plan: "Monthly" },
  "Founding 12-Week Plan": { offer: "Founding 100 Charter Offer", plan: "12-Week Plan" },
  "Founding 6-Month PIF": { offer: "Founding 100 Charter Offer", plan: "6-Month Pay-in-Full" },
  "Founding 12-Month PIF": { offer: "Founding 100 Charter Offer", plan: "12-Month Pay-in-Full" },
  "Standard Monthly": { offer: "Standard Tier", plan: "Monthly" },
  "Standard 12-Week Plan": { offer: "Standard Tier", plan: "12-Week Plan" },
  "Standard 6-Month PIF": { offer: "Standard Tier", plan: "6-Month Pay-in-Full" },
  "Standard 12-Month PIF": { offer: "Standard Tier", plan: "12-Month Pay-in-Full" },
};
/** Expected annual value of a recommended plan (for pipeline value). */
export function recommendedTierValue(tier: RecommendedTier): number {
  if (tier === "Unknown") return 0;
  const m = REC_MAP[tier];
  const p = pricingFor(m.offer, m.plan);
  return p.year1Pay || p.total;
}

/** Build a Care Club Lead from a completed job (+ its original lead if found). careLeadId is assigned by the store. */
export function careLeadFromJob(job: Job, lead: Lead | undefined, careLeadId: string): Omit<CareClubLead, "id"> {
  const t = today();
  return {
    careLeadId,
    originalLeadId: job.leadId,
    customerId: job.customerId || lead?.customerId || "",
    ghlContactId: lead?.ghlContactId || "",
    ghlContactLink: job.ghlContactLink || lead?.ghlContactLink || "",
    customerName: job.customerName || lead?.customerName || "",
    phone: job.phone || lead?.phone || "",
    email: job.email || lead?.email || "",
    vehicle: job.unit || lead?.serviceInterest || "",
    completedJobId: job.id,
    urableJobId: job.urableJobId,
    urableJobLink: job.urableJobLink,
    completedService: job.services,
    completedJobDate: job.dateCompleted,
    completedJobRevenue: job.totalRevenue,
    confirmedSource: job.confirmedSource || lead?.confirmedSource || "",
    originalSalesRep: job.assignedSalesRep || lead?.assignedSalesRep || "",
    assignedCareRep: "",
    assignedFounderTech: "",
    pipelineStatus: "New Care Club Lead",
    offerPresented: "Not Presented Yet",
    recommendedTier: "Unknown",
    followUpDate: "",
    lastContactDate: "",
    closeDate: "",
    lostReason: "",
    notes: "",
    createdAt: t,
    updatedAt: t,
  };
}

/** Draft a Care Club Member from a sold Care Club Lead (user still picks tier/plan/dates). */
export function memberDraftFromCareLead(cl: CareClubLead): Omit<CareMember, "id"> {
  const price = pricingFor("Founding 100 Charter Offer", "Monthly");
  const t = today();
  return {
    memberNumber: "", leadId: cl.originalLeadId, customerId: cl.customerId, ghlContactId: cl.ghlContactId, ghlContactLink: cl.ghlContactLink,
    customerName: cl.customerName, phone: cl.phone, email: cl.email, address: "", zip: "",
    offerType: "Founding 100 Charter Offer", memberTier: "Founding 100", paymentPlan: "Monthly", memberStatus: "Pending Signup",
    signupDate: t, startDate: "", renewalDate: "", cancelDate: "",
    primaryVehicle: cl.vehicle, secondVehicle: "", additionalVehicles: 0,
    monthlyRate: price.monthlyRate, secondVehicleRate: 0, onboardingFee: price.onboarding, amountDueToday: price.dueToday,
    totalContractValue: price.year1Pay, amountPaid: 0, amountDue: price.year1Pay, paymentStatus: "Unpaid", paymentMethod: "Stripe",
    assignedSalesRep: cl.assignedCareRep || cl.originalSalesRep, assignedFounderTech: cl.assignedFounderTech, preferredUnit: "",
    lastDetailDate: "", nextDetailDate: "", visitsThisMonth: 0, visitsThisYear: 0, perksUsedThisYear: 0,
    source: cl.confirmedSource, notes: `From Care Club lead ${cl.careLeadId} (job ${cl.urableJobId}). ${cl.notes}`.trim(),
    createdAt: t, updatedAt: t,
  };
}

export interface CareLeadKpis {
  total: number; fresh: number; contacted: number; offersSent: number; followUpsDue: number;
  interested: number; sold: number; lost: number; noResponse: number; closeRate: number; pipelineValue: number;
}
export function careLeadKpis(leads: CareClubLead[]): CareLeadKpis {
  const t = today();
  const open = (s: string) => !["Sold", "Lost", "Not Interested"].includes(s);
  const sold = leads.filter((l) => l.pipelineStatus === "Sold").length;
  return {
    total: leads.length,
    fresh: leads.filter((l) => l.pipelineStatus === "New Care Club Lead").length,
    contacted: leads.filter((l) => l.pipelineStatus === "Contacted").length,
    offersSent: leads.filter((l) => l.pipelineStatus === "Offer Sent").length,
    followUpsDue: leads.filter((l) => l.followUpDate && l.followUpDate <= t && open(l.pipelineStatus)).length,
    interested: leads.filter((l) => l.pipelineStatus === "Interested").length,
    sold,
    lost: leads.filter((l) => l.pipelineStatus === "Lost" || l.pipelineStatus === "Not Interested").length,
    noResponse: leads.filter((l) => l.pipelineStatus === "No Response").length,
    closeRate: leads.length ? sold / leads.length : 0,
    pipelineValue: sum(leads.filter((l) => open(l.pipelineStatus)), (l) => recommendedTierValue(l.recommendedTier)),
  };
}

/* ---------------- Care Club audit checks ---------------- */
export interface Check { name: string; count: number; ids: string[]; }
export function careAudit(members: CareMember[], visits: CareVisit[], jobs: Job[]): Check[] {
  const memberNums = members.filter(isFounding).map((m) => m.memberNumber);
  const dupMemberId = dup(members.map((m) => m.id));
  const dupNum = members.filter(isFounding).filter((m) => m.memberNumber !== "" && memberNums.filter((n) => n === m.memberNumber).length > 1);
  const jobLeadIds = new Set(jobs.map((j) => j.customerName)); // jobs (Phase-1 MVP has no leadId yet)
  const mk = (name: string, rows: CareMember[]) => ({ name, count: rows.length, ids: rows.map((r) => r.id) });
  return [
    { name: "Duplicate Member ID", count: dupMemberId.length, ids: dupMemberId },
    mk("Duplicate Founding Member Number", dupNum),
    mk("Founding 100 cap exceeded", members.filter((m) => isFounding(m) && +m.memberNumber > 100)),
    mk("Founders 25 cap exceeded", members.filter((m) => m.memberTier === "Founders 25" && (+m.memberNumber < 1 || +m.memberNumber > 25))),
    mk("Active member missing payment plan", members.filter((m) => m.memberStatus === "Active" && !m.paymentPlan)),
    mk("Active member missing monthly rate / total", members.filter((m) => m.memberStatus === "Active" && !m.monthlyRate && !m.totalContractValue)),
    mk("Active member missing GHL Contact Link", members.filter((m) => m.memberStatus === "Active" && !m.ghlContactLink)),
    mk("Active member missing Founder Tech", members.filter((m) => m.memberStatus === "Active" && !m.assignedFounderTech)),
    mk("Active member missing Next Detail Date", members.filter((m) => m.memberStatus === "Active" && !m.nextDetailDate)),
    mk("Past due member needs follow-up", members.filter((m) => m.memberStatus === "Past Due" || m.paymentStatus === "Past Due")),
    { name: "Visit has Urable Job ID but no link", count: visits.filter((v) => v.urableJobId && !v.urableJobLink).length, ids: visits.filter((v) => v.urableJobId && !v.urableJobLink).map((v) => v.id) },
    { name: "Care Club visit missing assigned tech", count: visits.filter((v) => !v.tech).length, ids: visits.filter((v) => !v.tech).map((v) => v.id) },
    { name: "Completed visit not linked to member", count: visits.filter((v) => v.visitStatus === "Completed" && !v.memberId).length, ids: [] },
  ];
}
function dup(ids: string[]): string[] {
  const seen: Record<string, number> = {}; ids.forEach((i) => (seen[i] = (seen[i] || 0) + 1));
  return ids.filter((i) => seen[i] > 1);
}
