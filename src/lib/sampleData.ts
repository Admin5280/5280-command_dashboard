import { AppData, CARE_UNITS, DEFAULT_PAY_RULES } from "./types";

export const DEFAULT_SOURCES = [
  "Google Ads", "Google LSA", "Google Business Profile", "Meta Ads", "Instagram",
  "Facebook", "Referral", "Organic Search", "Direct Call", "Website", "Other",
];

export const DEFAULT_SERVICES = [
  "Mobile Detail", "Interior Detail", "Exterior Detail", "Paint Correction",
  "Ceramic Coating", "Window Tint", "Maintenance Detail", "Care Club Visit",
  "Callback", "Redo Job", "Quality Follow-Up", "Other",
];

export const DEFAULT_SALES_REPS = ["Haley Brasil Soares", "Tony Gomez", "Jherico Megino"];
export const DEFAULT_TECHS = ["Anthony Kiepprien", "Jarvis Hutchings", "Julien Jerome-Stewart", "Justin David Smith JR"];

// Fixed ids/dates -> stable across SSR & client (no hydration surprises)
export function sampleData(): AppData {
  return {
    sources: [...DEFAULT_SOURCES],
    services: [...DEFAULT_SERVICES],
    salesReps: [...DEFAULT_SALES_REPS],
    technicians: [...DEFAULT_TECHS],
    units: [...CARE_UNITS],
    leads: leadSample(),
    jobs: jobSample(),
    marketing: [
      { id: "m1", date: "2026-06-01", channel: "Google Ads", campaign: "Search - Detailing", spend: 1800, leads: 42, bookedJobs: 16, revenue: 7200, notes: "" },
      { id: "m2", date: "2026-06-01", channel: "Google LSA", campaign: "LSA Calls", spend: 950, leads: 30, bookedJobs: 12, revenue: 4800, notes: "" },
      { id: "m3", date: "2026-06-01", channel: "Meta Ads", campaign: "Lead Form", spend: 600, leads: 25, bookedJobs: 8, revenue: 2600, notes: "" },
      { id: "m4", date: "2026-06-01", channel: "Google Business Profile", campaign: "Organic Profile", spend: 0, leads: 18, bookedJobs: 9, revenue: 3100, notes: "" },
    ],
    careMembers: careSample(),
    careVisits: visitSample(),
    carePerks: perkSample(),
    careClubLeads: careLeadSample(),
    techBasePay: [
      { id: "bp1", technicianName: "Anthony Kiepprien", basePayType: "Weekly Base", basePayAmount: 150, effectiveStart: "2026-01-01", effectiveEnd: "", active: true, notes: "" },
      { id: "bp2", technicianName: "Jarvis Hutchings", basePayType: "None", basePayAmount: 0, effectiveStart: "", effectiveEnd: "", active: true, notes: "" },
      { id: "bp3", technicianName: "Julien Jerome-Stewart", basePayType: "None", basePayAmount: 0, effectiveStart: "", effectiveEnd: "", active: true, notes: "" },
      { id: "bp4", technicianName: "Justin David Smith JR", basePayType: "None", basePayAmount: 0, effectiveStart: "", effectiveEnd: "", active: true, notes: "" },
    ],
    payRules: { ...DEFAULT_PAY_RULES, tech: DEFAULT_PAY_RULES.tech.map((r) => ({ ...r })), sales: { ...DEFAULT_PAY_RULES.sales } },
    payRulesHistory: [],
  };
}

