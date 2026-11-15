"use client";

import { useRef, useState } from "react";
import { usd } from "./format";

type Parsed = {
  transactions: { date: string; amount: number; payer: string }[];
  projectedAnnualIncome: number;
  confidence: "low" | "medium" | "high";
  months: number;
  excludedCount: number;
  aiClassified?: number;
  explanation?: string;
};

/**
 * Optional bank-CSV upload for quiz step 3. POST /api/parse-income parses it
 * deterministically (nothing stored) and projects annual income; we pre-fill
 * the income field with that projection.
 */
export function IncomeUpload({ onIncome }: { onIncome: (annual: number) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Parsed | null>(null);

  async function send(csv: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/parse-income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = (await r.json()) as Parsed & { error?: string };
      if (!r.ok) throw new Error(data.error ?? "We couldn't read that file.");
      setResult(data);
      onIncome(data.projectedAnnualIncome);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "We couldn't read that file.");
    }
    setBusy(false);
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 1_000_000) {
      setError("That file is over 1 MB. Export a shorter date range.");
      return;
    }
    send(await f.text());
  }

  async function sample() {
    const r = await fetch("/demo-bank.csv");
    send(await r.text());
  }

  const total = result?.transactions.reduce((s, t) => s + t.amount, 0) ?? 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-line-strong p-4">
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-medium">Upload invoices or a bank CSV</p>
        <p className="text-sm text-ink-3">Optional. We keep client payments, skip transfers and refunds, and store nothing. Unclear rows may be checked by AI.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" id="csv" onChange={(e) => onFile(e.target.files?.[0])} />
        <label htmlFor="csv" className="btn btn-secondary btn-sm min-h-11 cursor-pointer">
          {busy ? "Reading…" : "Choose a CSV file"}
        </label>
        <button type="button" onClick={sample} disabled={busy} className="btn btn-sm min-h-11 text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
          Try the sample file
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-loss-ink">
          {error}
        </p>
      )}
      {result && (
        <div className="swap-in flex flex-col gap-1 rounded-lg bg-safe-wash px-3 py-2.5 text-sm" role="status">
          <p className="text-ink">
            <span className="font-medium num">{result.transactions.length}</span> client payments over{" "}
            <span className="num">{result.months}</span> months · <span className="num">{usd(total)}</span> →{" "}
            <span className="font-semibold text-safe-ink num">{usd(result.projectedAnnualIncome)}/yr</span>
          </p>
          <p className="text-ink-3">
            Confidence: {result.confidence}
            {result.excludedCount > 0 && ` · ${result.excludedCount} transfers or refunds skipped`}
            {!!result.aiClassified && ` · ${result.aiClassified} unclear rows checked by AI`}. We filled in the projection — adjust it if you
            expect a change.
          </p>
          {result.explanation && <p className="text-ink-2">{result.explanation}</p>}
        </div>
      )}
    </div>
  );
}
