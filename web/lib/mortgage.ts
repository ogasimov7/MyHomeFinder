/* Mortgage terms are the viewer's own: kept in their browser, never sent. */

export interface Terms {
  /** share of the price paid up front, in percent */
  downPct: number;
  years: number;
  /** yearly interest rate, in percent */
  ratePct: number;
}

export const DEFAULT_TERMS: Terms = { downPct: 20, years: 20, ratePct: 8 };

/** The annuity payment on what is left after the down payment. */
export function monthlyPayment(price: number, terms: Terms): number {
  const principal = price * (1 - terms.downPct / 100);
  const n = Math.round(terms.years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = terms.ratePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export function cleanTerms(value: Partial<Terms> | null | undefined): Terms {
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  return {
    downPct: num(value?.downPct, 0, 90, DEFAULT_TERMS.downPct),
    years: num(value?.years, 1, 30, DEFAULT_TERMS.years),
    ratePct: num(value?.ratePct, 0, 30, DEFAULT_TERMS.ratePct),
  };
}
