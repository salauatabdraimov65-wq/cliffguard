import type { Input } from "./types";

export type ValidationResult = { ok: true; input: Input } | { ok: false; error: string };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Validates an untrusted JSON body against the Input contract (lib/types.ts). */
export function validateInput(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const b = body as Record<string, unknown>;

  if (!isNum(b.householdSize) || !Number.isInteger(b.householdSize) || b.householdSize < 1 || b.householdSize > 8) {
    return { ok: false, error: "householdSize must be an integer from 1 to 8." };
  }
  if (typeof b.state !== "string" || !/^[A-Za-z]{2}$/.test(b.state)) {
    return { ok: false, error: "state must be a 2-letter US state code." };
  }
  if (b.zip !== undefined && (typeof b.zip !== "string" || !/^\d{5}$/.test(b.zip))) {
    return { ok: false, error: "zip must be a 5-digit string." };
  }
  if (!Array.isArray(b.ages) || !b.ages.every((a) => isNum(a) && a >= 0 && a <= 120)) {
    return { ok: false, error: "ages must be an array of numbers from 0 to 120." };
  }
  if (b.ages.length !== b.householdSize) {
    return { ok: false, error: "ages must have one entry per household member." };
  }
  for (const k of ["income", "netSelfEmploymentIncome", "benchmarkPremium"] as const) {
    if (!isNum(b[k]) || (b[k] as number) < 0 || (b[k] as number) > 100_000_000) {
      return { ok: false, error: `${k} must be a non-negative number.` };
    }
  }
  if (typeof b.hsaEligible !== "boolean") {
    return { ok: false, error: "hsaEligible must be a boolean." };
  }
  if (b.coverageYear !== 2027) {
    return { ok: false, error: "coverageYear must be 2027." };
  }

  return {
    ok: true,
    input: {
      householdSize: b.householdSize,
      state: b.state.toUpperCase(),
      ...(b.zip !== undefined ? { zip: b.zip as string } : {}),
      ages: b.ages as number[],
      income: b.income as number,
      netSelfEmploymentIncome: b.netSelfEmploymentIncome as number,
      benchmarkPremium: b.benchmarkPremium as number,
      hsaEligible: b.hsaEligible,
      coverageYear: 2027,
    },
  };
}
