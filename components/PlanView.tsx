"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { Input, PlanStep } from "@/lib/types";
import { calculate } from "@/lib/engine";
import { demoFamily } from "@/lib/demoFamily";
import { ArrowRight, Bell, Calendar, Check, Lock } from "./Icons";
import { inputToQuery, queryToInput } from "./inputParams";
import { PlanExplain } from "./PlanExplain";
import { usd } from "./format";

const TITLE: Record<PlanStep["account"], string> = {
  MARKETPLACE_UPDATE: "Update your Marketplace application",
  SEP_IRA: "Contribute to a SEP IRA",
  SOLO_401K: "Contribute to a Solo 401(k)",
  HSA: "Contribute to an HSA",
};

const PRO_EXTRAS = [
  { icon: Calendar, title: "Room-under-the-cliff tracker", body: "Log income as it comes in and see how much room is left before the cliff." },
  { icon: Bell, title: "Reminders that matter", body: "December, before you report income, and again before you file." },
];

type Props = { input: Input | null; demo: boolean; paid: boolean; canceled: boolean };

// Back from Stripe the URL has no household; the last one lives in this tab's sessionStorage.
const noop = () => () => {};
function readLast(): string {
  try {
    return sessionStorage.getItem("cg:last") ?? "";
  } catch {
    return "";
  }
}

