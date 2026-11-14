import { describe, it, expect } from "vitest";
import { calculate, applicablePct, fpl, subsidyFor } from "../lib/engine";
import { demoFamily } from "../lib/demoFamily";
import type { Input } from "../lib/types";

const base = (o: Partial<Input>): Input => ({
  householdSize: 4,
  state: "TX",
  ages: [38, 36, 8, 5],
  income: 0,
  netSelfEmploymentIncome: 0,
  benchmarkPremium: 24000,
  hsaEligible: false,
  coverageYear: 2027,
  ...o,
});

const amount = (r: ReturnType<typeof calculate>, acc: string) =>
  r.plan.find((s) => s.account === acc)?.amount ?? 0;

describe("calculate (coverage 2027, 48 states)", () => {
  it("1. demo family Mike & Jess", () => {
    const r = calculate(demoFamily);
    expect(r.cliff).toBe(132000);
    expect(r.subsidy).toBe(0);
    expect(r.overBy).toBe(4000);
    expect(r.loss).toBe(10510);
    expect(amount(r, "SEP_IRA")).toBe(4500);
    expect(amount(r, "HSA")).toBe(0);
    expect(r.magiAfterPlan).toBe(131500);
    expect(r.subsidyAfterPlan).toBe(10561);
    expect(r.estTaxSavings).toBe(990);
    expect(r.feasible).toBe(true);
  });

  it("2. below the cliff: only marketplace update", () => {
    const r = calculate(base({ income: 120000, netSelfEmploymentIncome: 120000 }));
    expect(r.subsidy).toBe(11736);
    expect(r.overBy).toBe(0);
    expect(r.plan.map((s) => s.account)).toEqual(["MARKETPLACE_UPDATE"]);
  });

  it("3. cheap benchmark plan: crossing costs nothing", () => {
    const r = calculate(
      base({ householdSize: 1, ages: [30], income: 65000, netSelfEmploymentIncome: 65000, benchmarkPremium: 6000 }),
    );
    expect(r.cliff).toBe(63840);
    expect(r.overBy).toBe(1160);
    expect(r.loss).toBe(0);
    expect(r.warnings).toContain("Crossing the cliff costs you little because your benchmark plan is cheap.");
  });

  it("4. infeasible: needed 48,500 > SEP 36,000 + HSA 9,000", () => {
    const r = calculate(base({ income: 180000, netSelfEmploymentIncome: 180000, hsaEligible: true }));
    expect(r.contributionNeeded).toBe(48500);
    expect(r.feasible).toBe(false);
    expect(r.warnings).toContain("Even maximum contributions can't bring you under the cliff this year.");
  });

  it("5. household of 3 just over the cliff", () => {
    const r = calculate(
      base({ householdSize: 3, ages: [35, 33, 4], income: 110000, netSelfEmploymentIncome: 110000, benchmarkPremium: 18000 }),
    );
    expect(r.cliff).toBe(109280);
    expect(r.overBy).toBe(720);
    expect(r.loss).toBe(6832);
    expect(amount(r, "SEP_IRA")).toBe(1500);
    expect(r.magiAfterPlan).toBe(108500);
    expect(r.subsidyAfterPlan).toBe(6911);
  });

  it("6. small SE income: SEP 2,000 + HSA 2,500", () => {
    const r = calculate(base({ income: 136000, netSelfEmploymentIncome: 10000, hsaEligible: true }));
    expect(amount(r, "SEP_IRA")).toBe(2000);
    expect(amount(r, "HSA")).toBe(2500);
    expect(r.contributionNeeded).toBe(4500);
    expect(r.feasible).toBe(true);
  });

  it("7. Alaska is not supported", () => {
    const r = calculate(base({ state: "AK", income: 120000 }));
    expect(r.warnings).toContain("Alaska and Hawaii are not supported yet.");
  });

  it("8. applicable % interpolation at ~250.6% FPL (Rev. Proc. 2026-26)", () => {
    const ratio = 40000 / fpl(1); // 40,000 / 15,960 ≈ 2.5063
    const pct = applicablePct(ratio);
    expect(pct).toBeCloseTo(0.0867, 3); // 8.66% + 1.56pp * (0.0063 / 0.5) ≈ 8.68%
    const r = calculate(
      base({ householdSize: 1, ages: [30], income: 40000, netSelfEmploymentIncome: 40000, benchmarkPremium: 6000 }),
    );
    expect(r.subsidy).toBe(Math.round(6000 - pct * 40000));
    expect(Math.abs(r.subsidy - (6000 - 0.0867 * 40000))).toBeLessThan(5);
    expect(r.warnings).toEqual([]);
  });

  it("9. band edges: 133% starts the 3.23% band, 400% stays at 10.22%", () => {
    expect(applicablePct(1.3299)).toBeCloseTo(0.0215, 6);
    expect(applicablePct(1.33)).toBeCloseTo(0.0323, 6);
    expect(applicablePct(2.0)).toBeCloseTo(0.0678, 6);
    expect(applicablePct(4.0)).toBeCloseTo(0.1022, 6);
    expect(subsidyFor(4 * fpl(4) + 1, 4, 24000)).toBe(0);
  });
});
