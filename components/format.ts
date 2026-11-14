export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** $132k style, for axis ticks and compact labels. */
export const usdK = (n: number) => {
  const k = n / 1000;
  return `$${Number.isInteger(k) ? k : k.toFixed(1)}k`;
};

export const pct = (ratio: number) => `${Math.round(ratio * 100)}%`;
