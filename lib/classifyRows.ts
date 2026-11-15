import type { IncomingRow } from "./parseIncome";
import { DEFAULT_OPENAI_MODEL } from "./explain";

// AI stage 3: the keyword rules stay the base. Only AMBIGUOUS incoming rows (wire transfers,
// Zelle, Venmo/PayPal, "Transfer - <company>", bare deposits) are sent to the model, which
// classifies each as income | own_transfer | refund. It never computes totals.
// No key / error / timeout -> the rules' verdicts are kept unchanged.

export type Category = "income" | "own_transfer" | "refund";
export type ClassifyResult = { rows: IncomingRow[]; aiClassified: number; source: "ai" | "rules" };

const MAX_ROWS = 50;
const TIMEOUT_MS = 7000;

const SYSTEM_PROMPT = [
  "You classify incoming bank transactions for a self-employed US household.",
  "For each row return one category:",
  "income = payment from a client, customer or employer (including wires, Zelle, PayPal, Stripe/Square payouts from a business);",
  "own_transfer = money moved between the household's own accounts or from a family member;",
  "refund = refund, return, reversal, chargeback, cashback or interest.",
  "Use only the description and amount. Return every id exactly once.",
].join(" ");

const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "row_categories",
    strict: true,
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "integer" },
              category: { type: "string", enum: ["income", "own_transfer", "refund"] },
            },
            required: ["id", "category"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
} as const;

type FetchLike = typeof fetch;

export async function classifyAmbiguous(
  rows: IncomingRow[],
  opts: { apiKey?: string; model?: string; fetchImpl?: FetchLike; timeoutMs?: number } = {},
): Promise<ClassifyResult> {
  const unchanged: ClassifyResult = { rows, aiClassified: 0, source: "rules" };
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  const ambiguous = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.ambiguous).slice(0, MAX_ROWS);
  if (!apiKey || ambiguous.length === 0) return unchanged;

  try {
    const res = await (opts.fetchImpl ?? fetch)("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: opts.model ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
        temperature: 0,
        max_tokens: 1500,
        response_format: RESPONSE_FORMAT,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            // descriptions and amounts only: no dates, no account numbers beyond what the bank printed
            content: JSON.stringify({ rows: ambiguous.map(({ r, i }) => ({ id: i, description: r.description, amount: r.amount })) }),
          },
        ],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS),
    });
    if (!res.ok) return unchanged;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "") as { items?: { id: number; category: Category }[] };
    if (!Array.isArray(parsed.items)) return unchanged;

    const sent = new Set(ambiguous.map(({ i }) => i));
    const next = rows.map((r) => ({ ...r }));
    let applied = 0;
    for (const item of parsed.items) {
      if (!sent.has(item.id) || !["income", "own_transfer", "refund"].includes(item.category)) continue;
      next[item.id].excluded = item.category !== "income";
      applied++;
    }
    return applied ? { rows: next, aiClassified: applied, source: "ai" } : unchanged;
  } catch (e) {
    console.error("Row classification failed; keeping the rules", e instanceof Error ? e.message : e);
    return unchanged;
  }
}
