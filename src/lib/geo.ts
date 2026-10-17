/* ============================================================
   Listing text -> Baku geography.

   bina.az prints one location label per card and it is usually the
   settlement or metro name, never the district. Everything that
   cannot be matched is reported as unresolved rather than guessed:
   a listing in the wrong area would be compared against the wrong
   median, which is worse than not ranking it at all.
   ============================================================ */

import { DISTRICT_FALLBACK, areaById, districtById } from "./geography";

/** Azerbaijani letters folded to ASCII so aliases match regardless of spelling. */
export function fold(text: string): string {
  return text
    .toLocaleLowerCase("az")
    .replace(/ə/g, "e")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DISTRICT_ALIASES: Record<string, string> = {
  sebail: "sabail", sabail: "sabail",
  nesimi: "nasimi", nasimi: "nasimi",
  nerimanov: "narimanov", narimanov: "narimanov",
  yasamal: "yasamal",
  xetai: "khatai", xatai: "khatai",
  nizami: "nizami",
  bineqedi: "binagadi",
  sabuncu: "sabunchu",
  suraxani: "surakhani",
  xezer: "khazar",
  qaradag: "garadagh",
};

const METRO_ALIASES: Record<string, string> = {
  "hezi aslanov": "hazi-aslanov", "h aslanov": "hazi-aslanov",
  ehmedli: "ahmadli",
  "xalqlar dostlugu": "khalglar-dostlugu",
  neftciler: "neftchilar-area",
  "qara qarayev": "gara-garayev-area",
  koroglu: "koroglu-area",
  ulduz: "ulduz-area",
  genclik: "ganjlik",
  "28 may": "28-may-area",
  sahil: "sahil-bulvar",
  "iceri seher": "icherisheher",
  "elmler akademiyasi": "elmlar", elmler: "elmlar",
  insaatcilar: "inshaatchilar",
  "20 yanvar": "20-yanvar-area",
  "memar ecemi": "memar-ajami-area",
  "azadliq prospekti": "8-mikrorayon", azadliq: "8-mikrorayon",
  dernegul: "9-mikrorayon",
  "cefer cabbarli": "shah-ismayil",
  bakmil: "montin",
};

const AREA_ALIASES: Record<string, string> = {
  "iceri seher": "icherisheher",
  bulvar: "sahil-bulvar", "sahil bulvari": "sahil-bulvar",
  bayil: "bayil",
  badamdar: "badamdar",
  "nizami kucesi": "nizami-kucesi", terqovi: "nizami-kucesi",
  montin: "montin",
  kubinka: "kubinka",
  "yeni yasamal": "yeni-yasamal",
  "sah ismayil xetai": "shah-ismayil",
  "8 noyabr": "8-noyabr",
  "8 mikrorayon": "8-mikrorayon", "8 ci mikrorayon": "8-mikrorayon",
  "9 mikrorayon": "9-mikrorayon", "9 cu mikrorayon": "9-mikrorayon",
  bineqedi: "binagadi-merkez",
  xocasan: "khojasan", xocesen: "khojasan",
  bakixanov: "bakikhanov",
  zabrat: "zabrat",
  ramana: "ramana",
  mastaga: "mashtaga",
  gunesli: "gunashli", gunasli: "gunashli",
  hovsan: "hovsan",
  bahar: "bahar",
  merdekan: "mardakan",
  buzovna: "buzovna",
  suvelan: "shuvalan",
  turkan: "turkan",
  lokbatan: "lokbatan",
  puta: "puta",
};

/**
 * Settlements with no area of their own, mapped to the district they belong
 * to. Only the administrative membership is asserted — verified against
 * bina.az's own location slugs (baki/<district>/<settlement>).
 */
const SETTLEMENT_DISTRICTS: Record<string, string> = {
  bulbule: "surakhani", zig: "surakhani", qaracuxur: "surakhani", emircan: "surakhani",
  "yeni gunesli": "surakhani",
  balaxani: "sabunchu", "yeni balaxani": "sabunchu", nardaran: "sabunchu", pirsagi: "sabunchu",
  kurdexani: "sabunchu", savalan: "sabunchu",
  bileceri: "binagadi", "m e resulzade": "binagadi", sulutepe: "binagadi",
  "1 ci mikrorayon": "nasimi", "2 ci mikrorayon": "nasimi", "3 cu mikrorayon": "nasimi",
  "4 cu mikrorayon": "nasimi", "5 ci mikrorayon": "nasimi",
  "6 ci mikrorayon": "binagadi", "7 ci mikrorayon": "binagadi",
  qala: "khazar", zire: "khazar", bine: "khazar", sagan: "khazar",
  gurgen: "khazar", dubendi: "khazar",
  elet: "garadagh", sengecal: "garadagh", qizildas: "garadagh",
  musfiqabad: "garadagh", subani: "garadagh",
  kesle: "nizami", "8 ci kilometr": "nizami",
  nzs: "khatai",
  sixov: "sabail", bibiheybet: "sabail",
  // outside Baku's districts — read and ranked, nothing else claimed
  sumqayit: "sumgayit",
  xirdalan: "absheron", masazir: "absheron", novxani: "absheron", goredil: "absheron",
  mehdiabad: "absheron", hokmeli: "absheron", saray: "absheron", digah: "absheron",
  fatmayi: "absheron", ceyranbatan: "absheron", qobu: "absheron", guzdek: "absheron",
  pirekeskul: "absheron", memmedli: "absheron", zagulba: "absheron", zugulba: "absheron",
};

export interface ResolvedLocation {
  districtId: string;
  districtName: string;
  areaId: string;
  areaName: string;
  /** the exact area was not recognised and the district stands in for it */
  areaAssumed: boolean;
  /** false where this build has no market for the place at all */
  marketKnown: boolean;
}

/** Longest match wins, so "Yeni Yasamal" beats "Yasamal". */
function hit(table: Record<string, string>, folded: string): string | null {
  let best: string | null = null;
  for (const key of Object.keys(table)) {
    if (!folded.includes(` ${key} `) && !folded.includes(` ${key}`)) continue;
    if (!best || key.length > best.length) best = key;
  }
  return best ? table[best] : null;
}

export function resolveFromText(text: string): ResolvedLocation | null {
  const folded = ` ${fold(text)} `;
  const districtId = hit(DISTRICT_ALIASES, folded);
  const areaId = hit(AREA_ALIASES, folded) ?? hit(METRO_ALIASES, folded);
  // Last resort only: a settlement name tells us the district when nothing
  // more specific matched.
  const settlement = districtId || areaId ? null : hit(SETTLEMENT_DISTRICTS, folded);

  const district = districtId ?? settlement ?? (areaId ? areaById.get(areaId)?.districtId ?? null : null);
  if (!district) return null;

  let area = areaId;
  let areaAssumed = false;
  if (!area) {
    area = DISTRICT_FALLBACK[district] ?? null;
    areaAssumed = true;
  }
  if (!area) return null;

  const d = districtById.get(district);
  const a = areaById.get(area);
  if (!d || !a) return null;

  return {
    districtId: district,
    districtName: d.name,
    areaId: area,
    areaName: areaAssumed ? `${d.name} r.` : a.name,
    areaAssumed,
    marketKnown: d.marketKnown !== false,
  };
}
