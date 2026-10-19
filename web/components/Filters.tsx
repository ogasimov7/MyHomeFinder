"use client";

import { useState, type ReactNode } from "react";
import { DISTRICTS } from "../../src/lib/geography";
import {
  BUDGETS,
  DEFAULT_QUERY,
  MAX_PLACES,
  PLACE_KINDS,
  ROOMS,
  SIZES,
  type Category,
  type PlaceOption,
} from "@/lib/query";
import { useTerms } from "@/lib/store";
import { useSearch } from "./SearchState";
import { BuildingIcon, CheckIcon, CloseIcon, FilterIcon, HouseIcon, KeyIcon, SparkIcon } from "./icons";

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

/* The districts, and inside each one chosen, the places it can be narrowed
   to — its metro stations, settlements and microdistricts — set in below it
   as a smaller, lighter level. None chosen means the whole district. */
function DistrictPicker({
  places,
  districts,
  chosen,
  finer,
  onChange,
}: {
  places: PlaceOption[];
  districts: string[];
  chosen: string[];
  /** whether the source can be asked for places at all */
  finer: boolean;
  onChange: (patch: { districts: string[]; places: string[] }) => void;
}) {
  const inDistrict = (d: string) => places.filter((p) => p.districts.includes(d));

  const toggleDistrict = (d: string) => {
    if (!districts.includes(d)) return onChange({ districts: [...districts, d].sort(), places: chosen });
    const rest = districts.filter((x) => x !== d);
    // A place leaves with its district, unless another chosen district holds it too.
    const keep = chosen.filter((id) => places.find((p) => p.id === id)?.districts.some((x) => rest.includes(x)));
    onChange({ districts: rest, places: keep });
  };
  const togglePlace = (id: string) =>
    onChange({
      districts,
      places: chosen.includes(id) ? chosen.filter((x) => x !== id) : chosen.length >= MAX_PLACES ? chosen : [...chosen, id],
    });
  const wholeDistrict = (d: string) => {
    const mine = new Set(inDistrict(d).map((p) => p.id));
    onChange({ districts, places: chosen.filter((id) => !mine.has(id)) });
  };

  return (
    <>
      <div className="chips">
        {DISTRICTS.map((d) => (
          <Chip key={d.id} on={districts.includes(d.id)} onClick={() => toggleDistrict(d.id)}>
            {d.name}
          </Chip>
        ))}
      </div>

      {finer &&
        DISTRICTS.filter((d) => districts.includes(d.id)).map((d) => {
          const own = inDistrict(d.id);
          if (!own.length) return null;
          const picked = own.filter((p) => chosen.includes(p.id)).length;
          return (
            <section key={d.id} className="subplaces" aria-label={`${d.name} rayonu üzrə`}>
              <header className="subplaces-head">
                <span>
                  {d.name} <small>rayonu</small>
                </span>
                <button
                  type="button"
                  className={`subchip is-all${picked === 0 ? " is-on" : ""}`}
                  aria-pressed={picked === 0}
                  onClick={() => wholeDistrict(d.id)}
                >
                  Bütün rayon
                </button>
              </header>
              {PLACE_KINDS.map((k) => {
                const items = own.filter((p) => p.kind === k.id);
                if (!items.length) return null;
                return (
                  <div key={k.id} className="subplaces-group">
                    <span className="subplaces-label">{k.label}</span>
                    <div className="subchips">
                      {items.map((p) => {
                        const on = chosen.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`subchip${on ? " is-on" : ""}`}
                            aria-pressed={on}
                            onClick={() => togglePlace(p.id)}
                          >
                            {on && <CheckIcon size={12} />}
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
    </>
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

          <Group title="Rayon" hint={kub ? undefined : "seçin, alt ərazilər açılır"}>
            <DistrictPicker
              places={places}
              districts={query.districts}
              chosen={query.places}
              finer={!kub}
              onChange={(patch) => update(patch)}
            />
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
