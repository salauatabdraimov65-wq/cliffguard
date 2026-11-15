"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Input } from "@/lib/types";
import { calculate } from "@/lib/engine";
import { monitorStatus } from "@/lib/monitor";
import { demoMonthly } from "@/lib/demoMonthly";
import { ArrowRight, Bell } from "./Icons";
import { inputToQuery } from "./inputParams";
import { usd, usdK } from "./format";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const REMINDERS = [
  { date: "Dec 15, 2026", text: "Last day to enroll for coverage that starts Jan 1. Report your planned income." },
  { date: "Jan 15, 2027", text: "Open enrollment ends in most states." },
  { date: "Monthly", text: "Log what came in. We recheck your room under the cliff." },
  { date: "Before you file", text: "Make the retirement contribution, then reconcile your credit on your 2027 return." },
];

const digits = (s: string) => s.replace(/[^\d]/g, "");

export function Monitor({ input, demo }: { input: Input; demo: boolean }) {
  const [months, setMonths] = useState<string[]>(() =>
    MONTHS.map((_, i) => (demo && demoMonthly.monthlyIncomes[i] !== undefined ? String(demoMonthly.monthlyIncomes[i]) : "")),
  );
  const [future, setFuture] = useState(demo ? String(demoMonthly.knownFuture.amount) : "");

  const planned = useMemo(() => {
    if (demo) return demoMonthly.plannedContribution;
    const r = calculate(input);
    return r.feasible ? r.contributionNeeded : 0;
  }, [demo, input]);

  // months so far = January through the last month with a figure (gaps count as $0)
  const last = months.reduce((acc, m, i) => (m !== "" ? i : acc), -1);
  const entries = months.slice(0, last + 1).map((m) => Number(digits(m)) || 0);
  const knownFuture = Number(digits(future)) || 0;

  const status = useMemo(
    () =>
      monitorStatus(entries.length ? entries : [input.income / 12], entries.length ? knownFuture : 0, planned, input),
    // entries is derived from months; stringify keeps the memo honest
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(entries), knownFuture, planned, input],
  );

  const ytd = entries.reduce((a, b) => a + b, 0);
  const under = status.headroom >= 0;
  const fill = Math.min(1, Math.max(0, status.projectedMagi / status.cliff));
  const maxBar = Math.max(...months.map((m) => Number(digits(m)) || 0), 1);

  return (
    <div className="wrap flex flex-col gap-8 py-8 sm:py-12">
      <div className="enter flex flex-col gap-2">
        <p className="eyebrow">{demo ? "Demo family · illustrative months" : "Your household"} · 2027</p>
        <h1 className="text-[34px] font-medium leading-[1.08] tracking-[-0.02em] sm:text-5xl">Room under the cliff</h1>
      </div>

      <section className={`enter-2 rounded-2xl border px-5 py-6 transition-colors duration-300 sm:px-8 sm:py-8 ${under ? "border-safe/25 bg-safe-wash" : "border-loss/25 bg-loss-wash"}`} aria-live="polite">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-1">
            <p className={`text-[17px] font-medium ${under ? "text-safe-ink" : "text-loss-ink"}`}>
              {under ? "At this pace you stay under the cliff" : "At this pace you go over the cliff"}
            </p>
            <p className="text-5xl font-semibold tracking-[-0.03em] num sm:text-6xl">
              {under ? usd(status.headroom) : `−${usd(-status.headroom)}`}
            </p>
            {/* the projection as worksheet lines, so it never breaks mid-equation */}
            <dl className="mt-3 grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-[15px] num">
              <dt className="text-ink-2">Projected income</dt>
              <dd className="text-right">{usd(status.projectedIncome)}</dd>
              {planned > 0 && (
                <>
                  <dt className="text-ink-2">Planned SEP IRA</dt>
                  <dd className="text-right">−{usd(planned)}</dd>
                </>
              )}
              <dt className="border-t border-line-strong pt-1 font-medium">MAGI</dt>
              <dd className="border-t border-line-strong pt-1 text-right font-semibold">{usd(status.projectedMagi)}</dd>
            </dl>
          </div>
          {status.topUp > 0 && (
            <p className="swap-in max-w-sm rounded-xl bg-card px-4 py-3 text-[15px] text-ink-2">
              {status.feasible ? (
                <>
                  Add <span className="font-semibold text-ink num">{usd(status.topUp)}</span> to your SEP IRA to stay under. That still leaves{" "}
                  <span className="num">{usd(status.sepRoomLeft)}</span> of SEP room.
                </>
              ) : (
                <>Your SEP IRA room isn&apos;t enough to cover the {usd(status.topUp)} top-up. Update your Marketplace income to avoid a repayment.</>
              )}
            </p>
          )}
        </div>
        {/* meter: projected MAGI against the cliff */}
        <div className="mt-6" aria-hidden="true">
          <div className="relative h-2 rounded-full bg-card">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ${under ? "bg-safe" : "bg-loss"}`}
              style={{ width: `${fill * 100}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[12px] text-ink-3 num">
            <span>$0</span>
            <span className="text-ink">{usdK(status.cliff)} cliff</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <section aria-labelledby="months-h" className="card enter-3 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="months-h" className="text-[17px] font-medium">Income by month</h2>
            <p className="text-sm text-ink-3 num">
              {entries.length} of 12 months · {usd(ytd)} so far
            </p>
          </div>
          <div className="mt-6 flex h-28 items-end gap-1.5" aria-hidden="true">
            {months.map((m, i) => {
              const v = Number(digits(m)) || 0;
              return (
                <div key={i} className="flex h-full flex-1 items-end justify-center">
                  <span
                    className="w-full max-w-6 rounded-t bg-safe-soft transition-[height] duration-500"
                    style={{ height: v ? `${Math.max(4, (v / maxBar) * 100)}%` : "2px", opacity: v ? 1 : 0.4 }}
                  />
                </div>
              );
            })}
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
                    const d = digits(e.target.value).slice(0, 7);
                    setMonths((arr) => arr.map((x, j) => (j === i ? d : x)));
                  }}
                  placeholder="—"
                />
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5">
            <label htmlFor="future" className="text-[15px] font-medium">
              {demo ? demoMonthly.knownFuture.label : "Signed work still to come this year"}
            </label>
            <div className="relative max-w-60">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">$</span>
              <input
                id="future"
                inputMode="numeric"
                className="field pl-8 text-[17px]"
                value={future ? Number(future).toLocaleString("en-US") : ""}
                onChange={(e) => setFuture(digits(e.target.value).slice(0, 7))}
                placeholder="0"
              />
            </div>
            <p className="text-sm text-ink-3">On top of your usual monthly pace.</p>
          </div>
        </section>

        <aside aria-labelledby="rem-h" className="card enter-3 flex flex-col p-5 sm:p-6">
          <h2 id="rem-h" className="inline-flex items-center gap-2 text-[17px] font-medium">
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
        Projection = income so far + average month × months left + signed work. {demo && "Demo months are illustrative. "}Educational estimate, not tax advice.
      </p>
    </div>
  );
}
