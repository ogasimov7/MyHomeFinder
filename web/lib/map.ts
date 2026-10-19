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
  /** best value first, then by how much dearer per m² */
  items: ClusterItem[];
  /** how many listings the cluster holds in all */
  total: number;
  /** false when the cluster was larger than could be read whole */
  complete: boolean;
  /** mean price per m² of the listings read, in manat */
  average: { perSqm: number; count: number } | null;
}

/** bina.az serves 25 per page; four pages is as far as one click reads. */
const CLUSTER_PAGE = 25;
const CLUSTER_MAX = 100;

/* A cluster's listings, read whole so its cheapest per m² is really the
   cheapest. bina.az asks for the cluster by its own id and also wants the view
   it came from, and cannot sort them, so they are paged through to the end —
   up to a hundred; past that the comparison says it covers only those. */
export async function getCluster(category: Category, bounds: Bounds, clusterId: string): Promise<ClusterPage> {
  "use cache";
  cacheLife("minutes");
  const items: Preview[] = [];
  let after: string | null = null;
  let total = 0;
  let more = true;
  while (more && items.length < CLUSTER_MAX) {
    const data: {
      mapItems: { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; edges: { node: RawPreview }[] };
    } = await ask(
      `query MapItems($first: Int, $after: String, $filter: MapItemFilter!) {
        mapItems(first: $first, after: $after, filter: $filter) {
          totalCount
          pageInfo { hasNextPage endCursor }
          edges { node { ${PREVIEW_FIELDS} } }
        }
      }`,
      { first: CLUSTER_PAGE, after, filter: { ...filter(category, bounds), mapClusterId: clusterId } },
    );
    const page = data.mapItems;
    total = page.totalCount;
    items.push(...page.edges.flatMap(({ node }) => toPreview(node) ?? []));
    more = page.pageInfo.hasNextPage && page.pageInfo.endCursor !== null;
    after = page.pageInfo.endCursor;
  }

  // The whole circle is one group: one listing in it is the best value.
  const sqm = (i: Preview) => manatPerSqm(i.price, i.currency, i.area);
  const values = bestValue(items, () => clusterId, sqm);
  const ranked = items
    .map((item, order) => ({ ...item, value: values.get(item)!, order }))
    .sort((a, b) => byValue(a.value, b.value) || a.order - b.order)
    .map(({ order: _order, ...item }) => item);
  return { items: ranked, total, complete: !more, average: meanPerSqm(items.map(sqm)) };
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
