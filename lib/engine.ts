import type { Input, Result } from "./types";
import fpl2025 from "../data/fpl-2025.json";
import fpl2026 from "../data/fpl-2026.json";
import pct2026 from "../data/applicable-pct-2026.json";
import pct2027 from "../data/applicable-pct-2027.json";
import { optimize } from "./optimizer";
import { isoDay, stateRule } from "./stateRules";

/** Coverage (tax) year. Subsidy for coverage year Y uses the prior year's HHS poverty guidelines. */
export type CoverageYear = 2026 | 2027;

type PctRow = { from: number; to: number; initial: number; final: number };
type FplTable = { base: number; perAdditional: number };

const sortRows = (rows: PctRow[]) => [...rows].sort((a, b) => a.from - b.from);

const TABLES: Record<CoverageYear, { fpl: FplTable; pct: PctRow[] }> = {
  2026: { fpl: fpl2025, pct: sortRows(pct2026.rows) }, // HHS 2025 + IRS Rev. Proc. 2025-25
  2027: { fpl: fpl2026, pct: sortRows(pct2027.rows) }, // HHS 2026 + IRS Rev. Proc. 2026-26
};

export const CLIFF_MULTIPLE = 4.0;
const UNSUPPORTED_STATES = new Set(["AK", "HI"]);

/** Federal Poverty Level (48 states + DC) used for the given coverage year. */
export function fpl(householdSize: number, year: CoverageYear = 2027): number {
  const n = Math.max(1, Math.floor(householdSize));
  const t = TABLES[year].fpl;
  return t.base + t.perAdditional * (n - 1);
}

/**
 * Applicable percentage for an FPL ratio (e.g. 3.5 = 350% FPL):
 * 2027 — IRS Rev. Proc. 2026-26 §3.01; 2026 — IRS Rev. Proc. 2025-25.
 * Bands are [from, to); the last band also includes its upper bound (400%).
 * Inside a band: linear interpolation initial -> final.
 */
export function applicablePct(fplPercent: number, year: CoverageYear = 2027): number {
  const ROWS = TABLES[year].pct;
  const x = Math.max(0, fplPercent);
  const last = ROWS[ROWS.length - 1];
  if (x >= last.to) return last.final;
  const r = ROWS.find((row) => x >= row.from && x < row.to) ?? last;
  const t = (x - r.from) / (r.to - r.from);
  return r.initial + (r.final - r.initial) * t;
}

/** Annual Premium Tax Credit (unrounded). 0 above the 400% FPL cliff or below 100% FPL. */
export function subsidyFor(
  magi: number,
  householdSize: number,
  benchmark: number,
  year: CoverageYear = 2027,
): number {
  const f = fpl(householdSize, year);
  if (magi > CLIFF_MULTIPLE * f) return 0;
  const ratio = magi / f;
  if (ratio < 1) return 0; // Medicaid territory, not modelled
  return Math.max(0, benchmark - applicablePct(ratio, year) * magi);
}

export type CalculateOptions = {
  /** "Today" for deadline logic (Date or YYYY-MM-DD). Defaults to the current date. */
  today?: Date | string;
};

export function calculate(input: Input, options: CalculateOptions = {}): Result {
  const today = isoDay(options.today);
  const warnings: string[] = [];
  const n = input.householdSize;
  const f = fpl(n);
  const cliff = CLIFF_MULTIPLE * f;
  const magi = input.income;
  const fplPercent = magi / f;

  // The credit can't exceed the premium of the plan actually bought (IRC §36B(b)(2)(A)).
  const planPrice = input.actualPlanPremium ?? input.benchmarkPremium;
  const subsidyAt = (m: number) => Math.min(subsidyFor(m, n, input.benchmarkPremium), planPrice);
  const subsidy = subsidyAt(magi);
  const overBy = Math.max(0, magi - cliff);
  const loss = overBy > 0 ? subsidyAt(cliff) : 0;

  if (overBy > 0 && Math.round(loss) === 0) {
    warnings.push("Crossing the cliff costs you little because your benchmark plan is cheap.");
  }
  // The cheap-plan explanation stays first: the UI shows warnings[0] for that case.
  if (fplPercent < 1) {
    warnings.push("Income below 100% FPL — you may qualify for Medicaid instead.");
  }
  if (UNSUPPORTED_STATES.has(input.state.toUpperCase())) {
    warnings.push("Alaska and Hawaii are not supported yet.");
  }
  if (stateRule(input.state).stateSubsidy) {
    warnings.push("New Mexico funds its own extra subsidy — your real loss may be smaller.");
  }

  const opt = optimize({
    input,
    magi,
    cliff,
    overBy,
    loss,
    subsidy,
    subsidyAt,
    today,
  });
  warnings.push(...opt.warnings);

  return {
    fpl: Math.round(f),
    cliff: Math.round(cliff),
    magi: Math.round(magi),
    fplPercent,
    subsidy: Math.round(subsidy),
    overBy: Math.round(overBy),
    loss: Math.round(loss),
    plan: opt.plan,
    feasible: opt.feasible,
    contributionNeeded: Math.round(opt.contributionNeeded),
    magiAfterPlan: Math.round(opt.magiAfterPlan),
    subsidyAfterPlan: Math.round(opt.subsidyAfterPlan),
    estTaxSavings: Math.round(opt.estTaxSavings),
    netBenefit: Math.round(opt.netBenefit),
    premiumYouPay: Math.round(Math.max(0, planPrice - subsidy)),
    premiumYouPayAfterPlan: Math.round(Math.max(0, planPrice - opt.subsidyAfterPlan)),
    warnings,
  };
}
