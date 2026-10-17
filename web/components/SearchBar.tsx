"use client";

import { useEffect, useRef, useState } from "react";
import { SORTS, type Sort } from "@/lib/query";
import { useSearch } from "./SearchState";
import { SearchIcon } from "./icons";

/** Typing settles before the address changes, so each keystroke is not a render. */
const SETTLE_MS = 350;

export function SearchBox() {
  const { query, update } = useSearch();
  const [text, setText] = useState(query.q);
  const sent = useRef(query.q);

  // Follow the address only when it changes from elsewhere (back button, a
  // reset) — not when it catches up with what was typed, which by then may
  // already be a few letters longer.
  useEffect(() => {
    if (query.q !== sent.current) {
      sent.current = query.q;
      setText(query.q);
    }
  }, [query.q]);

  useEffect(() => {
    const next = text.trim();
    if (next === sent.current) return;
    const t = setTimeout(() => {
      sent.current = next;
      update({ q: next });
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [text, update]);

  return (
    <label className="searchbox">
      <SearchIcon size={18} />
      <input
        type="search"
        placeholder="Ərazi və ya rayon: Gənclik, Yasamal…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Ərazi və ya rayon üzrə axtar"
      />
    </label>
  );
}

export function SortSelect() {
  const { query, update } = useSearch();
  return (
    <label className="sort">
      <span>Sırala:</span>
      <select value={query.sort} onChange={(e) => update({ sort: e.target.value as Sort })}>
        {SORTS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
