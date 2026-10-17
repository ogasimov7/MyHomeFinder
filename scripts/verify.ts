/* Logic checks for the parts that decide what the user is told.
   Run: npm run verify */

import { scanCards, parseCard, readPostedAt, FRESH_DAYS, type RawCard } from "../src/lib/cards";
import { resolveFromText } from "../src/lib/geo";
import { coverageParts, rank, MAX_ROWS } from "../src/lib/ranking";
import { MIN_CARDS, readerJs } from "../src/lib/reader";
import { siteFor, typeOfUrl, SITES } from "../src/lib/sites";
import { money, perSqm, signedPct } from "../src/lib/format";

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const card = (id: string, text: string): RawCard => ({ id, url: `https://bina.az/items/${id}`, text });

/* ---- card text, as bina.az prints it ---- */
console.log("\n--- kart oxunuşu ---");
const flat = parseCard(card("901", "83 000 Mərdəkan q. 1 otaqlı 37 m² 4/5 mərtəbə Bakı , bugün 12:51"));
check("qiymət oxundu", flat.ok && flat.listing.price === 83000, flat.ok ? `${flat.listing.price}` : "oxunmadı");
check("sahə oxundu", flat.ok && flat.listing.area === 37);
check("otaq oxundu", flat.ok && flat.listing.rooms === 1);
check("mərtəbə oxundu", flat.ok && flat.listing.floor === 4 && flat.listing.totalFloors === 5);
check("qəsəbə tanındı", flat.ok && flat.listing.areaId === "mardakan", flat.ok ? flat.listing.areaId : "");

const time = parseCard(card("903", "137 700 Neftçilər m. 1 otaqlı 51 m² 13/15 mərtəbə Bakı , bugün 17:36"));
check("saat qiymət sayılmadı", time.ok && time.listing.price === 137700, time.ok ? `${time.listing.price}` : "");

const usd = parseCard(card("444", "120 000 USD 2 otaqlı 72 m² 12/16 Nərimanov r."));
check("USD çevrildi", usd.ok && usd.listing.price === 204000, usd.ok ? `${usd.listing.price}` : "");
check("çevrilmə bildirilir", usd.ok && usd.listing.priceConverted);
check("manatla elan çevrilmiş sayılmır", flat.ok && !flat.listing.priceConverted);

const land = parseCard(card("905", "60 000 Masazır 8 sot Abşeron"));
check("torpaq mənzil sayılmır", !land.ok && land.reason === "notFlat", land.ok ? "oxundu" : land.reason);
const faraway = parseCard(card("906", "45 000 Gəncə 2 otaqlı 60 m² 2/5 mərtəbə"));
check("modeldə olmayan şəhər buraxılır", !faraway.ok && faraway.reason === "geo", faraway.ok ? "oxundu" : faraway.reason);

/* ---- geography ---- */
console.log("\n--- coğrafiya ---");
check("metro adı tanınır", resolveFromText("Gənclik m.")?.areaId === "ganjlik");
check("uzun ad qısasını üstələyir", resolveFromText("Yeni Yasamal")?.areaId === "yeni-yasamal");
const settlement = resolveFromText("Bülbülə");
check("qəsəbə rayona bağlanır", settlement?.districtId === "surakhani", settlement?.districtId ?? "tanınmadı");
check("məhəllə uydurulmur", settlement?.areaAssumed === true);
const outside = resolveFromText("Xırdalan");
check("Abşeron oxunur", outside?.districtId === "absheron", outside?.districtId ?? "tanınmadı");
check("bazarı olmadığı bildirilir", outside?.marketKnown === false);
check("Bakı bölgəsində bazar var", resolveFromText("Gənclik m.")?.marketKnown === true);
check("tanınmayan ad uydurulmur", resolveFromText("filan yaşayış kompleksi") === null);

