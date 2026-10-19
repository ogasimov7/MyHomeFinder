/* ============================================================
   The places a district can be narrowed to, as bina.az lists them.

   bina.az groups its locations as districts, metro stations,
   settlements and landmarks. A settlement names its district;
   a metro station does not, so the stations' districts are kept
   here (below). The list changes rarely and is read once a day.
   ============================================================ */

import "server-only";
import { cacheLife } from "next/cache";
import { fold } from "../../src/lib/geo";
import { DISTRICTS } from "../../src/lib/geography";
import { TIMEOUT_MS, USER_AGENT } from "./http";
import { BINA_DISTRICT_ID, type PlaceKind, type PlaceOption } from "./query";

const GROUP_METRO = "1";
const GROUP_SETTLEMENT = "3";

/* Each station's district, worked out from bina.az itself: how many of the
   listings filed under the station are filed under each district as well
   (2026-10). A station on a border shows under every district holding at
   least 30% of its listings — Sahil is half Nəsimi, half Səbail. */
const METRO_DISTRICTS: Record<string, string[]> = {
  "1": ["narimanov"], // Nəriman Nərimanov
  "2": ["narimanov"], // Gənclik
  "3": ["narimanov"], // Ulduz
  "4": ["narimanov", "nizami"], // Koroğlu
  "5": ["yasamal", "nasimi"], // 20 Yanvar
  "6": ["binagadi"], // Azadlıq Prospekti
  "7": ["yasamal"], // İnşaatçılar
  "8": ["nasimi"], // 28 May
  "33": ["khatai"], // Həzi Aslanov
  "34": ["yasamal"], // Elmlər Akademiyası
  "35": ["yasamal", "nasimi"], // Nizami
  "36": ["khatai"], // Şah İsmayıl Xətai
  "37": ["sabail"], // İçəri Şəhər
  "38": ["nasimi", "sabail"], // Sahil
  "51": ["khatai"], // Əhmədli
  "52": ["nizami"], // Qara Qarayev
  "53": ["nizami"], // Neftçilər
  "54": ["nizami"], // Xalqlar Dostluğu
  "59": ["nasimi"], // Memar Əcəmi
  "60": ["binagadi"], // Nəsimi
  "61": ["binagadi"], // Dərnəgül
  "63": ["narimanov"], // Bakmil
  "266": ["binagadi"], // Avtovağzal
  "279": ["nasimi"], // 8 Noyabr
  "315": ["binagadi"], // Xocəsən
};

const districtByName = new Map(DISTRICTS.map((d) => [fold(d.name), d.id]));

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

  const place = (l: RawLocation): PlaceOption | null => {
    const name = l.name.trim();
    if (l.locationGroup?.id === GROUP_METRO) {
      const districts = METRO_DISTRICTS[l.id] ?? [];
      return districts.length ? { id: l.id, name, kind: "metro", districts } : null;
    }
    if (l.locationGroup?.id !== GROUP_SETTLEMENT) return null;
    const district = l.parent ? districtByName.get(fold(l.parent.name)) : undefined;
    const kind: PlaceKind = /mikrorayon/i.test(name) ? "micro" : "settlement";
    return district ? { id: l.id, name, kind, districts: [district] } : null;
  };

  return locations
    .flatMap((l) => place(l) ?? [])
    .sort((a, b) => a.name.localeCompare(b.name, "az", { numeric: true }));
}

/* What bina.az is asked for. A chosen district with places chosen inside it
   stands for those places; one without, for the whole district. A place
   whose district is not chosen (a link written by hand) still counts. */
export async function locationIdsFor(districts: string[], places: string[]): Promise<string[] | undefined> {
  if (!districts.length && !places.length) return undefined;
  const catalog = places.length ? await getPlaceOptions().catch(() => []) : [];
  const inside = (id: string, district: string) => catalog.find((p) => p.id === id)?.districts.includes(district) ?? false;
  const ids = new Set<string>();
  for (const d of districts) {
    const chosen = places.filter((p) => inside(p, d));
    if (chosen.length) chosen.forEach((p) => ids.add(p));
    else if (BINA_DISTRICT_ID[d]) ids.add(BINA_DISTRICT_ID[d]);
  }
  for (const p of places) if (!districts.some((d) => inside(p, d))) ids.add(p);
  return ids.size ? [...ids] : undefined;
}
