"use client";

import { useState } from "react";
import type { Input, Result } from "@/lib/types";
import { ArrowRight } from "./Icons";
import { usd } from "./format";

type Scenario = { input: Input; result: Result };
type Answer = { answer: string; scenario?: Scenario; source?: "ai" | "rules" };

const SUGGESTIONS = ["What if I earn $8,000 more?", "What if I pick a bronze plan?", "What if we have another child?"];

/** "Ask CliffGuard": what-if questions. Every number comes from our engine via /api/ask. */
export function AskCliffGuard({ input }: { input: Input }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Answer | null>(null);
  const [error, setError] = useState("");

  async function ask(q: string) {
    const text = q.trim();
    if (!text || busy) return;
    setQuestion(text);
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, question: text }),
      });
      const data = (await r.json()) as Answer & { error?: string };
      if (!r.ok) throw new Error(data.error ?? "Something went wrong.");
      setReply(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
    setBusy(false);
  }

  const s = reply?.scenario?.result;

  return (
    <section aria-labelledby="ask-h" className="card flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="ask-h" className="text-[17px] font-medium">Ask CliffGuard</h2>
        <p className="text-sm text-ink-3">Try a what-if. Every number comes from the same calculator as above.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor="ask-q" className="sr-only">Your question</label>
        <input
          id="ask-q"
          className="field flex-1"
          value={question}
          maxLength={500}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What if I earn $8,000 more?"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !question.trim()}>
          {busy ? "Thinking…" : "Ask"}
          {!busy && <ArrowRight />}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((q) => (
          <button key={q} type="button" onClick={() => ask(q)} disabled={busy} className="btn btn-secondary btn-sm min-h-11">
            {q}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-loss-ink">
          {error}
        </p>
      )}

      {reply && (
        <div aria-live="polite" className="flex flex-col gap-3 rounded-xl border border-line bg-raised px-4 py-3">
          {reply.source === "ai" && (
            <span className="w-fit rounded-md bg-card px-2 py-0.5 font-mono text-[12px] text-ink-3">AI · numbers from our calculator</span>
          )}
          <p className="leading-relaxed text-ink-2">{reply.answer}</p>
          {s && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-ink-3">Income</dt>
                <dd className="font-semibold num">{usd(s.magi)}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Credit now</dt>
                <dd className="font-semibold num">{usd(s.subsidy)}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Put aside</dt>
                <dd className="font-semibold num">
                  {s.feasible ? usd(s.contributionNeeded) : <span className="text-ink-3">Not enough room</span>}
                </dd>
              </div>
              <div>
                <dt className="text-ink-3">Credit after plan</dt>
                <dd className="font-semibold text-safe-ink num">{usd(s.subsidyAfterPlan)}</dd>
              </div>
            </dl>
          )}
        </div>
      )}
    </section>
  );
}
