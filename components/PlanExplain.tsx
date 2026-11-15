"use client";

import { useEffect, useState } from "react";
import type { Input } from "@/lib/types";

/** "In plain English": a short explanation of the plan from /api/explain (numbers from our engine). */
export function PlanExplain({ input }: { input: Input }) {
  const key = JSON.stringify(input);
  // the result is stored with the input it belongs to, so a new input shows the loader again
  const [state, setState] = useState<{ key: string; text?: string; failed?: boolean }>({ key: "" });

  useEffect(() => {
    let alive = true;
    fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: JSON.parse(key) }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { explanation?: string }) => {
        if (!alive) return;
        setState(d.explanation ? { key, text: d.explanation } : { key, failed: true });
      })
      .catch(() => alive && setState({ key, failed: true }));
    return () => {
      alive = false;
    };
  }, [key]);

  const current = state.key === key ? state : null;
  if (current?.failed) return null;
  const text = current?.text ?? null;
  return (
    <section aria-labelledby="explain-h" aria-busy={text === null} className="enter flex flex-col gap-2 rounded-xl border border-line bg-card px-5 py-4">
      <h2 id="explain-h" className="text-sm font-medium text-ink-3">In plain English</h2>
      {text === null ? (
        <div aria-hidden="true" className="flex flex-col gap-2 py-1">
          <span className="h-3.5 w-11/12 animate-pulse rounded bg-line-strong" />
          <span className="h-3.5 w-10/12 animate-pulse rounded bg-line-strong" />
          <span className="h-3.5 w-7/12 animate-pulse rounded bg-line-strong" />
        </div>
      ) : (
        <p className="max-w-[70ch] leading-relaxed text-ink-2">{text}</p>
      )}
    </section>
  );
}
