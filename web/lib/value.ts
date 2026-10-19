/* ============================================================
   Value within a group, against the group's own average price
   per m². The cheapest is the best value; the others are either
   below the average — a good offer, with no figure, so it hands
   a seller no number to raise towards — or above it, by so much.

   The group is what the viewer is looking at — the listings of one
   place in a search, or of one circle on the map — never the market
   at large. A group of one says nothing, so it gets no badge.
   ============================================================ */

/** The manat is pegged to the dollar; see src/lib/cards.ts. */
import { USD_AZN } from "../../src/lib/cards";

/** What every compared listing knows of its group. */
interface Group {
  perSqm: number;
  /** how many listings the group holds */
  size: number;
  /** the group's mean price per m² */
  average: number;
  /** the cheapest price per m² in the group */
  bestPerSqm: number;
}

export type Value =
  | ({ kind: "best" } & Group)
  /** below the group's average */
  | ({ kind: "good"; belowPct: number } & Group)
  /** above the group's average, by premiumPct */
  | ({ kind: "dearer"; premiumPct: number } & Group)
  /** alone in its group, or without a size to compare by */
  | { kind: "none" };

/**
 * Places each item against its group: the cheapest per m², below the average,
 * or above it. Items whose price per m² cannot be known stay out of the group
 * and get `none`.
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
    const bestPerSqm = Math.min(...group.map((g) => g.perSqm));
    const average = group.reduce((sum, g) => sum + g.perSqm, 0) / group.length;
    for (const { item, perSqm: v } of group) {
      const known = { perSqm: v, size: group.length, average, bestPerSqm };
      // Equal to the cheapest is the cheapest: a tie shares the badge.
      out.set(
        item,
        v <= bestPerSqm
          ? { kind: "best", ...known }
          : v < average
            ? { kind: "good", belowPct: ((average - v) / average) * 100, ...known }
            : { kind: "dearer", premiumPct: ((v - average) / average) * 100, ...known },
      );
    }
  }
  return out;
}

/** Best first, then the furthest below the average, then the least above it;
    what cannot be compared goes last. */
export function byValue(a: Value, b: Value): number {
  const rank = (v: Value) => ({ best: 0, good: 1, dearer: 2, none: 3 })[v.kind];
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (a.kind === "good" && b.kind === "good") return b.belowPct - a.belowPct;
  if (a.kind === "dearer" && b.kind === "dearer") return a.premiumPct - b.premiumPct;
  return 0;
}

export type ValueTone = "best" | "good" | "dearer";

export function valueLabel(v: Value): { label: string; tone: ValueTone } | null {
  if (v.kind === "best") return { label: "Ən sərfəli", tone: "best" };
  if (v.kind === "good") return { label: "Sərfəli təklif", tone: "good" };
  if (v.kind === "dearer") {
    const pct = Math.round(v.premiumPct);
    return { label: pct < 1 ? "Orta qiymətdə" : `${pct}% baha`, tone: "dearer" };
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
