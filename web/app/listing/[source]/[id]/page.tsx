import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { money, perSqm } from "../../../../../src/lib/format";
import type { Listing } from "../../../../../src/lib/cards";
import { BackButton, Description, MortgageCalc, SaveButton, ShareButton } from "@/components/DetailParts";
import { Gallery } from "@/components/Gallery";
import { AreaIcon, BedIcon, CheckIcon, ExternalIcon, PinIcon, StairsIcon, StarIcon, TagIcon, UserIcon } from "@/components/icons";
import { ListingCard } from "@/components/ListingCard";
import { DetailSkeleton } from "@/components/Skeletons";
import { compare, getDetail, type Detail } from "@/lib/detail";
import { getMarket, type Market, type MarketRow } from "@/lib/market";
import { marketKey, parseQuery, queryString, type Source } from "@/lib/query";
import { valueLabel, type Value } from "@/lib/value";
import { placeValues, searched } from "@/lib/view";

type Props = PageProps<"/listing/[source]/[id]">;

const isSource = (s: string): s is Source => s === "bina" || s === "kub";
const siteName = (s: Source) => (s === "bina" ? "bina.az" : "kub.az");

function heading(detail: Detail, listing: Listing | null): string {
  if (!listing) return detail.category ?? "Elan";
  return `${listing.rooms} otaqlı ${listing.type === "house" ? "həyət evi" : "mənzil"}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { source, id } = await params;
  if (!isSource(source)) return { title: "Elan tapılmadı" };
  const detail = await getDetail(source, id).catch(() => null);
  if (!detail) return { title: "Elan tapılmadı" };
  const price = detail.listing ? money(detail.listing.price) : `${detail.price} ${detail.currency}`;
  return {
    title: `${heading(detail, detail.listing)} · ${price}`,
    description: detail.description.slice(0, 160),
  };
}

export default function ListingPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ListingView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** "2026-10-16T23:08:27+04:00" as the site meant it: Baku's own clock. */
function siteDate(iso: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}, ${m[4]}:${m[5]}` : null;
}