export function PlanView({ input: initial, demo, paid, canceled }: Props) {
  const stored = useSyncExternalStore(noop, readLast, () => null);
  const input = useMemo<Input | null>(() => {
    if (initial) return initial;
    if (stored === null) return null; // server render: wait for the client
    return (stored && queryToInput(Object.fromEntries(new URLSearchParams(stored)))) || demoFamily;
  }, [initial, stored]);
  const [unlocked, setUnlocked] = useState(paid);
  const [interval, setBilling] = useState<"year" | "month">("year");
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState("");

  const res = useMemo(() => (input ? calculate(input) : null), [input]);
  if (!input || !res) return <div className="wrap py-24" aria-busy="true" />;

  const rescue = res.overBy > 0 && res.loss > 0 && res.feasible && res.contributionNeeded > 0;
  const steps = res.plan;

  async function checkout() {
    setBusy(true);
    setPayError("");
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = (await r.json()) as { url?: string; error?: string };
      if (r.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setPayError(r.status === 503 ? "Payments are not switched on for this deployment yet." : data.error ?? "Checkout could not start.");
    } catch {
      setPayError("Checkout could not start. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <div className="wrap flex flex-col gap-8 py-8 sm:py-12">
      <div className="enter flex flex-col gap-4">
        <Link
          href={`/diagnosis?${demo ? "demo=1" : inputToQuery(input)}`}
          className="inline-flex min-h-11 w-fit items-center text-sm text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink"
        >
          Back to my diagnosis
        </Link>
        <p className="eyebrow">{demo ? "Demo family · Mike & Jess" : "Your household"} · 2027 coverage</p>
        <h1 className="text-[34px] font-medium leading-[1.08] tracking-[-0.02em] sm:text-5xl">
          {rescue ? "Your rescue plan" : res.overBy > 0 ? "Your options" : "Stay under the cliff"}
        </h1>
        <p className="max-w-[60ch] text-lg leading-relaxed text-ink-2">
          {rescue ? (
            <>
              Put <span className="font-medium text-ink num">{usd(res.contributionNeeded)}</span> into retirement or health
              savings, report <span className="font-medium text-ink num">{usd(res.magiAfterPlan)}</span> as your income, and
              keep an estimated <span className="font-medium text-safe-ink num">{usd(res.subsidyAfterPlan)}</span> a year in
              premium tax credit.
            </>
          ) : res.overBy > 0 ? (
            res.warnings[0] ?? "Crossing the cliff costs you little at this benchmark price."
          ) : (
            <>
              You are <span className="font-medium text-ink num">{usd(res.cliff - res.magi)}</span> under the cliff. The plan is
              to stay there as your income comes in.
            </>
          )}
        </p>
      </div>

      <PlanExplain input={input} />

      <dl className="enter flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-line bg-card px-5 py-4">
        <div className="flex flex-col">
          <dt className="text-sm text-ink-3">You pay for your plan now</dt>
          <dd className="text-xl font-semibold num">
            {usd(res.premiumYouPay / 12)}<span className="text-sm font-normal text-ink-3"> /mo</span>
          </dd>
        </div>
        {rescue && (
          <div className="flex flex-col">
            <dt className="text-sm text-ink-3">After the plan</dt>
            <dd className="text-xl font-semibold text-safe-ink num">
              {usd(res.premiumYouPayAfterPlan / 12)}<span className="text-sm font-normal text-ink-3"> /mo</span>
            </dd>
          </div>
        )}
        <p className="basis-full text-[13px] text-ink-3">
          {input.actualPlanPremium !== undefined ? "Your plan" : "Benchmark plan"}: {usd((input.actualPlanPremium ?? input.benchmarkPremium) / 12)}/mo before the credit. Estimate.
        </p>
      </dl>

      {canceled && !unlocked && (
        <p className="rounded-xl border border-line bg-card px-4 py-3 text-sm text-ink-2">Checkout canceled. Your first step is still here.</p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        {/* steps */}
        <ol className="enter-2 flex flex-col gap-3">
          {steps.map((s, i) => {
            const locked = i > 0 && !unlocked;
            return (
              <li key={`${s.account}-${i}`} className="card relative overflow-hidden p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <span className="line-no mt-1 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h2 className="text-lg font-medium">{TITLE[s.account]}</h2>
                      {locked ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-raised px-2 py-1 font-mono text-[12px] text-ink-2">
                          <Lock size={16} /> Pro
                        </span>
                      ) : (
                        s.amount > 0 && <span className="text-xl font-semibold num">{usd(s.amount)}</span>
                      )}
                    </div>
                    {locked ? (
                      // placeholder bars, not the real figures: nothing to read from the page source
                      <div aria-hidden="true" className="flex flex-col gap-2 py-1 blur-[3px]">
                        <span className="h-3.5 w-11/12 rounded bg-line-strong" />
                        <span className="h-3.5 w-2/3 rounded bg-line-strong" />
                      </div>
                    ) : (
                      <>
                        <p className="leading-relaxed text-ink-2">{s.note}</p>
                        <p className="inline-flex items-center gap-2 text-sm text-ink-3">
                          <Calendar size={16} /> {s.deadline.charAt(0).toUpperCase() + s.deadline.slice(1)}
                        </p>
                      </>
                    )}
                    {locked && <p className="sr-only">This step is part of CliffGuard Pro.</p>}
                  </div>
                </div>
              </li>
            );
          })}

          {PRO_EXTRAS.map((x) => (
            <li key={x.title} className={`flex items-start gap-4 rounded-2xl border border-dashed border-line-strong p-5 sm:p-6 ${unlocked ? "" : "opacity-80"}`}>
              <x.icon className="mt-0.5 shrink-0 text-ink-3" />
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-medium">{x.title}</h2>
                  {!unlocked && <span className="font-mono text-[12px] text-ink-3">Pro</span>}
                </div>
                <p className="text-[15px] text-ink-2">{x.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* summary + paywall */}
        <aside className="enter-3 flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          {rescue && (
            <div className="card p-5 sm:p-6">
              <h2 className="text-[17px] font-medium">What the plan is worth</h2>
              <dl className="mt-3 flex flex-col">
                {[
                  { k: "Subsidy back", v: usd(res.subsidyAfterPlan - res.subsidy) },
                  { k: "Federal tax, estimate at 22%", v: usd(res.estTaxSavings) },
                ].map((r) => (
                  <div key={r.k} className="flex items-baseline justify-between gap-3 border-b border-line py-3">
                    <dt className="text-[15px] text-ink-2">{r.k}</dt>
                    <dd className="text-[15px] num">{r.v}</dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-3 pt-4">
                  <dt className="font-medium">Net benefit, per year</dt>
                  <dd className="text-2xl font-semibold text-safe-ink num">{usd(res.netBenefit)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[13px] text-ink-3">The contribution stays your money, in your own account.</p>
            </div>
          )}

          {unlocked ? (
            <div className="swap-in card flex flex-col gap-4 p-5 sm:p-6">
              <p className="inline-flex items-center gap-2 font-semibold text-safe-ink">
                <Check /> {paid ? "Pro is active" : "Pro preview"}
              </p>
              <p className="text-[15px] text-ink-2">Every step is open. Track your income through the year so you stay under the cliff.</p>
              <Link href={`/monitor?${demo ? "demo=1" : inputToQuery(input)}`} className="btn btn-primary">
                Open my tracker <ArrowRight />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-5 rounded-2xl bg-ink p-5 text-on-ink shadow-lg sm:p-6">
              <div>
                <h2 className="text-[17px] font-medium">Get the full plan</h2>
                <p className="mt-1 text-[15px] opacity-75">Amounts, deadlines and a watch on your income all year.</p>
              </div>
              <div role="radiogroup" aria-label="Billing" className="grid grid-cols-2 gap-1 rounded-xl bg-on-ink/10 p-1">
                {([
                  ["year", "$99", "per year"],
                  ["month", "$12.99", "per month"],
                ] as const).map(([v, price, per]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={interval === v}
                    onClick={() => setBilling(v)}
                    className={`flex min-h-14 flex-col items-center justify-center rounded-lg transition-colors duration-150 ${interval === v ? "bg-on-ink text-ink" : "text-on-ink/80 hover:text-on-ink"}`}
                  >
                    <span className="text-lg font-semibold num">{price}</span>
                    <span className="text-[12px] opacity-75">{per}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={checkout} disabled={busy} className="btn bg-accent text-on-accent hover:bg-accent-hover" style={{ boxShadow: "var(--btn-highlight)" }}>
                {busy ? "Opening checkout…" : `Get Pro — ${interval === "year" ? "$99/year" : "$12.99/month"}`}
              </button>
              {payError && (
                <div className="swap-in flex flex-col gap-2 text-sm" role="alert">
                  <p className="opacity-85">{payError}</p>
                  <button type="button" onClick={() => setUnlocked(true)} className="btn btn-sm w-fit border border-on-ink/30 text-on-ink hover:bg-on-ink/10">
                    Preview Pro instead
                  </button>
                </div>
              )}
              <p className="text-[12px] leading-relaxed opacity-60">
                Secure checkout by Stripe (test mode). We never move your money or open accounts for you.
              </p>
            </div>
          )}
        </aside>
      </div>

      <p className="max-w-[70ch] text-[13px] leading-relaxed text-ink-3">
        Educational estimate, not tax advice. Contribution limits and deductibility depend on your full tax picture — confirm
        with a tax professional before you contribute.
      </p>
    </div>
  );
}
