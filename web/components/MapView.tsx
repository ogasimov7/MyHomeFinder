"use client";

/* ============================================================
   The map: opens on where the viewer stands, at street level, and
   shows what is for sale around them.

   The position is asked of the browser and stays in it — only the
   edges of the view go to the server, the same as for anyone who
   pans the map there by hand.
   ============================================================ */

import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { money, perSqm } from "../../src/lib/format";
import type { ClusterItem, ClusterPage, Marker, Preview } from "@/lib/map";
import { valueLabel, type Value } from "@/lib/value";
import type { Category } from "@/lib/query";
import { ArrowIcon, BuildingIcon, CloseIcon, PinIcon, StarIcon } from "./icons";

/** Baku's centre, for when the viewer's own position is not available. */
const BAKU: [number, number] = [40.4093, 49.8671];
const CITY_ZOOM = 13;
/** As close as the map goes: the viewer's own street. */
const FULL_ZOOM = 19;
/** Past this bina.az no longer splits markers; a cluster is one building. */
const BUILDING_ZOOM = 18;
/** The listings panel on the right, and the room a cluster needs beside it. */
const PANEL_WIDTH = 400;
const SETTLE_MS = 250;

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "flat", label: "Bütün mənzillər" },
  { id: "new", label: "Yeni tikili" },
  { id: "old", label: "Köhnə tikili" },
  { id: "house", label: "Həyət evi" },
];

type Status = "locating" | "asking" | "located" | "denied" | "unavailable" | "slow";

type ClusterSelection = {
  kind: "cluster";
  id: string;
  count: number;
  /** whether the cluster is a single building rather than a neighbourhood */
  building: boolean;
  items: ClusterItem[] | null;
  total: number | null;
  /** false when the circle held more than could be read and compared */
  complete: boolean;
  failed: boolean;
  /** how many of the circle's listings were read and compared */
  read: number | null;
  average: ClusterPage["average"];
};

type Selection = { kind: "item"; id: string; item: Preview | null } | ClusterSelection;

/** 50405 → "50 405" */
const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** "185K ₼", "1.2M ₼": short enough to sit on a pin. */
function short(price: number): string {
  if (price >= 1_000_000) return `${(price / 1_000_000).toFixed(price >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M ₼`;
  if (price >= 1000) return `${Math.round(price / 1000)}K ₼`;
  return `${price} ₼`;
}

function boundsQuery(map: Leaflet.Map, category: Category): string {
  const b = map.getBounds();
  return new URLSearchParams({
    n: String(b.getNorth()),
    s: String(b.getSouth()),
    e: String(b.getEast()),
    w: String(b.getWest()),
    category,
  }).toString();
}