/* ---- ranking ---- */
console.log("\n--- sıralama ---");
const page = scanCards([
  card("1", "100 000 Gənclik m. 2 otaqlı 50 m² 3/9 mərtəbə"),   // 2000 ₼/m²
  card("2", "180 000 Gənclik m. 3 otaqlı 60 m² 5/9 mərtəbə"),   // 3000 ₼/m²
  card("3", "125 000 Gənclik m. 2 otaqlı 50 m² 7/9 mərtəbə"),   // 2500 ₼/m²
  card("4", "150 000 Əhmədli m. 3 otaqlı 75 m² 2/9 mərtəbə"),   // tək elan
  card("5", "310 000 Mərdəkan q. 5 otaqlı 240 m² həyət evi"),   // ev
  card("6", "60 000 Masazır 8 sot"),                            // mənzil deyil
  card("7", "45 000 Gəncə 2 otaqlı 60 m²"),                     // ünvan tanınmır
]);
check("kartlar oxundu", page.listings.length === 4, `${page.listings.length}`);
check("ev mənzil sayılmır", page.skips.type === 1, `${page.skips.type}`);
check("torpaq oxunmayan sayılır", page.skips.notFlat === 1, `${page.skips.notFlat}`);
check("ünvan tanınmayan sayılır", page.skips.geo === 1, `${page.skips.geo}`);

const ranked = rank(page, "https://bina.az/alqi-satqi/menziller");
ranked.rows.forEach((r, i) =>
  console.log(`  ${i + 1}. ${money(r.listing.price)} · ${perSqm(r.listing.pricePerSqm)} · ${r.reference.name} · ${r.deviationPct === null ? "tək elan" : signedPct(r.deviationPct, 0)}`),
);
check("ev sıralamadan kənarda", ranked.rows.length === 4, `${ranked.rows.length}`);
check("ən ucuz birinci gəlir", ranked.rows[0].listing.id === "1", ranked.rows[0].listing.id);
check("median öz səhifəsindən çıxır", Math.abs(ranked.rows[0].reference.median - 2500) < 1, `${ranked.rows[0].reference.median}`);
check("faiz mediana görədir", Math.abs((ranked.rows[0].deviationPct ?? 0) + 20) < 0.1, `${ranked.rows[0].deviationPct?.toFixed(1)}`);
const alone = ranked.rows.find((r) => r.listing.id === "4")!;
check("tək elan üçün faiz uydurulmur", alone.deviationPct === null && alone.reference.level === "self");
check("sayğac səbəbləri yazır", coverageParts(ranked).some((p) => p.includes("başqa növ")), coverageParts(ranked).join(" · "));
check("sıfır kateqoriya yazılmır", !coverageParts(ranked).some((p) => p.startsWith("0 ")));

/* ---- a place's own listings can stand behind its median ---- */
console.log("\n--- ərazi nümunəsi ---");
const pool = scanCards([
  card("p1", "160 000 Əhmədli m. 2 otaqlı 50 m² 3/9 mərtəbə"),  // 3200 ₼/m²
  card("p2", "180 000 Əhmədli m. 3 otaqlı 60 m² 4/9 mərtəbə"),  // 3000 ₼/m²
  card("1", "100 000 Gənclik m. 2 otaqlı 50 m² 3/9 mərtəbə"),   // səhifədə də var
]).listings;
const pooled = rank(page, "https://bina.az/alqi-satqi/menziller", { pool });
const ahmadli = pooled.rows.find((r) => r.listing.id === "4")!;
check("nümunə tək elana etalon verir", ahmadli.reference.level === "area" && ahmadli.reference.count === 3, `${ahmadli.reference.level} · ${ahmadli.reference.count}`);
check("nümunə medianı hesablayır", Math.abs(ahmadli.reference.median - 3000) < 1, `${ahmadli.reference.median}`);
check("nümunə sıralanmır", pooled.rows.length === ranked.rows.length, `${pooled.rows.length}`);
const ganjlik = pooled.rows.find((r) => r.listing.id === "1")!;
check("səhifədəki elan iki dəfə sayılmır", ganjlik.reference.count === 3, `${ganjlik.reference.count}`);

