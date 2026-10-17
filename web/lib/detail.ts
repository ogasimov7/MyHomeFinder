/* ============================================================
   One listing, read whole: photos, description, seller, map.

   The numbers that matter for the ranking — price, size, rooms,
   place — still go through the one card parser, so the listing page
   and the card it was opened from never disagree about them.
   ============================================================ */

import "server-only";
import { cacheLife } from "next/cache";
import { parse } from "node-html-parser";
import { parseCard, type Listing, type PropertyType, type RawCard } from "../../src/lib/cards";
import { rank, type RankedListing } from "../../src/lib/ranking";
import { siteFor } from "../../src/lib/sites";
import {
  TIMEOUT_MS,
  USER_AGENT,
  binaCardText,
  binaPlace,
  kubPlace,
  placeSample,
  type BinaCardFields,
  type Market,
  type MarketRow,
  type Place,
} from "./market";
import type { Category } from "./query";
import type { Source } from "./query";

export interface Photo {
  full: string;
  /** 660×496: sharp enough for a grid tile, a fraction of the full file */
  medium: string;
  thumb: string;
}

export interface Detail {
  source: Source;
  id: string;
  /** the listing on its own site */
  url: string;
  /** where kub.az itself copied the listing from, when it says */
  origin: string | null;
  category: string | null;
  price: number;
  currency: string;
  address: string | null;
  description: string;
  photos: Photo[];
  lat: number | null;
  lng: number | null;
  seller: { name: string | null; type: string | null; agency: string | null; logo: string | null };
  views: number | null;
  updatedAt: string | null;
  bill: boolean | null;
  repair: boolean | null;
  mortgage: boolean | null;
  /** the listing as the parser reads it; null when it cannot be ranked */
  listing: Listing | null;
  /** the neighbourhood it is priced against */
  place: Place | null;
}

export async function getDetail(source: Source, id: string): Promise<Detail | null> {
  "use cache";
  cacheLife("hours");
  if (!/^\d{1,12}$/.test(id)) return null;
  return source === "kub" ? readKubItem(id) : readBinaItem(id);
}

/* ---------------- bina.az ---------------- */

const ITEM_QUERY = `query Item($id: ID!) {
  item(id: $id) {
    id path address description isLeased rooms floor floors updatedAt views
    contactName contactTypeName latitude longitude
    hasBillOfSale hasMortgage hasRepair
    area { value units }
    price { total currency }
    photos { full f660x496 thumbnail }
    category { id name }
    city { name }
    location { id fullName }
    business { ... on Agency { name logoUrl } ... on Residence { companyName logoUrl } }
  }
}`;

interface BinaFullItem extends BinaCardFields {
  id: string;
  path: string;
  address: string | null;
  description: string | null;
  isLeased: boolean;
  views: number | null;
  contactName: string | null;
  contactTypeName: string | null;
  latitude: number | null;
  longitude: number | null;
  hasBillOfSale: boolean;
  hasMortgage: boolean;
  hasRepair: boolean;
  photos: { full: string; f660x496: string; thumbnail: string }[] | null;
  category: { id: string; name: string } | null;
  business: { name?: string; companyName?: string; logoUrl?: string | null } | null;
}

/** bina.az's category for houses; everything else it sells here is a flat. */
const BINA_HOUSE = "5";

