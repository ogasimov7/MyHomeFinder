/* ============================================================
   One search page, read from the site and ranked.

   The phone app lets the user scroll a site and reads the cards it
   draws; here the server asks the site for the same page. Either way
   the cards go through the one parser, geography and ranking in
   ../src/lib, so a listing scores the same on the phone and on the web.

   About a hundred listings are read per search — the same crowd the
   app waits for before it ranks — and the result is cached for ten
   minutes, so a busy page costs the sites a handful of requests an
   hour, not one per visitor.
   ============================================================ */

import "server-only";
import { cacheLife } from "next/cache";
import { parse, type HTMLElement, type Node } from "node-html-parser";
import { FRESH_DAYS, scanCards, type Listing, type PropertyType, type RawCard } from "../../src/lib/cards";
import { fold } from "../../src/lib/geo";
import { siteFor } from "../../src/lib/sites";
import { coverageParts, rank, type RankedListing } from "../../src/lib/ranking";
import { BUDGETS, SIZES, range, type Category, type MarketKey, type Source } from "./query";

/** What a listing carries beyond what its card text can say. */
export interface Extras {
  photo: string | null;
  bill?: boolean;
  repair?: boolean;
  mortgage?: boolean;
  vip?: boolean;
}

export interface MarketRow extends RankedListing {
  source: Source;
  extras: Extras;
  /** where the site listed it: both sites list newest first, to the minute */
  order: number;
}

export interface Market {
  source: Source;
  rows: MarketRow[];
  /** each place's own recent listings, which the medians were taken over */
  pool: Listing[];
  /** how many cards were read off the site for this search */
  read: number;
  /** the coverage line, in the app's own words */
  coverage: string[];
  /** how many listings the site holds for this search, when it says */
  total: number | null;
  sourceUrl: string;
  at: string;
  /** filters this source could not apply on its side, applied after ranking */
  postFilter: boolean;
}

/** Enough listings for the area medians to mean something; see reader.ts. */
const TARGET = 300;
export const TIMEOUT_MS = 12_000;
export const USER_AGENT = "Mozilla/5.0 (compatible; HomeFinder/1.0)";

export async function getMarket(key: MarketKey): Promise<Market> {
  "use cache";
  cacheLife("market");
  return key.source === "kub" ? readKub(key.category) : readBina(key);
}

/* ---------------- bina.az ----------------

   bina.az draws its search page in the browser from a GraphQL query; the
   server asks the same query for the same filters. The answer is structured,
   but it is printed back into the card text bina.az itself shows, so the one
   parser reads it — the rules about types, currencies, dates and unknown
   addresses stay in one place. */

const BINA_QUERY = `query SearchItems($first: Int, $filter: ItemFilter, $sort: ItemConnectionSort!, $cursor: String) {
  itemsConnection(first: $first, after: $cursor, filter: $filter, sort: $sort) {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges { node {
      id rooms floor floors path updatedAt
      area { value units }
      price { total currency }
      location { id fullName }
      city { name }
      hasBillOfSale hasRepair hasMortgage isVipped
      preview { f460x345 }
    } }
  }
}`;

export const BINA_CATEGORY: Record<Category, string> = { flat: "1", new: "2", old: "3", house: "5" };
/** bina.az serves at most this many per request */
const BINA_PAGE = 25;

interface BinaItem {
  id: string;
  rooms: number | null;
  floor: number | null;
  floors: number | null;
  path: string;
  updatedAt: string | null;
  area: { value: number; units: string } | null;
  price: { total: number; currency: string } | null;
  location: { id?: string; fullName: string } | null;
  city: { name: string } | null;
  hasBillOfSale: boolean;
  hasRepair: boolean;
  hasMortgage: boolean;
  isVipped: boolean;
  preview: { f460x345: string | null } | null;
}

interface BinaPage {
  totalCount: number;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  edges: { node: BinaItem }[];
}