/* ---- the list stops at the first hundred ---- */
console.log("\n--- siyahı həddi ---");
const crowd = scanCards(
  Array.from({ length: 130 }, (_, i) =>
    card(`b${i}`, `${100000 + i * 1000} Gənclik m. 2 otaqlı 50 m² 3/9 mərtəbə`),
  ),
);
const capped = rank(crowd, "https://bina.az/alqi-satqi/menziller");
check("siyahı ilk 100-də kəsilir", capped.rows.length === MAX_ROWS, `${capped.rows.length}`);
check("baxılan elan sayı məhdud deyil", capped.seen === 130 && capped.ranked === 130, `${capped.seen}/${capped.ranked}`);
check("kəsilən elanlar saxlanılmır", capped.rows.length < capped.ranked);
check("maxRows ilə hamısı qalır", rank(crowd, "https://bina.az/alqi-satqi/menziller", { maxRows: Infinity }).rows.length === 130);
check(
  "ən ucuz 100 qalır",
  capped.rows[0].listing.price === 100000 && capped.rows[MAX_ROWS - 1].listing.price === 100000 + (MAX_ROWS - 1) * 1000,
  `${money(capped.rows[0].listing.price)} … ${money(capped.rows[MAX_ROWS - 1].listing.price)}`,
);
check(
  "kəsilmə sayğacda deyilir",
  coverageParts(capped).some((p) => p === `ilk ${MAX_ROWS}-i göstərilir`),
  coverageParts(capped).join(" · "),
);
check("kəsilmə olmayanda susulur", !coverageParts(ranked).some((p) => p.startsWith("ilk ")));

/* ---- dates, and the window the scan works in ---- */
console.log("\n--- tarix və 5 günlük pəncərə ---");
const now = new Date(2026, 7, 27, 18, 0, 0); // 27 avqust 2026
const dated = (text: string) => readPostedAt(text, now);
check("bugün oxunur", dated("Bakı, bugün 17:42")?.getDate() === 27, `${dated("Bakı, bugün 17:42")}`);
check("dünən oxunur", dated("Bakı, dünən 23:15")?.getDate() === 26);
check("ay adı ilə tarix oxunur", dated("Bakı, 21 avqust 2026")?.getDate() === 21 && dated("Bakı, 21 avqust 2026")?.getMonth() === 7);
check("nöqtəli tarix oxunur", dated("19.08.2026")?.getDate() === 19 && dated("19.08.2026")?.getMonth() === 7);
check("tarixsiz kart null qaytarır", dated("Bakı, 3 otaqlı 70 m²") === null);

const window = scanCards(
  [
    card("f1", "100 000 Gənclik m. 2 otaqlı 50 m² 3/9 mərtəbə Bakı, bugün 12:00"),
    card("f2", "120 000 Gənclik m. 2 otaqlı 50 m² 4/9 mərtəbə Bakı, dünən 09:30"),
    card("f3", "140 000 Gənclik m. 2 otaqlı 50 m² 5/9 mərtəbə Bakı, 24 avqust 2026"),
    card("o1", "900 000 Gənclik m. 3 otaqlı 90 m² 6/9 mərtəbə Bakı, 21 avqust 2026"),
    card("o2", "800 000 Gənclik m. 3 otaqlı 90 m² 7/9 mərtəbə Bakı, 01.07.2026"),
    card("n1", "160 000 Gənclik m. 2 otaqlı 50 m² 8/9 mərtəbə Bakı"),
  ],
  { freshDays: FRESH_DAYS, now },
);
check("son 5 gün saxlanılır", window.listings.length === 4, `${window.listings.length}`);
check("köhnə elanlar kənarda qalır", window.skips.stale === 2, `${window.skips.stale}`);
check("tarixsiz elan atılmır", window.listings.some((l) => l.id === "n1"));
check("tarix elanda saxlanılır", window.listings.every((l) => (l.id === "n1" ? l.postedAt === null : !!l.postedAt)));
check(
  "köhnələr sayğacda deyilir",
  coverageParts(rank(window, "https://bina.az/x")).some((p) => p === "2 köhnə elan"),
);

