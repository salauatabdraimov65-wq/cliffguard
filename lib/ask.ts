import type { IncomeStability, Input, Result } from "./types";
import { calculate } from "./engine";
import { DEFAULT_OPENAI_MODEL, DISCLAIMER, logAiFallback, openAiError, planFacts, redact, templateExplanation, unknownNumbers } from "./explain";

// "Ask CliffGuard": what-if questions about the subsidy and the plan.
// The model never computes numbers. It changes Input fields and calls OUR engine through the
// `calculate` tool (max 3 calls), then answers only from the tool results.
// No key / error / timeout -> a deterministic rule-based parser runs the same engine.

export type Changes = {
  income?: number;
  netSelfEmploymentIncome?: number;
  householdSize?: number;
  hsaEligible?: boolean;
  actualPlanPremium?: number; // annual USD
  incomeStability?: IncomeStability;
};

export type Scenario = { changes: Changes; input: Input; result: Result };
export type AskResponse = { answer: string; scenario?: Scenario; source: "ai" | "rules"; reason?: string };

const MAX_TOOL_CALLS = 3;
const TIMEOUT_MS = 8000;
const MAX_QUESTION = 500;

export const OFF_TOPIC_ANSWER =
  "I can only help with your ACA subsidy and your CliffGuard plan. Try: “What if I earn $8,000 more?”, " +
  "“What if I pick a bronze plan?” or “What if we have another child?”";

const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;

/** Apply model- or rule-proposed changes to the input, with hard limits. */
export function applyChanges(base: Input, c: Changes): Input {
  const next: Input = { ...base, ages: [...base.ages] };
  if (typeof c.income === "number" && Number.isFinite(c.income)) {
    next.income = Math.min(10_000_000, Math.max(0, Math.round(c.income)));
    // Self-employed household by default: SE income follows income unless it was set separately.
    if (base.netSelfEmploymentIncome === base.income && c.netSelfEmploymentIncome === undefined) {
      next.netSelfEmploymentIncome = next.income;
    }
  }
  if (typeof c.netSelfEmploymentIncome === "number" && Number.isFinite(c.netSelfEmploymentIncome)) {
    next.netSelfEmploymentIncome = Math.min(next.income, Math.max(0, Math.round(c.netSelfEmploymentIncome)));
  }
  if (typeof c.householdSize === "number" && Number.isInteger(c.householdSize)) {
    const n = Math.min(8, Math.max(1, c.householdSize));
    while (next.ages.length < n) next.ages.push(0); // a new child
    next.ages = next.ages.slice(0, n);
    next.householdSize = n;
  }
  if (typeof c.hsaEligible === "boolean") next.hsaEligible = c.hsaEligible;
  if (typeof c.actualPlanPremium === "number" && Number.isFinite(c.actualPlanPremium)) {
    next.actualPlanPremium = Math.min(1_000_000, Math.max(0, Math.round(c.actualPlanPremium)));
  }
  if (c.incomeStability === "steady" || c.incomeStability === "uneven" || c.incomeStability === "lumpy") {
    next.incomeStability = c.incomeStability;
  }
  return next;
}

function runScenario(base: Input, changes: Changes, today?: string): Scenario {
  const input = applyChanges(base, changes);
  return { changes, input, result: calculate(input, today ? { today } : {}) };
}

// ---------------- deterministic fallback ----------------

const MONEY = /\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?/i;

/** Every amount the user typed, e.g. "$8,000" or "8k" -> 8000. */
export function numbersInQuestion(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?/gi)) {
    let v = Number(m[1].replace(/,/g, ""));
    if (m[2]) v *= 1000;
    if (Number.isFinite(v)) out.push(v, Math.round(v / 12), v * 12);
  }
  return out;
}

function money(text: string): number | null {
  const m = text.match(MONEY);
  if (!m) return null;
  let v = Number(m[1].replace(/,/g, ""));
  if (m[2]) v *= 1000;
  return Number.isFinite(v) ? v : null;
}