function careLeadSample(): import("./types").CareClubLead[] {
  const c = (o: Partial<import("./types").CareClubLead>): import("./types").CareClubLead => ({
    id: "", careLeadId: "", originalLeadId: "", customerId: "", ghlContactId: "", ghlContactLink: "https://app.gohighlevel.com/contacts/example",
    customerName: "", phone: "", email: "", vehicle: "", completedJobId: "", urableJobId: "", urableJobLink: "",
    completedService: "", completedJobDate: "2026-06-10", completedJobRevenue: 0, confirmedSource: "", originalSalesRep: "",
    assignedCareRep: "", assignedFounderTech: "", pipelineStatus: "New Care Club Lead", offerPresented: "Not Presented Yet",
    recommendedTier: "Unknown", followUpDate: "", lastContactDate: "", closeDate: "", lostReason: "", notes: "",
    createdAt: "2026-06-10", updatedAt: "2026-06-10", ...o,
  });
  return [
    c({ id: "ccl1", careLeadId: "CL-3001", originalLeadId: "L-2001", customerId: "C-1001", completedJobId: "j1", urableJobId: "1471", urableJobLink: "https://app.urable.com/jobs/1471", customerName: "Marcus Webb", phone: "720-555-0142", email: "marcus@example.com", vehicle: "2021 Ford F-150", completedService: "Mobile Detail", completedJobDate: "2026-06-04", completedJobRevenue: 390, confirmedSource: "Google Ads", originalSalesRep: "Haley Brasil Soares", assignedCareRep: "Haley Brasil Soares", pipelineStatus: "Interested", offerPresented: "Founding 100 Charter Offer", recommendedTier: "Founding Monthly", followUpDate: "2026-07-08" }),
    c({ id: "ccl2", careLeadId: "CL-3002", originalLeadId: "L-2003", customerId: "C-1003", completedJobId: "j2", urableJobId: "1478", urableJobLink: "https://app.urable.com/jobs/1478", customerName: "Dell Carter", phone: "720-555-0177", email: "dell@example.com", vehicle: "2022 BMW X5", completedService: "Paint Correction", completedJobDate: "2026-06-06", completedJobRevenue: 850, confirmedSource: "Google Business Profile", originalSalesRep: "Haley Brasil Soares", assignedCareRep: "Tony Gomez", pipelineStatus: "Offer Sent", offerPresented: "Founding 100 Charter Offer", recommendedTier: "Founding 6-Month PIF", followUpDate: "2026-07-09" }),
    c({ id: "ccl3", careLeadId: "CL-3003", originalLeadId: "L-2005", customerId: "C-1005", completedJobId: "j3", urableJobId: "1488", urableJobLink: "https://app.urable.com/jobs/1488", customerName: "Owen Park", phone: "720-555-0188", email: "owen@example.com", vehicle: "2023 Toyota Tacoma", completedService: "Maintenance Detail", completedJobDate: "2026-06-10", completedJobRevenue: 230, confirmedSource: "Google LSA", originalSalesRep: "Haley Brasil Soares", pipelineStatus: "New Care Club Lead" }),
    c({ id: "ccl4", careLeadId: "CL-3004", originalLeadId: "L-2008", customerId: "C-1008", completedJobId: "j4", urableJobId: "1494", urableJobLink: "https://app.urable.com/jobs/1494", customerName: "Amber Cole", phone: "303-555-0155", email: "amber@example.com", vehicle: "2021 Subaru Outback", completedService: "Mobile Detail", completedJobDate: "2026-06-13", completedJobRevenue: 340, confirmedSource: "Organic Search", originalSalesRep: "Haley Brasil Soares", assignedCareRep: "Jherico Megino", pipelineStatus: "Contacted", followUpDate: "2026-07-10" }),
  ];
}

