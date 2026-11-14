import type { Input, PlanStep } from "./types";

export type OptimizeArgs = {
  input: Input;
  magi: number;
  cliff: number;
  overBy: number;
  loss: number;
  subsidy: number;
  subsidyAt: (magi: number) => number;
};

export type OptimizeResult = {
  plan: PlanStep[];
  feasible: boolean;
  contributionNeeded: number;
  magiAfterPlan: number;
  subsidyAfterPlan: number;
  estTaxSavings: number;
  netBenefit: number;
  warnings: string[];
};

// Placeholder: real SEP_IRA -> HSA allocation comes in the next commit.
export function optimize(a: OptimizeArgs): OptimizeResult {
  return {
    plan: [],
    feasible: a.overBy === 0,
    contributionNeeded: 0,
    magiAfterPlan: a.magi,
    subsidyAfterPlan: a.subsidy,
    estTaxSavings: 0,
    netBenefit: 0,
    warnings: [],
  };
}
