/* ============================================================
   What is for sale on the piece of map in view.

   bina.az clusters its own markers server-side; a marker is either
   one listing (id and price) or a cluster (a count at a point — at
   street level, usually one building). Both are asked for by the
   bounds of the view, rounded so that nearby views share a cache
   entry instead of each costing bina.az a request.
   ============================================================ */

import "server-only";
import { cacheLife } from "next/cache";
import { BINA_CATEGORY, TIMEOUT_MS, USER_AGENT } from "./market";
import type { Category } from "./query";
import { instalments } from "./instalment";
import { bestValue, byValue, manatPerSqm, meanPerSqm, type Value } from "./value";

/** bina.az does not split markers any further than this. */
export const MAX_DATA_ZOOM = 18;

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type Marker =
  | { kind: "item"; id: string; lat: number; lng: number; price: number }
  | { kind: "cluster"; id: string; lat: number; lng: number; count: number };

export interface Preview {
  id: string;
  price: number;
  currency: string;
  rooms: number | null;
  area: number | null;
  floor: number | null;
  floors: number | null;
  place: string | null;
  photo: string | null;
}

async function ask<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch("https://bina.az/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`bina.az ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (!json.data) throw new Error(`bina.az: ${json.errors?.[0]?.message ?? "boş cavab"}`);
  return json.data;
}

function filter(category: Category, b: Bounds) {
  return {
    cityId: "1",
    leased: false,
    categoryId: BINA_CATEGORY[category],
    bounds: {
      topLeft: { latitude: b.north, longitude: b.west },
      bottomRight: { latitude: b.south, longitude: b.east },
    },
  };
}

const MARKERS_QUERY = `query MapMarkers($filter: MapMarkerFilter!, $zoom: Int!) {
  mapMarkers(filter: $filter, zoom: $zoom) {
    markers {
      __typename
      ... on ClusterMapMarker { id count lat lng }
      ... on ItemMapMarker { itemId lat lng price isLeased }
    }
  }
}`;

type RawMarker =
  | { __typename: "ClusterMapMarker"; id: string; count: number; lat: number; lng: number }
  | { __typename: "ItemMapMarker"; itemId: string; lat: number; lng: number; price: number; isLeased: boolean };

export async function getMarkers(category: Category, bounds: Bounds, zoom: number): Promise<Marker[]> {
  "use cache";
  cacheLife("minutes");
  const data = await ask<{ mapMarkers: { markers: RawMarker[] } }>(MARKERS_QUERY, {
    filter: filter(category, bounds),
    zoom: Math.min(zoom, MAX_DATA_ZOOM),
  });
  return data.mapMarkers.markers.flatMap((m): Marker[] => {
    if (m.__typename === "ClusterMapMarker") return [{ kind: "cluster", id: m.id, lat: m.lat, lng: m.lng, count: m.count }];
    if (m.isLeased) return [];
    return [{ kind: "item", id: m.itemId, lat: m.lat, lng: m.lng, price: m.price }];
  });
}

const PREVIEW_FIELDS = `id rooms floor floors area { value } price { total currency } location { fullName } preview { f460x345 }`;

interface RawPreview {
  id: string;
  rooms: number | null;
  floor: number | null;
  floors: number | null;
  area: { value: number } | null;
  price: { total: number; currency: string } | null;
  location: { fullName: string } | null;
  preview: { f460x345: string | null } | null;
}

function toPreview(item: RawPreview): Preview | null {
  if (!item.price) return null;
  return {
    id: item.id,
    price: item.price.total,
    currency: item.price.currency,
    rooms: item.rooms,
    area: item.area?.value ?? null,
    floor: item.floor,
    floors: item.floors,
    place: item.location?.fullName ?? null,
    photo: item.preview?.f460x345 ?? null,
  };
}

export async function getPreview(id: string): Promise<Preview | null> {
  "use cache";
  cacheLife("hours");
  const data = await ask<{ item: RawPreview | null }>(`query MapItem($id: ID!) { item(id: $id) { ${PREVIEW_FIELDS} } }`, { id });
  return data.item ? toPreview(data.item) : null;
}

export type ClusterItem = Preview & { value: Value };

export interface ClusterPage {
  /** the most favourable first: best value, then by how much dearer per m² */
  items: ClusterItem[];
  /** how many listings the cluster holds in all */
  total: number;
  /** how many of them were read and compared */
  read: number;
  /** false when the cluster was too large to be read whole */
  complete: boolean;
  /** mean price per m² of the listings read, in manat */
  average: { perSqm: number; count: number } | null;
  /** listings left out as a down payment shown as the price */
  setAside: number;
}

/** bina.az serves 25 per page, whatever is asked for. */
const CLUSTER_PAGE = 25;
/** Read whole up to this; a larger circle is sampled evenly across time. */
const CLUSTER_MAX = 10_000;
/** Rows sent to the panel: the most favourable of the whole circle. */
const CLUSTER_SHOWN = 100;
/* bina.az pages a cluster newest first, and its cursor is just a moment in
   time — so the circle can be cut into stretches of time and the stretches
   read side by side, instead of one page after another. Listings live about
   a month; stretches are shorter near today, where listings are thicker. */
const SPAN_HOURS = 24 * 32;
/** about how many listings one stretch is cut to hold */
const PER_STRETCH = 150;
const MAX_STRETCHES = 64;
/** requests to bina.az in flight at once for one circle */
const IN_FLIGHT = 12;

const MAP_ITEMS_QUERY = `query MapItems($first: Int, $after: String, $filter: MapItemFilter!) {
  mapItems(first: $first, after: $after, filter: $filter) {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges { node { ${PREVIEW_FIELDS} } }
  }
}`;

type MapItemsPage = {
  mapItems: { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; edges: { node: RawPreview }[] };
};