/* ---- kub.az, read from cards the site really printed ---- */
console.log("\n--- kub.az ---");
check("bina.az tanınır", siteFor("https://bina.az/alqi-satqi/menziller")?.id === "bina");
check("kub.az tanınır", siteFor("https://kub.az/2-otaqli-yeni-tikili-evler-satilir")?.id === "kub");
check("ru altdomeni də tanınır", siteFor("https://ru.kub.az/x")?.id === "kub");
check("özgə sayt qəbul edilmir", siteFor("https://tap.az/elanlar") === null);

const kub = siteFor("https://kub.az/2-otaqli-yeni-tikili-evler-satilir")!;
const kubCard = (id: string, url: string, text: string): RawCard => ({ id, url, text });
const sale = kubCard(
  "22841000",
  "https://kub.az/elan/Sat%C4%B1l%C4%B1r-Bina%20ev%20m%C9%99nzil-98500%20AZN-id-22841000",
  "98500 AZN Satılır Bina ev mənzil / Yeni tikili 2 otaq 79 m² 11 / 18 Mərtəbə 1 246 AZN/m² Bakı/Abşeron Qaradağ r. Lökbatan Bakı şəhəri, Lökbatan 22 TƏCİLİ SATILIR – LÖKBATANDA PREMİUM YAŞAYIŞ KOMPLEKSİ! 19.08.2026",
);
const prose = kubCard(
  "22851822",
  "https://kub.az/elan/Sat%C4%B1l%C4%B1r-Bina%20ev%20m%C9%99nzil-288000%20AZN-id-22851822",
  "VIP 288000 AZN Kupçalı Satılır Bina ev mənzil / Yeni tikili 2 otaq 64 m² 6 / 28 Mərtəbə 4 500 AZN/m² Bakı/Abşeron Ünvan: SEA BREEZE REPORTAGE HEİGHTS REPORTAGE HEİGHTS-də SUPER FÜRSƏT! Yasamal seçimi 19.08.2026",
);
const rent = kubCard(
  "22800111",
  "https://kub.az/elan/Kiray%C9%99-Bina%20ev%20m%C9%99nzil-900%20AZN-2%20otaq-60%20m2-id-22800111",
  "900 AZN Kirayə Bina ev mənzil / Köhnə tikili 2 otaq 60 m² 3 / 9 Mərtəbə 15 AZN/m² Bakı/Abşeron Yasamal r. Yeni Yasamal 19.08.2026",
);

const kubScan = scanCards([sale, prose, rent], { site: kub, now });
check("kub.az kartı oxunur", kubScan.listings.length === 1, `${kubScan.listings.length}`);
check("qiymət və sahə düz oxunur", kubScan.listings[0]?.price === 98500 && kubScan.listings[0]?.area === 79);
check("ünvan saytın öz sətrindən götürülür", kubScan.listings[0]?.areaName === "Lökbatan", kubScan.listings[0]?.areaName ?? "");
check("kirayə elanı sıralanmır", kubScan.skips.rent === 1, `${kubScan.skips.rent}`);
check("təsvirdəki yer adına inanılmır", kubScan.skips.geo === 1, `${kubScan.skips.geo}`);
check("kub.az tarixi oxunur", kubScan.listings[0]?.postedAt?.slice(0, 10) === "2026-08-19", kubScan.listings[0]?.postedAt ?? "");
check(
  "kirayə sayğacda deyilir",
  coverageParts(rank(kubScan, "https://kub.az/x")).some((p) => p === "1 kirayə elanı"),
);

