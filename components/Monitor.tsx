"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Input } from "@/lib/types";
import { calculate } from "@/lib/engine";
import { ArrowRight, Bell } from "./Icons";
import { inputToQuery } from "./inputParams";
import { usd, usdK } from "./format";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Example months for the demo family only — labelled as such on screen.
const DEMO_MONTHS = [11200, 9800, 12400, 10900, 11600, 12300];

const REMINDERS = [
  { date: "Dec 15, 2026", text: "Last day to enroll for coverage that starts Jan 1. Report your planned income." },
  { date: "Jan 15, 2027", text: "Open enrollment ends in most states." },
  { date: "Monthly", text: "Log what came in. We recheck your room under the cliff." },
  { date: "Before you file", text: "Make the retirement contribution, then reconcile your credit on your 2027 return." },
];

export function Monitor({ input, demo }: { input: Input; demo: boolean }) {
  const [months, setMonths] = useState<string[]>(() =>
    MONTHS.map((_, i) => (demo && DEMO_MONTHS[i] !== undefined ? String(DEMO_MONTHS[i]) : "")),
  );

  const logged = months.map((m) => Number(m.replace(/[^\d]/g, "")) || 0);
  const count = months.filter((m) => m !== "").length;
  const sum = logged.reduce((a, b) => a + b, 0);
  const projected = count > 0 ? Math.round((sum / count) * 12) : input.income;

  const planned = useMemo(() => calculate(input), [input]);
  const plannedContribution = planned.feasible ? planned.contributionNeeded : 0;
  const now = useMemo(
    () => calculate({ ...input, income: projected, netSelfEmploymentIncome: Math.round(projected * Math.min(1, input.netSelfEmploymentIncome / Math.max(1, input.income))) }),
    [input, projected],
  );
  const magi = projected - plannedContribution;
  const room = now.cliff - magi;
  const extra = room < 0 && now.feasible ? Math.max(0, now.contributionNeeded - plannedContribution) : 0;
  const fill = Math.min(1, magi / now.cliff);
  const maxBar = Math.max(...logged, 1);

  return (
    <div className="wrap flex flex-col gap-8 py-8 sm:py-12">
      <div className="enter flex flex-col gap-2">
        <p className="eyebrow">{demo ? "Demo family · example months" : "Your household"} · 2027</p>
        <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-5xl">Room under the cliff</h1>
      </div>

      <section className={`enter-2 rounded-2xl border px-5 py-6 sm:px-8 sm:py-8 ${room >= 0 ? "border-safe/25 bg-safe-wash" : "border-loss/25 bg-loss-wash"}`} aria-live="polite">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-1">
            <p className={`text-[17px] font-medium ${room >= 0 ? "text-safe-ink" : "text-loss-ink"}`}>
              {room >= 0 ? "At this pace you stay under the cliff" : "At this pace you go over the cliff"}
            </p>
            <p className="text-5xl font-semibold tracking-[-0.03em] num sm:text-6xl">
              {room >= 0 ? usd(room) : `−${usd(-room)}`}
            </p>
            <p className="text-[15px] text-ink-2 num">
              Projected {usd(projected)}
              {plannedContribution > 0 && ` − ${usd(plannedContribution)} planned contribution`} = {usd(magi)} MAGI
            </p>
          </div>
          {extra > 0 && (
            <p className="max-w-sm rounded-xl bg-card px-4 py-3 text-[15px] text-ink-2">
              Raise your contribution by <span className="font-semibold text-ink num">{usd(extra)}</span> to stay under — or update
              your Marketplace income.
            </p>
          )}
        </div>
        {/* meter: projected MAGI against the cliff */}
        <div className="mt-6" aria-hidden="true">
          <div className="relative h-2 rounded-full bg-card">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ${room >= 0 ? "bg-safe" : "bg-loss"}`}
              style={{ width: `${fill * 100}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[12px] text-ink-3 num">
            <span>$0</span>
            <span className="text-ink">{usdK(now.cliff)} cliff</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <section aria-labelledby="months-h" className="card enter-3 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="months-h" className="text-[17px] font-semibold">Income by month</h2>
            <p className="text-sm text-ink-3 num">{count} of 12 logged · {usd(sum)} so far</p>
          </div>
          {/* mini columns: what came in, month by month */}
          <div className="mt-6 flex h-28 items-end gap-1.5" aria-hidden="true">
            {logged.map((v, i) => (
              <div key={i} className="flex h-full flex-1 items-end justify-center">
                <span
                  className="w-full max-w-6 rounded-t bg-safe-soft transition-[height] duration-300"
                  style={{ height: v ? `${Math.max(4, (v / maxBar) * 100)}%` : "2px", opacity: v ? 1 : 0.4 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {MONTHS.map((m, i) => (
              <div key={m} className="flex flex-col gap-1">
                <label htmlFor={`m-${i}`} className="font-mono text-[12px] text-ink-3">{m}</label>
                <input
                  id={`m-${i}`}
                  inputMode="numeric"
                  className="field min-h-11 px-2.5 text-[15px]"
                  value={months[i] ? Number(months[i]).toLocaleString("en-US") : ""}
                  onChange={(e) => {
                    const d = e.target.value.replace(/[^\d]/g, "").slice(0, 7);
                    setMonths((arr) => arr.map((x, j) => (j === i ? d : x)));
                  }}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
        </section>

        <aside aria-labelledby="rem-h" className="card enter-3 flex flex-col p-5 sm:p-6">
          <h2 id="rem-h" className="inline-flex items-center gap-2 text-[17px] font-semibold">
            <Bell className="text-ink-3" /> Reminders
          </h2>
          <ol className="mt-3 flex flex-col">
            {REMINDERS.map((r) => (
              <li key={r.date} className="flex flex-col gap-1 border-b border-line py-3 last:border-0">
                <span className="font-mono text-[12px] text-ink-3">{r.date}</span>
                <span className="text-[15px] text-ink-2">{r.text}</span>
              </li>
            ))}
          </ol>
          <Link href={`/plan?${demo ? "demo=1&" : ""}${inputToQuery(input)}&paid=1`} className="btn btn-secondary mt-auto">
            Back to my plan <ArrowRight />
          </Link>
        </aside>
      </div>

      <p className="max-w-[70ch] text-[13px] leading-relaxed text-ink-3">
        Projection = average logged month × 12. Educational estimate, not tax advice.
      </p>
    </div>
  );
}