const cursorAt = (ms: number) => Buffer.from(String(Math.round(ms))).toString("base64");
const cursorTime = (cursor: string) => Number(/^\d+/.exec(Buffer.from(cursor, "base64").toString())?.[0] ?? NaN);

/** Runs the jobs with at most `limit` of them at once, results in order. */
async function pool<T>(jobs: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let next = 0;
  const lane = async () => {
    while (next < jobs.length) {
      const i = next++;
      out[i] = await jobs[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, lane));
  return out;
}

/* A cluster id is a map tile, "15/20923/12359". bina.az lists a cluster only
   within the bounds it is asked for, so asking with the view on screen cuts
   off whatever of a circle near the edge lies outside it; asking with the
   tile's own bounds gets the whole circle. */
function tileBounds(clusterId: string): Bounds {
  const [z, x, y] = clusterId.split("/").map(Number);
  const lng = (tx: number) => (tx / 2 ** z) * 360 - 180;
  const lat = (ty: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / 2 ** z))) * 180) / Math.PI;
  return { north: lat(y), south: lat(y + 1), west: lng(x), east: lng(x + 1) };
}

/* A cluster's listings, read whole so its cheapest per m² is really the
   cheapest and its mean is the mean of all of it. */
export async function getCluster(category: Category, clusterId: string): Promise<ClusterPage> {
  "use cache";
  cacheLife("minutes");
  const vars = { first: CLUSTER_PAGE, filter: { ...filter(category, tileBounds(clusterId)), mapClusterId: clusterId } };
  const now = Date.now();

  // One stretch: from its start back in time until a page reaches the next
  // stretch. The page that crosses over is read by both; ids settle that.
  let total = 0;
  let capped = false;
  const stretch = async (from: number | null, until: number, budget: number) => {
    const out: Preview[] = [];
    let after: string | null = from === null ? null : cursorAt(from);
    for (let pages = 0; ; pages++) {
      if (pages >= budget) {
        capped = true;
        break;
      }
      const page: MapItemsPage["mapItems"] = (await ask<MapItemsPage>(MAP_ITEMS_QUERY, { ...vars, after })).mapItems;
      total = Math.max(total, page.totalCount);
      out.push(...page.edges.flatMap(({ node }) => toPreview(node) ?? []));
      const end = page.pageInfo.endCursor;
      if (!page.pageInfo.hasNextPage || !end || cursorTime(end) < until) break;
      after = end;
    }
    return out;
  };

  // How large the circle is decides how finely it is cut.
  const head = await ask<MapItemsPage>(MAP_ITEMS_QUERY, { ...vars, after: null });
  total = head.mapItems.totalCount;
  const count = Math.min(MAX_STRETCHES, Math.max(1, Math.ceil(total / PER_STRETCH)));
  const starts = Array.from({ length: count }, (_, i) => now - SPAN_HOURS * (i / count) ** 2 * 3_600_000);
  const budget = total > CLUSTER_MAX ? Math.ceil(CLUSTER_MAX / CLUSTER_PAGE / count) : Infinity;
  const jobs = starts.map((from, i) => () => stretch(i === 0 ? null : from, starts[i + 1] ?? -Infinity, budget));
  const read = (await pool(jobs, IN_FLIGHT)).flat();
  const all = [...new Map(read.map((p) => [p.id, p])).values()];
  const sqm = (i: Preview) => manatPerSqm(i.price, i.currency, i.area);

  // A down payment posing as the price would be the circle's best value and
  // pull its mean down: suspects are measured against the circle's median.
  const known = all.flatMap((i) => sqm(i) ?? []).sort((a, b) => a - b);
  const median = known.length ? known[Math.floor(known.length / 2)] : null;
  const setAside = median
    ? await instalments(all.flatMap((i) => { const v = sqm(i); return v === null ? [] : [{ id: i.id, ratio: v / median, area: i.area }]; }), true)
    : new Set<string>();
  const items = all.filter((i) => !setAside.has(i.id));

  // The whole circle is one group: one listing in it is the best value.
  const values = bestValue(items, () => clusterId, sqm);
  const ranked = items
    .map((item, order) => ({ ...item, value: values.get(item)!, order }))
    .sort((a, b) => byValue(a.value, b.value) || a.order - b.order)
    .slice(0, CLUSTER_SHOWN)
    .map(({ order: _order, ...item }) => item);
  return {
    items: ranked,
    total,
    read: items.length,
    complete: !capped,
    average: meanPerSqm(items.map(sqm)),
    setAside: setAside.size,
  };
}

/* ---------------- request parsing ---------------- */

/** Wide enough for Baku and the Absheron ring; anything else is not ours to ask about. */
const AREA = { north: 40.75, south: 40.2, east: 50.45, west: 49.4 };

/** Bounds read from a query string, rounded to ~100 m and kept inside the area. */
export function readBounds(params: URLSearchParams): Bounds | null {
  const n = Number(params.get("n"));
  const s = Number(params.get("s"));
  const e = Number(params.get("e"));
  const w = Number(params.get("w"));
  if (![n, s, e, w].every(Number.isFinite) || n <= s || e <= w) return null;
  const up = (v: number) => Math.ceil(v * 1000) / 1000;
  const down = (v: number) => Math.floor(v * 1000) / 1000;
  const b = {
    north: Math.min(up(n), AREA.north),
    south: Math.max(down(s), AREA.south),
    east: Math.min(up(e), AREA.east),
    west: Math.max(down(w), AREA.west),
  };
  return b.north > b.south && b.east > b.west ? b : null;
}

export function readCategory(params: URLSearchParams): Category {
  const c = params.get("category");
  return c === "new" || c === "old" || c === "house" ? c : "flat";
}