/** Turns simple what-if questions into Changes; null if the question isn't one we can answer. */
export function parseWhatIf(question: string, base: Input): Changes | null {
  const q = question.toLowerCase();
  const changes: Changes = {};
  const amount = money(q);

  const planPrice = q.match(/plan\s+(?:costs?|is|for|price(?:d)?(?: at)?)\s*\$?\s*(\d[\d,]*)\s*(?:\/\s*mo|a month|per month|monthly|\/month)?/);
  if (planPrice) {
    const v = Number(planPrice[1].replace(/,/g, ""));
    const monthly = /\/\s*mo|a month|per month|monthly|\/month/.test(q) || v < 3000;
    changes.actualPlanPremium = monthly ? v * 12 : v;
  } else if (amount !== null && /(more|extra|additional|raise|bonus|increase|up by|another \$)/.test(q)) {
    changes.income = base.income + amount;
  } else if (amount !== null && /(less|lower|drop|fewer|decrease|down by|cut|lose \$)/.test(q)) {
    changes.income = base.income - amount;
  } else if (amount !== null && /(earn|make|income|revenue|bring in)/.test(q)) {
    changes.income = amount;
  }
  if (/(bronze|catastrophic|\bhsa\b)/.test(q)) changes.hsaEligible = true;
  if (/(baby|another (kid|child)|new (kid|child)|have a (kid|child)|one more (kid|child))/.test(q)) {
    changes.householdSize = base.householdSize + 1;
  }
  if (/(uneven|irregular)/.test(q)) changes.incomeStability = "uneven";
  if (/(lumpy|big payments|few big)/.test(q)) changes.incomeStability = "lumpy";

  return Object.keys(changes).length ? changes : null;
}

export function describeChanges(c: Changes, base: Input): string {
  const parts: string[] = [];
  if (c.income !== undefined) parts.push(`your income is ${usd(c.income)} instead of ${usd(base.income)}`);
  if (c.householdSize !== undefined) parts.push(`your household grows to ${c.householdSize}`);
  if (c.hsaEligible) parts.push("you pick a bronze or catastrophic plan (HSA-eligible)");
  if (c.actualPlanPremium !== undefined) parts.push(`your plan costs ${usd(c.actualPlanPremium)} a year`);
  if (c.incomeStability) parts.push(`your income is ${c.incomeStability}`);
  return parts.join(" and ");
}

export function rulesAnswer(base: Input, question: string, today?: string): AskResponse {
  const changes = parseWhatIf(question, base);
  if (!changes) return { answer: OFF_TOPIC_ANSWER, source: "rules" };
  const scenario = runScenario(base, changes, today);
  const answer = `If ${describeChanges(changes, base)}: ${templateExplanation(scenario.result)}`;
  return { answer, scenario, source: "rules" };
}

// ---------------- OpenAI with function calling ----------------

const SYSTEM_PROMPT = [
  "You are CliffGuard, an assistant for US self-employed families on the ACA Marketplace.",
  "Answer only questions about their premium tax credit (subsidy), the 400% FPL cliff, and their CliffGuard plan.",
  "For any what-if, call the `calculate` tool with ONLY the fields that change; never compute numbers yourself.",
  "Use ONLY numbers that appear in the JSON you were given or in tool results. 2-4 sentences, plain English, 6th-grade reading level.",
  "No tax or legal advice. If the question is off-topic, set off_topic to true.",
  `End the answer with exactly: ${DISCLAIMER}`,
].join(" ");

const nullable = (type: string, description: string) => ({ type: [type, "null"], description });

const CALCULATE_TOOL = {
  type: "function",
  function: {
    name: "calculate",
    description:
      "Runs the CliffGuard engine on the household with these fields changed (null = unchanged). Returns the engine's numbers.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        income: nullable("number", "New expected annual household income, USD."),
        netSelfEmploymentIncome: nullable("number", "New annual net self-employment income, USD."),
        householdSize: nullable("integer", "New household size, 1-8."),
        hsaEligible: nullable("boolean", "true if they pick a bronze or catastrophic (HSA-eligible) plan."),
        actualPlanPremium: nullable("number", "ANNUAL price of the plan they will buy, USD (monthly x 12)."),
        incomeStability: { type: ["string", "null"], enum: ["steady", "uneven", "lumpy", null] },
      },
      required: ["income", "netSelfEmploymentIncome", "householdSize", "hsaEligible", "actualPlanPremium", "incomeStability"],
      additionalProperties: false,
    },
  },
} as const;

const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "ask_answer",
    strict: true,
    schema: {
      type: "object",
      properties: { answer: { type: "string" }, off_topic: { type: "boolean" } },
      required: ["answer", "off_topic"],
      additionalProperties: false,
    },
  },
} as const;

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type Message = { role: string; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };
type FetchLike = typeof fetch;

function toChanges(args: Record<string, unknown>): Changes {
  const c: Changes = {};
  for (const [k, v] of Object.entries(args)) {
    if (v === null || v === undefined) continue;
    (c as Record<string, unknown>)[k] = v;
  }
  return c;
}

