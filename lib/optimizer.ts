import type { Input, PlanStep } from "./types";
import limits2027 from "../data/limits-2027.json";
import { formatDate, isPast, stateRule } from "./stateRules";

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
  today: string; // YYYY-MM-DD; deadlines are shown relative to this date
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

// Contribution deadlines for tax year 2027 (2027 return due Apr 15, 2028; Oct 15, 2028 with an extension).
export const TAX_2027 = { filing: "2028-04-15", extension: "2028-10-15" } as const;

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

function marketplaceStep(reportedMagi: number, state: string, today: string): PlanStep {
  const oeEnd = stateRule(state).openEnrollmentEnd;
  if (!isPast(oeEnd, today)) {
    return {
      account: "MARKETPLACE_UPDATE",
      amount: 0,
      deadline: `by ${formatDate(oeEnd)}`,
      note: `Report ${usd(reportedMagi)} as your 2027 income on your Marketplace application.`,
    };
  }
  // Open enrollment is over: income can still be updated on the existing application.
  return {
    account: "MARKETPLACE_UPDATE",
    amount: 0,
    deadline: "as soon as possible",
    note: `Open enrollment has ended; update your 2027 income to ${usd(reportedMagi)} in your Marketplace account.`,
  };
}

/** Months left to spread a contribution over (Jan–Dec 2027), 0 when it no longer makes sense. */
function monthsLeft(today: string): number {
  if (today < "2027-01-01") return 12;
  if (today > "2027-12-31") return 0;
  return 12 - (Number(today.slice(5, 7)) - 1);
}

function sepStep(sep: number, today: string): PlanStep {
  const m = monthsLeft(today);
  const perMonth = m > 1 ? ` (about ${usd(sep / m)}/month)` : "";
  const deadline = isPast(TAX_2027.filing, today)
    ? `by ${formatDate(TAX_2027.extension)}, only if you filed a tax extension`
    : `before you file your 2027 tax return (by ${formatDate(TAX_2027.filing)})`;
  return {
    account: "SEP_IRA",
    amount: sep,
    deadline,
    note: `Contribute ${usd(sep)} to a SEP IRA${perMonth}.`,
  };
}

export function optimize(a: OptimizeArgs): OptimizeResult {
  const { input, magi, overBy, subsidy, subsidyAt, today } = a;

  const noAction = (warnings: string[] = [], contributionNeeded = 0, feasible = true): OptimizeResult => ({
    plan: [marketplaceStep(magi, input.state, today)],
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
  // A lever whose 2027 deadline has passed can no longer be used.
  const sepClosed = isPast(TAX_2027.extension, today);
  const hsaClosed = isPast(TAX_2027.filing, today);
  const sepCap = sepClosed ? 0 : sepCapacity(input);
  const hsaCap = hsaClosed ? 0 : hsaCapacity(input);

  if (needed > sepCap + hsaCap) {
    const warnings =
      sepClosed || (hsaClosed && sepCap === 0)
        ? ["The deadline for 2027 contributions has passed."]
        : ["Even maximum contributions can't bring you under the cliff this year."];
    return noAction(warnings, needed, false);
  }

  const sep = Math.min(needed, sepCap);
  const hsa = needed - sep;
  const total = sep + hsa;
  const magiAfterPlan = magi - total;
  const subsidyAfterPlan = subsidyAt(magiAfterPlan);
  const estTaxSavings = Math.round(total * limits.taxRateEstimate);
  const netBenefit = subsidyAfterPlan - subsidy + estTaxSavings;

  const plan: PlanStep[] = [marketplaceStep(magiAfterPlan, input.state, today)];
  if (sep > 0) plan.push(sepStep(sep, today));
  if (hsa > 0) {
    plan.push({
      account: "HSA",
      amount: hsa,
      deadline: `by ${formatDate(TAX_2027.filing)}`,
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