function binaFilter(key: MarketKey) {
  const price = range(BUDGETS, key.budget);
  const area = range(SIZES, key.size);
  return {
    cityId: "1",
    leased: false,
    categoryId: BINA_CATEGORY[key.category],
    roomIds: key.rooms.length ? key.rooms : undefined,
    priceFrom: price.from,
    priceTo: price.to,
    areaFrom: area.from,
    areaTo: area.to,
    hasBillOfSale: key.bill || undefined,
    hasRepair: key.repair || undefined,
    hasMortgage: key.mortgage || undefined,
  };
}

/** The fields a bina.az card prints, shared by search results and a single item. */
export type BinaCardFields = Pick<BinaItem, "price" | "rooms" | "area" | "floor" | "floors" | "location" | "city" | "updatedAt">;

/** The card bina.az prints for an item: price, rooms, size, floor, place, date. */
export function binaCardText(item: BinaCardFields): string {
  const parts: string[] = [];
  if (item.price) parts.push(`${item.price.total} ${item.price.currency}`);
  if (item.rooms) parts.push(`${item.rooms} otaqlı`);
  if (item.area) parts.push(`${item.area.value} m²`);
  if (item.floor && item.floors) parts.push(`${item.floor}/${item.floors} mərtəbə`);
  if (item.location) parts.push(item.location.fullName);
  if (item.city) parts.push(item.city.name);
  // The site's own local date, read off the timestamp rather than through a
  // time zone: "2026-10-16T23:34:22+04:00" is the 16th in Baku.
  const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(item.updatedAt ?? "");
  if (date) parts.push(`${date[3]}.${date[2]}.${date[1]}`);
  return parts.join(" ");
}

async function readBina(key: MarketKey): Promise<Market> {
  const filter = binaFilter(key);
  const items: BinaItem[] = [];
  let cursor: string | null = null;
  let total: number | null = null;

  while (items.length < TARGET) {
    const res = await fetch("https://bina.az/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify({
        operationName: "SearchItems",
        query: BINA_QUERY,
        variables: { first: BINA_PAGE, filter, sort: "BUMPED_AT_DESC", cursor },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`bina.az ${res.status}`);
    const json = (await res.json()) as { data?: { itemsConnection: BinaPage }; errors?: { message: string }[] };
    if (!json.data) throw new Error(`bina.az: ${json.errors?.[0]?.message ?? "boş cavab"}`);

    const page = json.data.itemsConnection;
    total = page.totalCount;
    items.push(...page.edges.map((e) => e.node));
    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
    cursor = page.pageInfo.endCursor;
  }

  const extras = new Map<string, Extras>();
  const cards: RawCard[] = items.map((item) => {
    extras.set(item.id, {
      photo: item.preview?.f460x345 ?? null,
      bill: item.hasBillOfSale,
      repair: item.hasRepair,
      mortgage: item.hasMortgage,
      vip: item.isVipped,
    });
    return { id: item.id, url: `https://bina.az${item.path}`, text: binaCardText(item) };
  });

  const places = new Map<string, Place>();
  for (const item of items) {
    const place = binaPlace(item);
    if (place) places.set(item.id, place);
  }
  const pool = await placeSamples(key.category, [...new Map([...places.values()].map((p) => [p.id, p])).values()]);

  const sourceUrl = `https://bina.az${BINA_PATHS[key.category]}`;
  return finish(cards, extras, "bina", key.category, sourceUrl, total, false, places, pool);
}

const BINA_PATHS: Record<Category, string> = {
  flat: "/alqi-satqi/menziller",
  new: "/alqi-satqi/menziller/yeni-tikili",
  old: "/alqi-satqi/menziller/kohne-tikili",
  house: "/alqi-satqi/heyet-evleri",
};

/* ---------------- kub.az ----------------

   kub.az renders its cards on the server, but ignores filters in the
   address: the page is read whole — new and old buildings told apart by the
   category the card prints — and rooms, budget and size are applied after
   the ranking, so the medians come from the full page. */

const KUB_PAGES = 15;
/** pages asked for at once, so the site is not hit with all of them together */
const KUB_BATCH = 5;

