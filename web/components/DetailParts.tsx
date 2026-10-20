"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { money } from "../../src/lib/format";
import type { MarketRow } from "@/lib/market";
import { monthlyPayment } from "@/lib/mortgage";
import { rowKey, useSaved, useTerms } from "@/lib/store";
import { ArrowLeftIcon, ChatIcon, HeartIcon, PhoneIcon, ShareIcon } from "./icons";

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

/* A number box that can be emptied and typed into afresh. What is typed is
   kept as text while the box has focus; only a number within range reaches
   the terms, and leaving the box shows the terms again. Bound straight to
   the terms, an emptied box read as NaN, was put back to the default and
   snapped back under the cursor. */
function TermInput({
  value,
  min,
  max,
  step,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={text ?? String(value)}
      onFocus={() => setText(String(value))}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value.replace(",", "."));
        if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) onCommit(n);
      }}
      onBlur={() => setText(null)}
    />
  );
}

/* The buyer's own terms, remembered in this browser across listings. */
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
          <TermInput min={0} max={90} step={5} value={terms.downPct} onCommit={(downPct) => setTerms({ downPct })} />
          <i>%</i>
        </label>
        <label>
          <span>Müddət</span>
          <TermInput min={1} max={30} value={terms.years} onCommit={(years) => setTerms({ years })} />
          <i>il</i>
        </label>
        <label>
          <span>Faiz</span>
          <TermInput min={0} max={30} step={0.5} value={terms.ratePct} onCommit={(ratePct) => setTerms({ ratePct })} />
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

/** "(099) 324-90-90" → "994993249090", as tel: and wa.me want it. */
function international(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("994")) return digits;
  if (digits.startsWith("0")) return `994${digits.slice(1)}`;
  return digits.length === 9 ? `994${digits}` : digits;
}

/* Call or write to the seller. bina.az shows a number only when asked, so
   it is asked for when one of these is first pressed, and the press goes on
   to the call or the chat; after that both are plain links. kub.az listings,
   whose numbers cannot be asked for, link to the listing itself. */
export function ContactButtons({
  source,
  id,
  listingUrl,
  compact = false,
}: {
  source: string;
  id: string;
  /** the listing on its own site — the WhatsApp message names it, and it is the fallback */
  listingUrl: string;
  compact?: boolean;
}) {
  const [phone, setPhone] = useState<{ intl: string; shown: string } | null>(null);
  const [state, setState] = useState<"idle" | "asking" | "failed">("idle");

  if (source !== "bina") {
    return (
      <a className="btn-solid" href={listingUrl} target="_blank" rel="noopener noreferrer">
        Satıcı ilə əlaqə
      </a>
    );
  }

  const tel = (n: string) => `tel:+${n}`;
  const chat = (n: string) =>
    `https://wa.me/${n}?text=${encodeURIComponent(`Salam! bina.az-dakı elanınızla bağlı yazıram: ${listingUrl}`)}`;

  const ask = async (): Promise<string | null> => {
    setState("asking");
    try {
      const res = await fetch(`/api/phone/${id}`, { cache: "no-store" });
      const { phones } = (await res.json()) as { phones?: string[] };
      if (!res.ok || !phones?.length) throw new Error("no phone");
      const found = { intl: international(phones[0]), shown: phones[0] };
      setPhone(found);
      setState("idle");
      return found.intl;
    } catch {
      setState("failed");
      return null;
    }
  };

  // Once the number is known the links work on their own; before, the press
  // asks for it and then carries on where it was going.
  const press = (to: (n: string) => string) => async (e: React.MouseEvent) => {
    if (phone) return;
    e.preventDefault();
    if (state === "asking") return;
    const n = await ask();
    if (n) window.location.href = to(n);
  };

  return (
    <div className={`contact${compact ? " is-compact" : ""}`}>
      <div className="contact-buttons">
        <a className="btn-solid contact-call" href={phone ? tel(phone.intl) : "#"} onClick={press(tel)} aria-busy={state === "asking"}>
          <PhoneIcon size={17} /> {compact ? "Zəng" : "Zəng et"}
        </a>
        <a
          className="btn-ghost contact-chat"
          href={phone ? chat(phone.intl) : "#"}
          target={phone ? "_blank" : undefined}
          rel="noopener noreferrer"
          onClick={press(chat)}
        >
          <ChatIcon size={17} /> WhatsApp
        </a>
      </div>
      {!compact && phone && <p className="contact-number">{phone.shown}</p>}
      {state === "failed" && (
        <p className="contact-failed">
          Nömrə alınmadı —{" "}
          <a href={listingUrl} target="_blank" rel="noopener noreferrer">
            elanın öz səhifəsində
          </a>{" "}
          baxın.
        </p>
      )}
    </div>
  );
}