export function MapView() {
  const box = useRef<HTMLDivElement>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const pins = useRef<Leaflet.LayerGroup | null>(null);
  const me = useRef<Leaflet.LayerGroup | null>(null);
  const pinById = useRef(new Map<string, HTMLElement>());
  const selectedId = useRef<string | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const [category, setCategory] = useState<Category>("flat");
  const categoryRef = useRef(category);
  const [status, setStatus] = useState<Status>("locating");
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);

  /* ---- selection ---- */

  const openItem = useCallback(async (id: string) => {
    setSelection({ kind: "item", id, item: null });
    try {
      const res = await fetch(`/api/map/item/${id}`);
      const data = (await res.json()) as { item?: Preview };
      setSelection((s) => (s?.kind === "item" && s.id === id ? { ...s, item: data.item ?? null } : s));
    } catch {
      setSelection(null);
    }
  }, []);

  /* A cluster opens as a list on the right, best value first; the map moves
     aside if the cluster would end up underneath it. */
  const openCluster = useCallback(async (marker: Extract<Marker, { kind: "cluster" }>) => {
    const m = map.current;
    if (!m) return;
    const query = `id=${encodeURIComponent(marker.id)}&${boundsQuery(m, categoryRef.current)}`;
    setSelection({
      kind: "cluster",
      id: marker.id,
      count: marker.count,
      building: m.getZoom() >= BUILDING_ZOOM,
      items: null,
      total: null,
      complete: true,
      failed: false,
      read: null,
      average: null,
    });
    const point = m.latLngToContainerPoint([marker.lat, marker.lng]);
    const size = m.getSize();
    if (window.matchMedia("(max-width: 744px)").matches) {
      // On a phone the list rises from below: keep the cluster in the top third.
      if (point.y > size.y * 0.3) m.panBy([0, point.y - size.y * 0.22]);
    } else if (point.x > size.x - PANEL_WIDTH - 60) {
      m.panBy([point.x - (size.x - PANEL_WIDTH) / 2, 0]);
    }
    const update = (patch: Partial<ClusterSelection>) =>
      setSelection((s) => (s?.kind === "cluster" && s.id === marker.id ? { ...s, ...patch } : s));
    try {
      const res = await fetch(`/api/map/cluster?${query}`);
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as ClusterPage;
      update({ items: page.items, total: page.total, read: page.read, complete: page.complete, average: page.average });
    } catch {
      update({ items: [], failed: true });
    }
  }, []);

  /* ---- markers ---- */

  const load = useCallback(async () => {
    const m = map.current;
    const lib = L.current;
    if (!m || !lib || !pins.current) return;
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    setLoading(true);
    try {
      const res = await fetch(`/api/map/markers?${boundsQuery(m, categoryRef.current)}&z=${Math.round(m.getZoom())}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(String(res.status));
      const { markers } = (await res.json()) as { markers: Marker[] };
      pins.current.clearLayers();
      pinById.current.clear();
      // bina.az answers by whole tiles, wider than the view; only what can be
      // seen is counted.
      const view = m.getBounds();
      let total = 0;
      for (const marker of markers) {
        const seen = view.contains([marker.lat, marker.lng]);
        if (marker.kind === "item") {
          if (seen) total += 1;
          const pin = lib.marker([marker.lat, marker.lng], {
            icon: lib.divIcon({ className: "map-pin", html: `<span>${short(marker.price)}</span>`, iconSize: [0, 0] }),
            keyboard: true,
            title: money(marker.price),
          });
          pin.on("click", () => openItem(marker.id));
          pin.on("add", () => {
            const el = pin.getElement();
            if (!el) return;
            pinById.current.set(marker.id, el);
            el.classList.toggle("is-selected", selectedId.current === marker.id);
          });
          pins.current.addLayer(pin);
        } else {
          if (seen) total += marker.count;
          const size = marker.count >= 100 ? "lg" : marker.count >= 10 ? "md" : "sm";
          const pin = lib.marker([marker.lat, marker.lng], {
            icon: lib.divIcon({ className: `map-cluster is-${size}`, html: `<span>${marker.count}</span>`, iconSize: [0, 0] }),
            keyboard: true,
            title: `${marker.count} elan`,
          });
          pin.on("click", () => openCluster(marker));
          pin.on("add", () => {
            const el = pin.getElement();
            if (!el) return;
            pinById.current.set(marker.id, el);
            el.classList.toggle("is-selected", selectedId.current === marker.id);
          });
          pins.current.addLayer(pin);
        }
      }
      setCount(total);
      setFailed(false);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setFailed(true);
    } finally {
      if (inflight.current === ctrl) setLoading(false);
    }
  }, [openItem, openCluster]);

  /* ---- the viewer's position ---- */

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    const ask = (patient: boolean) =>
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const m = map.current;
          const lib = L.current;
          if (!m || !lib || !me.current) return;
          const here: [number, number] = [coords.latitude, coords.longitude];
          me.current.clearLayers();
          me.current.addLayer(lib.circle(here, { radius: coords.accuracy, className: "map-accuracy", interactive: false }));
          me.current.addLayer(
            lib.marker(here, { icon: lib.divIcon({ className: "map-me", html: "<span></span>", iconSize: [0, 0] }), interactive: false }),
          );
          // The window may have changed size while the browser was asking.
          m.invalidateSize();
          m.setView(here, FULL_ZOOM);
          setStatus("located");
        },
        (err) =>
          setStatus(err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "slow" : "unavailable"),
        // While the browser is still asking, the clock must not run: the
        // viewer may take a while to answer, and that is not a failure.
        { enableHighAccuracy: true, maximumAge: 60_000, ...(patient ? {} : { timeout: 15_000 }) },
      );

    setStatus("locating");
    if (!navigator.permissions) {
      ask(true);
      return;
    }
    navigator.permissions
      .query({ name: "geolocation" })
      .then((permission) => {
        if (permission.state === "prompt") setStatus("asking");
        ask(permission.state === "prompt");
      })
      .catch(() => ask(true));
  }, []);

  /* ---- the map itself ---- */

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Leaflet measures its box once; a resized window must be measured again
    // or the centre — the viewer's own position — drifts off screen.
    const resize = new ResizeObserver(() => map.current?.invalidateSize());
    (async () => {
      // Leaflet is CommonJS: bundled for the browser it arrives as the default export.
      const mod = await import("leaflet");
      const lib = (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
      if (cancelled || !box.current) return;
      L.current = lib;
      const m = lib.map(box.current, {
        center: BAKU,
        zoom: CITY_ZOOM,
        minZoom: 10,
        maxZoom: FULL_ZOOM,
        zoomControl: false,
        maxBounds: lib.latLngBounds([40.15, 49.3], [40.8, 50.5]),
      });
      // OpenStreetMap's own tiles need no key and go to street level; they are
      // meant for modest traffic — a busy site should move to a keyed provider.
      lib
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: FULL_ZOOM,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · elanlar: bina.az',
        })
        .addTo(m);
      lib.control.zoom({ position: "bottomright", zoomInTitle: "Yaxınlaşdır", zoomOutTitle: "Uzaqlaşdır" }).addTo(m);
      pins.current = lib.layerGroup().addTo(m);
      me.current = lib.layerGroup().addTo(m);
      map.current = m;
      resize.observe(box.current);
      m.on("moveend", () => {
        clearTimeout(timer);
        timer = setTimeout(load, SETTLE_MS);
      });
      m.on("click", () => setSelection(null));
      load();
      locate();
    })();
    return () => {
      cancelled = true;
      resize.disconnect();
      clearTimeout(timer);
      inflight.current?.abort();
      map.current?.remove();
      map.current = null;
    };
  }, [load, locate]);

  // A new property type redraws the pins for the same view.
  useEffect(() => {
    if (categoryRef.current === category) return;
    categoryRef.current = category;
    setSelection(null);
    load();
  }, [category, load]);

  // The open pin stands out from its neighbours, also once the pins reload.
  useEffect(() => {
    selectedId.current = selection?.id ?? null;
    pinById.current.forEach((el, id) => el.classList.toggle("is-selected", selection?.id === id));
  }, [selection]);

  // Escape closes whatever is open.
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelection(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection]);

  return (
    <div className={`mapwrap${selection?.kind === "cluster" ? " has-panel" : ""}`}>
      <div ref={box} className="map-canvas" />

      <div className="map-top">
        <div className="map-chips" role="group" aria-label="Əmlak növü">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={`chip${category === c.id ? " is-on" : ""}`} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <span className={`map-count${loading ? " is-loading" : ""}`}>
          {failed ? "bina.az cavab vermir" : count === null ? "Elanlar yüklənir…" : `Bu ərazidə ${grouped(count)} elan`}
        </span>
      </div>

      <button type="button" className="map-locate" onClick={locate} aria-label="Mənim yerim" title="Mənim yerim">
        <PinIcon size={18} />
        <span>Mənim yerim</span>
      </button>

      {status !== "located" && (
        <p className={`map-status is-${status}`} role="status">
          {status === "locating" && "Yeriniz müəyyən edilir…"}
          {status === "asking" && "Yaxınlığınızı göstərmək üçün brauzerin soruşduğu pəncərədə “İcazə ver” seçin."}
          {status === "denied" && "Yer icazəsi verilmədi — Bakının mərkəzi göstərilir. Ünvan sətrindəki kilid işarəsindən icazə verin."}
          {status === "unavailable" &&
            "Cihaz yerinizi tapa bilmədi — Bakının mərkəzi göstərilir. Kompüterdə məkan xidmətlərinin brauzer üçün açıq olduğunu yoxlayın."}
          {status === "slow" && "Yerinizi tapmaq çox çəkdi — “Mənim yerim” ilə yenidən cəhd edin."}
        </p>
      )}

      {selection?.kind === "item" && <ItemCard selection={selection} onClose={() => setSelection(null)} />}
      {selection?.kind === "cluster" && <ClusterPanel selection={selection} onClose={() => setSelection(null)} />}
    </div>
  );
}

function ItemCard({ selection, onClose }: { selection: Extract<Selection, { kind: "item" }>; onClose: () => void }) {
  return (
    <aside className="map-card" aria-live="polite">
      <button type="button" className="map-card-close" onClick={onClose} aria-label="Bağla">
        <CloseIcon size={16} />
      </button>
      {selection.item ? <PreviewRow item={selection.item} /> : <div className="map-card-loading sk" />}
    </aside>
  );
}

function ClusterPanel({ selection, onClose }: { selection: ClusterSelection; onClose: () => void }) {
  const { items, total, complete, failed, building, count, read, average } = selection;
  return (
    <aside className="map-panel" aria-label="Seçilmiş nöqtədəki elanlar">
      <header className="map-panel-head">
        <div>
          <h2>{grouped(total ?? count)} elan</h2>
          <p>{building ? "Bu binada satışda olanlar" : "Seçdiyiniz dairədəki elanlar"} · m²-ə görə ən sərfəli yuxarıda</p>
          {average && (
            <p className="avg-stat">
              Orta m² qiyməti <b>{perSqm(average.perSqm)}</b>
              <small>· {grouped(average.count)} elan</small>
            </p>
          )}
        </div>
        <button type="button" className="map-card-close" onClick={onClose} aria-label="Bağla">
          <CloseIcon size={16} />
        </button>
      </header>
      <div className="map-panel-list">
        {!complete && items && (
          <p className="map-panel-warn">
            Bu dairədə {grouped(total ?? count)} elan var — orta və müqayisə onların {grouped(read ?? items.length)}-i üzrədir.
            Dəqiq nəticə üçün xəritəni yaxınlaşdırın.
          </p>
        )}
        {complete && items && total !== null && total > items.length && (
          <p className="map-panel-note is-top">
            Dairədəki {grouped(total)} elandan m²-i ən sərfəli {items.length}-i göstərilir.
          </p>
        )}
        {items === null
          ? Array.from({ length: 5 }, (_, i) => <div key={i} className="map-panel-sk sk" />)
          : items.map((item) => <PreviewRow key={item.id} item={item} value={item.value} compact />)}
        {items !== null && items.length === 0 && !failed && <p className="map-panel-note">Bu nöqtədə elan tapılmadı.</p>}
        {failed && <p className="map-panel-note">bina.az cavab vermədi. Bir az sonra yenidən cəhd edin.</p>}
      </div>
    </aside>
  );
}

function PreviewRow({ item, value, compact = false }: { item: Preview; value?: Value; compact?: boolean }) {
  const badge = value ? valueLabel(value) : null;
  const specs = [
    item.rooms ? `${item.rooms} otaq` : null,
    item.area ? `${item.area} m²` : null,
    item.floor && item.floors ? `${item.floor}/${item.floors} mərtəbə` : null,
  ].filter(Boolean);
  return (
    <Link href={`/listing/bina/${item.id}`} className={`map-preview${compact ? " is-compact" : ""}`}>
      <span className="map-preview-photo">
        {item.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photo} alt="" referrerPolicy="no-referrer" />
        ) : (
          <BuildingIcon size={24} />
        )}
      </span>
      <span className="map-preview-text">
        {badge && (
          <span className={`map-badge is-${badge.tone}`}>
            {badge.tone === "best" && <StarIcon size={11} />}
            {badge.label}
          </span>
        )}
        <b>{item.currency === "AZN" ? money(item.price) : `${item.price.toLocaleString("az")} ${item.currency}`}</b>
        <span>{specs.join(" · ")}</span>
        {item.place && <span className="map-preview-place">{item.place}</span>}
        {!compact && (
          <span className="map-preview-go">
            Elana bax <ArrowIcon size={14} />
          </span>
        )}
      </span>
    </Link>
  );
}