function cm(o: Partial<import("./types").CareMember>): import("./types").CareMember {
  return {
    id: "", memberNumber: "", leadId: "", customerId: "", ghlContactId: "", ghlContactLink: "https://app.gohighlevel.com/contacts/example",
    customerName: "", phone: "", email: "", address: "", zip: "80120",
    offerType: "Founding 100 Charter Offer", memberTier: "Founding 100", paymentPlan: "Monthly", memberStatus: "Active",
    signupDate: "2026-06-10", startDate: "2026-06-12", renewalDate: "2027-06-12", cancelDate: "",
    primaryVehicle: "", secondVehicle: "", additionalVehicles: 0,
    monthlyRate: 245, secondVehicleRate: 0, onboardingFee: 245, amountDueToday: 490,
    totalContractValue: 3185, amountPaid: 490, amountDue: 0, paymentStatus: "Paid", paymentMethod: "Stripe",
    assignedSalesRep: "Haley Brasil Soares", assignedFounderTech: "Anthony Kiepprien", preferredUnit: "Unit 1 | 2023 Ford F-150",
    lastDetailDate: "2026-06-15", nextDetailDate: "2026-07-15", visitsThisMonth: 1, visitsThisYear: 1, perksUsedThisYear: 1,
    source: "Google Ads", notes: "", createdAt: "2026-06-10", updatedAt: "2026-06-10", ...o,
  };
}
function careSample(): import("./types").CareMember[] {
  return [
    cm({ id: "cm1", memberNumber: 1, memberTier: "Founders 25", customerName: "Marcus Webb", phone: "720-555-0142", email: "marcus@example.com", primaryVehicle: "2021 Ford F-150", renewalDate: "2026-07-10" }),
    cm({ id: "cm2", memberNumber: 2, memberTier: "Founders 25", customerName: "Dell Carter", phone: "720-555-0177", email: "dell@example.com", primaryVehicle: "2022 BMW X5", secondVehicle: "2020 Audi Q7", secondVehicleRate: 195, monthlyRate: 245, amountPaid: 685 }),
    cm({ id: "cm3", memberNumber: 5, customerName: "Owen Park", phone: "720-555-0188", email: "owen@example.com", primaryVehicle: "2023 Toyota Tacoma", nextDetailDate: "2026-06-20" }),
    cm({ id: "cm4", memberNumber: 8, customerName: "Amber Cole", phone: "303-555-0155", email: "amber@example.com", primaryVehicle: "2021 Subaru Outback", memberStatus: "Past Due", paymentStatus: "Past Due", amountPaid: 245, amountDue: 245 }),
    cm({ id: "cm5", memberNumber: 12, paymentPlan: "12-Week Plan", monthlyRate: 220, onboardingFee: 0, amountDueToday: 660, totalContractValue: 2640, amountPaid: 660, customerName: "Nina Patel", phone: "303-555-0144", email: "nina@example.com", primaryVehicle: "2022 Lexus RX", nextDetailDate: "2026-06-20" }),
    cm({ id: "cm6", memberNumber: 15, paymentPlan: "12-Week Plan", monthlyRate: 220, onboardingFee: 0, amountDueToday: 660, totalContractValue: 2640, amountPaid: 660, customerName: "Grace Lin", phone: "303-555-0166", email: "grace@example.com", primaryVehicle: "2018 Audi A4" }),
    cm({ id: "cm7", memberNumber: 20, paymentPlan: "6-Month Pay-in-Full", monthlyRate: 0, onboardingFee: 0, amountDueToday: 1225, totalContractValue: 1225, amountPaid: 1225, customerName: "Victor Reyes", phone: "720-555-0133", email: "victor@example.com", primaryVehicle: "2016 Chevy Silverado" }),
    cm({ id: "cm8", memberNumber: 22, paymentPlan: "6-Month Pay-in-Full", monthlyRate: 0, onboardingFee: 0, amountDueToday: 1225, totalContractValue: 1225, amountPaid: 1225, customerName: "Ella Brooks", phone: "303-555-0170", email: "ella@example.com", primaryVehicle: "2020 Kia Telluride" }),
    cm({ id: "cm9", memberNumber: 24, memberTier: "Founders 25", paymentPlan: "12-Month Pay-in-Full", monthlyRate: 0, onboardingFee: 0, amountDueToday: 2550, totalContractValue: 2550, amountPaid: 2550, customerName: "Jake Mullins", phone: "720-555-0111", email: "jake@example.com", primaryVehicle: "2017 Jeep Wrangler" }),
    cm({ id: "cm10", offerType: "Standard Tier", memberTier: "Standard", monthlyRate: 295, onboardingFee: 295, amountDueToday: 590, totalContractValue: 3835, amountPaid: 590, secondVehicleRate: 0, customerName: "Sofia Reyes", phone: "303-555-0123", email: "sofia@example.com", primaryVehicle: "2020 Honda Civic", source: "Meta Ads", assignedFounderTech: "Carlos" }),
  ];
}
function visitSample(): import("./types").CareVisit[] {
  const v = (o: Partial<import("./types").CareVisit>): import("./types").CareVisit => ({
    id: "", memberId: "", leadId: "", urableJobId: "", urableJobLink: "", ghlContactLink: "", customerName: "", vehicle: "",
    visitDate: "2026-06-15", serviceType: "Maintenance Detail", visitStatus: "Completed", tech: "Anthony Kiepprien",
    unit: "Unit 1 | 2023 Ford F-150", bonusServiceUsed: "", addOnSold: "", addOnRevenue: 0, tip: 0, notes: "", ...o,
  });
  return [
    v({ id: "cv1", memberId: "cm1", customerName: "Marcus Webb", vehicle: "2021 Ford F-150", urableJobId: "1471", urableJobLink: "https://app.urable.com/jobs/1471", tip: 40 }),
    v({ id: "cv2", memberId: "cm2", customerName: "Dell Carter", vehicle: "2022 BMW X5", serviceType: "First-Day Reset", tip: 60 }),
    v({ id: "cv3", memberId: "cm3", customerName: "Owen Park", vehicle: "2023 Toyota Tacoma", visitStatus: "Scheduled", visitDate: "2026-07-02", tech: "" }),
    v({ id: "cv4", memberId: "cm5", customerName: "Nina Patel", vehicle: "2022 Lexus RX", serviceType: "Monthly Bonus Service", addOnSold: "Engine Bay", addOnRevenue: 60, tip: 30 }),
    v({ id: "cv5", memberId: "cm7", customerName: "Victor Reyes", vehicle: "2016 Chevy Silverado", serviceType: "Ceramic Bonus", urableJobId: "1502" }),
    v({ id: "cv6", memberId: "cm9", customerName: "Jake Mullins", vehicle: "2017 Jeep Wrangler", serviceType: "Anniversary Detail", visitStatus: "Scheduled", visitDate: "2026-07-05" }),
    v({ id: "cv7", memberId: "cm10", customerName: "Sofia Reyes", vehicle: "2020 Honda Civic", tech: "Carlos", tip: 25 }),
    v({ id: "cv8", memberId: "cm6", customerName: "Grace Lin", vehicle: "2018 Audi A4", serviceType: "Salt Strip", visitStatus: "No Show", tech: "Jesse" }),
  ];
}
function perkSample(): import("./types").CarePerk[] {
  const p = (o: Partial<import("./types").CarePerk>): import("./types").CarePerk => ({
    id: "", memberId: "", customerName: "", offerType: "Founding 100 Charter Offer", perkName: "", perkValue: 0,
    eligibleDate: "2026-06-12", usedDate: "", status: "Available", urableJobId: "", urableJobLink: "", notes: "", ...o,
  });
  return [
    p({ id: "cp1", memberId: "cm1", customerName: "Marcus Webb", perkName: "First-Day Reset", perkValue: 400, status: "Used", usedDate: "2026-06-12" }),
    p({ id: "cp2", memberId: "cm1", customerName: "Marcus Webb", perkName: "Founder Tech", perkValue: 400, status: "Available" }),
    p({ id: "cp3", memberId: "cm2", customerName: "Dell Carter", perkName: "First-Day Reset", perkValue: 400, status: "Used", usedDate: "2026-06-14" }),
    p({ id: "cp4", memberId: "cm2", customerName: "Dell Carter", perkName: "Winter Prep Pack", perkValue: 250, status: "Available" }),
    p({ id: "cp5", memberId: "cm5", customerName: "Nina Patel", perkName: "Monthly Bonus Service", perkValue: 720, status: "Used", usedDate: "2026-06-18" }),
    p({ id: "cp6", memberId: "cm7", customerName: "Victor Reyes", perkName: "Free 1-Year Ceramic + Stage 1 Paint Correction", perkValue: 1200, status: "Scheduled" }),
    p({ id: "cp7", memberId: "cm9", customerName: "Jake Mullins", perkName: "Free 3-Year Ceramic + Stage 1 Paint Correction", perkValue: 1500, status: "Available" }),
    p({ id: "cp8", memberId: "cm9", customerName: "Jake Mullins", perkName: "Founders 25 Credit", perkValue: 500, status: "Available" }),
    p({ id: "cp9", memberId: "cm10", customerName: "Sofia Reyes", offerType: "Standard Tier", perkName: "First-Day Reset", perkValue: 400, status: "Used", usedDate: "2026-06-16" }),
    p({ id: "cp10", memberId: "cm3", customerName: "Owen Park", perkName: "Salt Strip", perkValue: 150, status: "Expired" }),
  ];
}