/* ---- flats, houses and land ---- */
console.log("\n--- əmlak növləri ---");
const houseCards = [
  card("h1", "490 000 Mərdəkan q. 5 otaqlı 175 m² Bakı, bugün 09:44"),
  card("h2", "165 000 Türkan q. 6 otaqlı 164 m² Bakı, bugün 21:14"),
  card("h3", "95 000 Masazır q. 3 otaqlı 55 m² 4/8 mərtəbə Bakı, bugün 20:27"), // mənzil
];
const houses = scanCards(houseCards, { type: "house" });
check("həyət evi kartı oxunur", houses.listings.length === 2, `${houses.listings.length}`);
check("mərtəbəli kart ev siyahısına düşmür", houses.skips.type === 1, `${houses.skips.type}`);
check("növ elanda saxlanılır", houses.listings.every((l) => l.type === "house"));

const plotCards = [
  card("l1", "59 000 Qobu q. 8 sot Bakı, bugün 21:44"),
  card("l2", "490 000 Mərdəkan q. 5 otaqlı 175 m² Bakı, bugün 09:44"),
];
const plots = scanCards(plotCards, { type: "house" });
check("torpaq ev sayılmır", plots.listings.length === 1, `${plots.listings.length}`);
check("torpaq oxunmayan kimi sayılır", plots.skips.notFlat === 1, `${plots.skips.notFlat}`);

/* On a page of flats a house gives itself away by name, and a plot by the
   sot; a card that says neither is taken as the page's own type. */
const flats = scanCards(
  [
    card("f1", "95 000 Masazır q. 3 otaqlı 55 m² 4/8 mərtəbə Bakı, bugün 20:27"),
    card("f2", "310 000 Mərdəkan q. 5 otaqlı 240 m² həyət evi Bakı, bugün 10:00"),
    card("f3", "60 000 Masazır q. 8 sot Bakı, bugün 11:00"),
  ],
  { type: "flat" },
);
check(
  "mənzil axtarışında ev və torpaq sayılmır",
  flats.listings.length === 1 && flats.skips.type === 1 && flats.skips.notFlat === 1,
  `${flats.listings.length}/${flats.skips.type}/${flats.skips.notFlat}`,
);
check(
  "başqa növ sayğacda deyilir",
  coverageParts(rank(flats, "https://bina.az/x")).some((p) => p === "1 başqa növ"),
);

/* ---- links, and the script the site is read with ---- */
console.log("\n--- sayt uyğunluğu ---");
check("linkdən növ oxunur — ev", typeOfUrl("https://bina.az/alqi-satqi/heyet-evleri?page=2") === "house");
check("linkdən növ oxunur — mənzil", typeOfUrl("https://bina.az/alqi-satqi/menziller?rooms=2") === "flat");
check("kub linkindən növ oxunur", typeOfUrl("https://kub.az/evler-villalar-bag-satilir") === "house");
const kubJs = readerJs(kub);
const binaJs = readerJs(SITES.find((site) => site.id === "bina")!);
check("kub skriptində bina naxışı qalmır", !kubJs.includes("/items/"), kubJs.includes("/items/") ? "sızıb" : "");
check("kub skripti öz seçicisini işlədir", kubJs.includes('a[href*=\\"/elan/\\"]') || kubJs.includes("/elan/"));
check("bina skripti öz seçicisini işlədir", binaJs.includes("/items/"));
check("id naxışı skriptə yazılır", kubJs.includes("-id-"), "");
check("düymə həddi skriptə yazılır", binaJs.includes("var MIN_CARDS = " + MIN_CARDS), `${MIN_CARDS}`);
check("hədd sıralama limiti ilə eynidir", MIN_CARDS === MAX_ROWS, `${MIN_CARDS}/${MAX_ROWS}`);

console.log(failures === 0 ? "\nALL CHECKS PASSED\n" : `\n${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
