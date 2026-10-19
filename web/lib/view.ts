/* ============================================================
   A ranked page, narrowed and ordered for display.

   The ranking is computed once per search. What the search asked for
   decides which listings take part; within each place, the cheapest
   per m² among them is the best value. Districts, the text box and
   the order are applied after that, so a listing keeps its badge
   whatever is hidden around it.
   ============================================================ */

import { fold } from "../../src/lib/geo";
import type { Listing } from "../../src/lib/cards";
import type { Market, MarketRow } from "./market";
import { BINA_DISTRICT_ID, BUDGETS, SIZES, range, type Query } from "./query";
import { bestValue, byValue, type Value } from "./value";

function within(value: number, r: { from?: number; to?: number }): boolean {
  return (r.from === undefined || value >= r.from) && (r.to === undefined || value <= r.to);
}

function roomsMatch(rooms: number, wanted: string[]): boolean {
  if (!wanted.length) return true;
  return wanted.some((w) => (w === "5+" ? rooms >= 5 : rooms === Number(w)));
}

/** The listings the search itself asked for. */
export function searched(market: Market, query: Query): MarketRow[] {
  // bina.az already applied these; kub.az could not, so they apply here.
  if (!market.postFilter) return market.rows;
  const price = range(BUDGETS, query.budget);
  const size = range(SIZES, query.size);
  return market.rows.filter(
    ({ listing }) => roomsMatch(listing.rooms, query.rooms) && within(listing.price, price) && within(listing.area, size),
  );
}

/** Best value per place among the given rows, keyed by listing id. */
export function placeValues(rows: { listing: Listing }[]): Record<string, Value> {
  const values = bestValue(rows, (r) => r.listing.areaId, (r) => r.listing.pricePerSqm);
  return Object.fromEntries(rows.map((r) => [r.listing.id, values.get(r)!]));
}

export function view(market: Market, query: Query): { rows: MarketRow[]; values: Record<string, Value> } {
  const base = searched(market, query);
  const values = placeValues(base);
  const needle = query.q ? fold(query.q) : "";
  // bina.az was asked for the districts themselves; its own filing is kept
  // over the district this site reads off a card. kub.az could not be asked,
  // and nor can a district bina.az has no id for.
  const byDistrict =
    query.districts.length > 0 && (market.postFilter || query.districts.some((d) => !BINA_DISTRICT_ID[d]));

  const rows = base.filter(({ listing }) => {
    if (byDistrict && !query.districts.includes(listing.districtId)) return false;
    if (query.best && values[listing.id].kind !== "best") return false;
    if (needle && !fold(`${listing.areaName} ${listing.districtName}`).includes(needle)) return false;
    return true;
  });

  switch (query.sort) {
    case "price":
      rows.sort((a, b) => a.listing.price - b.listing.price);
      break;
    case "sqm":
      rows.sort((a, b) => a.listing.pricePerSqm - b.listing.pricePerSqm);
      break;
    case "new":
      // Cards are dated to the day; the site's own order is dated to the minute.
      rows.sort((a, b) => a.order - b.order);
      break;
    default:
      // The best of each place first, then by how much dearer; the ranking's
      // own order settles the rest.
      rows.sort((a, b) => byValue(values[a.listing.id], values[b.listing.id]));
  }
  return { rows, values };
}
