import Link from "next/link";
import { Suspense } from "react";
import { ArrowIcon, ChartIcon, InfoIcon, KeyIcon } from "@/components/icons";
import { ListingCard } from "@/components/ListingCard";
import { CardSkeletons } from "@/components/Skeletons";
import { getMarket, type Market } from "@/lib/market";
import { DEFAULT_QUERY, marketKey } from "@/lib/query";
import { DISTRICTS } from "../../src/lib/geography";
import { placeValues } from "@/lib/view";

const SHORTCUTS = [
  { href: "/search?rooms=1", label: "1 otaqlı" },
  { href: "/search?rooms=2", label: "2 otaqlı" },
  { href: "/search?rooms=3", label: "3 otaqlı" },
  { href: "/search?category=new", label: "Yeni tikili" },
  { href: "/search?category=house", label: "Həyət evləri" },
  { href: "/search?best=1&budget=100-200", label: "100–200K, ən sərfəlilər" },
];

/** The default search, read once and shared by every block that shows it. */
async function latest(): Promise<Market | null> {
  try {
    return await getMarket(marketKey(DEFAULT_QUERY));
  } catch {
    return null;
  }
}

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1 className="hero-title">
          Dəyərli ev,
          <br />
          <span className="hero-line">
            <Suspense fallback={<span className="hero-pill" />}>
              <HeroPill />
            </Suspense>
            rəqəmlərlə
          </span>
        </h1>
        <div className="hero-side">
          <p>
            bina.az və kub.az-dakı elanları hər ərazinin içində m² qiymətinə görə müqayisə edirik. Hər yerin ən
            sərfəlisini ilk siz görürsünüz.
          </p>
          <div className="hero-cta">
            <Link href="/search" className="btn-solid">
              Elanlara bax
            </Link>
            <Link href="/how" className="btn-ghost">
              Necə işləyir
            </Link>
          </div>
        </div>
        <nav className="shortcuts" aria-label="Tez axtarış">
          {SHORTCUTS.map((s) => (
            <Link key={s.href} href={s.href} className="chip">
              {s.label}
            </Link>
          ))}
        </nav>
      </section>

      <Suspense fallback={<div className="stats sk" style={{ height: 120 }} />}>
        <Stats />
      </Suspense>

      <section className="section">
        <header className="section-head">
          <div>
            <h2>Rayonlar üzrə ən sərfəlilər</h2>
            <p>bina.az-da son əlavə olunan mənzillər arasında, hər rayonda öz ərazisinin m²-i ən ucuzu olanlar.</p>
          </div>
          <Link href="/search?best=1" className="link-arrow">
            Hamısına bax <ArrowIcon size={16} />
          </Link>
        </header>
        <Suspense fallback={<CardSkeletons count={6} />}>
          <DistrictDeals />
        </Suspense>
      </section>

      <section className="section features">
        <article>
          <ChartIcon size={22} />
          <h3>Öz məhəlləsinin içində</h3>
          <p>Elanlar eyni metro, qəsəbə və ya mikrorayondakı qonşuları ilə m² qiymətinə görə müqayisə olunur. Ən ucuzu “Ən sərfəli”, ərazinin ortasından ucuzlar “Sərfəli təklif” nişanı alır; ortadan bahalarda neçə faiz baha olduğu yazılır.</p>
        </article>
        <article>
          <KeyIcon size={22} />
          <h3>Sizin ipoteka şərtləriniz</h3>
          <p>Elanın səhifəsində ilkin ödəniş, müddət və faizi yazın — aylıq ödəniş dərhal hesablanır. Şərtlər yadda qalır, yalnız brauzerinizdə.</p>
        </article>
        <article>
          <InfoIcon size={22} />
          <h3>Heç nə uydurulmur</h3>
          <p>Ünvanı tanınmayan elan sıralanmır, ərazidə tək olan elana saxta faiz yazılmır, dollarla verilən qiymət açıq qeyd olunur.</p>
        </article>
      </section>
    </>
  );
}

async function HeroPill() {
  const market = await latest();
  const values = market ? placeValues(market.rows) : {};
  const photo = market?.rows.find((r) => r.extras.photo && values[r.listing.id]?.kind === "best")?.extras.photo;
  return (
    <span className="hero-pill">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo && <img src={photo} alt="" referrerPolicy="no-referrer" />}
    </span>
  );
}

async function Stats() {
  const market = await latest();
  if (!market) return null;
  const byId = placeValues(market.rows);
  const values = Object.values(byId);
  const best = values.filter((v) => v.kind === "best").length;
  const good = values.filter((v) => v.kind === "good").length;
  // Places with at least two listings: the only ones a comparison was made in.
  const compared = new Set(market.rows.filter((r) => byId[r.listing.id].kind !== "none").map((r) => r.listing.areaId)).size;
  return (
    <section className="stats" aria-label="Bu günün rəqəmləri">
      <div>
        <b>{market.rows.length}</b>
        <span>elan sıralandı</span>
      </div>
      <div>
        <b>{compared}</b>
        <span>ərazi müqayisə olundu</span>
      </div>
      <div>
        <b>{best}</b>
        <span>öz ərazisinin ən sərfəlisi</span>
      </div>
      <div>
        <b>{good}</b>
        <span>öz ərazisinin ortasından ucuz</span>
      </div>
    </section>
  );
}

/** Cards shown per district on the home page. */
const PER_DISTRICT = 4;

/* The best value of each place, gathered by district: a row of cards for
   every district that has any in the latest listings, central ones first.
   "All" opens that district's own search, read from bina.az for it alone. */
async function DistrictDeals() {
  const market = await latest();
  if (!market) {
    return (
      <div className="empty">
        <h2>bina.az hazırda cavab vermir</h2>
        <p>Bir az sonra yenidən baxın.</p>
      </div>
    );
  }
  const values = placeValues(market.rows);
  const best = market.rows.filter((r) => values[r.listing.id].kind === "best");
  const districts = DISTRICTS.flatMap((d) => {
    // Places with more listings first: being the cheapest of many says more.
    const rows = best
      .filter((r) => r.listing.districtId === d.id)
      .sort((a, b) => {
        const va = values[a.listing.id];
        const vb = values[b.listing.id];
        return (vb.kind === "best" ? vb.size : 0) - (va.kind === "best" ? va.size : 0);
      })
      .slice(0, PER_DISTRICT);
    return rows.length ? [{ district: d, rows }] : [];
  });

  return (
    <div className="district-deals">
      {districts.map(({ district, rows }) => (
        <section key={district.id} className="district-row" aria-label={`${district.name} rayonu`}>
          <header>
            <h3>
              {district.name} <span>rayonu</span>
            </h3>
            <Link href={`/search?district=${district.id}&best=1`} className="link-arrow">
              Hamısı <ArrowIcon size={15} />
            </Link>
          </header>
          <div className="rail">
            {rows.map((row) => (
              <ListingCard key={row.listing.id} row={row} value={values[row.listing.id]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
