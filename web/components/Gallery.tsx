"use client";

/* ============================================================
   Photos the way Airbnb lays them out: one large picture on the
   left, four on the right, "show all" in the corner. On a phone the
   grid becomes a strip the thumb swipes through.

   Any photo opens the viewer at that photo.
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Photo } from "@/lib/detail";
import { BuildingIcon, ChevronIcon, CloseIcon, GridIcon } from "./icons";

/** The grid shows the cover and four more; the rest wait in the viewer. */
const GRID = 5;
/** A horizontal drag longer than this turns the photo in the viewer. */
const SWIPE_PX = 40;

export function Gallery({ photos }: { photos: Photo[] }) {
  const [viewing, setViewing] = useState<number | null>(null);
  const [slide, setSlide] = useState(0);
  const count = photos.length;

  if (count === 0) {
    return (
      <div className="pgrid pgrid-empty">
        <BuildingIcon size={44} />
        <span>Bu elan üçün şəkil yoxdur</span>
      </div>
    );
  }

  const shown = photos.slice(0, GRID);

  return (
    <>
      <div className={`pgrid pgrid-${shown.length}`}>
        {shown.map((p, i) => {
          // The last tile carries the way into the rest of the photos.
          const last = count > 1 && i === shown.length - 1;
          return (
            <button
              key={p.full}
              type="button"
              className={`pgrid-tile${last ? " is-last" : ""}`}
              onClick={() => setViewing(last ? 0 : i)}
              aria-label={last ? `Bütün ${count} şəkilə bax` : `Şəkil ${i + 1}-i aç`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i === 0 ? p.full : p.medium} alt="" referrerPolicy="no-referrer" />
              {last && (
                <span className="pgrid-more">
                  <GridIcon size={20} />
                  <b>Bütün şəkillərə bax</b>
                  <small>{count} şəkil</small>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Phones: one photo at a time, swiped natively with scroll-snap. */}
      <div className="pstrip-wrap">
        <div
          className="pstrip"
          onScroll={(e) => {
            const el = e.currentTarget;
            setSlide(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {photos.map((p, i) => (
            <button key={p.full} type="button" onClick={() => setViewing(i)} aria-label={`Şəkil ${i + 1}-i aç`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.medium} alt="" loading={i === 0 ? "eager" : "lazy"} referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
        {count > 1 && (
          <span className="pstrip-count">
            {slide + 1} / {count}
          </span>
        )}
      </div>

      {viewing !== null && <Viewer photos={photos} start={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function Viewer({ photos, start, onClose }: { photos: Photo[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const count = photos.length;
  const step = useCallback((by: number) => setIndex((i) => (i + by + count) % count), [count]);
  const touchX = useRef<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  // The viewer takes the keyboard while it is open, and the page stops scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, step]);

  // Keep the current thumbnail in view as the photos turn.
  useEffect(() => {
    strip.current?.children[index]?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  return (
    <div className="lightbox" role="dialog" aria-modal aria-label="Şəkillər" onClick={onClose}>
      <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="lightbox-close" onClick={onClose} aria-label="Bağla">
          <CloseIcon size={20} />
        </button>
        <span>
          {index + 1} / {count}
        </span>
        <span />
      </div>
      <div
        className="lightbox-stage"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > SWIPE_PX && count > 1) step(dx < 0 ? 1 : -1);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photos[index].full} alt="" referrerPolicy="no-referrer" />
        {count > 1 && (
          <>
            <button type="button" className="lightbox-arrow is-prev" onClick={() => step(-1)} aria-label="Əvvəlki şəkil">
              <ChevronIcon size={22} style={{ transform: "rotate(180deg)" }} />
            </button>
            <button type="button" className="lightbox-arrow is-next" onClick={() => step(1)} aria-label="Növbəti şəkil">
              <ChevronIcon size={22} />
            </button>
          </>
        )}
      </div>
      <div className="lightbox-strip" ref={strip} onClick={(e) => e.stopPropagation()}>
        {photos.map((p, i) => (
          <button key={p.full} type="button" className={index === i ? "is-on" : ""} onClick={() => setIndex(i)} aria-label={`Şəkil ${i + 1}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />
          </button>
        ))}
      </div>
    </div>
  );
}
