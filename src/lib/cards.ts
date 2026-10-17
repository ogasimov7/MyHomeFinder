/* ============================================================
   bina.az search-result cards -> listings.

   The WebView hands over each card's visible text; everything is
   read from that text rather than from CSS classes, because prices,
   areas and room counts survive a redesign and class names do not.

   A card that cannot be read is never guessed at: it is counted,
   with the reason, so the app can say what its ranking does and
   does not cover.
   ============================================================ */

import { resolveFromText } from "./geo";
import type { Site } from "./sites";

/** What the injected reader sends back for each card it found. */
export interface RawCard {
  id: string;
  url: string;
  text: string;
}

/** What is being bought: the two shapes the app ranks. */
export type PropertyType = "flat" | "house";

export interface Listing {
  id: string;
  url: string;
  price: number;
  area: number;
  rooms: number;
  floor: number | null;
  totalFloors: number | null;
  pricePerSqm: number;
  districtId: string;
  districtName: string;
  areaId: string;
  areaName: string;
  areaAssumed: boolean;
  marketKnown: boolean;
  /** the ad was priced in USD; the manat figure is arithmetic, not the ad */
  priceConverted: boolean;
  type: PropertyType;
  title: string;
  /** when the card says it was posted; null when the card says nothing */
  postedAt: string | null;
}

/** Why a card stayed out of the ranking. */
export type SkipReason = "geo" | "notFlat" | "unreadable" | "stale" | "rent" | "type";

export interface ScanResult {
  listings: Listing[];
  skips: Record<SkipReason, number>;
  seen: number;
}

// Cards print the price bare — "83 000", no currency — so it is recognised by
// shape, with the currency optional. A floor keeps years and times out of it.
const PRICE_RE = /(\d{1,3}(?:[\s .,]\d{3})+|\d{4,})\s*(AZN|₼|USD|\$)?/i;
const AREA_RE = /([\d]+(?:[.,]\d+)?)\s*(?:m\s*²|m\s*2(?!\d)|kv\.?\s*m)/i;
const ROOMS_RE = /(\d+)\s*[-–—]?\s*otaq/i;
/** Land is sold by the sot; the app does not rank plots, only homes. */
const SOT_RE = /\d+(?:[.,]\d+)?\s*sot/i;
const FLOOR_RE = /(\d{1,2})\s*\/\s*(\d{1,2})/;
const USD_RE = /(USD|\$)/i;

/* Cards date themselves in three ways on bina.az — "bugün 17:42",
   "dünən 23:15", "21 avqust 2026" — and as "19.08.2026" on kub.az. A card
   that says nothing keeps a null date and is never called stale for it. */
const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr",
];
const TODAY_RE = /bugün\s+(\d{1,2}):(\d{2})/i;
const YESTERDAY_RE = /dünən\s+(\d{1,2}):(\d{2})/i;
const NAMED_DATE_RE = new RegExp(`(\\d{1,2})\\s+(${MONTHS.join("|")})\\s+(\\d{4})`, "i");
const NUMERIC_DATE_RE = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;

/** The card's own date, read against `now` so "bugün" means the run's day. */
export function readPostedAt(text: string, now = new Date()): Date | null {
  const today = TODAY_RE.exec(text);
  if (today) {
    const d = new Date(now);
    d.setHours(Number(today[1]), Number(today[2]), 0, 0);
    return d;
  }
  const yesterday = YESTERDAY_RE.exec(text);
  if (yesterday) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    d.setHours(Number(yesterday[1]), Number(yesterday[2]), 0, 0);
    return d;
  }
  const named = NAMED_DATE_RE.exec(text);
  if (named) {
    const month = MONTHS.indexOf(named[2].toLocaleLowerCase("az"));
    if (month >= 0) return new Date(Number(named[3]), month, Number(named[1]), 12, 0, 0, 0);
  }
  const numeric = NUMERIC_DATE_RE.exec(text);
  if (numeric) {
    return new Date(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]), 12, 0, 0, 0);
  }
  return null;
}

/** True when the card is older than the window the scan was asked for. */
export function isStale(postedAt: Date | null, freshDays: number, now = new Date()): boolean {
  if (!postedAt) return false; // an undated card is not evidence of age
  return now.getTime() - postedAt.getTime() > freshDays * 24 * 60 * 60 * 1000;
}

/* The window the app works in: a ranking is about what is on the market now,
   and a month-old asking price is not evidence about today. */
export const FRESH_DAYS = 5;

/** A sale never costs three digits. */
const MIN_SALE_PRICE = 3000;

/** The manat is pegged to the dollar at 1.70; the conversion is always shown. */
export const USD_AZN = 1.7;

