import { fakeCalc } from "@/lib/fakeCalc";
import type { Input } from "@/lib/types";

export type Point = { x: number; subsidy: number; over: boolean };

/** Range shown on charts and the slider: the cliff ± $22k (demo: $110k–$154k). */
export function chartRange(cliff: number) {
  return { min: cliff - 22000, max: cliff + 22000 };
}

/** Subsidy at each MAGI, every $2k across the range. Values come from the calc engine. */
export function buildSeries(input: Input, cliff: number, step = 2000): Point[] {
  const { min, max } = chartRange(cliff);
  const pts: Point[] = [];
  for (let x = min; x <= max; x += step) {
    const r = fakeCalc({ ...input, income: x });
    pts.push({ x, subsidy: r.subsidy, over: x > cliff });
  }
  return pts;
}

/** Index of the bar that represents `magi`, never on the wrong side of the cliff. */
export function barIndexFor(series: Point[], magi: number, cliff: number): number {
  if (series.length === 0) return -1;
  const step = series.length > 1 ? series[1].x - series[0].x : 1;
  let i = Math.round((magi - series[0].x) / step);
  i = Math.max(0, Math.min(series.length - 1, i));
  if (magi > cliff && !series[i].over && i < series.length - 1) i += 1;
  if (magi <= cliff && series[i].over && i > 0) i -= 1;
  return i;
}

/** Clean y-axis top: next multiple of $5k above the tallest bar. */
export function niceMax(series: Point[]): number {
  const m = Math.max(1, ...series.map((p) => p.subsidy));
  return Math.ceil(m / 5000) * 5000;
}
