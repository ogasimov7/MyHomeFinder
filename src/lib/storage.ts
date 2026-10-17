/* Everything the app remembers lives on this device: the searches already
   run and the last ranking. No server, no database, no account — the same
   promise the browser extension makes. */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RankingResult } from "./ranking";

const KEYS = {
  history: "hf.history.v1",
  results: "hf.results.v1",
};

/** A search the user has run before, newest first, kept so it can be rerun. */
export interface SearchEntry {
  id: string;
  url: string;
  /** when it was last run */
  at: string;
}

/** Enough to recognise a search, few enough to stay a list rather than a log. */
export const HISTORY_LIMIT = 20;

async function read<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable: the session keeps working in memory */
  }
}

export const loadHistory = async () => (await read<SearchEntry[]>(KEYS.history)) ?? [];
export const saveHistory = (items: SearchEntry[]) => write(KEYS.history, items);

/* The same search run twice is one entry, moved back to the top. */
export function remember(history: SearchEntry[], url: string, now = new Date()): SearchEntry[] {
  const entry: SearchEntry = { id: String(now.getTime()), url, at: now.toISOString() };
  const rest = history.filter((item) => item.url !== url);
  return [entry, ...rest].slice(0, HISTORY_LIMIT);
}

export const loadResults = () => read<RankingResult>(KEYS.results);
export const saveResults = (result: RankingResult) => write(KEYS.results, result);
