import type { Input, PlanStep } from "./types";
import limits2027 from "../data/limits-2027.json";

export type Limits = typeof limits2027;
const limits: Limits = limits2027;

// Levers in priority order: SEP_IRA -> HSA.
// Traditional IRA is intentionally NOT used (PROJECT.md §11.4).

export type OptimizeArgs = {
  input: Input;
  magi: number;
  cliff: number;
  overBy: number;
  loss: number; // unrounded subsidy lost because of the cliff
  subsidy: number; // unrounded current subsidy
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

const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;

/** Max SEP IRA contribution (simplified: 20% of net SE income, capped by §415(c)). */
export function sepCapacity(
  input: Pick<Input, "netSelfEmploymentIncome">,
  lim: Pick<Limits, "sepPctOfNetSE" | "sep415cCap"> = limits,
): number {
  const byIncome = lim.sepPctOfNetSE * Math.max(0, input.netSelfEmploymentIncome);
  return Math.max(0, Math.min(byIncome, lim.sep415cCap));
}

/** Max HSA contribution; 0 unless an HSA-eligible (bronze/catastrophic) plan is chosen. */
export function hsaCapacity(
  input: Pick<Input, "hsaEligible" | "householdSize"> & { ages?: number[] },
  lim: { hsa: { self: number; family: number; catchUp55: number } } = limits,
): number {
  if (!input.hsaEligible) return 0;
  const base = input.householdSize > 1 ? lim.hsa.family : lim.hsa.self;
  const catchUp = (input.ages ?? []).some((a) => a >= 55) ? lim.hsa.catchUp55 : 0;
  return base + catchUp;
}

/** Contribution that brings MAGI `overBy` dollars down under the cliff, with safety buffer and rounding. */
export function contributionFor(
  overBy: number,
  lim: Pick<Limits, "safetyBuffer" | "roundTo"> = limits,
): number {
  if (overBy <= 0) return 0;
  return Math.ceil((overBy + lim.safetyBuffer) / lim.roundTo) * lim.roundTo;
}

function marketplaceStep(reportedMagi: number): PlanStep {
  return {
    account: "MARKETPLACE_UPDATE",
    amount: 0,
    deadline: "by Dec 15, 2026",
    note: `Report ${usd(reportedMagi)} as your 2027 income on your Marketplace application.`,
  };
}

export function optimize(a: OptimizeArgs): OptimizeResult {
  const { input, magi, overBy, subsidy, subsidyAt } = a;

  const noAction = (warnings: string[] = [], contributionNeeded = 0, feasible = true): OptimizeResult => ({
    plan: [marketplaceStep(magi)],
    feasible,
    contributionNeeded,
    magiAfterPlan: magi,
    subsidyAfterPlan: subsidy,
    estTaxSavings: 0,
    netBenefit: 0,
    warnings,
  });

  // Below the cliff, or crossing it costs ~nothing (cheap benchmark plan): no contributions needed.
  if (overBy <= 0 || Math.round(a.loss) === 0) return noAction();

  const needed = contributionFor(overBy);
  const sepCap = sepCapacity(input);
  const hsaCap = hsaCapacity(input);

  if (needed > sepCap + hsaCap) {
    return noAction(
      ["Even maximum contributions can't bring you under the cliff this year."],
      needed,
      false,
    );
  }

  const sep = Math.min(needed, sepCap);
  const hsa = needed - sep;
  const total = sep + hsa;
  const magiAfterPlan = magi - total;
  const subsidyAfterPlan = subsidyAt(magiAfterPlan);
  const estTaxSavings = Math.round(total * limits.taxRateEstimate);
  const netBenefit = subsidyAfterPlan - subsidy + estTaxSavings;

  const plan: PlanStep[] = [marketplaceStep(magiAfterPlan)];
  if (sep > 0) {
    plan.push({
      account: "SEP_IRA",
      amount: sep,
      deadline: "before you file your 2027 tax return",
      note: `Contribute ${usd(sep)} to a SEP IRA (about ${usd(sep / 12)}/month).`,
    });
  }
  if (hsa > 0) {
    plan.push({
      account: "HSA",
      amount: hsa,
      deadline: "by Apr 15, 2028",
      note: `Contribute ${usd(hsa)} to an HSA (requires a bronze or catastrophic plan).`,
    });
  }

  return {
    plan,
    feasible: true,
    contributionNeeded: needed,
    magiAfterPlan,
    subsidyAfterPlan,
    estTaxSavings,
    netBenefit,
    warnings: [],
  };
}
