import { describe, it, expect } from "vitest";
import { calculate } from "../lib/engine";
import { validateInput } from "../lib/validateInput";
import { demoFamily } from "../lib/demoFamily";
import type { Input } from "../lib/types";

const TODAY = "2026-11-15";
const at = (i: Input) => calculate(i, { today: TODAY });

describe("actualPlanPremium: credit capped at the price of the plan bought", () => {
  it("no actualPlanPremium: demo numbers unchanged, pays the benchmark price", () => {
    const r = at(demoFamily);
    expect(r.subsidy).toBe(0);
    expect(r.loss).toBe(10510);
    expect(r.subsidyAfterPlan).toBe(10561);
    expect(r.premiumYouPay).toBe(24000); // over the cliff: full benchmark price
    expect(r.premiumYouPayAfterPlan).toBe(24000 - 10561); // 13,439
  });

  it("$1,200/month plan (14,400/yr): after the plan pays 14,400 - 10,561 = 3,839", () => {
    const r = at({ ...demoFamily, actualPlanPremium: 14400 });
    expect(r.subsidyAfterPlan).toBe(10561); // below the plan price, not capped
    expect(r.premiumYouPay).toBe(14400);
    expect(r.premiumYouPayAfterPlan).toBe(3839);
    expect(r.loss).toBe(10510);
  });

  it("$700/month plan (8,400/yr): credit capped at 8,400, pays 0", () => {
    const r = at({ ...demoFamily, actualPlanPremium: 8400 });
    expect(r.subsidyAfterPlan).toBe(8400);
    expect(r.premiumYouPayAfterPlan).toBe(0);
    expect(r.premiumYouPay).toBe(8400);
    expect(r.loss).toBe(8400); // you can only lose what the plan would have been covered
    expect(r.contributionNeeded).toBe(4500); // the plan is still worth doing
    expect(r.netBenefit).toBe(8400 + 990);
  });

  it("below the cliff the cap applies to the current subsidy too", () => {
    const r = at({ ...demoFamily, income: 120000, actualPlanPremium: 6000 });
    expect(r.subsidy).toBe(6000); // engine credit 11,736 capped at 6,000
    expect(r.premiumYouPay).toBe(0);
  });

  it("validateInput: optional, non-negative number", () => {
    const body = JSON.parse(JSON.stringify(demoFamily));
    const ok = validateInput({ ...body, actualPlanPremium: 14400 });
    expect(ok.ok && ok.input.actualPlanPremium).toBe(14400);
    expect(validateInput({ ...body, actualPlanPremium: -1 }).ok).toBe(false);
    expect(validateInput({ ...body, actualPlanPremium: "14400" }).ok).toBe(false);
    const none = validateInput(body);
    expect(none.ok && "actualPlanPremium" in none.input).toBe(false);
  });
});
