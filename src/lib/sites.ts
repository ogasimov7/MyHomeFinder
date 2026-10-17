/* ============================================================
   The sites the app can read, and the three things that differ
   between them.

   Everything else — the price, the area, the room count, the date,
   the geography, the ranking — is shared: the sites print the same
   facts in the same language, so only the wrapping is per-site.
   ============================================================ */

import type { PropertyType, RawCard } from "./cards";

export interface Site {
  id: "bina" | "kub";
  name: string;
  /** matched against the hostname with endsWith, so subdomains count */
  host: string;
  /** how a search page links to one listing */
  cardSelector: string;
  /** a JS regex source that captures the listing id from that link */
  idPattern: string;
  /** the slice of card text the geography may be read from */
  locationText?: (text: string) => string;
  /** rentals share the search pages with sales on some sites */
  isRental?: (card: RawCard) => boolean;
  /* Where each type is sold, so a bookmark can say what it is a search for. */
  searchPaths: Record<PropertyType, string>;
}

/* kub.az prints a region label ("Bakı/Abşeron") on every card and then, for
   most of them, the real location — "Qaradağ r. Lökbatan" — before the
   seller's own description. Only that middle part may reach the geography:
   the label is the same on every card, and the description is prose, where
   a place name means nothing about where the flat is. */
function kubLocation(text: string): string {
  const afterPrice = text.split(/AZN\s*\/\s*m\s*²/i)[1] ?? "";
  const match = /([^\s;]+)\s+r\.\s+([^;]{0,40})/.exec(afterPrice);
  return match ? `${match[1]} r. ${match[2]}` : "";
}

/* The deal type is the first word of the listing's own address — "Satılır",
   "Kirayə", "Günlük kirayə" — which is harder to misread than the card text,
   where a sale can mention rent in passing. */
function kubRental(card: RawCard): boolean {
  let path = card.url;
  try {
    path = decodeURIComponent(card.url);
  } catch {
    /* a malformed escape leaves the raw path, which still carries the word */
  }
  return /\/elan\/(kiray|g[üu]nl[üu]k)/i.test(path);
}

export const SITES: Site[] = [
  {
    id: "bina",
    name: "bina.az",
    host: "bina.az",
    cardSelector: 'a[href*="/items/"]',
    idPattern: "/items/(\\d+)",
    searchPaths: {
      flat: "/alqi-satqi/menziller",
      house: "/alqi-satqi/heyet-evleri",
    },
  },
  {
    id: "kub",
    name: "kub.az",
    host: "kub.az",
    cardSelector: 'a[href*="/elan/"]',
    idPattern: "-id-(\\d+)",
    locationText: kubLocation,
    isRental: kubRental,
    searchPaths: {
      flat: "/menziller-satilir",
      house: "/evler-villalar-bag-satilir",
    },
  },
];

/* A bookmark carries its own type: a saved house search stays a house search
   whatever the profile says today. */
export function typeOfUrl(url: string): PropertyType {
  const site = siteFor(url);
  if (!site) return "flat";
  const path = url.replace(/^https?:\/\//i, "").split(/[?#]/)[0].toLowerCase();
  const types: PropertyType[] = ["house", "flat"];
  for (const type of types) {
    const marker = site.searchPaths[type].replace(/^\//, "").toLowerCase();
    if (path.includes(marker)) return type;
  }
  return "flat";
}

/** The site a link belongs to, or null when the app cannot read it. */
export function siteFor(url: string): Site | null {
  const host = url.replace(/^https?:\/\//i, "").split("/")[0].split(":")[0].toLowerCase();
  return SITES.find((site) => host === site.host || host.endsWith(`.${site.host}`)) ?? null;
}
