import { describe, it, expect } from "vitest";
import { calculate } from "../lib/engine";
import { topUpNeeded } from "../lib/monitor";
import { validateInput } from "../lib/validateInput";
import { demoFamily } from "../lib/demoFamily";
import type { Input } from "../lib/types";

const TODAY = "2026-11-15";
const at = (i: Input) => calculate(i, { today: TODAY });
const sep = (r: ReturnType<typeof calculate>) => r.plan.find((s) => s.account === "SEP_IRA")?.amount ?? 0;
const UNEVEN = "Your income is uneven, so we keep a $2,000 cushion below the cliff.";
const LUMPY = "Your income comes in a few big payments, so we keep a $4,000 cushion below the cliff.";

describe("incomeStability -> safety cushion", () => {
  it("default and steady: demo stays SEP 4,500, no cushion warning", () => {
    for (const r of [at(demoFamily), at({ ...demoFamily, incomeStability: "steady" })]) {
      expect(sep(r)).toBe(4500);
      expect(r.magiAfterPlan).toBe(131500);
      expect(r.subsidyAfterPlan).toBe(10561);
      expect(r.warnings).toEqual([]);
    }
  });

  it("uneven: $2,000 cushion -> SEP 6,000, MAGI 130,000", () => {
    const r = at({ ...demoFamily, incomeStability: "uneven" });
    expect(r.contributionNeeded).toBe(6000);
    expect(sep(r)).toBe(6000);
    expect(r.magiAfterPlan).toBe(130000);
    expect(r.subsidyAfterPlan).toBe(Math.round(24000 - 0.1022 * 130000)); // 10,714
    expect(r.estTaxSavings).toBe(1320);
    expect(r.warnings).toEqual([UNEVEN]);
  });

  it("lumpy: $4,000 cushion -> SEP 8,000, MAGI 128,000", () => {
    const r = at({ ...demoFamily, incomeStability: "lumpy" });
    expect(sep(r)).toBe(8000);
    expect(r.magiAfterPlan).toBe(128000);
    expect(r.warnings).toEqual([LUMPY]);
  });

  it("just under the cliff: steady does nothing, uneven restores the cushion", () => {
    const under = { ...demoFamily, income: 131000, netSelfEmploymentIncome: 131000 };
    const steady = at(under);
    expect(steady.overBy).toBe(0);
    expect(steady.plan.map((s) => s.account)).toEqual(["MARKETPLACE_UPDATE"]);
    const uneven = at({ ...under, incomeStability: "uneven" });
    expect(uneven.overBy).toBe(0);
    expect(uneven.loss).toBe(0);
    expect(sep(uneven)).toBe(1000); // 1,000 under -> needs 2,000 -> add 1,000
    expect(uneven.magiAfterPlan).toBe(130000);
    expect(uneven.warnings).toEqual([UNEVEN]);
  });

  it("far below the cliff or cheap plan: no plan, no cushion warning", () => {
    const far = at({ ...demoFamily, income: 120000, incomeStability: "lumpy" });
    expect(far.plan.map((s) => s.account)).toEqual(["MARKETPLACE_UPDATE"]);
    expect(far.warnings).toEqual([]);
    const cheap = at({ ...demoFamily, householdSize: 1, ages: [30], income: 63000, benchmarkPremium: 6000, incomeStability: "uneven" });
    expect(cheap.plan.map((s) => s.account)).toEqual(["MARKETPLACE_UPDATE"]);
  });

  it("infeasible: the infeasible warning stays first (UI banner), cushion second", () => {
    const r = at({ ...demoFamily, income: 180000, netSelfEmploymentIncome: 180000, hsaEligible: true, incomeStability: "uneven" });
    expect(r.feasible).toBe(false);
    expect(r.contributionNeeded).toBe(50000);
    expect(r.warnings).toEqual(["Even maximum contributions can't bring you under the cliff this year.", UNEVEN]);
  });

  it("monitor top-up uses the same cushion", () => {
    expect(topUpNeeded(138300, 4500, demoFamily)).toBe(2500);
    expect(topUpNeeded(138300, 4500, { ...demoFamily, incomeStability: "uneven" })).toBe(4000);
    expect(topUpNeeded(131000, 0, demoFamily)).toBe(0);
    expect(topUpNeeded(131000, 0, { ...demoFamily, incomeStability: "uneven" })).toBe(1000);
  });

  it("validateInput accepts the three values and rejects others", () => {
    const body = JSON.parse(JSON.stringify(demoFamily));
    for (const v of ["steady", "uneven", "lumpy"]) {
      const res = validateInput({ ...body, incomeStability: v });
      expect(res.ok && res.input.incomeStability).toBe(v);
    }
    expect(validateInput({ ...body, incomeStability: "wild" }).ok).toBe(false);
    const none = validateInput(body);
    expect(none.ok && "incomeStability" in none.input).toBe(false);
  });
});
