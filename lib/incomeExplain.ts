import Anthropic from "@anthropic-ai/sdk";
import type { ParsedIncome } from "./parseIncome";

// Optional plain-English explanation of a parsed income summary.
// Uses ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY if set; otherwise returns null.
// Privacy: only aggregates are sent — no payer names, no individual transactions.

const SYSTEM =
  "You explain an income projection to a self-employed US household in 2-3 short sentences of plain English. " +
  "It is an educational estimate, not tax advice: never say 'guaranteed' or 'you will save'. " +
  "Mention how the projection was computed and how reliable it is given the number of months. No markdown.";

function summary(p: ParsedIncome): string {
  const total = p.transactions.reduce((s, t) => s + t.amount, 0);
  const payers = new Set(p.transactions.map((t) => t.payer)).size;
  return JSON.stringify({
    monthsOfData: p.months,
    clientPayments: p.transactions.length,
    distinctPayers: payers,
    totalIncoming: Math.round(total),
    excludedTransfersRefundsInterest: p.excludedCount,
    projectedAnnualIncome: p.projectedAnnualIncome,
    confidence: p.confidence,
  });
}

async function viaAnthropic(p: ParsedIncome): Promise<string | null> {
  const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
  const res = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: `Income summary: ${summary(p)}` }],
  });
  if (res.stop_reason === "refusal") return null;
  const text = res.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join(" ")
    .trim();
  return text || null;
}

async function viaOpenAI(p: ParsedIncome): Promise<string | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Income summary: ${summary(p)}` },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

export async function explainIncome(p: ParsedIncome): Promise<string | null> {
  try {
    if (process.env.ANTHROPIC_API_KEY) return await viaAnthropic(p);
    if (process.env.OPENAI_API_KEY) return await viaOpenAI(p);
  } catch (e) {
    console.error("AI explanation failed; continuing without it", e);
  }
  return null;
}
