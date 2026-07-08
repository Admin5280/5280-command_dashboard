export type LeadStatus =
  | "New Lead" | "Contacted" | "Estimate Sent" | "Follow-Up Needed" | "Booked" | "Completed Job" | "Care Club Sold" | "Lost" | "No Response";

export const LEAD_STATUSES: LeadStatus[] = [
  "New Lead", "Contacted", "Estimate Sent", "Follow-Up Needed", "Booked", "Completed Job", "Care Club Sold", "Lost", "No Response",
];

export const LEAD_SOURCES = [
  "Google Ads", "Google LSA", "Google Business Profile", "Meta Ads", "Organic Search",
  "Direct Call", "Referral", "Maintenance Club", "Existing Customer", "Unknown", "Other",
];
export type SourceReviewStatus = "Needs Review" | "Reviewed" | "Cannot Confirm" | "";
export const SOURCE_REVIEW_STATUSES: SourceReviewStatus[] = ["Needs Review", "Reviewed", "Cannot Confirm"];
export type ClaimStatus = "Unclaimed" | "Claimed" | "Assigned" | "Reassigned" | "";
export const CLAIM_STATUSES: ClaimStatus[] = ["Unclaimed", "Claimed", "Assigned", "Reassigned"];

export type JobType = "Solo" | "Duo" | "Multi-Tech" | "Shop";
export const JOB_TYPES: JobType[] = ["Solo", "Duo", "Multi-Tech", "Shop"];

export type JobStatus = "Booked" | "In Progress" | "Completed" | "Canceled" | "Refunded" | "";
export const JOB_STATUSES: JobStatus[] = ["Booked", "In Progress", "Completed", "Canceled", "Refunded"];

export type CancellationReason =
  | "Customer Canceled" | "Weather" | "Scheduling Issue" | "No Show" | "Price Objection"
  | "Vehicle Not Available" | "Technician Issue" | "Other" | "";
export const CANCELLATION_REASONS: CancellationReason[] = [
  "Customer Canceled", "Weather", "Scheduling Issue", "No Show", "Price Objection",
  "Vehicle Not Available", "Technician Issue", "Other",
];
export type JobPaymentStatus = "Fully Paid" | "Partially Paid" | "Unpaid" | "Refunded" | "";
export const JOB_PAYMENT_STATUSES: JobPaymentStatus[] = ["Fully Paid", "Partially Paid", "Unpaid", "Refunded"];
export const PAYMENT_METHODS = ["Stripe", "Cash", "Card", "Check", "Other"];
export type PayStatus = "Pending Review" | "Approved" | "Exported" | "Paid" | "Hold" | "";
export const PAY_STATUSES: PayStatus[] = ["Pending Review", "Approved", "Exported", "Paid", "Hold"];
export type CommissionStatus = "Not Eligible" | "Pending Review" | "Eligible" | "Approved" | "Exported" | "Paid" | "Hold" | "";
export const COMMISSION_STATUSES: CommissionStatus[] = ["Not Eligible", "Pending Review", "Eligible", "Approved", "Exported", "Paid", "Hold"];

export type ReviewRequestStatus = "Not Sent" | "Sent" | "Received" | "Declined";
export const REVIEW_REQUEST_STATUSES: ReviewRequestStatus[] = ["Not Sent", "Sent", "Received", "Declined"];

export interface Lead {
  id: string;                 // internal record id
  leadId: string;             // human key (L-xxxx) — links to jobs
  ghlContactId: string;
  ghlContactLink: string;
  dateCreated: string;        // yyyy-mm-dd
  customerName: string;
  phone: string;
  email: string;
  rawSource: string;          // optional reference (what came in)
  possibleSource: string;
  confirmedSource: string;    // final source used in dashboards
  sourceReviewStatus: SourceReviewStatus;
  serviceInterest: string;
  claimStatus: ClaimStatus;
  assignedSalesRep: string;
  status: LeadStatus;         // Lead Status
  nextFollowUp: string;
  quoteAmount: number;
  bookedDate: string;
  bookedJobValue: number;
  notes: string;
  customerId: string;
  maintenanceId: string;
  origin: string;             // "ghl" (webhook) | "manual"
}

