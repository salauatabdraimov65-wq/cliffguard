const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** $136,000 */
export function usd(n: number): string {
  return usdFmt.format(Math.round(n));
}

/** $136k */
export function usdK(n: number): string {
  const k = n / 1000;
  return `$${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

/** 4.12 -> "412%" */
export function fplPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
