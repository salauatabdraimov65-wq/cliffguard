import type { Input } from "@/lib/types";
import { demoFamily } from "@/lib/demoFamily";

/**
 * Input <-> URL query. The whole household lives in the URL, so a diagnosis is
 * shareable, survives a refresh, and needs no account or storage.
 */
export type QueryLike = Record<string, string | string[] | undefined>;

export function inputToQuery(input: Input): string {
  const q = new URLSearchParams({
    st: input.state,
    hh: String(input.householdSize),
    ages: input.ages.join("-"),
    inc: String(Math.round(input.income)),
    se: String(Math.round(input.netSelfEmploymentIncome)),
    bp: String(Math.round(input.benchmarkPremium)),
    hsa: input.hsaEligible ? "1" : "0",
  });
  if (input.zip) q.set("zip", input.zip);
  return q.toString();
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const num = (v: string | undefined) => {
  if (v === undefined || v.trim() === "") return NaN;
  return Number(v);
};

/** Returns null when the query does not describe a complete household. */
export function queryToInput(query: QueryLike): Input | null {
  if (one(query.demo) === "1") return demoFamily;

  const state = (one(query.st) ?? "").toUpperCase();
  const hh = num(one(query.hh));
  const inc = num(one(query.inc));
  const bp = num(one(query.bp));
  if (!/^[A-Z]{2}$/.test(state) || !Number.isInteger(hh) || hh < 1 || hh > 8) return null;
  if (!(inc >= 0) || !(bp >= 0)) return null;

  const se = num(one(query.se));
  const rawAges = (one(query.ages) ?? "").split("-").map(Number).filter((a) => Number.isFinite(a));
  const ages = Array.from({ length: hh }, (_, i) => rawAges[i] ?? (i < 2 ? 40 : 10));
  const zip = one(query.zip);

  return {
    householdSize: hh,
    state,
    ...(zip && /^\d{5}$/.test(zip) ? { zip } : {}),
    ages,
    income: inc,
    netSelfEmploymentIncome: se >= 0 ? se : inc,
    benchmarkPremium: bp,
    hsaEligible: one(query.hsa) === "1",
    coverageYear: 2027,
  };
}

export const isDemo = (query: QueryLike) => one(query.demo) === "1";
