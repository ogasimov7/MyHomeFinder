/* ============================================================
   Ranking, measured against the page the user just scrolled.

   The reference is taken at the finest level that still has
   something to compare against: the listing's own area first, its
   district next, and — when it is the only listing around — itself,
   which is labelled rather than printed as a hollow 0%.

   A page-wide median across districts is never used: that would
   measure the district, not the listing. Nor is a page ever mixed:
   the scan hands over one property type, because a house and a flat
   are not priced by the same square metre.
   ============================================================ */

import type { Listing, ScanResult, SkipReason } from "./cards";

export type ReferenceLevel = "area" | "district" | "self";

export interface Reference {
  median: number;
  count: number;
  level: ReferenceLevel;
  name: string;
}

export interface RankedListing {
  listing: Listing;
  /** percent below (−) or above (+) the reference; null when it is its own */
  deviationPct: number | null;
  reference: Reference;
}

export interface RankingResult {
  /** the best maxRows listings (MAX_ROWS unless asked); the rest are dropped */
  rows: RankedListing[];
  /** how many listings were ranked before the list was cut down */
  ranked: number;
  seen: number;
  skips: Record<SkipReason, number>;
  /** how many distinct areas the page's listings fall into */
  areas: number;
  sourceUrl: string;
  at: string;
}

/** At least two listings are needed before a group can say anything about one. */
const MIN_COMPARISON = 2;

/* The scan itself is unbounded — the more listings it reads, the truer the
   medians — but a ranking is read from the top, and a list past this length is
   storage rather than an answer. */
export const MAX_ROWS = 100;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function group(listings: Listing[], key: (l: Listing) => string) {
  const buckets = new Map<string, number[]>();
  for (const l of listings) {
    if (!Number.isFinite(l.pricePerSqm) || l.pricePerSqm <= 0) continue;
    const bucket = buckets.get(key(l)) ?? [];
    bucket.push(l.pricePerSqm);
    buckets.set(key(l), bucket);
  }
  return buckets;
}

export interface RankOptions {
  /** More listings of the same type that shape the medians but are not
      ranked themselves — a place's own recent listings, when the page alone
      holds too few of them to say what the place costs. */
  pool?: Listing[];
  /** How many rows to keep; MAX_ROWS by default. A page that groups the rows
      again afterwards needs all of them. */
  maxRows?: number;
}

export function rank(scan: ScanResult, sourceUrl: string, options: RankOptions = {}): RankingResult {
  // The scan has already kept one type and one type only, so every median
  // here is measured against listings of the same kind.
  const listings = scan.listings;
  // A listing that is both on the page and in the pool is counted once.
  const onPage = new Set(listings.map((l) => l.id));
  const crowd = [...listings, ...(options.pool ?? []).filter((l) => !onPage.has(l.id))];
  const byArea = group(crowd, (l) => l.areaId);
  const byDistrict = group(crowd, (l) => l.districtId);

  const rows: RankedListing[] = listings.map((listing) => {
    const areaValues = byArea.get(listing.areaId) ?? [];
    const districtValues = byDistrict.get(listing.districtId) ?? [];

    let reference: Reference;
    if (areaValues.length >= MIN_COMPARISON) {
      reference = { median: median(areaValues), count: areaValues.length, level: "area", name: listing.areaName };
    } else if (districtValues.length >= MIN_COMPARISON) {
      reference = { median: median(districtValues), count: districtValues.length, level: "district", name: `${listing.districtName} r.` };
    } else {
      reference = { median: listing.pricePerSqm, count: 1, level: "self", name: listing.areaName };
    }

    const deviationPct =
      reference.level === "self" ? null : ((listing.pricePerSqm - reference.median) / reference.median) * 100;

    return { listing, deviationPct, reference };
  });

  // Cheapest against its own reference leads; price per m² breaks the ties that
  // single-listing areas (null by definition) would otherwise leave unordered.
  rows.sort(
    (a, b) =>
      (a.deviationPct ?? 0) - (b.deviationPct ?? 0) ||
      a.listing.pricePerSqm - b.listing.pricePerSqm,
  );

  return {
    // Every listing shaped the medians above; only the best are kept below.
    rows: rows.slice(0, options.maxRows ?? MAX_ROWS),
    ranked: rows.length,
    seen: scan.seen,
    skips: scan.skips,
    areas: new Set(listings.map((l) => l.areaId)).size,
    sourceUrl,
    at: new Date().toISOString(),
  };
}

/** The counter line, said in words rather than as one lump of "skipped". */
export function coverageParts(result: RankingResult): string[] {
  const ranked = result.ranked ?? result.rows.length; // results stored before the cap
  const parts = [`${result.seen} elandan ${ranked}-i sıralandı`];
  if (ranked > result.rows.length) parts.push(`ilk ${result.rows.length}-i göstərilir`);
  if (result.skips.type) parts.push(`${result.skips.type} başqa növ`);
  if (result.skips.geo) parts.push(`${result.skips.geo} ünvan tanınmadı`);
  if (result.skips.notFlat) parts.push(`${result.skips.notFlat} mənzil deyil`);
  if (result.skips.unreadable) parts.push(`${result.skips.unreadable} oxunmadı`);
  if (result.skips.stale) parts.push(`${result.skips.stale} köhnə elan`);
  if (result.skips.rent) parts.push(`${result.skips.rent} kirayə elanı`);
  return parts;
}