async function readKub(category: Category): Promise<Market> {
  const site = siteFor("https://kub.az")!;
  const type: PropertyType = category === "house" ? "house" : "flat";
  const base = `https://kub.az${site.searchPaths[type]}`;

  const readPage = async (i: number) => {
    const res = await fetch(i === 0 ? base : `${base}?page=${i + 1}`, {
      headers: { "user-agent": USER_AGENT, "accept-language": "az" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`kub.az ${res.status}`);
    return res.text();
  };
  const pages: string[] = [];
  for (let i = 0; i < KUB_PAGES; i += KUB_BATCH) {
    const batch = Array.from({ length: Math.min(KUB_BATCH, KUB_PAGES - i) }, (_, j) => readPage(i + j));
    pages.push(...(await Promise.all(batch)));
  }

  const extras = new Map<string, Extras>();
  const places = new Map<string, Place>();
  const cards: RawCard[] = [];
  let total: number | null = null;

  for (const html of pages) {
    const root = parse(html);
    const found = /(\d+)\s+elan tapılıb/.exec(root.text);
    if (found && total === null) total = Number(found[1]);

    for (const item of root.querySelectorAll(".items .item")) {
      const link = item.querySelector('a[href*="/elan/"]');
      const href = link?.getAttribute("href") ?? "";
      const id = new RegExp(site.idPattern).exec(href)?.[1];
      // A listing bumped while the pages are read can show on two of them.
      if (!id || extras.has(id)) continue;
      const text = visibleText(item);
      if (category === "new" && !/yeni tikili/i.test(text)) continue;
      if (category === "old" && !/köhnə tikili/i.test(text)) continue;
      const img = item.querySelector("img")?.getAttribute("src");
      extras.set(id, { photo: img ? new URL(img, "https://kub.az").href : null, vip: item.classList.contains("vip") });
      cards.push({ id, url: new URL(href, "https://kub.az").href, text });
      const place = kubPlace(href);
      if (place) places.set(id, place);
    }
  }

  return finish(cards, extras, "kub", category, base, total, true, places, []);
}

/** The text a reader sees, joined the way the app's reader joins it. */
function visibleText(el: HTMLElement): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      const t = node.text.trim();
      if (t) parts.push(t);
      return;
    }
    if ((node as HTMLElement).tagName === "SCRIPT" || (node as HTMLElement).tagName === "STYLE") return;
    node.childNodes.forEach(walk);
  };
  walk(el);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/* ---------------- places ----------------

   A district is too coarse to price a flat by: 28 May and Keşlə are both
   Nəsimi-adjacent and nothing alike. Listings are compared within the place
   the site itself files them under — a metro station, a settlement, a
   microdistrict ("7-ci mikrorayon q.") — and only fall back to the district
   when the place has too few listings to have a price of its own. */

export interface Place {
  /** stable across searches, so the same place is one bucket everywhere */
  id: string;
  /** as the site names it: "28 May m.", "Masazır q." */
  name: string;
  /** bina.az's own location id, when the place can be asked for directly */
  binaId?: string;
}

export function binaPlace(item: { location: { id?: string; fullName: string } | null }): Place | null {
  const loc = item.location;
  if (!loc?.id) return null;
  return { id: `bina:${loc.id}`, name: loc.fullName, binaId: loc.id };
}

/* kub.az spells the place out in the listing's address, dash by dash:
   "…-Nəsimi r-4-cü mikrorayon-Memar Əcəmi m-Kupçalı-id-23147986". After the
   district come the settlement (itself split at its hyphen: "4", "cü
   mikrorayon") and then the metro. The settlement is the finer of the two. */
export function kubPlace(href: string): Place | null {
  let path = href;
  try {
    path = decodeURIComponent(href);
  } catch {
    /* keep the raw path */
  }
  const parts = path.split("/").pop()!.split("-").map((p) => p.trim());
  const district = parts.findIndex((p) => / r$/.test(p));
  const metro = parts.find((p) => / m$/.test(p));
  const settlement: string[] = [];
  if (district >= 0) {
    for (const p of parts.slice(district + 1)) {
      if (/ m$/.test(p) || p === "id" || /^kupçalı$/i.test(p)) break;
      settlement.push(p);
    }
  }
  const name = settlement.length ? `${settlement.join("-")} q.` : metro ? `${metro}.` : null;
  return name ? { id: `kub:${fold(name)}`, name } : null;
}

