import { Job } from "./types";
import { groupBy, safeDiv, sum } from "./format";
import { completed } from "./metrics";

export type QualityStatus = "Excellent" | "Needs Review" | "Critical" | "—";
export interface ServiceQualityRow {
  service: string;
  completed: number;
  reviewRequests: number;
  reviewsReceived: number;
  reviewPct: number;
  avgRating: number;
  callbacks: number;
  callbackPct: number;
  negativeReviews: number;
  negativePct: number;
  redoJobs: number;
  redoPct: number;
  status: QualityStatus;
  tone: "good" | "warn" | "danger" | "neutral";
}

export function qualityStatus(callbackPct: number, avgRating: number, negativeReviews: number, reviewPct: number):
  { status: QualityStatus; tone: "good" | "warn" | "danger" | "neutral" } {
  if (callbackPct > 0.10 || (avgRating > 0 && avgRating < 4.5) || negativeReviews > 0) return { status: "Critical", tone: "danger" };
  if ((callbackPct >= 0.05 && callbackPct <= 0.10) || (avgRating > 0 && avgRating < 4.8)) return { status: "Needs Review", tone: "warn" };
  if (reviewPct >= 0.50 && callbackPct < 0.05 && avgRating >= 4.8) return { status: "Excellent", tone: "good" };
  return { status: "—", tone: "neutral" };
}

/** Per-service quality & reputation metrics over completed jobs in range. */
export function serviceQuality(jobs: Job[], from: string, to: string): ServiceQualityRow[] {
  const inR = (iso: string) => !!iso && (!from || iso >= from) && (!to || iso <= to);
  const comp = completed(jobs).filter((j) => inR(j.dateCompleted));
  const byService = groupBy(comp, (j) => j.services || "—");
  return Object.entries(byService).map(([service, items]) => {
    const completedCount = items.length;
    const reviewRequests = items.filter((j) => j.reviewRequestStatus && j.reviewRequestStatus !== "Not Sent").length;
    const reviewsReceived = items.filter((j) => j.reviewReceived).length;
    const rated = items.filter((j) => (j.rating || 0) > 0);
    const avgRating = rated.length ? sum(rated, (j) => j.rating) / rated.length : 0;
    const callbacks = sum(items, (j) => j.callbackCount || 0);
    const negativeReviews = items.filter((j) => j.reviewNegative).length;
    const redoJobs = sum(items, (j) => j.redoCount || 0);
    const reviewPct = safeDiv(reviewsReceived, completedCount);
    const callbackPct = safeDiv(callbacks, completedCount);
    const negativePct = safeDiv(negativeReviews, reviewsReceived);
    const redoPct = safeDiv(redoJobs, completedCount);
    const { status, tone } = qualityStatus(callbackPct, avgRating, negativeReviews, reviewPct);
    return {
      service, completed: completedCount, reviewRequests, reviewsReceived, reviewPct, avgRating,
      callbacks, callbackPct, negativeReviews, negativePct, redoJobs, redoPct, status, tone,
    };
  }).sort((a, b) => b.completed - a.completed);
}

export interface QualityTotals {
  completed: number; reviewRequests: number; reviewsReceived: number; reviewPct: number;
  callbacks: number; callbackPct: number; avgRating: number; negativeReviews: number; redoJobs: number;
}
export function qualityTotals(rows: ServiceQualityRow[]): QualityTotals {
  const completedCount = sum(rows, (r) => r.completed);
  const reviewsReceived = sum(rows, (r) => r.reviewsReceived);
  const callbacks = sum(rows, (r) => r.callbacks);
  const ratedWeighted = sum(rows.filter((r) => r.avgRating > 0), (r) => r.avgRating * r.reviewsReceived || r.avgRating * r.completed);
  const ratedWeight = sum(rows.filter((r) => r.avgRating > 0), (r) => r.reviewsReceived || r.completed);
  return {
    completed: completedCount,
    reviewRequests: sum(rows, (r) => r.reviewRequests),
    reviewsReceived,
    reviewPct: safeDiv(reviewsReceived, completedCount),
    callbacks,
    callbackPct: safeDiv(callbacks, completedCount),
    avgRating: safeDiv(ratedWeighted, ratedWeight),
    negativeReviews: sum(rows, (r) => r.negativeReviews),
    redoJobs: sum(rows, (r) => r.redoJobs),
  };
}
