import type { Input, Result } from "./types";

// Plain-English explanation of a plan. Text only: every number comes from Result.
// OpenAI is optional (OPENAI_API_KEY, server-side only); without it, or on any error or
// a >7 s timeout, a deterministic template built from the same numbers is returned.

export type Explanation = { explanation: string; source: "ai" | "template"; reason?: string };

export const DISCLAIMER = "Educational estimate, not tax advice.";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 7000;

// Structured output: the model must return exactly { "explanation": string }.
const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "plan_explanation",
    strict: true,
    schema: {
      type: "object",
      properties: { explanation: { type: "string" } },
      required: ["explanation"],
      additionalProperties: false,
    },
  },
} as const;

const SYSTEM_PROMPT = [
  "Explain the plan in plain English, 3-4 sentences, at a 6th-grade reading level.",
  "Use ONLY the numbers in the JSON; never invent, round differently, or compute new numbers.",
  "Do not give tax advice or tell the reader what they must do.",
  `End with exactly: ${DISCLAIMER}`,
].join(" ");

/** Masks anything that looks like a secret key before it reaches logs or responses. */
export function redact(text: string): string {
  return text.replace(/\b(sk|rk|pk)[-_][A-Za-z0-9_\-*]{6,}/g, "$1-***");
}

/** Short, safe description of a failed OpenAI HTTP response, e.g. "http_404: The model `x` does not exist". */
export async function openAiError(res: Response): Promise<string> {
  let msg = "";
  try {
    const body = (await res.json()) as { error?: { message?: string; code?: string } };
    msg = body.error?.code ? `${body.error.code}: ${body.error.message ?? ""}` : body.error?.message ?? "";
  } catch {
    /* no JSON body */
  }
  return redact(`http_${res.status}${msg ? `: ${msg.slice(0, 200)}` : ""}`);
}

export function logAiFallback(feature: string, reason: string) {
  if (reason !== "no_key") console.warn(`[ai] ${feature}: using fallback (${reason})`);
}

const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;

/** The only data the model sees: numbers from Result (no free text from the client). */
export function planFacts(result: Result, input?: Pick<Input, "householdSize">) {
  return {
    householdSize: input?.householdSize,
    expectedIncome: result.magi,
    cliff: result.cliff,
    overTheCliffBy: result.overBy,
    creditNow: result.subsidy,
    creditLostToTheCliff: result.loss,
    canGetUnderTheCliff: result.feasible,
    contributionInPlan: result.contributionNeeded,
    incomeAfterPlan: result.magiAfterPlan,
    creditAfterPlan: result.subsidyAfterPlan,
    estimatedFederalTaxSavings: result.estTaxSavings,
    netBenefitPerYear: result.netBenefit,
    youPayForYourPlanNowPerYear: result.premiumYouPay,
    youPayAfterThePlanPerYear: result.premiumYouPayAfterPlan,
    planSteps: result.plan.map((s) => ({ account: s.account, amount: s.amount })),
  };
}

/** Deterministic explanation from the same numbers. */
export function templateExplanation(r: Result): string {
  const rescue = r.overBy > 0 && r.loss > 0 && r.feasible && r.contributionNeeded > 0;
  let body: string;
  if (rescue) {
    body =
      `Your expected income of ${usd(r.magi)} is ${usd(r.overBy)} over the subsidy cliff of ${usd(r.cliff)}, ` +
      `so right now you would get no premium tax credit. ` +
      `If you put ${usd(r.contributionNeeded)} into the accounts in your plan, the income that counts for the credit drops to ${usd(r.magiAfterPlan)}. ` +
      `That brings back an estimated ${usd(r.subsidyAfterPlan)} a year in credit, plus about ${usd(r.estTaxSavings)} in federal tax savings.`;
  } else if (r.overBy > 0 && !r.feasible) {
    body =
      `Your expected income of ${usd(r.magi)} is ${usd(r.overBy)} over the subsidy cliff of ${usd(r.cliff)}. ` +
      `Getting back under it would take about ${usd(r.contributionNeeded)} in contributions, which is more than your accounts allow this year, ` +
      `so the plan focuses on reporting your income correctly to avoid paying back credit later.`;
  } else if (r.overBy > 0) {
    body =
      `Your expected income of ${usd(r.magi)} is ${usd(r.overBy)} over the subsidy cliff of ${usd(r.cliff)}. ` +
      `At your plan's price, crossing the cliff costs you little, so no contributions are needed.`;
  } else {
    body =
      `Your expected income of ${usd(r.magi)} is under the subsidy cliff of ${usd(r.cliff)}, ` +
      `so you keep an estimated ${usd(r.subsidy)} a year in premium tax credit. ` +
      `The plan is to report your income on the Marketplace and stay under the cliff as the year goes on.`;
  }
  return `${body} ${DISCLAIMER}`;
}

/** All finite numbers anywhere inside a value (objects, arrays), rounded. */
export function numbersIn(value: unknown, out = new Set<number>()): Set<number> {
  if (typeof value === "number" && Number.isFinite(value)) out.add(Math.round(value));
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => numbersIn(v, out));
  return out;
}

/** Every number in the text must come from the facts (or be a small number / a year). */
export function usesOnlyKnownNumbers(text: string, facts: unknown): boolean {
  return unknownNumbers(text, facts).length === 0;
}

/** Numbers in the text that don't come from the facts (monthly = yearly / 12 and "400%" are allowed). */
export function unknownNumbers(text: string, facts: unknown): number[] {
  const allowed = numbersIn(facts);
  for (const v of [...allowed]) if (v >= 1200) allowed.add(Math.round(v / 12));
  allowed.add(400);
  const found = text.match(/\d[\d,]*(\.\d+)?/g) ?? [];
  return found
    .map((raw) => Math.round(Number(raw.replace(/,/g, ""))))
    .filter((n) => !(allowed.has(n) || n <= 31 || (n >= 2025 && n <= 2028)));
}

type FetchLike = typeof fetch;

export async function explainPlan(
  result: Result,
  input?: Input,
  opts: { apiKey?: string; model?: string; fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<Explanation> {
  const fallback = (reason: string): Explanation => {
    logAiFallback("explain", reason);
    return { explanation: templateExplanation(result), source: "template", reason };
  };
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback("no_key");

  const facts = planFacts(result, input);
  try {
    const res = await (opts.fetchImpl ?? fetch)("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: opts.model ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
        temperature: 0.2,
        max_tokens: 300,
        response_format: RESPONSE_FORMAT,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(facts) },
        ],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
    });
    if (!res.ok) return fallback(await openAiError(res));
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content ?? "";
    let text = "";
    try {
      const parsed = JSON.parse(raw) as { explanation?: unknown };
      if (typeof parsed.explanation === "string") text = parsed.explanation.trim();
    } catch {
      return fallback("invalid_json"); // not valid JSON for the schema
    }
    if (!text) return fallback("empty_answer");
    const unknown = unknownNumbers(text, facts);
    if (unknown.length) return fallback(`unknown_numbers: ${unknown.slice(0, 5).join(", ")}`);
    if (!text.endsWith(DISCLAIMER)) text = `${text.replace(/\s*Educational estimate.*$/i, "")} ${DISCLAIMER}`.trim();
    return { explanation: text, source: "ai" };
  } catch (e) {
    return fallback(redact(e instanceof Error ? `${e.name}: ${e.message}` : "error"));
  }
}
