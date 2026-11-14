import { CLIFF_MULTIPLE, fpl, subsidyFor } from "./engine";
import { contributionFor, hsaCapacity, sepCapacity } from "./optimizer";
import limits2026 from "../data/limits-2026.json";

// Repayment-risk check for tax year 2026 (return filed in spring 2027).
// The APTC repayment cap is repealed from tax year 2026 (OBBBA §71305):
// any excess advance credit is repaid in full on Form 8962.
// Levers: SEP IRA (until the return due date incl. extensions) -> HSA (until Apr 15, 2027).
// Traditional IRA is intentionally NOT used (PROJECT.md §11.4).

const YEAR = 2026 as const;

export type RepaymentInput = {
  householdSize: number; // 1..8
  estimatedIncome: number; // income reported to the Marketplace -> APTC paid during 2026
  actualIncome: number; // actual 2026 MAGI before the fix
  benchmarkPremium2026: number; // annual benchmark silver premium for 2026, USD
  netSelfEmploymentIncome: number; // for the SEP IRA limit
  hsaEligible: boolean; // bronze/catastrophic plan in 2026
  ages?: number[]; // optional, for the HSA 55+ catch-up
};

export type RepaymentDeadline = {
  account: "SEP_IRA" | "HSA" | "TAX_RETURN";
  amount: number; // USD (0 for TAX_RETURN)
  deadline: string; // EN
  note: string; // EN, 1 sentence
};

export type RepaymentResult = {
  fpl: number;
  cliff: number; // 4 * fpl (2025 HHS guidelines)
  aptcReceived: number; // advance credit paid, based on estimatedIncome
  ptcAllowed: number; // credit actually allowed, based on actualIncome
  repaymentOwed: number; // max(0, aptcReceived - ptcAllowed)
  additionalCredit: number; // max(0, ptcAllowed - aptcReceived), refunded on the return
  feasible: boolean; // can contributions bring actual MAGI under the cliff?
  contributionToAvoid: number; // SEP + HSA needed to get under the cliff (0 if already under)
  magiAfterFix: number;
  ptcAfterFix: number;
  repaymentAfterFix: number;
  deadlines: RepaymentDeadline[];
  warnings: string[]; // EN
};

export class RepaymentInputError extends Error {}

const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function validateRepaymentInput(body: unknown): RepaymentInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new RepaymentInputError("Body must be a JSON object.");
  }
  const b = body as Record<string, unknown>;
  if (!isNum(b.householdSize) || !Number.isInteger(b.householdSize) || b.householdSize < 1 || b.householdSize > 8) {
    throw new RepaymentInputError("householdSize must be an integer from 1 to 8.");
  }
  for (const k of ["estimatedIncome", "actualIncome", "benchmarkPremium2026", "netSelfEmploymentIncome"] as const) {
    if (!isNum(b[k]) || (b[k] as number) < 0 || (b[k] as number) > 100_000_000) {
      throw new RepaymentInputError(`${k} must be a non-negative number.`);
    }
  }
  if (typeof b.hsaEligible !== "boolean") throw new RepaymentInputError("hsaEligible must be a boolean.");
  if (b.ages !== undefined && (!Array.isArray(b.ages) || !b.ages.every((a) => isNum(a) && a >= 0 && a <= 120))) {
    throw new RepaymentInputError("ages must be an array of numbers from 0 to 120.");
  }
  return {
    householdSize: b.householdSize,
    estimatedIncome: b.estimatedIncome as number,
    actualIncome: b.actualIncome as number,
    benchmarkPremium2026: b.benchmarkPremium2026 as number,
    netSelfEmploymentIncome: b.netSelfEmploymentIncome as number,
    hsaEligible: b.hsaEligible,
    ...(b.ages ? { ages: b.ages as number[] } : {}),
  };
}

export function checkRepayment2026(input: RepaymentInput): RepaymentResult {
  const n = input.householdSize;
  const f = fpl(n, YEAR);
  const cliff = CLIFF_MULTIPLE * f;
  const credit = (magi: number) => subsidyFor(magi, n, input.benchmarkPremium2026, YEAR);
  const warnings: string[] = [];

  const aptc = credit(input.estimatedIncome);
  const ptc = credit(input.actualIncome);
  const owed = Math.max(0, aptc - ptc);

  if (input.actualIncome / f < 1) {
    warnings.push("Income below 100% FPL has special reconciliation rules — confirm with a tax professional.");
  }

  const overBy = Math.max(0, input.actualIncome - cliff);
  const needed = owed > 0 ? contributionFor(overBy, limits2026) : 0;
  const sepCap = sepCapacity(input, limits2026);
  const hsaCap = hsaCapacity(input, limits2026);
  const feasible = needed <= sepCap + hsaCap;

  let sep = 0;
  let hsa = 0;
  if (needed > 0 && feasible) {
    sep = Math.min(needed, sepCap);
    hsa = needed - sep;
  }
  const magiAfterFix = input.actualIncome - sep - hsa;
  const ptcAfterFix = credit(magiAfterFix);
  const repaymentAfterFix = Math.max(0, aptc - ptcAfterFix);

  if (needed > 0 && !feasible) {
    warnings.push("Even maximum SEP IRA and HSA contributions can't bring 2026 income under the cliff.");
  }
  if (overBy === 0 && owed > 0) {
    warnings.push("You are under the cliff; the repayment comes only from income being higher than estimated.");
  }

  const deadlines: RepaymentDeadline[] = [];
  if (sep > 0) {
    deadlines.push({
      account: "SEP_IRA",
      amount: sep,
      deadline: "by your 2026 tax return due date, including extensions",
      note: `Contribute ${usd(sep)} to a SEP IRA for tax year 2026 before you file.`,
    });
  }
  if (hsa > 0) {
    deadlines.push({
      account: "HSA",
      amount: hsa,
      deadline: "by Apr 15, 2027",
      note: `Contribute ${usd(hsa)} to an HSA for 2026 (requires a 2026 bronze or catastrophic plan).`,
    });
  }
  deadlines.push({
    account: "TAX_RETURN",
    amount: 0,
    deadline: "by Apr 15, 2027 (or Oct 15, 2027 with an extension)",
    note: "Reconcile your advance credit on Form 8962 with your 2026 federal return.",
  });

  return {
    fpl: Math.round(f),
    cliff: Math.round(cliff),
    aptcReceived: Math.round(aptc),
    ptcAllowed: Math.round(ptc),
    repaymentOwed: Math.round(owed),
    additionalCredit: Math.round(Math.max(0, ptc - aptc)),
    feasible,
    contributionToAvoid: needed,
    magiAfterFix: Math.round(magiAfterFix),
    ptcAfterFix: Math.round(ptcAfterFix),
    repaymentAfterFix: Math.round(repaymentAfterFix),
    deadlines,
    warnings,
  };
}
