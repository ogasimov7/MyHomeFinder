/* Number formatting, written by hand rather than through Intl: Hermes ships
   different ICU sets per platform and a listing price must look the same on
   both. */

export function money(value: number): string {
  return `${grouped(Math.round(value))} ₼`;
}

export function moneyShort(value: number): string {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K ₼`;
  return `${Math.round(value)} ₼`;
}

export function perSqm(value: number): string {
  return `${grouped(Math.round(value))} ₼/m²`;
}

export function pct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function signedPct(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(decimals)}%`;
}

/* A saved link carries its own name: the site it points at, and the path that
   tells two searches on that site apart. */
export function siteName(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
}

export function sitePath(url: string): string {
  const rest = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const slash = rest.indexOf("/");
  return slash === -1 ? "" : rest.slice(slash);
}

function grouped(value: number): string {
  const negative = value < 0;
  const digits = String(Math.abs(value));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += " ";
    out += digits[i];
  }
  return negative ? `−${out}` : out;
}
