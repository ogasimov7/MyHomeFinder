"use client";

import { Children, useState, type ReactNode } from "react";

/** Cards shown at first and added per press: four full rows at most widths. */
const STEP = 48;

/* The whole ranked page arrives at once — the badges are worked out over all
   of it — but only the first cards are drawn, so a long page does not load
   hundreds of photos before anyone scrolls. */
export function MoreGrid({ children }: { children: ReactNode }) {
  const cards = Children.toArray(children);
  const [shown, setShown] = useState(STEP);
  const left = cards.length - shown;

  return (
    <>
      <div className="grid">{cards.slice(0, shown)}</div>
      {left > 0 && (
        <div className="more">
          <p>
            {shown} / {cards.length} elan göstərilir
          </p>
          <button type="button" className="btn-ghost" onClick={() => setShown((n) => n + STEP)}>
            Daha {Math.min(STEP, left)} elan göstər
          </button>
        </div>
      )}
    </>
  );
}
