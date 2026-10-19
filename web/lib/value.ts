/* ============================================================
   Best value within a group: which listing is cheapest by the
   square metre, and how much dearer each of the others is.

   The group is what the viewer is looking at — the listings of one
   place in a search, or of one circle on the map — never the market
   at large. A group of one says nothing, so it gets no badge.
   ============================================================ */

/** The manat is pegged to the dollar; see src/lib/cards.ts. */
import { USD_AZN } from "../../src/lib/cards";

export type Value =
  | { kind: "best"; perSqm: number; size: number }
  | { kind: "dearer"; perSqm: number; premiumPct: number; bestPerSqm: number; size: number }
  /** alone in its group, or without a size to compare by */
  | { kind: "none" };

/**
 * Compares each item with the cheapest per m² in its group. Items whose price
 * per m² cannot be known stay out of the group and get `none`.
 */
export function bestValue<T>(items: T[], groupOf: (item: T) => string, perSqm: (item: T) => number | null): Map<T, Value> {
  const groups = new Map<string, { item: T; perSqm: number }[]>();
  for (const item of items) {
    const v = perSqm(item);
    if (v === null || !Number.isFinite(v) || v <= 0) continue;
    const key = groupOf(item);
    const group = groups.get(key) ?? [];
    group.push({ item, perSqm: v });
    groups.set(key, group);
  }

  const out = new Map<T, Value>();
  for (const item of items) out.set(item, { kind: "none" });
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const best = Math.min(...group.map((g) => g.perSqm));
    for (const { item, perSqm: v } of group) {
      // Equal to the cheapest is the cheapest: a tie shares the badge.
      out.set(
        item,
        v <= best
          ? { kind: "best", perSqm: v, size: group.length }
          : { kind: "dearer", perSqm: v, premiumPct: ((v - best) / best) * 100, bestPerSqm: best, size: group.length },
      );
    }
  }
  return out;
}

/** Best first, then the cheapest premium; what cannot be compared goes last. */
export function byValue(a: Value, b: Value): number {
  const rank = (v: Value) => (v.kind === "best" ? 0 : v.kind === "dearer" ? 1 : 2);
  return rank(a) - rank(b) || (a.kind === "dearer" && b.kind === "dearer" ? a.premiumPct - b.premiumPct : 0);
}

export function valueLabel(v: Value): { label: string; tone: "best" | "dearer" } | null {
  if (v.kind === "best") return { label: "Ən sərfəli", tone: "best" };
  if (v.kind === "dearer") {
    const pct = Math.round(v.premiumPct);
    return { label: pct < 1 ? "1%-dən az baha" : `${pct}% baha`, tone: "dearer" };
  }
  return null;
}

/** A listing price in manat per m², as the cards compare them. */
export function manatPerSqm(price: number, currency: string, area: number | null): number | null {
  if (!area || area <= 0 || price <= 0) return null;
  const azn = currency === "USD" ? price * USD_AZN : currency === "AZN" ? price : null;
  return azn === null ? null : azn / area;
}

/** The plain mean of the prices per m² that can be read, and how many went
    into it; null when none can. */
export function meanPerSqm(values: (number | null | undefined)[]): { perSqm: number; count: number } | null {
  const known = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (!known.length) return null;
  return { perSqm: known.reduce((sum, v) => sum + v, 0) / known.length, count: known.length };
}