async function ListingView({ params, searchParams }: Props) {
  const { source, id } = await params;
  if (!isSource(source)) notFound();
  const query = { ...parseQuery(await searchParams), source };
  const qs = queryString(query);

  let detail: Detail | null;
  try {
    detail = await getDetail(source, id);
  } catch {
    return (
      <div className="empty">
        <h2>{siteName(source)} hazırda cavab vermir</h2>
        <p>Elanı bir az sonra yenidən açın.</p>
      </div>
    );
  }
  if (!detail) notFound();

  // Measured against the search it was opened from — the same page its card
  // was ranked in — or, opened on its own, the latest listings of its kind.
  if (detail.listing?.type === "house") query.category = "house";
  else if (query.category === "house") query.category = "flat";
  let market: Market | null = null;
  try {
    market = await getMarket(marketKey(query));
  } catch {
    /* the page still stands without a comparison */
  }

  // Ranking a listing that was not on the page stamps the result with the
  // time; that belongs to this request, not to a prerender.
  await connection();
  const { ranked, row, similar } = await compare(detail, market, query.category);
  const listing = row?.listing ?? detail.listing;
  const photos = detail.photos.length
    ? detail.photos
    : row?.extras.photo
      ? [{ full: row.extras.photo, medium: row.extras.photo, thumb: row.extras.photo }]
      : [];
  const saveRow: MarketRow | null =
    ranked && listing
      ? {
          ...ranked,
          listing,
          source,
          order: 0,
          extras: {
            photo: row?.extras.photo ?? photos[0]?.full ?? null,
            bill: detail.bill ?? undefined,
            repair: detail.repair ?? undefined,
            mortgage: detail.mortgage ?? undefined,
          },
        }
      : null;

  // Its standing among the listings of its place in the same search — the
  // group its card was badged in. Opened from elsewhere, it joins that group.
  const base = market ? searched(market, query) : [];
  const values = placeValues(base);
  const peers = listing && market ? base.map((r) => r.listing).filter((l) => l.areaId === listing.areaId) : [];
  const group = listing ? (peers.some((l) => l.id === listing.id) ? peers : [...peers, listing]) : [];
  const value: Value | null = listing && market ? placeValues(group.map((l) => ({ listing: l })))[listing.id] : null;
  const badge = value ? valueLabel(value) : null;
  const cheapestOther = listing
    ? Math.min(...group.filter((l) => l.id !== listing.id).map((l) => l.pricePerSqm), Infinity)
    : Infinity;
  const price = listing?.price ?? detail.price;
  const title = heading(detail, listing);
  const place = listing
    ? listing.areaAssumed
      ? listing.areaName
      : `${listing.areaName}, ${listing.districtName} r.`
    : null;

  const facts = (
    [
    ["Kateqoriya", detail.category],
    ["Satıcı", detail.seller.type],
    ["Yenilənib", siteDate(detail.updatedAt)],
    ["Baxış", detail.views !== null ? String(detail.views) : null],
    ["Elan nömrəsi", detail.id],
      ["Mənbə", detail.origin ? new URL(detail.origin).hostname.replace(/^www\./, "") : siteName(source)],
    ] as [string, string | null][]
  ).filter((f): f is [string, string] => Boolean(f[1]));

  const features = [
    detail.bill && "Kupçalı",
    detail.repair && "Təmirli",
    detail.mortgage && "İpotekaya uyğun",
    listing?.priceConverted && "Qiymət USD ilə verilib",
    listing && !listing.marketKnown && "Bakıdan kənar",
  ].filter((f): f is string => Boolean(f));

  return (
    <div className="detail">
      <div className="detail-top">
        <BackButton fallback={`/search${qs}`} />
        <a className="btn-ghost" href={detail.url} target="_blank" rel="noopener noreferrer">
          {siteName(source)}-da aç <ExternalIcon size={16} />
        </a>
      </div>

      <header className="detail-head">
        <div>
          <h1>
            {title} · {money(price)}
          </h1>
          <p>
            {badge && (
              <span className={`pill pill-${badge.tone}`}>
                {badge.tone === "best" && <StarIcon size={12} />}
                {badge.label}
              </span>
            )}
            {(detail.address || place) && <span>{detail.address ?? place}</span>}
          </p>
        </div>
        <div className="detail-actions">
          <ShareButton title={`${title} · ${money(price)}`} />
          <SaveButton row={saveRow} />
        </div>
      </header>

      <Gallery photos={photos} />

      <div className="detail-cols">
        <div className="detail-main">
          {listing && (
            <ul className="specs">
              <li>
                <BedIcon size={20} />
                <div>
                  <b>{listing.rooms}</b>
                  <span>Otaq</span>
                </div>
              </li>
              <li>
                <AreaIcon size={20} />
                <div>
                  <b>{listing.area} m²</b>
                  <span>Sahə</span>
                </div>
              </li>
              {listing.floor !== null && listing.totalFloors !== null && (
                <li>
                  <StairsIcon size={20} />
                  <div>
                    <b>
                      {listing.floor} / {listing.totalFloors}
                    </b>
                    <span>Mərtəbə</span>
                  </div>
                </li>
              )}
              <li>
                <TagIcon size={20} />
                <div>
                  <b>{perSqm(listing.pricePerSqm)}</b>
                  <span>m² qiyməti</span>
                </div>
              </li>
            </ul>
          )}

          {detail.description && (
            <section className="box">
              <h2 className="box-title">Təsvir</h2>
              <Description text={detail.description} />
              {place && (
                <p className="card-tags detail-tags">
                  <span>{listing?.type === "house" ? "Həyət evi" : "Mənzil"}</span>
                  <span>{place}</span>
                  <span>Satış</span>
                </p>
              )}
            </section>
          )}

          <section className="box">
            <h2 className="box-title">Xüsusiyyətlər</h2>
            {features.length > 0 && (
              <ul className="features-list">
                {features.map((f) => (
                  <li key={f}>
                    <CheckIcon size={16} />
                    {f}
                  </li>
                ))}
              </ul>
            )}
            <dl className="facts">
              {facts.map(([k, val]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{val}</dd>
                </div>
              ))}
            </dl>
          </section>

          {detail.lat !== null && detail.lng !== null && (
            <section className="box">
              <h2 className="box-title">Xəritə</h2>
              <iframe
                className="map"
                title="Elanın xəritədə yeri"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${detail.lng - 0.01},${detail.lat - 0.006},${detail.lng + 0.01},${detail.lat + 0.006}&layer=mapnik&marker=${detail.lat},${detail.lng}`}
              />
              <p className="box-note">
                <PinIcon size={14} /> Nöqtəni satıcı işarələyib; dəqiq ünvanı satıcıdan soruşun.
              </p>
            </section>
          )}
        </div>

        <aside className="detail-side">
          <section className="box value">
            <h2 className="box-title">HomeFinder qiymətləndirməsi</h2>
            {listing && value ? (
              <Valuation listing={listing} value={value} next={Number.isFinite(cheapestOther) ? cheapestOther : null} />
            ) : (
              <p className="box-note">
                {listing
                  ? `${siteName(source)}-dan müqayisə üçün elanlar oxunmadı; bir az sonra yenidən baxın.`
                  : "Ünvan və ya ölçülər oxunmadığı üçün bu elan müqayisə olunmur — uydurma faiz göstərilmir."}
              </p>
            )}
          </section>

          <section className="box">
            <h2 className="box-title">İpoteka hesabı</h2>
            <MortgageCalc price={price} />
          </section>

          <section className="box seller">
            <div className="seller-who">
              <span className="seller-avatar">
                {detail.seller.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.seller.logo} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon size={22} />
                )}
              </span>
              <div>
                <b>{detail.seller.name ?? detail.seller.agency ?? siteName(source)}</b>
                <span>
                  {detail.seller.name && detail.seller.agency
                    ? detail.seller.agency
                    : detail.origin
                      ? `Orijinal elan — ${siteName(source)} bu elanı oradan götürüb`
                      : detail.seller.type ?? "Elanın sahibi"}
                </span>
              </div>
            </div>
            <a className="btn-solid" href={detail.origin ?? detail.url} target="_blank" rel="noopener noreferrer">
              Satıcı ilə əlaqə <ExternalIcon size={16} />
            </a>
            <p className="box-note">Telefon nömrəsi elanın öz səhifəsindədir. HomeFinder əlaqə məlumatı saxlamır.</p>
          </section>
        </aside>
      </div>

      {/* On a phone the seller box is far below the photos; this keeps the
          price and the way to the seller under the thumb. Hidden on wide screens. */}
      <div className="detail-bar">
        <div>
          <b>{money(price)}</b>
          {badge ? (
            <span className={`detail-bar-badge tone-${badge.tone}`}>
              {badge.tone === "best" && <StarIcon size={11} />}
              {badge.label}
            </span>
          ) : (
            listing && <span>{perSqm(listing.pricePerSqm)}</span>
          )}
        </div>
        <a className="btn-solid" href={detail.origin ?? detail.url} target="_blank" rel="noopener noreferrer">
          Satıcı ilə əlaqə
        </a>
      </div>

      {similar.length > 0 && (
        <section className="section">
          <header className="section-head">
            <div>
              <h2>Yaxınlıqda digər elanlar</h2>
              <p>Eyni axtarışdan, eyni ərazi və rayondan. Nişanlar hər elanın öz ərazisindəki yerinə görədir.</p>
            </div>
          </header>
          <div className="grid grid-3">
            {similar.map((r) => (
              <ListingCard key={r.listing.id} row={r} value={values[r.listing.id]} qs={qs} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Valuation({ listing, value, next }: { listing: Listing; value: Value; next: number | null }) {
  if (value.kind === "none") {
    return (
      <p className="box-note">
        Bu axtarışda {listing.areaName} üzrə başqa elan yoxdur, ona görə müqayisə aparılmır — uydurma nəticə göstərilmir.
      </p>
    );
  }
  const other = value.kind === "best" ? next : value.bestPerSqm;
  const max = Math.max(listing.pricePerSqm, other ?? 0);
  const tone = value.kind === "best" ? "best" : "dearer";
  return (
    <>
      <p className={`value-verdict tone-${tone}`}>{valueLabel(value)?.label}</p>
      <div className="bars">
        <div>
          <span>Bu elan</span>
          <i className={`bar tone-${tone}`} style={{ width: `${(listing.pricePerSqm / max) * 100}%` }} />
          <b>{perSqm(listing.pricePerSqm)}</b>
        </div>
        {other !== null && (
          <div>
            <span>{value.kind === "best" ? "Növbəti ən ucuz" : `Ən sərfəli · ${listing.areaName}`}</span>
            <i className="bar" style={{ width: `${(other / max) * 100}%` }} />
            <b>{perSqm(other)}</b>
          </div>
        )}
      </div>
      <p className="box-note">
        {listing.areaName} üzrə bu axtarışdakı {value.size} elan arasında, m² qiymətinə görə.
        {value.kind === "best" && other !== null
          ? ` Növbəti elan ${Math.max(1, Math.round(((other - listing.pricePerSqm) / listing.pricePerSqm) * 100))}% bahadır.`
          : ""}
      </p>
    </>
  );
}