export async function askCliffGuard(
  base: Input,
  question: string,
  opts: { apiKey?: string; model?: string; fetchImpl?: FetchLike; timeoutMs?: number; today?: string } = {},
): Promise<AskResponse> {
  const q = question.trim().slice(0, MAX_QUESTION);
  const fallback = (reason: string): AskResponse => {
    logAiFallback("ask", reason);
    return { ...rulesAnswer(base, q, opts.today), reason };
  };
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback("no_key");
  if (!q) return fallback("empty_question");

  const baseResult = calculate(base, opts.today ? { today: opts.today } : {});
  const deadline = Date.now() + (opts.timeoutMs ?? TIMEOUT_MS);
  // Allowed numbers: the household, our engine's results, the user's own question, and simple
  // differences between a scenario and today (e.g. "$8,000 more").
  const allowed: Record<string, unknown>[] = [
    planFacts(baseResult, base),
    { income: base.income, householdSize: base.householdSize, planPrice: base.actualPlanPremium ?? base.benchmarkPremium },
    { fromQuestion: numbersInQuestion(q) },
  ];
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        household: { householdSize: base.householdSize, income: base.income, netSelfEmploymentIncome: base.netSelfEmploymentIncome, hsaEligible: base.hsaEligible, planPricePerYear: base.actualPlanPremium ?? base.benchmarkPremium },
        currentResult: planFacts(baseResult, base),
        question: q,
      }),
    },
  ];
  let scenario: Scenario | undefined;
  let toolCalls = 0;

  try {
    for (let turn = 0; turn <= MAX_TOOL_CALLS; turn++) {
      const left = deadline - Date.now();
      if (left <= 0) return fallback("timeout");
      const res = await (opts.fetchImpl ?? fetch)("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: opts.model ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
          temperature: 0.2,
          max_tokens: 400,
          messages,
          tools: toolCalls < MAX_TOOL_CALLS ? [CALCULATE_TOOL] : undefined,
          tool_choice: toolCalls < MAX_TOOL_CALLS ? "auto" : undefined,
          response_format: RESPONSE_FORMAT,
        }),
        signal: AbortSignal.timeout(left),
      });
      if (!res.ok) return fallback(await openAiError(res));
      const data = (await res.json()) as { choices?: { message?: Message }[] };
      const msg = data.choices?.[0]?.message;
      if (!msg) return fallback("empty_response");

      if (msg.tool_calls?.length) {
        messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
        for (const call of msg.tool_calls) {
          if (call.function.name !== "calculate" || toolCalls >= MAX_TOOL_CALLS) {
            messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "not available" }) });
            continue;
          }
          toolCalls++;
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(call.function.arguments); } catch { /* empty changes */ }
          scenario = runScenario(base, toChanges(args), opts.today);
          const facts = { changedInput: scenario.changes, ...planFacts(scenario.result, scenario.input) };
          allowed.push(facts, scenario.changes as Record<string, unknown>, {
            income: scenario.input.income,
            householdSize: scenario.input.householdSize,
            incomeChange: Math.abs(scenario.input.income - base.income),
            lossChange: Math.abs(scenario.result.loss - baseResult.loss),
            contributionChange: Math.abs(scenario.result.contributionNeeded - baseResult.contributionNeeded),
            creditChange: Math.abs(scenario.result.subsidyAfterPlan - baseResult.subsidyAfterPlan),
          });
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(facts) });
        }
        continue;
      }

      let parsed: { answer?: unknown; off_topic?: unknown } = {};
      try { parsed = JSON.parse(msg.content ?? ""); } catch { return fallback("invalid_json"); }
      if (parsed.off_topic === true) return { answer: OFF_TOPIC_ANSWER, source: "ai" };
      let answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
      if (!answer) return fallback("empty_answer");
      const unknown = unknownNumbers(answer, allowed);
      if (unknown.length) return fallback(`unknown_numbers: ${unknown.slice(0, 5).join(", ")}`);
      if (!answer.endsWith(DISCLAIMER)) answer = `${answer.replace(/\s*Educational estimate.*$/i, "")} ${DISCLAIMER}`.trim();
      return { answer, scenario, source: "ai" };
    }
    return fallback("too_many_turns");
  } catch (e) {
    return fallback(redact(e instanceof Error ? `${e.name}: ${e.message}` : "error"));
  }
}
