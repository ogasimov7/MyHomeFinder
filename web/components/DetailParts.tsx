"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { money } from "../../src/lib/format";
import type { MarketRow } from "@/lib/market";
import { monthlyPayment } from "@/lib/mortgage";
import { rowKey, useSaved, useTerms } from "@/lib/store";
import { ArrowLeftIcon, HeartIcon, ShareIcon } from "./icons";

/* Back keeps the search exactly as it was left — filters and scroll — when
   the page was reached from it; a link opened on its own goes to the search. */
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="round-btn"
      aria-label="Geri"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      <ArrowLeftIcon size={20} />
    </button>
  );
}

export function SaveButton({ row }: { row: MarketRow | null }) {
  const { saved, toggle } = useSaved();
  if (!row) return null;
  const on = saved.some((s) => rowKey(s) === rowKey(row));
  return (
    <button type="button" className={`act-btn${on ? " is-on" : ""}`} onClick={() => toggle(row)} aria-pressed={on}>
      <HeartIcon size={17} filled={on} />
      <span>{on ? "Saxlanıb" : "Saxla"}</span>
    </button>
  );
}

/* The phone's own share sheet where there is one; elsewhere the link is copied. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* dismissed or not allowed: nothing to do */
    }
  };
  return (
    <button type="button" className="act-btn" onClick={share}>
      <ShareIcon size={17} />
      <span>{copied ? "Link kopyalandı" : "Paylaş"}</span>
    </button>
  );
}

const LONG = 560;

export function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > LONG;
  return (
    <>
      <p className={`desc${long && !open ? " is-clamped" : ""}`}>{text}</p>
      {long && (
        <button type="button" className="link-arrow desc-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? "Qısalt" : "Hamısını oxu"}
        </button>
      )}
    </>
  );
}

/* The same terms as the filters panel — changing them here changes every card. */
export function MortgageCalc({ price }: { price: number }) {
  const { terms, setTerms } = useTerms();
  const monthly = monthlyPayment(price, terms);
  const down = price * (terms.downPct / 100);
  const loan = price - down;
  const interest = Math.max(0, monthly * terms.years * 12 - loan);

  return (
    <div className="calc">
      <p className="calc-monthly">
        <span>Aylıq ödəniş</span>
        <b>{money(monthly)}</b>
      </p>
      <div className="terms">
        <label>
          <span>İlkin</span>
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
      <dl className="calc-lines">
        <div>
          <dt>İlkin ödəniş</dt>
          <dd>{money(down)}</dd>
        </div>
        <div>
          <dt>Kredit məbləği</dt>
          <dd>{money(loan)}</dd>
        </div>
        <div>
          <dt>Ümumi faiz</dt>
          <dd>{money(interest)}</dd>
        </div>
      </dl>
    </div>
  );
}
