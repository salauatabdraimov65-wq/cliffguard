import type { Input } from "./types";
import { CLIFF_MULTIPLE, fpl, type CoverageYear } from "./engine";
import { contributionFor, sepCapacity } from "./optimizer";

// Helpers for the monitoring screen ("you are $X away from the cliff").
// Pure functions, no I/O.

/**
 * Year-end income projection.
 * monthlyIncomes: actual income for the months so far (Jan..current), 1–12 entries.
 * knownFuture: extra income already contracted for the rest of the year (e.g. a Q4 contract),
 *              on top of the usual monthly run-rate.
 * Projection = year-to-date + average month × remaining months + knownFuture.
 */
export function projectYearEnd(monthlyIncomes: number[], knownFuture = 0): number {
  if (monthlyIncomes.length < 1 || monthlyIncomes.length > 12) {
    throw new RangeError("monthlyIncomes must have 1 to 12 entries.");
  }
  if (!monthlyIncomes.every((m) => Number.isFinite(m)) || !Number.isFinite(knownFuture)) {
    throw new RangeError("Incomes must be finite numbers.");
  }
  const ytd = monthlyIncomes.reduce((s, m) => s + m, 0);
  const avg = ytd / monthlyIncomes.length;
  const remaining = 12 - monthlyIncomes.length;
  return Math.round(ytd + avg * remaining + Math.max(0, knownFuture));
}

type MonitorInput = Pick<Input, "householdSize" | "netSelfEmploymentIncome">;

/**
 * Extra SEP IRA contribution (on top of plannedContribution) needed to keep
 * projected MAGI under the cliff, with the usual $500 buffer and $500 rounding.
 * 0 if the planned contribution already keeps the family under the cliff.
 */
export function topUpNeeded(
  projectedIncome: number,
  plannedContribution: number,
  input: MonitorInput,
  year: CoverageYear = 2027,
): number {
  const cliff = CLIFF_MULTIPLE * fpl(input.householdSize, year);
  const overBy = projectedIncome - Math.max(0, plannedContribution) - cliff;
  return contributionFor(overBy);
}

export type MonitorStatus = {
  projectedIncome: number;
  cliff: number;
  projectedMagi: number; // projectedIncome - plannedContribution
  headroom: number; // cliff - projectedMagi (negative = over the cliff)
  topUp: number; // extra SEP IRA contribution needed
  sepRoomLeft: number; // SEP capacity left after planned + topUp (can be negative)
  feasible: boolean; // planned + topUp fits within SEP capacity
};

/** Everything the monitoring screen needs in one call. */
export function monitorStatus(
  monthlyIncomes: number[],
  knownFuture: number,
  plannedContribution: number,
  input: MonitorInput,
  year: CoverageYear = 2027,
): MonitorStatus {
  const projectedIncome = projectYearEnd(monthlyIncomes, knownFuture);
  const cliff = CLIFF_MULTIPLE * fpl(input.householdSize, year);
  const projectedMagi = projectedIncome - Math.max(0, plannedContribution);
  const topUp = topUpNeeded(projectedIncome, plannedContribution, input, year);
  const sepRoomLeft = Math.round(sepCapacity(input) - plannedContribution - topUp);
  return {
    projectedIncome,
    cliff,
    projectedMagi,
    headroom: cliff - projectedMagi,
    topUp,
    sepRoomLeft,
    feasible: sepRoomLeft >= 0,
  };
}