/* ---- Leads & Jobs sample (linked by Lead ID) ---- */
type L = import("./types").Lead; type J = import("./types").Job;
function ld(o: Partial<L>): L {
  return { id: "", leadId: "", ghlContactId: "", ghlContactLink: "https://app.gohighlevel.com/contacts/example",
    dateCreated: "2026-06-01", customerName: "", phone: "", email: "", rawSource: "", possibleSource: "",
    confirmedSource: "", sourceReviewStatus: "Reviewed", serviceInterest: "Mobile Detail", claimStatus: "Assigned",
    assignedSalesRep: "Haley Brasil Soares", status: "New Lead", nextFollowUp: "", quoteAmount: 0, bookedDate: "",
    bookedJobValue: 0, notes: "", customerId: "", maintenanceId: "", origin: "manual", ...o };
}
function jb(o: Partial<J>): J {
  const b: J = { id: "", leadId: "", urableJobId: "", urableJobLink: "", ghlContactLink: "", dateCompleted: "2026-06-05",
    customerName: "", phone: "", email: "", address: "", zip: "80120", category: "Detail", services: "Full Detail",
    unit: "Unit 1 | 2023 Ford F-150", assigneesRaw: "", leadTech: "Anthony Kiepprien", helperTech: "", assigneeCount: 1,
    jobType: "Solo", jobStatus: "Completed", subtotal: 0, upsellAddOns: "", techUpsellAmount: 0, discount: 0, tip: 0, addOnsValue: 0,
    totalRevenue: 0, salesTotalRevenue: 0, amountPaid: 0, amountDue: 0, paymentStatus: "Fully Paid", paymentMethod: "Stripe",
    confirmedSource: "", assignedSalesRep: "Haley Brasil Soares", techPayStatus: "Pending Review",
    salesCommissionStatus: "Approved", reviewRequestStatus: "Not Sent", reviewReceived: false, rating: 0, reviewNegative: false,
    callbackCount: 0, redoCount: 0, qualityStatus: "",
    cancellationDate: "", cancellationReason: "", canceledBy: "", depositCollected: false, refundNeeded: false, cancellationNotes: "",
    adminNotes: "", customerId: "", historical: false, createdAt: "2026-06-05", updatedAt: "2026-06-05", ...o };
  b.totalRevenue = b.subtotal + b.techUpsellAmount + b.tip + b.addOnsValue - b.discount;
  if (b.amountPaid === 0 && b.paymentStatus === "Fully Paid") b.amountPaid = b.totalRevenue;
  b.amountDue = b.totalRevenue - b.amountPaid;
  return b;
}
function leadSample(): L[] {
  return [
    ld({ id: "l1", leadId: "L-2001", dateCreated: "2026-06-02", customerName: "Marcus Webb", phone: "720-555-0142", email: "marcus@example.com", rawSource: "Google Ads", confirmedSource: "Google Ads", serviceInterest: "Mobile Detail", status: "Booked", bookedDate: "2026-06-04", bookedJobValue: 390, quoteAmount: 350, customerId: "C-1001" }),
    ld({ id: "l2", leadId: "L-2002", dateCreated: "2026-06-03", customerName: "Priya Nair", phone: "303-555-0199", email: "priya@example.com", rawSource: "Direct Call", confirmedSource: "", sourceReviewStatus: "Needs Review", serviceInterest: "Ceramic Coating", claimStatus: "Claimed", assignedSalesRep: "Tony Gomez", status: "Follow-Up Needed", nextFollowUp: "2026-07-01", quoteAmount: 1200, customerId: "C-1002" }),
    ld({ id: "l3", leadId: "L-2003", dateCreated: "2026-06-05", customerName: "Dell Carter", phone: "720-555-0177", email: "dell@example.com", rawSource: "GMB Profile", confirmedSource: "Google Business Profile", serviceInterest: "Paint Correction", status: "Booked", bookedDate: "2026-06-06", bookedJobValue: 890, quoteAmount: 650, customerId: "C-1003" }),
    ld({ id: "l4", leadId: "L-2004", dateCreated: "2026-06-07", customerName: "Sofia Reyes", phone: "303-555-0123", email: "sofia@example.com", rawSource: "Meta Ads", confirmedSource: "Meta Ads", serviceInterest: "Window Tint", assignedSalesRep: "Jherico Megino", status: "Contacted", quoteAmount: 300, customerId: "C-1004" }),
    ld({ id: "l5", leadId: "L-2005", dateCreated: "2026-06-09", customerName: "Owen Park", phone: "720-555-0188", email: "owen@example.com", rawSource: "Google LSA", confirmedSource: "Google LSA", serviceInterest: "Maintenance Detail", status: "Booked", bookedDate: "2026-06-10", bookedJobValue: 230, quoteAmount: 200, customerId: "C-1005" }),
    ld({ id: "l6", leadId: "L-2006", dateCreated: "2026-06-11", customerName: "Grace Lin", phone: "303-555-0166", email: "grace@example.com", rawSource: "Referral", confirmedSource: "Referral", serviceInterest: "Interior Detail", claimStatus: "Unclaimed", assignedSalesRep: "", status: "New Lead", quoteAmount: 220, customerId: "C-1006" }),
    ld({ id: "l7", leadId: "L-2007", dateCreated: "2026-06-12", customerName: "Jake Mullins", phone: "720-555-0111", email: "jake@example.com", rawSource: "Meta Ads", confirmedSource: "Meta Ads", serviceInterest: "Exterior Detail", assignedSalesRep: "Jherico Megino", status: "Lost", quoteAmount: 180, notes: "Went with competitor", customerId: "C-1007" }),
    ld({ id: "l8", leadId: "L-2008", dateCreated: "2026-06-14", customerName: "Amber Cole", phone: "303-555-0155", email: "amber@example.com", rawSource: "Organic Search", confirmedSource: "Organic Search", serviceInterest: "Mobile Detail", status: "Booked", bookedDate: "2026-06-13", bookedJobValue: 340, quoteAmount: 275, customerId: "C-1008" }),
    ld({ id: "l9", leadId: "L-2009", dateCreated: "2026-06-16", customerName: "Victor Reyes", phone: "720-555-0133", email: "victor@example.com", rawSource: "Unknown", confirmedSource: "", sourceReviewStatus: "Needs Review", serviceInterest: "Ceramic Coating", assignedSalesRep: "Tony Gomez", status: "No Response", quoteAmount: 1400, customerId: "C-1009" }),
    ld({ id: "l10", leadId: "L-2010", dateCreated: "2026-06-18", customerName: "Nina Patel", phone: "303-555-0144", email: "nina@example.com", rawSource: "Organic Search", confirmedSource: "Organic Search", serviceInterest: "Paint Correction", status: "Booked", bookedDate: "2026-06-15", bookedJobValue: 950, quoteAmount: 700, customerId: "C-1010" }),
  ];
}
function jobSample(): J[] {
  return [
    jb({ id: "j1", leadId: "L-2001", urableJobId: "1471", urableJobLink: "https://app.urable.com/jobs/1471", dateCompleted: "2026-06-04", customerName: "Marcus Webb", services: "Mobile Detail", category: "Interior Car Detail", leadTech: "Anthony Kiepprien", jobType: "Solo", subtotal: 300, techUpsellAmount: 40, tip: 50, confirmedSource: "Google Ads", customerId: "C-1001", reviewRequestStatus: "Received", reviewReceived: true, rating: 5 }),
    jb({ id: "j2", leadId: "L-2003", urableJobId: "1478", urableJobLink: "https://app.urable.com/jobs/1478", dateCompleted: "2026-06-06", customerName: "Dell Carter", services: "Paint Correction", leadTech: "Jarvis Hutchings", jobType: "Solo", subtotal: 650, techUpsellAmount: 120, tip: 80, confirmedSource: "Google Business Profile", customerId: "C-1003", reviewRequestStatus: "Received", reviewReceived: true, rating: 4, callbackCount: 1 }),
    jb({ id: "j3", leadId: "L-2005", urableJobId: "1488", urableJobLink: "https://app.urable.com/jobs/1488", dateCompleted: "2026-06-10", customerName: "Owen Park", services: "Maintenance Detail", unit: "Unit 2 | 2016 Ford Transit Connect", leadTech: "Julien Jerome-Stewart", jobType: "Solo", subtotal: 200, tip: 30, confirmedSource: "Google LSA", customerId: "C-1005", reviewRequestStatus: "Sent" }),
    jb({ id: "j4", leadId: "L-2008", urableJobId: "1494", urableJobLink: "https://app.urable.com/jobs/1494", dateCompleted: "2026-06-13", customerName: "Amber Cole", services: "Mobile Detail", leadTech: "Anthony Kiepprien", jobType: "Solo", subtotal: 275, techUpsellAmount: 25, tip: 40, confirmedSource: "Organic Search", customerId: "C-1008", reviewRequestStatus: "Received", reviewReceived: true, rating: 5 }),
    jb({ id: "j5", leadId: "L-2010", urableJobId: "1500", urableJobLink: "https://app.urable.com/jobs/1500", dateCompleted: "2026-06-15", customerName: "Nina Patel", services: "Paint Correction", leadTech: "Jarvis Hutchings", helperTech: "Justin David Smith JR", assigneeCount: 2, jobType: "Duo", subtotal: 700, techUpsellAmount: 150, tip: 100, confirmedSource: "Organic Search", customerId: "C-1010", reviewRequestStatus: "Received", reviewReceived: true, rating: 3, reviewNegative: true, callbackCount: 1 }),
    jb({ id: "j9", leadId: "L-2010", urableJobId: "1521", urableJobLink: "https://app.urable.com/jobs/1521", dateCompleted: "2026-06-22", customerName: "Nina Patel", services: "Callback", leadTech: "Jarvis Hutchings", jobType: "Solo", subtotal: 0, tip: 0, paymentStatus: "Fully Paid", confirmedSource: "Organic Search", customerId: "C-1010", adminNotes: "Return visit to fix streaking on hood — resolved." }),
    jb({ id: "j6", urableJobId: "1506", dateCompleted: "2026-06-17", customerName: "Ella Brooks", services: "Interior Detail", leadTech: "Julien Jerome-Stewart", jobType: "Solo", subtotal: 240, techUpsellAmount: 30, tip: 35, confirmedSource: "Referral", assignedSalesRep: "Tony Gomez", adminNotes: "Walk-in (no lead)", customerId: "C-1099" }),
    jb({ id: "j7", leadId: "L-2004", urableJobId: "1512", urableJobLink: "https://app.urable.com/jobs/1512", dateCompleted: "2026-06-19", customerName: "Sofia Reyes", services: "Window Tint", unit: "Shop | 5306 S Bannock St, Littleton, CO 80120", leadTech: "Anthony Kiepprien", helperTech: "Carlos", assigneeCount: 2, jobType: "Duo", subtotal: 300, tip: 25, paymentStatus: "Partially Paid", amountPaid: 150, confirmedSource: "Meta Ads", assignedSalesRep: "Jherico Megino", customerId: "C-1004" }),
    jb({ id: "j8", urableJobId: "1519", dateCompleted: "2026-06-20", customerName: "Len Cortez", services: "Ceramic Coating", leadTech: "Jarvis Hutchings", jobType: "Solo", subtotal: 1645, salesTotalRevenue: 1645, tip: 0, confirmedSource: "Google Ads", customerId: "C-1100" }),
  ];
}

