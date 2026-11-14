import type { Input, Result } from "./types";
import fplTable from "../data/fpl-2026.json";
import pctTable from "../data/applicable-pct-2027.json";
import { optimize } from "./optimizer";

type PctRow = { from: number; to: number; initial: number; final: number };
const ROWS: PctRow[] = [...(pctTable.rows as PctRow[])].sort((a, b) => a.from - b.from);

export const CLIFF_MULTIPLE = 4.0;
const UNSUPPORTED_STATES = new Set(["AK", "HI"]);

/** Federal Poverty Level (HHS 2026, 48 states + DC) for a household size. */
export function fpl(householdSize: number): number {
  const n = Math.max(1, Math.floor(householdSize));
  return fplTable.base + fplTable.perAdditional * (n - 1);
}

/** True if the FPL ratio falls into a band that is not yet in the table (TODO(verify)). */
export function isUnverifiedBand(fplPercent: number): boolean {
  if (fplPercent > CLIFF_MULTIPLE) return false;
  return !ROWS.some((r) => fplPercent >= r.from && fplPercent <= r.to);
}

/**
 * Applicable percentage for an FPL ratio (e.g. 3.5 = 350% FPL).
 * Inside a band: linear interpolation initial -> final.
 * TODO(verify): bands missing from data/applicable-pct-2027.json are bridged by
 * linear interpolation between neighbouring known points (placeholder only).
 */
export function applicablePct(fplPercent: number): number {
  const x = Math.max(0, fplPercent);
  for (const r of ROWS) {
    if (x >= r.from && x <= r.to) {
      const span = r.to - r.from;
      const t = span > 0 ? (x - r.from) / span : 0;
      return r.initial + (r.final - r.initial) * t;
    }
  }
  const last = ROWS[ROWS.length - 1];
  if (x > last.to) return last.final;
  // gap between two known rows
  const prev = [...ROWS].reverse().find((r) => r.to < x)!;
  const next = ROWS.find((r) => r.from > x)!;
  const t = (x - prev.to) / (next.from - prev.to);
  return prev.final + (next.initial - prev.final) * t;
}

/** Annual Premium Tax Credit (unrounded). 0 above the 400% FPL cliff or below 100% FPL. */
export function subsidyFor(magi: number, householdSize: number, benchmark: number): number {
  const f = fpl(householdSize);
  if (magi > CLIFF_MULTIPLE * f) return 0;
  const ratio = magi / f;
  if (ratio < 1) return 0; // Medicaid territory, not modelled
  return Math.max(0, benchmark - applicablePct(ratio) * magi);
}

export function calculate(input: Input): Result {
  const warnings: string[] = [];
  const n = input.householdSize;
  const f = fpl(n);
  const cliff = CLIFF_MULTIPLE * f;
  const magi = input.income;
  const fplPercent = magi / f;

  if (UNSUPPORTED_STATES.has(input.state.toUpperCase())) {
    warnings.push("Alaska and Hawaii are not supported yet.");
  }
  if (fplPercent < 1) {
    warnings.push("Income below 100% FPL — you may qualify for Medicaid instead.");
  }

  const subsidyAt = (m: number) => subsidyFor(m, n, input.benchmarkPremium);
  const subsidy = subsidyAt(magi);
  const overBy = Math.max(0, magi - cliff);
  const loss = overBy > 0 ? subsidyAt(cliff) : 0;

  if (overBy > 0 && Math.round(loss) === 0) {
    warnings.push("Crossing the cliff costs you little because your benchmark plan is cheap.");
  }

  const opt = optimize({
    input,
    magi,
    cliff,
    overBy,
    loss,
    subsidy,
    subsidyAt,
  });
  warnings.push(...opt.warnings);

  if (isUnverifiedBand(fplPercent) || isUnverifiedBand(opt.magiAfterPlan / f)) {
    warnings.push(
      "Subsidy estimate at this income level uses an approximate rate table; confirm on healthcare.gov.",
    );
  }

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
    warnings,
  };
}
