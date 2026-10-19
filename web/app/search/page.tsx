import type { Metadata } from "next";
import { Suspense } from "react";
import { Filters } from "@/components/Filters";
import { ListingCard } from "@/components/ListingCard";
import { MoreGrid } from "@/components/MoreGrid";
import { SearchBox, SortSelect } from "@/components/SearchBar";
import { PendingFrame, SearchProvider } from "@/components/SearchState";
import { CardSkeletons, FiltersSkeleton } from "@/components/Skeletons";
import { getMarket } from "@/lib/market";
import { marketKey, parseQuery, queryString } from "@/lib/query";
import { perSqm } from "../../../src/lib/format";
import { meanPerSqm } from "@/lib/value";
import { view } from "@/lib/view";

export const metadata: Metadata = { title: "Axtarış" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <SearchProvider>
      <header className="page-head">
        <h1>Axtarış</h1>
        <Suspense fallback={<div className="searchbox is-skeleton" />}>
          <SearchBox />
        </Suspense>
      </header>
      <div className="search-layout">
        <Suspense fallback={<FiltersSkeleton />}>
          <Filters />
        </Suspense>
        <section className="results" aria-label="Nəticələr">
          <Suspense fallback={<CardSkeletons />}>
            <Results searchParams={searchParams} />
          </Suspense>
        </section>
      </div>
    </SearchProvider>
  );
}

const TIME = new Intl.DateTimeFormat("az", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Baku" });
const COUNT = (n: number) => n.toLocaleString("az").replace(/,/g, " ");

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const query = parseQuery(await searchParams);

  let market;
  try {
    market = await getMarket(marketKey(query));
  } catch {
    return (
      <div className="empty">
        <h2>{query.source === "bina" ? "bina.az" : "kub.az"} hazırda cavab vermir</h2>
        <p>Sayt müvəqqəti əlçatmaz ola bilər. Bir az sonra yenidən yoxlayın və ya digər mənbəyə keçin.</p>
      </div>
    );
  }

  const { rows, values } = view(market, query);
  const site = market.source === "bina" ? "bina.az" : "kub.az";
  const qs = queryString(query);
  // Over exactly the listings shown: every filter, district and text applied.
  const average = meanPerSqm(rows.map((r) => r.listing.pricePerSqm));

  return (
    <PendingFrame>
      <div className="results-head">
        <div>
          <p className="results-count">
            <b>{rows.length}</b> elan
            {market.total !== null && (
              <span>
                {" "}· {site}-da bu axtarışa {COUNT(market.total)} elan uyğundur, ən son {market.read}-i oxundu
              </span>
            )}
          </p>
          {average && (
            <p className="avg-stat">
              <span>Nəticələrin orta m² qiyməti</span>
              <b>{perSqm(average.perSqm)}</b>
              <small>{average.count} elan üzrə</small>
            </p>
          )}
          <p className="results-coverage">
            {market.coverage.join(" · ")} · {TIME.format(new Date(market.at))}-da yeniləndi
          </p>
        </div>
        <SortSelect />
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <h2>Bu filtrlərlə elan tapılmadı</h2>
          <p>Rayon və ya büdcə filtrini genişləndirin. Sıralama son oxunan {market.read} elan üzərindədir.</p>
        </div>
      ) : (
        // Keyed by the search, so a new filter starts from the first cards again.
        <MoreGrid key={qs}>
          {rows.map((row) => (
            <ListingCard key={row.listing.id} row={row} value={values[row.listing.id]} qs={qs} />
          ))}
        </MoreGrid>
      )}
    </PendingFrame>
  );
}
