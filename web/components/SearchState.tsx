"use client";

/* The filters, the search box and the results share one transition: while a
   new search renders on the server, the old results stay on screen, dimmed,
   instead of flashing back to a skeleton on every click. */

import { createContext, useCallback, useContext, useTransition, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseQuery, queryString, type Query } from "@/lib/query";

interface SearchState {
  pending: boolean;
  go: (query: Query) => void;
}

const Ctx = createContext<SearchState>({ pending: false, go: () => {} });

export function SearchProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = useCallback(
    (query: Query) => start(() => router.replace(`/search${queryString(query)}`, { scroll: false })),
    [router],
  );
  return <Ctx.Provider value={{ pending, go }}>{children}</Ctx.Provider>;
}

/** The current search and a way to change it. */
export function useSearch() {
  const params = useSearchParams();
  const { pending, go } = useContext(Ctx);
  const query = parseQuery(params);
  const update = useCallback((patch: Partial<Query>) => go({ ...parseQuery(params), ...patch }), [go, params]);
  return { query, pending, go, update };
}

export function PendingFrame({ children }: { children: ReactNode }) {
  const { pending } = useContext(Ctx);
  return (
    <div className={`results-frame${pending ? " is-pending" : ""}`} aria-busy={pending}>
      {children}
    </div>
  );
}
