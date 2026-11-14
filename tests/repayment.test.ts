import { describe, it, expect } from "vitest";
import { checkRepayment2026, validateRepaymentInput, type RepaymentInput } from "../lib/repayment";
import { applicablePct, fpl, subsidyFor } from "../lib/engine";

const family: RepaymentInput = {
  householdSize: 4,
  estimatedIncome: 125000,
  actualIncome: 131000,
  benchmarkPremium2026: 22000,
  netSelfEmploymentIncome: 131000,
  hsaEligible: false,
};

describe("2026 tables (coverage year 2026)", () => {
  it("FPL 2025: family of 4 = 32,150, cliff 128,600", () => {
    expect(fpl(4, 2026)).toBe(32150);
    expect(4 * fpl(4, 2026)).toBe(128600);
    expect(fpl(1, 2026)).toBe(15650);
  });
  it("applicable % 2026 (Rev. Proc. 2025-25), interpolated", () => {
    expect(applicablePct(1.0, 2026)).toBeCloseTo(0.021, 6);
    expect(applicablePct(1.33, 2026)).toBeCloseTo(0.0314, 6);
    expect(applicablePct(1.75, 2026)).toBeCloseTo((0.0419 + 0.066) / 2, 6);
    expect(applicablePct(3.5, 2026)).toBeCloseTo(0.0996, 6);
    expect(subsidyFor(128601, 4, 22000, 2026)).toBe(0);
  });
  it("2027 defaults are unchanged", () => {
    expect(fpl(4)).toBe(33000);
    expect(applicablePct(3.5)).toBeCloseTo(0.1022, 6);
  });
});

describe("checkRepayment2026", () => {
  it("over the cliff: full APTC repaid; SEP 3,000 fixes it", () => {
    const r = checkRepayment2026(family);
    expect(r.cliff).toBe(128600);
    expect(r.aptcReceived).toBe(Math.round(22000 - 0.0996 * 125000)); // 9,550
    expect(r.ptcAllowed).toBe(0);
    expect(r.repaymentOwed).toBe(r.aptcReceived);
    expect(r.contributionToAvoid).toBe(3000); // 2,400 over + 500 buffer -> round up to 500
    expect(r.feasible).toBe(true);
    expect(r.magiAfterFix).toBe(128000);
    // only the rate difference on the extra 3,000 of income remains: 0.0996 * 3,000
    expect(r.repaymentAfterFix).toBe(299);
    expect(r.deadlines.map((d) => d.account)).toEqual(["SEP_IRA", "TAX_RETURN"]);
    expect(r.deadlines[0].amount).toBe(3000);
  });

  it("small SE income: SEP then HSA", () => {
    const r = checkRepayment2026({ ...family, netSelfEmploymentIncome: 10000, hsaEligible: true });
    expect(r.deadlines.filter((d) => d.account !== "TAX_RETURN").map((d) => [d.account, d.amount])).toEqual([
      ["SEP_IRA", 2000],
      ["HSA", 1000],
    ]);
    expect(r.magiAfterFix).toBe(128000);
  });

  it("infeasible: no contributions planned, warning", () => {
    const r = checkRepayment2026({ ...family, actualIncome: 200000, netSelfEmploymentIncome: 50000 });
    expect(r.feasible).toBe(false);
    expect(r.repaymentAfterFix).toBe(r.repaymentOwed);
    expect(r.deadlines.map((d) => d.account)).toEqual(["TAX_RETURN"]);
    expect(r.warnings.join(" ")).toMatch(/can't bring 2026 income under the cliff/);
  });

  it("income lower than estimated: no repayment, extra credit", () => {
    const r = checkRepayment2026({ ...family, actualIncome: 120000 });
    expect(r.repaymentOwed).toBe(0);
    expect(r.additionalCredit).toBe(Math.round(0.0996 * 5000));
    expect(r.contributionToAvoid).toBe(0);
  });

  it("validates input", () => {
    expect(() => validateRepaymentInput({ ...family, householdSize: 0 })).toThrow();
    expect(() => validateRepaymentInput({ ...family, actualIncome: "x" })).toThrow();
    expect(validateRepaymentInput(family)).toEqual(family);
  });
});
