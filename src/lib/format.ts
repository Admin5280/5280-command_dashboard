export const money = (n: number) =>
  (isFinite(n) ? n : 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const money2 = (n: number) =>
  (isFinite(n) ? n : 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

export const num = (n: number) => (isFinite(n) ? n : 0).toLocaleString("en-US");

export const pct = (n: number, digits = 1) => `${((isFinite(n) ? n : 0) * 100).toFixed(digits)}%`;

export const safeDiv = (a: number, b: number) => (b ? a / b : 0);

export const roas = (rev: number, spend: number) => (spend ? rev / spend : 0);

/** yyyy-mm-dd of today */
export const today = () => new Date().toISOString().slice(0, 10);

export const prettyDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Group an array by a key selector into { key: items[] } */
export function groupBy<T>(rows: T[], key: (r: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const r of rows) {
    const k = key(r) || "—";
    (out[k] ||= []).push(r);
  }
  return out;
}

export const sum = <T,>(rows: T[], val: (r: T) => number) => rows.reduce((a, r) => a + (val(r) || 0), 0);
