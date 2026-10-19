"use client";

import { useState, type ReactNode } from "react";
import { fold } from "../../src/lib/geo";
import { DISTRICTS } from "../../src/lib/geography";
import {
  BUDGETS,
  DEFAULT_QUERY,
  MAX_PLACES,
  PLACE_KINDS,
  ROOMS,
  SIZES,
  placeLabel,
  type Category,
  type PlaceKind,
  type PlaceOption,
} from "@/lib/query";
import { useTerms } from "@/lib/store";
import { useSearch } from "./SearchState";
import { BuildingIcon, CloseIcon, FilterIcon, HouseIcon, KeyIcon, SearchIcon, SparkIcon } from "./icons";

const CATEGORIES: { id: Category; label: string; icon: typeof BuildingIcon }[] = [
  { id: "flat", label: "Bütün mənzillər", icon: BuildingIcon },
  { id: "new", label: "Yeni tikili", icon: SparkIcon },
  { id: "old", label: "Köhnə tikili", icon: KeyIcon },
  { id: "house", label: "Həyət evi", icon: HouseIcon },
];

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="fgroup">
      <h3 className="fgroup-title">
        {title}
        {hint && <small>{hint}</small>}
      </h3>
      {children}
    </section>
  );
}

function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className={`chip${on ? " is-on" : ""}`} aria-pressed={on} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function toggleIn(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value].sort();
}

/* Metro stations, settlements and microdistricts: too many for one row of
   chips, so they come in tabs with a box to type into. Typing looks across
   all three; what is chosen stays on top whichever tab is open. */
function PlacePicker({
  places,
  selected,
  onChange,
  disabled,
}: {
  places: PlaceOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
}) {
  const [kind, setKind] = useState<PlaceKind>("metro");
  const [text, setText] = useState("");
  const needle = fold(text.trim());
  const chosen = selected.flatMap((id) => places.find((p) => p.id === id) ?? []);
  const shown = needle
    ? places.filter((p) => fold(p.name).includes(needle))
    : places.filter((p) => p.kind === kind);
  const full = selected.length >= MAX_PLACES;
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : full ? selected : [...selected, id]);

  if (!places.length) return <p className="place-empty">Ərazi siyahısı hazırda yüklənmədi.</p>;

  return (
    <div className={`place-picker${disabled ? " is-disabled" : ""}`}>
      {chosen.length > 0 && (
        <div className="chips place-chosen">
          {chosen.map((p) => (
            <Chip key={p.id} on onClick={() => toggle(p.id)} disabled={disabled}>
              {placeLabel(p)} <CloseIcon size={12} />
            </Chip>
          ))}
        </div>
      )}
      <label className="place-search">
        <SearchIcon size={15} />
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Metro, qəsəbə, mikrorayon…"
          disabled={disabled}
          aria-label="Ərazi axtar"
        />
      </label>
      {!needle && (
        <div className="seg seg-3">
          {PLACE_KINDS.map((k) => (
            <Chip key={k.id} on={kind === k.id} onClick={() => setKind(k.id)} disabled={disabled}>
              {k.label}
            </Chip>
          ))}
        </div>
      )}
      <div className="chips place-list">
        {shown.map((p) => (
          <Chip key={p.id} on={selected.includes(p.id)} onClick={() => toggle(p.id)} disabled={disabled || (full && !selected.includes(p.id))}>
            {needle ? placeLabel(p) : p.name}
          </Chip>
        ))}
        {shown.length === 0 && <p className="place-empty">“{text.trim()}” tapılmadı.</p>}
      </div>
    </div>
  );
}