export interface Job {
  id: string;                 // internal record id
  leadId: string;             // links to a Lead
  urableJobId: string;
  urableJobLink: string;
  ghlContactLink: string;
  dateCompleted: string;      // yyyy-mm-dd
  customerName: string;
  phone: string;
  email: string;
  address: string;
  zip: string;
  category: string;
  services: string;
  unit: string;               // Job Location / Unit
  assigneesRaw: string;
  leadTech: string;
  helperTech: string;
  assigneeCount: number;
  jobType: JobType;
  jobStatus: JobStatus;
  subtotal: number;
  upsellAddOns: string;
  techUpsellAmount: number;
  discount: number;
  tip: number;
  addOnsValue: number;
  totalRevenue: number;       // computed: subtotal + techUpsell + tip + addOns − discount
  salesTotalRevenue: number;  // manual; falls back to totalRevenue for commission
  amountPaid: number;
  amountDue: number;          // computed: totalRevenue − amountPaid
  paymentStatus: JobPaymentStatus;
  paymentMethod: string;
  confirmedSource: string;    // from lead
  assignedSalesRep: string;   // from lead
  techPayStatus: PayStatus;
  salesCommissionStatus: CommissionStatus;
  // quality & reputation
  reviewRequestStatus: ReviewRequestStatus;
  reviewReceived: boolean;
  rating: number;             // 0 = none, else 1–5
  reviewNegative: boolean;
  callbackCount: number;
  redoCount: number;
  qualityStatus: string;
  // cancellation tracking
  cancellationDate: string;
  cancellationReason: CancellationReason;
  canceledBy: string;
  depositCollected: boolean;
  refundNeeded: boolean;
  cancellationNotes: string;
  adminNotes: string;
  customerId: string;
  historical: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Total Revenue formula. */
export const jobTotalRevenue = (j: Pick<Job, "subtotal" | "techUpsellAmount" | "tip" | "addOnsValue" | "discount">) =>
  (j.subtotal || 0) + (j.techUpsellAmount || 0) + (j.tip || 0) + (j.addOnsValue || 0) - (j.discount || 0);
/** Sales commissionable revenue: salesTotalRevenue if > 0 else totalRevenue. */
export const salesCommissionable = (j: Pick<Job, "salesTotalRevenue" | "totalRevenue">) =>
  (j.salesTotalRevenue || 0) > 0 ? j.salesTotalRevenue : j.totalRevenue;

export interface MarketingSpend {
  id: string;
  date: string;            // yyyy-mm-dd
  channel: string;
  campaign: string;
  spend: number;
  leads: number;
  bookedJobs: number;
  revenue: number;
  notes: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: "Sales" | "Technician";
  active: boolean;
}

export interface Service {
  id: string;
  name: string;
  active: boolean;
}

/* ---------------- Care Club ---------------- */
export type OfferType = "Founding 100 Charter Offer" | "Standard Tier";
export const OFFER_TYPES: OfferType[] = ["Founding 100 Charter Offer", "Standard Tier"];

export type MemberTier = "Founding 100" | "Founders 25" | "Standard";
export const MEMBER_TIERS: MemberTier[] = ["Founding 100", "Founders 25", "Standard"];

export type PaymentPlan = "Monthly" | "12-Week Plan" | "6-Month Pay-in-Full" | "12-Month Pay-in-Full";
export const PAYMENT_PLANS: PaymentPlan[] = ["Monthly", "12-Week Plan", "6-Month Pay-in-Full", "12-Month Pay-in-Full"];

export type MemberStatus = "Lead" | "Pending Signup" | "Active" | "Paused" | "Past Due" | "Canceled" | "Expired" | "Won Back";
export const MEMBER_STATUSES: MemberStatus[] = ["Lead", "Pending Signup", "Active", "Paused", "Past Due", "Canceled", "Expired", "Won Back"];

export type CarePaymentStatus = "Paid" | "Partially Paid" | "Unpaid" | "Past Due" | "Refunded";
export const CARE_PAYMENT_STATUSES: CarePaymentStatus[] = ["Paid", "Partially Paid", "Unpaid", "Past Due", "Refunded"];

export type VisitStatus = "Scheduled" | "Completed" | "Canceled" | "No Show" | "Rescheduled";
export const VISIT_STATUSES: VisitStatus[] = ["Scheduled", "Completed", "Canceled", "No Show", "Rescheduled"];

export type ServiceType =
  | "Maintenance Detail" | "First-Day Reset" | "Monthly Bonus Service" | "Quarterly Bonus Service"
  | "Winter Prep Pack" | "Spill Response" | "Salt Strip" | "Anniversary Detail" | "Ceramic Bonus" | "Other";
export const SERVICE_TYPES: ServiceType[] = ["Maintenance Detail", "First-Day Reset", "Monthly Bonus Service", "Quarterly Bonus Service", "Winter Prep Pack", "Spill Response", "Salt Strip", "Anniversary Detail", "Ceramic Bonus", "Other"];

export type PerkStatus = "Available" | "Scheduled" | "Used" | "Expired" | "Not Eligible";
export const PERK_STATUSES: PerkStatus[] = ["Available", "Scheduled", "Used", "Expired", "Not Eligible"];

export interface CareMember {
  id: string; memberNumber: number | ""; leadId: string; customerId: string; ghlContactId: string; ghlContactLink: string;
  customerName: string; phone: string; email: string; address: string; zip: string;
  offerType: OfferType; memberTier: MemberTier; paymentPlan: PaymentPlan; memberStatus: MemberStatus;
  signupDate: string; startDate: string; renewalDate: string; cancelDate: string;
  primaryVehicle: string; secondVehicle: string; additionalVehicles: number;
  monthlyRate: number; secondVehicleRate: number; onboardingFee: number; amountDueToday: number;
  totalContractValue: number; amountPaid: number; amountDue: number;
  paymentStatus: CarePaymentStatus; paymentMethod: string;
  assignedSalesRep: string; assignedFounderTech: string; preferredUnit: string;
  lastDetailDate: string; nextDetailDate: string;
  visitsThisMonth: number; visitsThisYear: number; perksUsedThisYear: number;
  source: string; notes: string; createdAt: string; updatedAt: string;
}

export interface CareVisit {
  id: string; memberId: string; leadId: string; urableJobId: string; urableJobLink: string; ghlContactLink: string;
  customerName: string; vehicle: string; visitDate: string; serviceType: ServiceType; visitStatus: VisitStatus;
  tech: string; unit: string; bonusServiceUsed: string; addOnSold: string; addOnRevenue: number; tip: number; notes: string;
}

export interface CarePerk {
  id: string; memberId: string; customerName: string; offerType: OfferType; perkName: string; perkValue: number;
  eligibleDate: string; usedDate: string; status: PerkStatus; urableJobId: string; urableJobLink: string; notes: string;
}

/* ---------------- Pay rules ---------------- */
export type TechRole = "Solo" | "Duo Lead" | "Helper";
export const TECH_ROLES: TechRole[] = ["Solo", "Duo Lead", "Helper"];

/** Percentages are stored as fractions (0.23 = 23%). */
export interface TechPayRule {
  role: TechRole;
  commissionPct: number; // of job subtotal (production)
  upsellPct: number;     // of technician upsell $ (lead tech only)
  tipPct: number;        // of tip
}
export interface SalesPayRule {
  commissionPct: number;            // of sales-commissionable revenue
  baseGuarantee: number;            // flat $ added per pay period
  requireCompletedPaidJob: boolean; // base only paid if rep has ≥1 completed & paid job
}
export interface PayRules {
  effectiveDate: string;
  updatedAt: string;
  tech: TechPayRule[];
  sales: SalesPayRule;
}

export const DEFAULT_PAY_RULES: PayRules = {
  effectiveDate: "2026-01-01",
  updatedAt: "2026-01-01",
  tech: [
    { role: "Solo", commissionPct: 0.23, upsellPct: 0.30, tipPct: 0.80 },
    { role: "Duo Lead", commissionPct: 0.17, upsellPct: 0.15, tipPct: 0.40 },
    { role: "Helper", commissionPct: 0.13, upsellPct: 0.15, tipPct: 0.40 },
  ],
  sales: { commissionPct: 0.06, baseGuarantee: 400, requireCompletedPaidJob: true },
};

/* ---------------- Technician base pay ---------------- */
export type BasePayType = "Weekly Base" | "Daily Base" | "Per Job Base" | "None";
export const BASE_PAY_TYPES: BasePayType[] = ["Weekly Base", "Daily Base", "Per Job Base", "None"];

export interface TechBasePayRule {
  id: string;
  technicianName: string;
  basePayType: BasePayType;
  basePayAmount: number;
  effectiveStart: string;
  effectiveEnd: string;
  active: boolean;
  notes: string;
}

/* ---------------- Care Club sales pipeline ---------------- */
export type CareLeadStatus =
  | "New Care Club Lead" | "Contacted" | "Offer Sent" | "Follow-Up Needed" | "Interested"
  | "Sold" | "Not Interested" | "Lost" | "No Response";
export const CARE_LEAD_STATUSES: CareLeadStatus[] = [
  "New Care Club Lead", "Contacted", "Offer Sent", "Follow-Up Needed", "Interested",
  "Sold", "Not Interested", "Lost", "No Response",
];

export type CareOfferPresented = "Founding 100 Charter Offer" | "Standard Tier" | "Not Presented Yet";
export const CARE_OFFERS_PRESENTED: CareOfferPresented[] = ["Founding 100 Charter Offer", "Standard Tier", "Not Presented Yet"];

export type RecommendedTier =
  | "Founding Monthly" | "Founding 12-Week Plan" | "Founding 6-Month PIF" | "Founding 12-Month PIF"
  | "Standard Monthly" | "Standard 12-Week Plan" | "Standard 6-Month PIF" | "Standard 12-Month PIF" | "Unknown";
export const RECOMMENDED_TIERS: RecommendedTier[] = [
  "Founding Monthly", "Founding 12-Week Plan", "Founding 6-Month PIF", "Founding 12-Month PIF",
  "Standard Monthly", "Standard 12-Week Plan", "Standard 6-Month PIF", "Standard 12-Month PIF", "Unknown",
];

export type CareLostReason =
  | "Too Expensive" | "Not Interested" | "Needs Time" | "No Response" | "Already Has Maintenance" | "Bad Fit" | "Other" | "";
export const CARE_LOST_REASONS: CareLostReason[] = [
  "Too Expensive", "Not Interested", "Needs Time", "No Response", "Already Has Maintenance", "Bad Fit", "Other",
];

export interface CareClubLead {
  id: string;
  careLeadId: string;            // human key CL-xxxx
  originalLeadId: string;        // carries the Lead ID through the journey
  customerId: string;
  ghlContactId: string;
  ghlContactLink: string;
  customerName: string;
  phone: string;
  email: string;
  vehicle: string;
  completedJobId: string;        // internal Job.id
  urableJobId: string;
  urableJobLink: string;
  completedService: string;
  completedJobDate: string;
  completedJobRevenue: number;
  confirmedSource: string;
  originalSalesRep: string;
  assignedCareRep: string;       // Assigned Care Club Sales Rep
  assignedFounderTech: string;
  pipelineStatus: CareLeadStatus;
  offerPresented: CareOfferPresented;
  recommendedTier: RecommendedTier;
  followUpDate: string;
  lastContactDate: string;
  closeDate: string;
  lostReason: CareLostReason;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  leads: Lead[];
  jobs: Job[];
  marketing: MarketingSpend[];
  sources: string[];
  services: string[];
  salesReps: string[];
  technicians: string[];
  units: string[];               // Job Locations / Units (editable in Settings)
  careMembers: CareMember[];
  careVisits: CareVisit[];
  carePerks: CarePerk[];
  careClubLeads: CareClubLead[];
  techBasePay: TechBasePayRule[];
  payRules: PayRules;
  payRulesHistory: PayRules[];
}

export const CARE_UNITS = [
  "Shop | 5306 S Bannock St, Littleton, CO 80120",
  "Unit 1 | 2023 Ford F-150",
  "Unit 2 | 2016 Ford Transit Connect",
];
