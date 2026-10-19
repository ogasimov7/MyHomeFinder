/* ============================================================
   A search, as the URL holds it.

   Every filter lives in the address, so a search can be shared,
   bookmarked and reloaded, and the server renders exactly what the
   link says. The same functions read the URL on both sides.
   ============================================================ */

export type Source = "bina" | "kub";
export type Category = "flat" | "new" | "old" | "house";
export type Sort = "value" | "price" | "sqm" | "new";

export interface Query {
  source: Source;
  category: Category;
  /** "1".."4", "5+" */
  rooms: string[];
  budget: string | null;
  size: string | null;
  /** district ids from the shared geography */
  districts: string[];
  /** bina.az location ids — metro stations, settlements, microdistricts */
  places: string[];
  /** bina.az only: the documents a listing must have */
  bill: boolean;
  repair: boolean;
  mortgage: boolean;
  /** only the best value of each place */
  best: boolean;
  sort: Sort;
  /** free text matched against the area and district names */
  q: string;
}

export const ROOMS = ["1", "2", "3", "4", "5+"] as const;

/** How many places one search may ask for at once. */
export const MAX_PLACES = 20;

/* The finer places a search can be narrowed to, as bina.az files its
   listings: metro stations, settlements, and the numbered microdistricts it
   lists among the settlements. */
export type PlaceKind = "metro" | "settlement" | "micro";

export interface PlaceOption {
  /** bina.az location id */
  id: string;
  name: string;
  kind: PlaceKind;
  /** the district a settlement belongs to, when bina.az says */
  district: string | null;
}

export const PLACE_KINDS: { id: PlaceKind; label: string; suffix: string }[] = [
  { id: "metro", label: "Metro", suffix: "m." },
  { id: "settlement", label: "Qəsəbə", suffix: "q." },
  { id: "micro", label: "Mikrorayon", suffix: "" },
];

/** "28 May m.", "Badamdar q.", "4-cü mikrorayon" */
export function placeLabel(place: PlaceOption): string {
  const suffix = PLACE_KINDS.find((k) => k.id === place.kind)!.suffix;
  return suffix ? `${place.name} ${suffix}` : place.name;
}

/* Ranges are offered as a handful of steps rather than free inputs: they read
   faster and every one is a link someone can share. */
export const BUDGETS: { id: string; label: string; from?: number; to?: number }[] = [
  { id: "u100", label: "100K-dək", to: 100_000 },
  { id: "100-200", label: "100–200K", from: 100_000, to: 200_000 },
  { id: "200-350", label: "200–350K", from: 200_000, to: 350_000 },
  { id: "350-600", label: "350–600K", from: 350_000, to: 600_000 },
  { id: "600p", label: "600K+", from: 600_000 },
];

export const SIZES: { id: string; label: string; from?: number; to?: number }[] = [
  { id: "u60", label: "60 m²-dək", to: 60 },
  { id: "60-100", label: "60–100 m²", from: 60, to: 100 },
  { id: "100-150", label: "100–150 m²", from: 100, to: 150 },
  { id: "150p", label: "150 m²+", from: 150 },
];

export const SORTS: { id: Sort; label: string }[] = [
  { id: "value", label: "Ən sərfəli" },
  { id: "price", label: "Ən ucuz" },
  { id: "sqm", label: "m² qiyməti" },
  { id: "new", label: "Ən yeni" },
];

export const DEFAULT_QUERY: Query = {
  source: "bina",
  category: "flat",
  rooms: [],
  budget: null,
  size: null,
  districts: [],
  places: [],
  bill: false,
  repair: false,
  mortgage: false,
  best: false,
  sort: "value",
  q: "",
};

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | string[] | undefined): string[] {
  const raw = one(value);
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function parseQuery(params: Params | URLSearchParams): Query {
  const get = (key: string) =>
    params instanceof URLSearchParams ? params.get(key) ?? undefined : one(params[key]);
  const getList = (key: string) =>
    params instanceof URLSearchParams ? list(params.get(key) ?? undefined) : list(params[key]);

  return {
    source: pick(get("source"), ["bina", "kub"], DEFAULT_QUERY.source),
    category: pick(get("category"), ["flat", "new", "old", "house"], DEFAULT_QUERY.category),
    rooms: getList("rooms").filter((r) => (ROOMS as readonly string[]).includes(r)).sort(),
    budget: BUDGETS.some((b) => b.id === get("budget")) ? get("budget")! : null,
    size: SIZES.some((s) => s.id === get("size")) ? get("size")! : null,
    districts: getList("district").sort(),
    places: [...new Set(getList("place").filter((id) => /^\d{1,6}$/.test(id)))].sort((a, b) => Number(a) - Number(b)).slice(0, MAX_PLACES),
    bill: get("bill") === "1",
    repair: get("repair") === "1",
    mortgage: get("mortgage") === "1",
    // "below" is what shared links said before the badge was best-in-place.
    best: get("best") === "1" || get("below") === "1",
    sort: pick(get("sort"), ["value", "price", "sqm", "new"], DEFAULT_QUERY.sort),
    q: (get("q") ?? "").trim().slice(0, 60),
  };
}

/** Only what differs from the default is written, so links stay short. */
export function queryString(query: Query): string {
  const p = new URLSearchParams();
  if (query.source !== DEFAULT_QUERY.source) p.set("source", query.source);
  if (query.category !== DEFAULT_QUERY.category) p.set("category", query.category);
  if (query.rooms.length) p.set("rooms", query.rooms.join(","));
  if (query.budget) p.set("budget", query.budget);
  if (query.size) p.set("size", query.size);
  if (query.districts.length) p.set("district", query.districts.join(","));
  if (query.places.length) p.set("place", query.places.join(","));
  if (query.bill) p.set("bill", "1");
  if (query.repair) p.set("repair", "1");
  if (query.mortgage) p.set("mortgage", "1");
  if (query.best) p.set("best", "1");
  if (query.sort !== DEFAULT_QUERY.sort) p.set("sort", query.sort);
  if (query.q) p.set("q", query.q);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function range<T extends { id: string; from?: number; to?: number }>(
  steps: T[],
  id: string | null,
): { from?: number; to?: number } {
  const step = steps.find((s) => s.id === id);
  return step ? { from: step.from, to: step.to } : {};
}

/* What decides which listings are fetched and ranked. Everything else —
   districts, the text box, the order — only narrows or reorders that one
   ranked page, so changing it never re-reads the site. Places are asked of
   the site itself: 300 listings of 28 May, not the few of the latest 300
   that happen to be there. */
export interface MarketKey {
  source: Source;
  category: Category;
  places: string[];
  rooms: string[];
  budget: string | null;
  size: string | null;
  bill: boolean;
  repair: boolean;
  mortgage: boolean;
}

export function marketKey(query: Query): MarketKey {
  const { source, category, places, rooms, budget, size, bill, repair, mortgage } = query;
  // kub.az is read whole and narrowed afterwards, so one page serves every
  // filter on it — and is fetched once, not once per filter.
  if (source === "kub") {
    return { source, category, places: [], rooms: [], budget: null, size: null, bill: false, repair: false, mortgage: false };
  }
  return { source, category, places, rooms, budget, size, bill, repair, mortgage };
}