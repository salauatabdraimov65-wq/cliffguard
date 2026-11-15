import { describe, it, expect } from "vitest";
import { calculate } from "../lib/engine";
import { NO_MARGIN_WARNING, PARTIAL_CUSHION_WARNING } from "../lib/optimizer";
import { demoFamily } from "../lib/demoFamily";
import type { Input } from "../lib/types";

const TODAY = "2026-11-15";
const at = (i: Input) => calculate(i, { today: TODAY });
const amount = (r: ReturnType<typeof calculate>, acc: string) => r.plan.find((s) => s.account === acc)?.amount ?? 0;

describe("cushion doesn't fit, but the cliff itself is reachable", () => {
  it("example: income 138,000, net SE 30,000, n=4 -> SEP 6,000 -> MAGI 132,000 (= cliff, still eligible)", () => {
    const r = at({ ...demoFamily, income: 138000, netSelfEmploymentIncome: 30000 });
    expect(r.overBy).toBe(6000);
    expect(r.feasible).toBe(true);
    expect(amount(r, "SEP_IRA")).toBe(6000); // capacity = 20% of 30,000
    expect(r.contributionNeeded).toBe(6000);
    expect(r.magiAfterPlan).toBe(132000);
    expect(r.subsidyAfterPlan).toBe(10510);
    expect(r.warnings).toEqual([NO_MARGIN_WARNING]);
  });

  it("rounds the overage up to $100, never above capacity", () => {
    // over by 5,950 -> 6,000 (capacity 6,000)
    const a = at({ ...demoFamily, income: 137950, netSelfEmploymentIncome: 30000 });
    expect(amount(a, "SEP_IRA")).toBe(6000);
    expect(a.magiAfterPlan).toBe(131950);
    // over by 5,980, capacity 5,990 (net SE 29,950) -> min(6,000, 5,990) = 5,990, still under the cliff
    const b = at({ ...demoFamily, income: 137980, netSelfEmploymentIncome: 29950 });
    expect(amount(b, "SEP_IRA")).toBe(5990);
    expect(b.magiAfterPlan).toBeLessThanOrEqual(132000);
    expect(b.feasible).toBe(true);
  });

  it("SEP then HSA when SEP alone is short", () => {
    // over by 6,000; SEP 2,000 (net SE 10,000) + HSA 9,000 -> needed 6,500 fits, normal plan
    const ok = at({ ...demoFamily, income: 138000, netSelfEmploymentIncome: 10000, hsaEligible: true });
    expect(ok.warnings).toEqual([]);
    expect(amount(ok, "SEP_IRA") + amount(ok, "HSA")).toBe(6500);
    // over by 10,900; SEP 2,000 + HSA 9,000 = 11,000 < needed 11,500 -> 2,000 SEP + 8,900 HSA, no margin
    const tight = at({ ...demoFamily, income: 142900, netSelfEmploymentIncome: 10000, hsaEligible: true });
    expect(tight.feasible).toBe(true);
    expect(amount(tight, "SEP_IRA")).toBe(2000);
    expect(amount(tight, "HSA")).toBe(8900);
    expect(tight.magiAfterPlan).toBe(132000);
    expect(tight.warnings).toEqual([NO_MARGIN_WARNING]);
  });

  it("still infeasible when even the overage exceeds capacity", () => {
    const r = at({ ...demoFamily, income: 138100, netSelfEmploymentIncome: 30000 }); // over 6,100 > 6,000
    expect(r.feasible).toBe(false);
    expect(r.warnings[0]).toBe("Even maximum contributions can't bring you under the cliff this year.");
  });

  it("uneven income: no-margin case keeps both explanations", () => {
    const r = at({ ...demoFamily, income: 138000, netSelfEmploymentIncome: 30000, incomeStability: "uneven" });
    expect(r.feasible).toBe(true);
    expect(amount(r, "SEP_IRA")).toBe(6000);
    expect(r.warnings).toEqual([NO_MARGIN_WARNING, "Your income is uneven, so we keep a $2,000 cushion below the cliff."]);
  });

  it("already under the cliff inside the cushion: partial cushion, not 'impossible'", () => {
    // 1,000 under the cliff, lumpy wants 4,000 -> needs 3,000; capacity 2,000 (net SE 10,000)
    const r = at({ ...demoFamily, income: 131000, netSelfEmploymentIncome: 10000, incomeStability: "lumpy" });
    expect(r.feasible).toBe(true);
    expect(amount(r, "SEP_IRA")).toBe(2000);
    expect(r.magiAfterPlan).toBe(129000);
    expect(r.warnings[0]).toBe(PARTIAL_CUSHION_WARNING);
  });

  it("demo family unchanged", () => {
    const r = at(demoFamily);
    expect(amount(r, "SEP_IRA")).toBe(4500);
    expect(r.warnings).toEqual([]);
  });
});
