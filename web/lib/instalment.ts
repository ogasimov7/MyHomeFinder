/* ============================================================
   A down payment posing as the price.

   Some sellers put the first instalment — or the monthly one — in
   the price box, and the flat then looks far cheaper per m² than
   anything around it: the "best value" of its place. Such a listing
   is found in two steps. It is a suspect when its price per m² is
   well below its place's typical one; it is set aside when its
   description says the price is an instalment, or when the price
   is too low to be a price at all. Cheap but honest listings — and
   there are many: whole floors, unfinished shells, the outskirts —
   say nothing of the kind and stay.
   ============================================================ */

import "server-only";
import { cacheLife } from "next/cache";
import { fold } from "../../src/lib/geo";
import { TIMEOUT_MS, USER_AGENT } from "./http";

/** Below this share of its place's typical price per m², a listing is a suspect. */
export const SUSPECT_RATIO = 0.6;
/** Below this, no description is needed: no flat of ordinary size sells for a
    third of its street. Large ones do — penthouses and duplexes with terraces
    count every square metre and come out cheap per m² — so the price alone
    sets aside only a flat up to ORDINARY_AREA. */
export const IMPLAUSIBLE_RATIO = 0.35;
export const ORDINARY_AREA = 200;

/** Too low to be a full price whatever the description says. */
export function implausible(ratio: number, area: number | null | undefined): boolean {
  return ratio < IMPLAUSIBLE_RATIO && area != null && area > 0 && area <= ORDINARY_AREA;
}

/* What a description says when the price is an instalment, read on the
   folded text ("İlkin ödəniş" → "ilkin odenis"). "İpotekaya uyğundur" is not
   among them: honest listings say it too. Nor is a bare "kredit", which also
   comes as "kredit yoxdur". */
const SAYS_AZ = [
  /\bilkin (odenis|odenisi|mebleg|meblegi|haqq|pul)/,
  /\bilkin \d/,
  /\d+ ?(azn|manat|faiz)? ?ilkin (ile|le)\b/,
  /\bayliq ode/,
  /\bayda \d+ ?(azn|manat)/,
  /\bhisse hisse\b/,
  /\bdaxili kredit/,
  /\bkredit ?(le|ile)\b/,
  /\bfaizsiz (kredit|ipoteka|odenis)/,
  /\b(qalan|qaliq) (mebleg|hisse|pul|odenis)/,
];
const SAYS_RU = [/первоначальн/, /первый взнос/, /взнос/, /ежемесячн/, /рассрочк/];

/** "Daxili kredit yoxdur" says the opposite: a phrase followed by a "no" does not count. */
const DENIED = /^ (\S+ )?(yoxdur|yox|olmur|deyil|edilmir|olunmur)\b/;
// \b knows only Latin letters; a Cyrillic word ends at a space, a stop or the end.
const DENIED_RU = /^[\s,.]*(не|нет)(?=[\s,.!]|$)/;

function says(patterns: RegExp[], text: string, denied: RegExp): boolean {
  return patterns.some((re) => {
    const all = new RegExp(re.source, "g");
    for (const m of text.matchAll(all)) if (!denied.test(text.slice(m.index + m[0].length))) return true;
    return false;
  });
}

export function saysInstalment(text: string): boolean {
  return says(SAYS_AZ, fold(text), DENIED) || says(SAYS_RU, text.toLowerCase(), DENIED_RU);
}

/** A bina.az listing's description, asked for only for suspects. */
export async function binaDescription(id: string): Promise<string> {
  "use cache";
  cacheLife("hours");
  const res = await fetch("https://bina.az/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({ query: "query D($id: ID!) { item(id: $id) { description } }", variables: { id } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`bina.az ${res.status}`);
  const json = (await res.json()) as { data?: { item: { description: string | null } | null } };
  return json.data?.item?.description ?? "";
}

export interface Suspect {
  id: string;
  /** its price per m² over its place's typical one */
  ratio: number;
  /** m² */
  area?: number | null;
  /** text already in hand — a card's — read before asking for more */
  text?: string;
}

/** Descriptions asked for at once, and at most per page. */
const IN_FLIGHT = 6;
const MAX_ASKED = 60;

/**
 * The ids, among the given, whose price is an instalment. Only listings below
 * SUSPECT_RATIO are looked at; for bina.az their descriptions are read (the
 * lowest first, sixty at most); a description that cannot be read clears them.
 */
export async function instalments(candidates: Suspect[], askBina: boolean): Promise<Set<string>> {
  const out = new Set<string>();
  const suspects = candidates.filter((c) => c.ratio < SUSPECT_RATIO).sort((a, b) => a.ratio - b.ratio);
  const toAsk: Suspect[] = [];
  for (const s of suspects) {
    if (implausible(s.ratio, s.area) || (s.text && saysInstalment(s.text))) out.add(s.id);
    else if (askBina && toAsk.length < MAX_ASKED) toAsk.push(s);
  }
  for (let i = 0; i < toAsk.length; i += IN_FLIGHT) {
    await Promise.all(
      toAsk.slice(i, i + IN_FLIGHT).map(async (s) => {
        const text = await binaDescription(s.id).catch(() => "");
        if (saysInstalment(text)) out.add(s.id);
      }),
    );
  }
  return out;
}
