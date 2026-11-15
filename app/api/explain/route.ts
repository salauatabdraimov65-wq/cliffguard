import { calculate } from "@/lib/engine";
import { explainPlan } from "@/lib/explain";
import type { PlanStep, Result } from "@/lib/types";
import { validateInput } from "@/lib/validateInput";

// POST /api/explain  body: { input: Input, result?: Result }  -> 200 { explanation, source } | 400 { error }
// With a valid `input`, the result is recomputed on the server (the client can't inject numbers or text).
// Without one, a numeric-only `result` is accepted. OPENAI_API_KEY stays on the server.

const NUMERIC: (keyof Result)[] = [
  "fpl", "cliff", "magi", "fplPercent", "subsidy", "overBy", "loss", "contributionNeeded",
  "magiAfterPlan", "subsidyAfterPlan", "estTaxSavings", "netBenefit", "premiumYouPay", "premiumYouPayAfterPlan",
];

function sanitizeResult(r: unknown): Result | null {
  if (typeof r !== "object" || r === null) return null;
  const o = r as Record<string, unknown>;
  for (const k of NUMERIC) {
    if (k === "premiumYouPay" || k === "premiumYouPayAfterPlan") continue; // optional for older clients
    if (typeof o[k] !== "number" || !Number.isFinite(o[k])) return null;
  }
  if (typeof o.feasible !== "boolean" || !Array.isArray(o.plan)) return null;
  const plan: PlanStep[] = [];
  for (const s of o.plan as unknown[]) {
    const step = s as Record<string, unknown>;
    if (!["SEP_IRA", "SOLO_401K", "HSA", "MARKETPLACE_UPDATE"].includes(step?.account as string)) return null;
    if (typeof step.amount !== "number" || !Number.isFinite(step.amount)) return null;
    plan.push({ account: step.account as PlanStep["account"], amount: step.amount, deadline: "", note: "" });
  }
  const num = (k: keyof Result) => (typeof o[k] === "number" ? (o[k] as number) : 0);
  return {
    fpl: num("fpl"), cliff: num("cliff"), magi: num("magi"), fplPercent: num("fplPercent"),
    subsidy: num("subsidy"), overBy: num("overBy"), loss: num("loss"), plan,
    feasible: o.feasible as boolean, contributionNeeded: num("contributionNeeded"),
    magiAfterPlan: num("magiAfterPlan"), subsidyAfterPlan: num("subsidyAfterPlan"),
    estTaxSavings: num("estTaxSavings"), netBenefit: num("netBenefit"),
    premiumYouPay: num("premiumYouPay"), premiumYouPayAfterPlan: num("premiumYouPayAfterPlan"),
    warnings: [], // free text from the client is never forwarded
  };
}

export async function POST(request: Request) {
  let body: { input?: unknown; result?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Body must be valid JSON: { input, result }." }, { status: 400 });
  }
  const v = body && body.input !== undefined ? validateInput(body.input) : null;
  if (v && v.ok) {
    return Response.json(await explainPlan(calculate(v.input), v.input));
  }
  const result = sanitizeResult(body?.result);
  if (!result) {
    return Response.json({ error: v && !v.ok ? v.error : "Send a valid input (preferred) or result." }, { status: 400 });
  }
  return Response.json(await explainPlan(result));
}
