import Link from "next/link";
import { Suspense } from "react";
import { ArrowIcon, ChartIcon, InfoIcon, KeyIcon } from "@/components/icons";
import { ListingCard } from "@/components/ListingCard";
import { CardSkeletons } from "@/components/Skeletons";
import { getMarket, type Market } from "@/lib/market";
import { DEFAULT_QUERY, marketKey } from "@/lib/query";
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
            <h2>Bu günün ən sərfəliləri</h2>
            <p>bina.az-da son əlavə olunan mənzillər arasında, hər birinin ərazisində m²-i ən ucuz olanlar.</p>
          </div>
          <Link href="/search?best=1" className="link-arrow">
            Hamısına bax <ArrowIcon size={16} />
          </Link>
        </header>
        <Suspense fallback={<CardSkeletons count={6} />}>
          <Deals />
        </Suspense>
      </section>

      <section className="section features">
        <article>
          <ChartIcon size={22} />
          <h3>Öz məhəlləsinin içində</h3>
          <p>Elanlar eyni metro, qəsəbə və ya mikrorayondakı qonşuları ilə m² qiymətinə görə müqayisə olunur. Ən ucuzu “Ən sərfəli” nişanı alır, digərlərində ondan neçə faiz baha olduğu yazılır.</p>
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
  const premiums = values.flatMap((v) => (v.kind === "dearer" ? [v.premiumPct] : [])).sort((a, b) => a - b);
  const typical = premiums.length ? premiums[Math.floor(premiums.length / 2)] : null;
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
        <b>{typical !== null ? `${Math.round(typical)}%` : "—"}</b>
        <span>digərləri ən sərfəlidən tipik olaraq baha</span>
      </div>
    </section>
  );
}

async function Deals() {
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
  // The ranking's own order, keeping only the best of each place.
  const rows = market.rows.filter((r) => values[r.listing.id].kind === "best").slice(0, 6);
  return (
    <div className="grid grid-3">
      {rows.map((row) => (
        <ListingCard key={row.listing.id} row={row} value={values[row.listing.id]} />
      ))}
    </div>
  );
}