export function Filters({ places }: { places: PlaceOption[] }) {
  const { query, update, go } = useSearch();
  const { terms, setTerms } = useTerms();
  const [open, setOpen] = useState(false);
  const kub = query.source === "kub";

  const active =
    query.rooms.length + query.districts.length + query.places.length +
    [query.budget, query.size, query.bill, query.repair, query.mortgage, query.best, query.category !== "flat"].filter(Boolean).length;

  return (
    <>
      <button type="button" className="filters-open" onClick={() => setOpen(true)}>
        <FilterIcon size={17} /> Filtrlər {active > 0 && <em>{active}</em>}
      </button>

      <aside className={`filters${open ? " is-open" : ""}`} aria-label="Filtrlər">
        <header className="filters-head">
          <h2>Filtrlər</h2>
          <span className="filters-powered">HomeFinder sıralaması</span>
          <button type="button" className="filters-close" onClick={() => setOpen(false)} aria-label="Bağla">
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="filters-scroll">
          <Group title="Yalnız ən sərfəlilər" hint="hər ərazidə m²-i ən ucuz">
            <button
              type="button"
              role="switch"
              aria-checked={query.best}
              className={`switch${query.best ? " is-on" : ""}`}
              onClick={() => update({ best: !query.best })}
            >
              <span />
            </button>
          </Group>

          <Group title="Mənbə">
            <div className="seg">
              <Chip on={!kub} onClick={() => update({ source: "bina" })}>bina.az</Chip>
              <Chip on={kub} onClick={() => update({ source: "kub" })}>kub.az</Chip>
            </div>
          </Group>

          <Group title="Əmlak növü">
            <div className="tiles">
              {CATEGORIES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`tile${query.category === id ? " is-on" : ""}`}
                  aria-pressed={query.category === id}
                  onClick={() => update({ category: id })}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </Group>

          <Group title="Ərazi" hint={kub ? "yalnız bina.az" : "metro, qəsəbə, mikrorayon"}>
            <PlacePicker places={places} selected={query.places} onChange={(ids) => update({ places: ids })} disabled={kub} />
          </Group>

          <Group title="Rayon">
            <div className="chips">
              {DISTRICTS.map((d) => (
                <Chip key={d.id} on={query.districts.includes(d.id)} onClick={() => update({ districts: toggleIn(query.districts, d.id) })}>
                  {d.name}
                </Chip>
              ))}
            </div>
          </Group>

          <Group title="Otaq sayı">
            <div className="chips chips-5">
              {ROOMS.map((r) => (
                <Chip key={r} on={query.rooms.includes(r)} onClick={() => update({ rooms: toggleIn(query.rooms, r) })}>
                  {r}
                </Chip>
              ))}
            </div>
          </Group>

          <Group title="Büdcə" hint="₼">
            <div className="chips">
              {BUDGETS.map((b) => (
                <Chip key={b.id} on={query.budget === b.id} onClick={() => update({ budget: query.budget === b.id ? null : b.id })}>
                  {b.label}
                </Chip>
              ))}
            </div>
          </Group>

          <Group title="Sahə">
            <div className="chips">
              {SIZES.map((s) => (
                <Chip key={s.id} on={query.size === s.id} onClick={() => update({ size: query.size === s.id ? null : s.id })}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </Group>

          <Group title="Sənəd və vəziyyət" hint={kub ? "yalnız bina.az" : undefined}>
            <div className="chips">
              <Chip disabled={kub} on={query.bill} onClick={() => update({ bill: !query.bill })}>Kupçalı</Chip>
              <Chip disabled={kub} on={query.repair} onClick={() => update({ repair: !query.repair })}>Təmirli</Chip>
              <Chip disabled={kub} on={query.mortgage} onClick={() => update({ mortgage: !query.mortgage })}>İpotekaya uyğun</Chip>
            </div>
          </Group>

          <Group title="İpoteka şərtləriniz" hint="brauzerinizdə qalır">
            <div className="terms">
              <label>
                <span>İlkin ödəniş</span>
                <input type="number" min={0} max={90} step={5} value={terms.downPct} onChange={(e) => setTerms({ downPct: e.target.valueAsNumber })} />
                <i>%</i>
              </label>
              <label>
                <span>Müddət</span>
                <input type="number" min={1} max={30} value={terms.years} onChange={(e) => setTerms({ years: e.target.valueAsNumber })} />
                <i>il</i>
              </label>
              <label>
                <span>Faiz</span>
                <input type="number" min={0} max={30} step={0.5} value={terms.ratePct} onChange={(e) => setTerms({ ratePct: e.target.valueAsNumber })} />
                <i>%</i>
              </label>
            </div>
          </Group>
        </div>

        <footer className="filters-foot">
          <button type="button" className="btn-ghost" onClick={() => go({ ...DEFAULT_QUERY, source: query.source, sort: query.sort })}>
            Filtrləri təmizlə
          </button>
          <button type="button" className="btn-solid filters-done" onClick={() => setOpen(false)}>
            Nəticələrə bax
          </button>
        </footer>
      </aside>
      {open && <div className="filters-scrim" onClick={() => setOpen(false)} aria-hidden />}
    </>
  );
}
