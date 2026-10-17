/* ============================================================
   Baku geography — identities only.

   The ranking measures a listing against the other listings on the
   same page, so no median, rent level or demand index is stored
   here: there is nothing to be wrong about. A place is a name, an
   id and the district it belongs to.

   `marketKnown: false` marks places this build can read listings
   from but has no market for at all (Sumqayit, the Absheron ring).
   They rank fine against their own page; nothing else is claimed.
   ============================================================ */

export interface District {
  id: string;
  name: string;
  marketKnown?: boolean;
}

export interface Area {
  id: string;
  name: string;
  districtId: string;
}

export const DISTRICTS: District[] = [
  { id: "sabail", name: "Səbail" },
  { id: "nasimi", name: "Nəsimi" },
  { id: "narimanov", name: "Nərimanov" },
  { id: "yasamal", name: "Yasamal" },
  { id: "khatai", name: "Xətai" },
  { id: "nizami", name: "Nizami" },
  { id: "binagadi", name: "Binəqədi" },
  { id: "sabunchu", name: "Sabunçu" },
  { id: "surakhani", name: "Suraxanı" },
  { id: "khazar", name: "Xəzər" },
  { id: "garadagh", name: "Qaradağ" },
  // read, ranked against their own page, nothing else claimed
  { id: "sumgayit", name: "Sumqayıt", marketKnown: false },
  { id: "absheron", name: "Abşeron", marketKnown: false },
];

export const AREAS: Area[] = [
  { id: "icherisheher", name: "İçərişəhər", districtId: "sabail" },
  { id: "sahil-bulvar", name: "Sahil / Bulvar", districtId: "sabail" },
  { id: "bayil", name: "Bayıl", districtId: "sabail" },
  { id: "badamdar", name: "Badamdar", districtId: "sabail" },
  { id: "28-may-area", name: "28 May", districtId: "nasimi" },
  { id: "nizami-kucesi", name: "Nizami küçəsi", districtId: "nasimi" },
  { id: "montin", name: "Montin", districtId: "nasimi" },
  { id: "kubinka", name: "Kubinka", districtId: "nasimi" },
  { id: "ganjlik", name: "Gənclik", districtId: "narimanov" },
  { id: "narimanov-merkez", name: "Nərimanov mərkəz", districtId: "narimanov" },
  { id: "sovetski-park", name: "Əli Bayramlı", districtId: "narimanov" },
  { id: "yeni-yasamal", name: "Yeni Yasamal", districtId: "yasamal" },
  { id: "elmlar", name: "Elmlər Akademiyası", districtId: "yasamal" },
  { id: "inshaatchilar", name: "İnşaatçılar", districtId: "yasamal" },
  { id: "20-yanvar-area", name: "20 Yanvar", districtId: "yasamal" },
  { id: "memar-ajami-area", name: "Memar Əcəmi", districtId: "yasamal" },
  { id: "hazi-aslanov", name: "Həzi Aslanov", districtId: "khatai" },
  { id: "ahmadli", name: "Əhmədli", districtId: "khatai" },
  { id: "khalglar-dostlugu", name: "Xalqlar Dostluğu", districtId: "khatai" },
  { id: "neftchilar-area", name: "Neftçilər", districtId: "khatai" },
  { id: "shah-ismayil", name: "Şah İsmayıl Xətai", districtId: "khatai" },
  { id: "gara-garayev-area", name: "Qara Qarayev", districtId: "nizami" },
  { id: "ulduz-area", name: "Ulduz", districtId: "nizami" },
  { id: "koroglu-area", name: "Koroğlu", districtId: "nizami" },
  { id: "8-noyabr", name: "8 Noyabr", districtId: "nizami" },
  { id: "8-mikrorayon", name: "8-ci mikrorayon", districtId: "binagadi" },
  { id: "9-mikrorayon", name: "9-cu mikrorayon", districtId: "binagadi" },
  { id: "binagadi-merkez", name: "Binəqədi mərkəz", districtId: "binagadi" },
  { id: "khojasan", name: "Xocəsən", districtId: "binagadi" },
  { id: "bakikhanov", name: "Bakıxanov", districtId: "sabunchu" },
  { id: "zabrat", name: "Zabrat", districtId: "sabunchu" },
  { id: "ramana", name: "Ramana", districtId: "sabunchu" },
  { id: "mashtaga", name: "Maştağa", districtId: "sabunchu" },
  { id: "gunashli", name: "Günəşli", districtId: "surakhani" },
  { id: "surakhani-merkez", name: "Suraxanı mərkəz", districtId: "surakhani" },
  { id: "hovsan", name: "Hövsan", districtId: "surakhani" },
  { id: "bahar", name: "Bahar", districtId: "surakhani" },
  { id: "mardakan", name: "Mərdəkan", districtId: "khazar" },
  { id: "buzovna", name: "Buzovna", districtId: "khazar" },
  { id: "shuvalan", name: "Şüvəlan", districtId: "khazar" },
  { id: "turkan", name: "Türkan", districtId: "khazar" },
  { id: "lokbatan", name: "Lökbatan", districtId: "garadagh" },
  { id: "puta", name: "Puta", districtId: "garadagh" },
  { id: "sahil-garadagh", name: "Sahil (Qaradağ)", districtId: "garadagh" },
  // stand-ins for the districts that have no named areas of their own here
  { id: "sumgayit-centre", name: "Sumqayıt", districtId: "sumgayit" },
  { id: "absheron-centre", name: "Abşeron", districtId: "absheron" },
];

export const districtById = new Map(DISTRICTS.map((d) => [d.id, d]));
export const areaById = new Map(AREAS.map((a) => [a.id, a]));

/** Where a district's own name stands in when no area was recognised. */
export const DISTRICT_FALLBACK: Record<string, string> = {
  sabail: "sahil-bulvar",
  nasimi: "28-may-area",
  narimanov: "narimanov-merkez",
  yasamal: "yeni-yasamal",
  khatai: "shah-ismayil",
  nizami: "gara-garayev-area",
  binagadi: "binagadi-merkez",
  sabunchu: "bakikhanov",
  surakhani: "surakhani-merkez",
  khazar: "mardakan",
  garadagh: "lokbatan",
  sumgayit: "sumgayit-centre",
  absheron: "absheron-centre",
};
