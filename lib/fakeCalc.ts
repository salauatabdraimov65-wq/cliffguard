import type { Input, Result } from "./types";

// Временная заглушка для фронта. В 04:00 заменяется на calculate() из engine.ts
export function fakeCalc(input: Input): Result {
  const fpl = 15960 + 5680 * (input.householdSize - 1);
  const cliff = 4 * fpl;
  const sub = (m: number) =>
    m <= cliff ? Math.max(0, input.benchmarkPremium - 0.1022 * m) : 0;
  const magi = input.income;
  const overBy = Math.max(0, magi - cliff);
  const need = overBy > 0 ? Math.ceil((overBy + 500) / 500) * 500 : 0;
  const after = magi - need;
  return {
    fpl, cliff, magi,
    fplPercent: magi / fpl,
    subsidy: Math.round(sub(magi)),
    overBy,
    loss: overBy > 0 ? Math.round(sub(cliff)) : 0,
    plan: [],
    feasible: true,
    contributionNeeded: need,
    magiAfterPlan: after,
    subsidyAfterPlan: Math.round(sub(after)),
    estTaxSavings: Math.round(need * 0.22),
    netBenefit: Math.round(sub(after) - sub(magi) + need * 0.22),
    warnings: [],
  };
}