async function readBinaItem(id: string): Promise<Detail | null> {
  const res = await fetch("https://bina.az/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({ operationName: "Item", query: ITEM_QUERY, variables: { id } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`bina.az ${res.status}`);
  const json = (await res.json()) as { data?: { item: BinaFullItem | null } };
  const item = json.data?.item;
  if (!item || !item.price) return null;

  const url = `https://bina.az${item.path}`;
  const type: PropertyType = item.category?.id === BINA_HOUSE ? "house" : "flat";
  const card: RawCard = { id: item.id, url, text: binaCardText(item) };
  const parsed = item.isLeased ? null : parseCard(card, { site: siteFor(url) ?? undefined, type });
  const place = binaPlace(item);

  return {
    source: "bina",
    id: item.id,
    url,
    origin: null,
    category: item.category?.name ?? null,
    price: item.price.total,
    currency: item.price.currency,
    address: [item.address, item.location?.fullName].filter(Boolean).join(", ") || null,
    description: cleanText(item.description ?? ""),
    photos: (item.photos ?? []).map((p) => ({ full: p.full, medium: p.f660x496, thumb: p.thumbnail })),
    lat: item.latitude,
    lng: item.longitude,
    seller: {
      name: item.contactName,
      type: item.contactTypeName,
      agency: item.business?.name ?? item.business?.companyName ?? null,
      logo: item.business?.logoUrl ?? null,
    },
    views: item.views,
    updatedAt: item.updatedAt,
    bill: item.hasBillOfSale,
    repair: item.hasRepair,
    mortgage: item.hasMortgage,
    listing: parsed?.ok ? withPlace(parsed.listing, place) : null,
    place,
  };
}

/* ---------------- kub.az ----------------

   kub.az is an aggregator: its listing page holds a title, an address, the
   description and a link to where the ad came from — no gallery, no map.
   The title spells out the card ("Satılır-Bina ev mənzil-145000 AZN-…"),
   so with the address it reads like one. */

async function readKubItem(id: string): Promise<Detail | null> {
  const url = `https://kub.az/elan/id-${id}`;
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, "accept-language": "az" },
    redirect: "manual", // a missing listing redirects to the home page
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status >= 300 && res.status < 400) return null;
  if (!res.ok) throw new Error(`kub.az ${res.status}`);

  const root = parse(await res.text());
  const title = root.querySelector("h3")?.text.trim();
  if (!title) return null;

  const paragraphs = root.querySelectorAll("p").map((p) => p.text.trim()).filter(Boolean);
  const origin = root.querySelector("p a")?.getAttribute("href") ?? null;
  const address = paragraphs.find((p) => /^ünvan:/i.test(p))?.replace(/^ünvan:\s*/i, "") ?? null;
  const description = paragraphs
    .filter((p) => !/^ünvan:/i.test(p) && p !== origin)
    .sort((a, b) => b.length - a.length)[0] ?? "";

  const words = title.split("-").map((w) => w.trim());
  const price = /(\d+)\s*(AZN|USD)/i.exec(title);
  const type: PropertyType = /həyət evi|villa|bağ evi/i.test(title) ? "house" : "flat";
  const site = siteFor(url)!;
  const card: RawCard = { id, url, text: `${words.join(" ")} ${address ?? ""}` };
  // The address stands in for kub.az's region line, so the whole text is the
  // place to look — but a rental is still a rental.
  const parsed = site.isRental?.({ ...card, url: `https://kub.az/elan/${encodeURIComponent(title)}` })
    ? null
    : parseCard(card, { type });
  // The title is the listing's own address, dash by dash, place included.
  const place = kubPlace(title);

  return {
    source: "kub",
    id,
    url: `https://kub.az/elan/${encodeURIComponent(title)}`,
    origin,
    category: words.slice(1, 2).concat(words.find((w) => /tikili/i.test(w)) ?? []).join(" / ") || null,
    price: price ? Number(price[1]) : 0,
    currency: price ? price[2].toUpperCase() : "AZN",
    address,
    description: cleanText(description),
    photos: [],
    lat: null,
    lng: null,
    seller: { name: null, type: null, agency: origin ? new URL(origin).hostname.replace(/^www\./, "") : null, logo: null },
    views: null,
    updatedAt: null,
    bill: /kupçalı/i.test(title) || null,
    repair: null,
    mortgage: null,
    listing: parsed?.ok ? withPlace(parsed.listing, place) : null,
    place,
  };
}

function withPlace(listing: Listing, place: Place | null): Listing {
  return place ? { ...listing, areaId: place.id, areaName: place.name, areaAssumed: false } : listing;
}

/** Sellers write in markdown-ish bold and Windows line ends; only the words stay. */
function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ---------------- comparison ---------------- */

export interface Comparison {
  ranked: RankedListing | null;
  /** the market row, when the listing was on the page it is compared with */
  row: MarketRow | null;
  similar: MarketRow[];
}

const SIMILAR = 3;

/* The listing is measured against the same search it was opened from. When it
   was on that page, its row is the answer — the card and this page agree by
   construction. Otherwise it is ranked with that page's listings and its own
   place's sample: fetched for it if the search had not already. */
export async function compare(detail: Detail, market: Market | null, category: Category): Promise<Comparison> {
  const row = market?.rows.find((r) => r.listing.id === detail.id) ?? null;
  const subject = row?.listing ?? detail.listing;
  if (!subject) return { ranked: null, row: null, similar: [] };

  let ranked: RankedListing | null = row;
  if (!ranked) {
    const pool = market?.pool ?? [];
    const known = pool.some((l) => l.areaId === subject.areaId);
    const extra = detail.place && !known ? await placeSample(category, detail.place) : [];
    const neighbours = (market?.rows ?? []).map((r) => r.listing).filter((l) => l.districtId === subject.districtId);
    const result = rank(
      { listings: [...neighbours, subject], skips: { geo: 0, notFlat: 0, unreadable: 0, stale: 0, rent: 0, type: 0 }, seen: neighbours.length + 1 },
      market?.sourceUrl ?? detail.url,
      { pool: [...pool, ...extra], maxRows: Infinity },
    );
    ranked = result.rows.find((r) => r.listing.id === detail.id) ?? null;
  }

  const others = (market?.rows ?? []).filter((r) => r.listing.id !== detail.id && r.listing.type === subject.type);
  const sameArea = others.filter((r) => r.listing.areaId === subject.areaId);
  const sameDistrict = others.filter((r) => r.listing.districtId === subject.districtId && r.listing.areaId !== subject.areaId);
  return { ranked, row, similar: [...sameArea, ...sameDistrict].slice(0, SIMILAR) };
}
