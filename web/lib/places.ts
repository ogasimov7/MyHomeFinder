/* ============================================================
   The places a search can be narrowed to, as bina.az lists them.

   bina.az groups its locations as districts, metro stations,
   settlements and landmarks. Districts already have their own
   filter and landmarks are not places one lives in; the metro
   stations and settlements are offered, with the numbered
   microdistricts — filed by bina.az among the settlements — on
   their own. The list changes rarely and is read once a day.
   ============================================================ */

import "server-only";
import { cacheLife } from "next/cache";
import { TIMEOUT_MS, USER_AGENT } from "./market";
import type { PlaceKind, PlaceOption } from "./query";

const GROUP_METRO = "1";
const GROUP_SETTLEMENT = "3";

interface RawLocation {
  id: string;
  name: string;
  locationGroup: { id: string } | null;
  parent: { name: string } | null;
}

export async function getPlaceOptions(): Promise<PlaceOption[]> {
  "use cache";
  cacheLife("days");
  const res = await fetch("https://bina.az/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({ query: `{ city(id: "1") { locations { id name locationGroup { id } parent { name } } } }` }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`bina.az ${res.status}`);
  const json = (await res.json()) as { data?: { city: { locations: RawLocation[] } | null } };
  const locations = json.data?.city?.locations ?? [];

  const kindOf = (l: RawLocation): PlaceKind | null => {
    if (l.locationGroup?.id === GROUP_METRO) return "metro";
    if (l.locationGroup?.id !== GROUP_SETTLEMENT) return null;
    return /mikrorayon/i.test(l.name) ? "micro" : "settlement";
  };

  return locations
    .flatMap((l) => {
      const kind = kindOf(l);
      return kind ? [{ id: l.id, name: l.name.trim(), kind, district: l.parent?.name ?? null }] : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name, "az", { numeric: true }));
}
