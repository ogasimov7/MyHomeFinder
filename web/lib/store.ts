"use client";

/* ============================================================
   The viewer's own things — saved listings and mortgage terms —
   kept in their browser. Nothing here reaches the server.

   Storage can be missing or refuse (private windows, blocked site
   data); every read and write is guarded and the page works without.
   ============================================================ */

import { useCallback, useSyncExternalStore } from "react";
import type { MarketRow } from "./market";
import { DEFAULT_TERMS, cleanTerms, type Terms } from "./mortgage";

export type Saved = MarketRow & { savedAt: string };

const KEYS = { saved: "hf.saved.v1", terms: "hf.terms.v1" };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* kept for this visit only */
  }
}

/* One tiny store per key: a cached snapshot (useSyncExternalStore wants the
   same object back until something changed), listeners, and the storage
   event so a second tab follows along. */
function createStore<T>(key: string, fallback: T, clean: (v: T) => T = (v) => v) {
  let snapshot: T | null = null;
  const listeners = new Set<() => void>();

  const get = () => (snapshot ??= clean(read(key, fallback)));
  const set = (next: T) => {
    snapshot = next;
    write(key, next);
    listeners.forEach((l) => l());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      snapshot = null;
      listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };
  return { get, set, subscribe, server: () => fallback };
}

const EMPTY: Saved[] = [];
const savedStore = createStore<Saved[]>(KEYS.saved, EMPTY, (v) => (Array.isArray(v) ? v : EMPTY));
const termsStore = createStore<Terms>(KEYS.terms, DEFAULT_TERMS, cleanTerms);

export const rowKey = (row: Pick<MarketRow, "source" | "listing">) => `${row.source}:${row.listing.id}`;

export function useSaved() {
  const saved = useSyncExternalStore(savedStore.subscribe, savedStore.get, savedStore.server);
  const toggle = useCallback((row: MarketRow) => {
    const current = savedStore.get();
    const key = rowKey(row);
    savedStore.set(
      current.some((s) => rowKey(s) === key)
        ? current.filter((s) => rowKey(s) !== key)
        : [{ ...row, savedAt: new Date().toISOString() }, ...current],
    );
  }, []);
  const clear = useCallback(() => savedStore.set(EMPTY), []);
  return { saved, toggle, clear };
}

export function useTerms() {
  const terms = useSyncExternalStore(termsStore.subscribe, termsStore.get, termsStore.server);
  const setTerms = useCallback((patch: Partial<Terms>) => termsStore.set(cleanTerms({ ...termsStore.get(), ...patch })), []);
  return { terms, setTerms };
}
