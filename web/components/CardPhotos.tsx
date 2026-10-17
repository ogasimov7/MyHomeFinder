"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BuildingIcon, ChevronIcon } from "./icons";

/** How long a card must stay in view before its photos are asked for. */
const DWELL_MS = 250;
/** Dots shown at once; longer albums slide the window along. */
const DOTS = 5;

/* A card's photos, flicked through in place: swiped on a phone, arrows on
   hover with a mouse. The search only carries one photo per listing, so the
   rest are fetched when the card has been in view for a moment — or at once
   when a pointer reaches it. */
export function CardPhotos({
  first,
  source,
  id,
  href,
  children,
}: {
  first: string | null;
  source: string;
  id: string;
  href: string;
  /** badges and labels laid over the photos */
  children?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLAnchorElement>(null);
  const asked = useRef(false);
  const [photos, setPhotos] = useState<string[]>(first ? [first] : []);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);

  const load = useCallback(async () => {
    if (asked.current) return;
    asked.current = true;
    try {
      const res = await fetch(`/api/photos/${source}/${id}`);
      if (!res.ok) throw new Error(String(res.status));
      const { photos: more } = (await res.json()) as { photos: string[] };
      // The card's own photo stays first, at the size already on screen.
      setPhotos((now) => (now.length ? [now[0], ...more.slice(1)] : more));
    } catch {
      /* the card keeps its one photo */
    } finally {
      setLoaded(true);
    }
  }, [source, id]);

  useEffect(() => {
    const el = box.current;
    if (!el || !first) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const seen = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        if (entry.isIntersecting) timer = setTimeout(load, DWELL_MS);
      },
      { threshold: 0.6 },
    );
    seen.observe(el);
    return () => {
      clearTimeout(timer);
      seen.disconnect();
    };
  }, [first, load]);

  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  // A press before the album has arrived is kept and carried out once it has.
  const pending = useRef(0);
  const go = (step: number) => {
    const el = track.current;
    if (!el) return;
    if (photos.length <= 1 && !loaded) {
      pending.current = step;
      void load();
      return;
    }
    el.scrollTo({ left: Math.max(0, index + step) * el.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    const el = track.current;
    if (!el || !pending.current || photos.length <= 1) return;
    el.scrollTo({ left: pending.current * el.clientWidth, behavior: "smooth" });
    pending.current = 0;
  }, [photos]);

  const drop = (src: string) => setPhotos((now) => now.filter((p) => p !== src));

  const many = photos.length > 1;
  const start = Math.min(Math.max(0, index - 2), Math.max(0, photos.length - DOTS));

  return (
    <div className="card-media" ref={box} onPointerEnter={(e) => e.pointerType === "mouse" && load()}>
      <Link className="card-track" href={href} ref={track} onScroll={onScroll} tabIndex={-1} aria-hidden>
        {photos.length ? (
          photos.map((src, i) => (
            // Remote listing photos are shown as the sites serve them; routing
            // them through the image optimiser would re-host other people's photos.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              loading={i === 0 ? "lazy" : i <= index + 1 ? "eager" : "lazy"}
              draggable={false}
              referrerPolicy="no-referrer"
              onError={() => drop(src)}
            />
          ))
        ) : (
          <div className="card-ph">
            <BuildingIcon size={34} />
          </div>
        )}
      </Link>

      {children}

      {(many || (!loaded && first)) && (
        <>
          {index > 0 && (
            <button type="button" className="card-arrow is-prev" onClick={() => go(-1)} aria-label="Əvvəlki şəkil">
              <ChevronIcon size={16} />
            </button>
          )}
          {(!loaded || index < photos.length - 1) && (
            <button type="button" className="card-arrow is-next" onClick={() => go(1)} aria-label="Növbəti şəkil">
              <ChevronIcon size={16} />
            </button>
          )}
        </>
      )}

      {many && (
        <div className="card-dots" aria-hidden>
          {photos.slice(start, start + DOTS).map((src, i) => (
            <i key={src} className={start + i === index ? "is-on" : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
