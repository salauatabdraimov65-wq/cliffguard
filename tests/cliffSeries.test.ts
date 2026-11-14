import { describe, it, expect } from "vitest";
import { buildSeries } from "../components/cliffSeries";
import { subsidyFor, fpl } from "../lib/engine";
import { demoFamily } from "../lib/demoFamily";

describe("cliffSeries.buildSeries uses the real engine", () => {
  it("single adult below 300% FPL (interpolated rate, not a flat 10.22%)", () => {
    const input = { ...demoFamily, householdSize: 1, ages: [30], benchmarkPremium: 6000 };
    const cliff = 4 * fpl(1); // 63,840 -> range 41,840..85,840
    const series = buildSeries(input, cliff);
    for (const p of series) {
      expect(p.subsidy).toBe(Math.round(subsidyFor(p.x, 1, 6000)));
      expect(p.over).toBe(p.x > cliff);
    }
    const at = series.find((p) => p.x === 41840)!;
    expect(at.subsidy).toBe(Math.round(subsidyFor(41840, 1, 6000)));
    expect(at.subsidy).toBeGreaterThan(Math.round(6000 - 0.1022 * 41840)); // old stub understated it
    expect(series.filter((p) => p.over).every((p) => p.subsidy === 0)).toBe(true);
  });

  it("demo family series is unchanged", () => {
    const series = buildSeries(demoFamily, 132000);
    expect(series[0].x).toBe(110000);
    expect(series.find((p) => p.x === 132000)!.subsidy).toBe(10510);
    expect(series.find((p) => p.x === 134000)!.subsidy).toBe(0);
  });
});
