"use client";

import Link from "next/link";
import { useSaved } from "@/lib/store";
import { ListingCard } from "./ListingCard";
import { HeartIcon } from "./icons";

export function SavedList() {
  const { saved, clear } = useSaved();

  if (saved.length === 0) {
    return (
      <div className="empty">
        <HeartIcon size={28} />
        <h2>Hələ seçilmiş elan yoxdur</h2>
        <p>Kartdakı ürək işarəsinə basın — elan burada, bu brauzerdə saxlanacaq.</p>
        <Link href="/search" className="btn-solid">
          Elanlara bax
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="results-head">
        <div>
          <p className="results-count">
            <b>{saved.length}</b> seçilmiş elan
          </p>
          <p className="results-coverage">
            Qiymətlər saxladığınız andakıdır; saytda dəyişmiş ola bilər. Müqayisə üçün elanı açın.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={clear}>
          Hamısını sil
        </button>
      </div>
      <div className="grid">
        {saved.map((row) => (
          <ListingCard key={`${row.source}:${row.listing.id}`} row={row} />
        ))}
      </div>
    </>
  );
}