/** A listing filed under its place instead of the coarse area the text gave. */
function placed(listing: Listing, place: Place | undefined): Listing {
  return place ? { ...listing, areaId: place.id, areaName: place.name, areaAssumed: false } : listing;
}

/** How many of a place's latest listings stand behind its median. */
const SAMPLE = 25;
/** Parallel requests to bina.az while sampling; the rest wait their turn. */
const SAMPLE_CONCURRENCY = 4;

const SAMPLE_QUERY = `query PlaceSample($first: Int, $filter: ItemFilter, $sort: ItemConnectionSort!) {
  itemsConnection(first: $first, filter: $filter, sort: $sort) {
    edges { node { id rooms floor floors updatedAt area { value units } price { total currency } location { id fullName } city { name } } }
  }
}`;

/* One place's latest listings of this kind — with no budget, size or document
   filter, so a search for cheap flats is not measured against cheap flats.
   Cached per place and shared by every search that meets it. */
export async function placeSample(category: Category, place: Place): Promise<Listing[]> {
  "use cache";
  cacheLife("place");
  if (!place.binaId) return [];
  try {
    const res = await fetch("https://bina.az/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify({
        operationName: "PlaceSample",
        query: SAMPLE_QUERY,
        variables: {
          first: SAMPLE,
          sort: "BUMPED_AT_DESC",
          filter: { cityId: "1", leased: false, categoryId: BINA_CATEGORY[category], locationIds: [place.binaId] },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { itemsConnection: { edges: { node: BinaItem }[] } } };
    const cards = (json.data?.itemsConnection.edges ?? []).map(({ node }) => ({
      id: node.id,
      url: `https://bina.az/items/${node.id}`,
      text: binaCardText(node),
    }));
    const scan = scanCards(cards, { site: siteFor("https://bina.az") ?? undefined, type: category === "house" ? "house" : "flat" });
    // Everything bina.az files under this place counts for it, whichever
    // finer label a listing carries itself.
    return scan.listings.map((l) => placed(l, place));
  } catch {
    return []; // the page falls back to its own listings for this place
  }
}

async function placeSamples(category: Category, places: Place[]): Promise<Listing[]> {
  const out: Listing[] = [];
  for (let i = 0; i < places.length; i += SAMPLE_CONCURRENCY) {
    const batch = await Promise.all(places.slice(i, i + SAMPLE_CONCURRENCY).map((p) => placeSample(category, p)));
    out.push(...batch.flat());
  }
  return out;
}

/* ---------------- shared ---------------- */

function finish(
  cards: RawCard[],
  extras: Map<string, Extras>,
  source: Source,
  category: Category,
  sourceUrl: string,
  total: number | null,
  postFilter: boolean,
  places: Map<string, Place>,
  pool: Listing[],
): Market {
  const read = scanCards(cards, {
    freshDays: FRESH_DAYS,
    site: siteFor(sourceUrl) ?? undefined,
    type: category === "house" ? "house" : "flat",
  });
  const scan = { ...read, listings: read.listings.map((l) => placed(l, places.get(l.id))) };
  // Every listing read is kept: the badges compare each place within the
  // whole page, and a cut by the median ranking would hide a place's best.
  const ranking = rank(scan, sourceUrl, { pool, maxRows: Infinity });
  const order = new Map(cards.map((card, i) => [card.id, i]));
  return {
    source,
    pool,
    read: cards.length,
    rows: ranking.rows.map((row) => ({
      ...row,
      source,
      extras: extras.get(row.listing.id) ?? { photo: null },
      order: order.get(row.listing.id) ?? cards.length,
    })),
    coverage: coverageParts(ranking),
    total,
    sourceUrl,
    at: ranking.at,
    postFilter,
  };
}