function readPrice(text: string): { azn: number; converted: boolean } | null {
  const re = new RegExp(PRICE_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const value = Number(m[1].replace(/[^\d]/g, "")) || 0;
    if (value < MIN_SALE_PRICE) continue;
    if (USD_RE.test(m[2] ?? "")) return { azn: Math.round(value * USD_AZN), converted: true };
    return { azn: value, converted: false };
  }
  return null;
}

/* What the card is, as far as the card can say.

   The cards are thinner than the categories they sit in: on the house pages a
   listing reads "490 000 Mərdəkan q. 5 otaqlı 175 m²", which is a flat's card
   without the floor. So the text is only asked for what it can prove — a plot
   by the sot, a house by name, a flat by its floor — and whatever it cannot
   settle is taken to be the type of the page it was read from.

   `null` means this is not a home at all: a plot, and with it the garages and
   offices that print a size without rooms. */
function classify(text: string, requested: PropertyType): PropertyType | null {
  const lower = text.toLocaleLowerCase("az");
  if (SOT_RE.test(text) && !ROOMS_RE.test(text)) return null;
  if (lower.includes("həyət evi") || lower.includes("villa") || lower.includes("bağ evi")) {
    return "house";
  }
  if (FLOOR_RE.test(text)) return "flat";
  return requested;
}

/** How wide a window the scan accepts, and what "now" means while it runs. */
export interface ScanOptions {
  /** cards older than this many days are skipped as stale; 0 keeps them all */
  freshDays?: number;
  now?: Date;
  /** the site the cards came from, when it needs the text read differently */
  site?: Site;
  /** what the search was for; cards of another type are skipped */
  type?: PropertyType;
}

export type CardOutcome = { ok: true; listing: Listing } | { ok: false; reason: SkipReason };

export function parseCard(card: RawCard, options: ScanOptions = {}): CardOutcome {
  const text = card.text;
  const requested = options.type ?? "flat";

  // Some sites sell and rent from the same search page; a monthly rent would
  // sit at the top of a sale ranking and stay there.
  if (options.site?.isRental?.(card)) return { ok: false, reason: "rent" };

  const type = classify(text, requested);
  // A plot is not a home, and a house among flats has its own market:
  // comparing the two would move the median for everyone on the page.
  if (!type) return { ok: false, reason: "notFlat" };
  if (type !== requested) return { ok: false, reason: "type" };

  const price = readPrice(text);
  const areaM = AREA_RE.exec(text);
  const roomsM = ROOMS_RE.exec(text);

  // No price or no size means this is not a home for sale: a garage, an
  // office, a card with neither figure printed on it.
  if (!price || !areaM) return { ok: false, reason: "notFlat" };

  const area = Number(areaM[1].replace(",", ".")) || 0;
  const rooms = roomsM ? Number(roomsM[1]) : 0;
  if (price.azn <= 0 || area <= 0 || rooms <= 0) return { ok: false, reason: "notFlat" };

  // Where the site prints an address of its own, only that is read: a place
  // name inside the seller's prose says nothing about where the flat is.
  const locationText = options.site?.locationText ? options.site.locationText(text) : text;
  const geo = locationText ? resolveFromText(locationText) : null;
  if (!geo) return { ok: false, reason: "geo" };

  const postedAt = readPostedAt(text, options.now);
  if (options.freshDays && isStale(postedAt, options.freshDays, options.now)) {
    return { ok: false, reason: "stale" };
  }

  const floorM = FLOOR_RE.exec(text);
  return {
    ok: true,
    listing: {
      id: card.id,
      url: card.url,
      price: price.azn,
      area,
      rooms,
      floor: floorM ? Number(floorM[1]) : null,
      totalFloors: floorM ? Number(floorM[2]) : null,
      pricePerSqm: price.azn / area,
      districtId: geo.districtId,
      districtName: geo.districtName,
      areaId: geo.areaId,
      areaName: geo.areaName,
      areaAssumed: geo.areaAssumed,
      marketKnown: geo.marketKnown,
      priceConverted: price.converted,
      postedAt: postedAt ? postedAt.toISOString() : null,
      type,
      title: text.slice(0, 90),
    },
  };
}

export function scanCards(cards: RawCard[], options: ScanOptions = {}): ScanResult {
  const listings: Listing[] = [];
  const skips: Record<SkipReason, number> = {
    geo: 0,
    notFlat: 0,
    unreadable: 0,
    stale: 0,
    rent: 0,
    type: 0,
  };
  const seenIds = new Set<string>();

  for (const card of cards) {
    if (seenIds.has(card.id)) continue;
    seenIds.add(card.id);
    if (!card.text || !card.text.trim()) {
      skips.unreadable++;
      continue;
    }
    const outcome = parseCard(card, options);
    if (outcome.ok) listings.push(outcome.listing);
    else skips[outcome.reason]++;
  }

  return { listings, skips, seen: seenIds.size };
}
