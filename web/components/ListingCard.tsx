"use client";

import Link from "next/link";
import { useState } from "react";
import { money, perSqm } from "../../src/lib/format";
import type { MarketRow } from "@/lib/market";
import { monthlyPayment } from "@/lib/mortgage";
import { rowKey, useSaved, useTerms } from "@/lib/store";
import { valueLabel, type Value } from "@/lib/value";
import { AreaIcon, BedIcon, BuildingIcon, HeartIcon, PinIcon, StairsIcon, StarIcon } from "./icons";

/** Where a card leads: the listing's own page, carrying the search it was ranked in. */
export function listingHref(row: Pick<MarketRow, "source" | "listing">, qs = ""): string {
  return `/listing/${row.source}/${row.listing.id}${qs}`;
}

/* `value` is the card's standing among the listings of its place in this
   search; a saved card, seen outside any search, has none. */
export function ListingCard({ row, value, qs = "" }: { row: MarketRow; value?: Value; qs?: string }) {
  const { listing, extras, source } = row;
  const { saved, toggle } = useSaved();
  const { terms } = useTerms();
  const [broken, setBroken] = useState(false);

  const isSaved = saved.some((s) => rowKey(s) === rowKey(row));
  const badge = value ? valueLabel(value) : null;
  const kind = listing.type === "house" ? "həyət evi" : "mənzil";
  const place = listing.areaAssumed ? listing.areaName : `${listing.areaName}, ${listing.districtName} r.`;
  const photo = !broken ? extras.photo : null;

  const standing =
    value?.kind === "best"
      ? `${listing.areaName}: bu axtarışdakı ${value.size} elan arasında m²-i ən ucuz`
      : value?.kind === "dearer"
        ? `${listing.areaName} üzrə ən sərfəli: ${perSqm(value.bestPerSqm)} · ${value.size} elan`
        : value
          ? `${listing.areaName}: bu axtarışda müqayisə üçün başqa elan yoxdur`
          : null;

  return (
    <article className="card">
      <Link className="card-media" href={listingHref(row, qs)} tabIndex={-1} aria-hidden>
        {photo ? (
          // Remote listing photos are shown as the sites serve them; routing
          // them through the image optimiser would re-host other people's photos.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <div className="card-ph">
            <BuildingIcon size={34} />
          </div>
        )}
        {badge && (
          <div className="card-badges">
            <span className={`pill pill-${badge.tone}`} title="Eyni ərazidəki elanlarla m² qiymətinə görə">
              {badge.tone === "best" && <StarIcon size={12} />}
              {badge.label}
            </span>
          </div>
        )}
        <span className="card-src">{source === "bina" ? "bina.az" : "kub.az"}</span>
      </Link>

      <button
        type="button"
        className={`card-fav${isSaved ? " is-on" : ""}`}
        onClick={() => toggle(row)}
        aria-pressed={isSaved}
        aria-label={isSaved ? "Seçilmişlərdən çıxar" : "Seçilmişlərə əlavə et"}
      >
        <HeartIcon size={17} filled={isSaved} />
      </button>

      <div className="card-body">
        <h3 className="card-title">
          <Link href={listingHref(row, qs)}>
            {listing.rooms} otaqlı {kind}
          </Link>
        </h3>
        <p className="card-price">
          {money(listing.price)}
          <span>{perSqm(listing.pricePerSqm)}</span>
        </p>
        <p className="card-meta">
          <span className="card-place">
            <PinIcon size={14} />
            {place}
          </span>
        </p>
        <p className="card-specs">
          <span>
            <BedIcon size={15} />
            {listing.rooms}
          </span>
          <span>
            <AreaIcon size={15} />
            {listing.area} m²
          </span>
          {listing.floor !== null && listing.totalFloors !== null && (
            <span>
              <StairsIcon size={15} />
              {listing.floor}/{listing.totalFloors}
            </span>
          )}
          <span className="card-monthly" title={`${terms.downPct}% ilkin, ${terms.years} il, ${terms.ratePct}% illik`}>
            Aylıq ≈ {money(monthlyPayment(listing.price, terms))}
          </span>
        </p>
        {standing && <p className="card-ref">{standing}</p>}
        {(extras.bill || extras.repair || extras.mortgage || listing.priceConverted || !listing.marketKnown) && (
          <p className="card-tags">
            {extras.bill && <span>Kupçalı</span>}
            {extras.repair && <span>Təmirli</span>}
            {extras.mortgage && <span>İpoteka</span>}
            {listing.priceConverted && <span title="Elan dollarla verilib; 1 USD = 1.70 ₼">USD → AZN</span>}
            {!listing.marketKnown && <span title="Bu bölgə yalnız öz səhifəsi ilə müqayisə olunur">Bakıdan kənar</span>}
          </p>
        )}
      </div>
    </article>
  );
}
