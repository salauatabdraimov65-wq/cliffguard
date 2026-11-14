import rules from "../data/state-rules-2027.json";

// State-specific rules for coverage year 2027 (data/state-rules-2027.json).

type StateEntry = { openEnrollmentEnd?: string; stateSubsidy?: boolean };
const STATES = rules.states as Record<string, StateEntry>;

export type StateRule = { openEnrollmentEnd: string; stateSubsidy: boolean };

export function stateRule(state: string): StateRule {
  const s = STATES[state.trim().toUpperCase()] ?? {};
  return {
    openEnrollmentEnd: s.openEnrollmentEnd ?? rules.defaultOpenEnrollmentEnd,
    stateSubsidy: s.stateSubsidy === true,
  };
}

// ---- date helpers (calendar dates only, compared as YYYY-MM-DD in UTC) ----

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2027-01-15" -> "Jan 15, 2027" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Normalises "today" to YYYY-MM-DD. Accepts a Date or an ISO date string. */
export function isoDay(today: Date | string = new Date()): string {
  if (typeof today === "string") {
    if (!/^\d{4}-\d{2}-\d{2}/.test(today)) throw new RangeError(`Invalid date: ${today}`);
    return today.slice(0, 10);
  }
  return today.toISOString().slice(0, 10);
}

/** True if the deadline (inclusive) has already passed on `today`. */
export const isPast = (deadlineIso: string, todayIso: string) => todayIso > deadlineIso;
