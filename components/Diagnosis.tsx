"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Input, PlanStep } from "@/lib/types";
import { calculate } from "@/lib/engine";
import { CliffChart, chartRange } from "./CliffChart";
import { ArrowRight, Check, Info, Undo } from "./Icons";
import { inputToQuery } from "./inputParams";
import { stateName } from "./zipToState";
import { usd } from "./format";
import { useTween } from "./useTween";

const ACCOUNT: Record<PlanStep["account"], string> = {
  SEP_IRA: "SEP IRA",
  SOLO_401K: "Solo 401(k)",
  HSA: "HSA",
  MARKETPLACE_UPDATE: "Marketplace update",
};

function planLabel(plan: PlanStep[]) {
  return plan
    .filter((s) => s.amount > 0)
    .map((s) => `${usd(s.amount)} → ${ACCOUNT[s.account]}`)
    .join(" + ");
}

export function Diagnosis({ input, demo }: { input: Input; demo: boolean }) {
  const { min, max } = chartRange(calculate(input).cliff);
  const sliderMin = Math.min(min, Math.floor(input.income / 500) * 500);
  const sliderMax = Math.max(max, Math.ceil(input.income / 500) * 500);

  const [income, setIncome] = useState(input.income);
  const [applied, setApplied] = useState(false);
  const [glide, setGlide] = useState(false);
  const glideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // keep the self-employed share of income constant while the slider moves
  const seShare = input.income > 0 ? Math.min(1, input.netSelfEmploymentIncome / input.income) : 1;
  const live: Input = useMemo(
    () => ({ ...input, income, netSelfEmploymentIncome: Math.round(income * seShare) }),
    [input, income, seShare],
  );
  const res = useMemo(() => calculate(live), [live]);

  // over the cliff: rescue; under it but inside the cushion for uneven or lumpy income: a cushion
  const canRescue = res.feasible && res.contributionNeeded > 0 && (res.overBy > 0 ? res.loss > 0 : true);
  const cushionOnly = canRescue && res.overBy <= 0;
  const rescued = applied && canRescue;
  const magi = rescued ? res.magiAfterPlan : res.magi;
  const subsidy = rescued ? res.subsidyAfterPlan : res.subsidy;
  const contribution = rescued ? res.contributionNeeded : 0;
  const state: "rescued" | "over" | "under" = rescued ? "rescued" : res.overBy > 0 ? "over" : "under";

  const shownSubsidy = useTween(subsidy, glide);
  const shownMagi = useTween(magi, glide);

  useEffect(() => {
    try {
      sessionStorage.setItem("cg:last", inputToQuery(live));
    } catch {
      /* storage can be unavailable; the URL still carries everything */
    }
  }, [live]);

  const toggle = (next: boolean) => {
    setApplied(next);
    setGlide(true);
    clearTimeout(glideTimer.current);
    glideTimer.current = setTimeout(() => setGlide(false), 650);
  };

  const cliffAt = ((res.cliff - sliderMin) / (sliderMax - sliderMin)) * 100;
  const planHref = `/plan?${demo ? "demo=1&" : ""}${inputToQuery(live)}`;
  const who = demo
    ? "Demo family · Mike & Jess, 2 kids · Austin, TX"
    : `Your household · ${input.householdSize} ${input.householdSize === 1 ? "person" : "people"} · ${stateName(input.state)}`;

  return (
    <div className="wrap flex flex-col gap-6 py-8 sm:gap-8 sm:py-12">
      <div className="enter flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">{who}</p>
        <Link href="/quiz" className="inline-flex min-h-11 items-center text-sm text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink">
          {demo ? "Use my own numbers" : "Edit my answers"}
        </Link>
      </div>

      {/* Banner: the verdict */}
      <section
        aria-live="polite"
        className={`enter-2 rounded-2xl border px-5 py-6 transition-colors duration-200 sm:px-8 sm:py-8 ${
          state === "over" ? "border-loss/25 bg-loss-wash" : "border-safe/25 bg-safe-wash"
        }`}
      >
        <div key={state} className="swap-in flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            {state === "over" && (
              <>
                <p className="text-[17px] font-medium text-loss-ink num">You&apos;re {usd(res.overBy)} over the subsidy cliff</p>
                <h1 className="text-[34px] font-medium leading-[1.08] tracking-[-0.02em] sm:text-5xl">
                  You&apos;re losing <span className="text-loss-ink">{usd(res.loss)}</span> a year
                </h1>
              </>
            )}
            {state === "under" && (
              <>
                <p className="text-[17px] font-medium text-safe-ink num">You are {usd(res.cliff - res.magi)} under the cliff</p>
                <h1 className="text-[34px] font-medium leading-[1.08] tracking-[-0.02em] sm:text-5xl">
                  You keep <span className="text-safe-ink">{usd(res.subsidy)}</span> a year
                </h1>
              </>
            )}
            {state === "rescued" && (
              <>
                <p className="inline-flex items-center gap-2 text-[17px] font-medium text-safe-ink">
                  <Check size={18} className="shrink-0" />
                  {cushionOnly
                    ? `Plan applied: a ${usd(res.cliff - res.magiAfterPlan)} cushion under the cliff`
                    : "Plan applied: you're back under the cliff"}
                </p>
                <h1 className="text-[34px] font-medium leading-[1.08] tracking-[-0.02em] sm:text-5xl">
                  You keep <span className="text-safe-ink num">{usd(shownSubsidy)}</span> a year
                </h1>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            {state === "over" && canRescue && (
              // the amount never splits: on a phone it drops to its own line as one unit
              <button
                type="button"
                onClick={() => toggle(true)}
                className="btn btn-dark w-full justify-between whitespace-normal py-3 text-left sm:w-auto sm:justify-center"
              >
                <span className="flex flex-col gap-0.5 sm:flex-row sm:gap-1.5">
                  <span>Apply rescue plan:</span>
                  <span className="whitespace-nowrap font-mono text-[15px] opacity-90 sm:font-sans sm:text-[16px] sm:opacity-100">{planLabel(res.plan)}</span>
                </span>
                <ArrowRight className="shrink-0" />
              </button>
            )}
            {state === "under" && cushionOnly && (
              <button type="button" onClick={() => toggle(true)} className="btn btn-secondary w-full justify-between whitespace-normal text-left sm:w-auto sm:justify-center">
                <span className="flex flex-col gap-0.5 sm:flex-row sm:gap-1.5">
                  <span>Add a cushion:</span>
                  <span className="whitespace-nowrap">{planLabel(res.plan)}</span>
                </span>
                <ArrowRight className="shrink-0" />
              </button>
            )}
            {state === "rescued" && (
              <button type="button" onClick={() => toggle(false)} className="btn btn-secondary w-full sm:w-auto">
                <Undo /> Undo plan
              </button>
            )}
            {state === "over" && !canRescue && (
              <p className="max-w-sm text-sm text-ink-2">
                {res.warnings[0] ?? "Crossing the cliff costs you little at this benchmark price."}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Chart + worksheet */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <section aria-labelledby="chart-h" className="card enter-3 p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="chart-h" className="text-[17px] font-medium">Your premium tax credit, by income</h2>
            <p className="text-sm text-ink-3">2027 coverage · per year</p>
          </div>

          <CliffChart
            householdSize={input.householdSize}
            benchmark={input.benchmarkPremium}
            planPrice={input.actualPlanPremium}
            cliff={res.cliff}
            income={income}
            magi={magi}
            contribution={contribution}
            contributionLabel={contribution ? `−${usd(contribution)} to retirement` : undefined}
            glide={glide}
            controls={
          <div className="mt-4 border-t border-line pt-4">
            {/* phone: label above the figure, never squeezed beside it */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <label htmlFor="income" className="text-[15px] font-medium text-ink-2 sm:text-ink">
                Expected 2027 household income
              </label>
              <output htmlFor="income" className="text-2xl font-semibold tracking-[-0.01em] num sm:text-xl">
                {usd(income)}
              </output>
            </div>
            <input
              id="income"
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={500}
              value={income}
              onChange={(e) => setIncome(Number(e.target.value))}
              className="range mt-2"
              style={{ ["--cliff-at" as string]: `${cliffAt}%` }}
              aria-valuetext={`${usd(income)}, ${income > res.cliff ? "over" : "under"} the ${usd(res.cliff)} cliff`}
            />
            <div className="flex justify-between text-[12px] text-ink-3 font-mono num">
              <span>{usd(sliderMin)}</span>
              <span>{usd(sliderMax)}</span>
            </div>
          </div>
            }
          />
        </section>

        <aside aria-labelledby="math-h" className="card enter-3 flex flex-col p-5 sm:p-6 lg:self-start">
          <h2 id="math-h" className="text-[17px] font-medium">The math</h2>
          <dl className="mt-4 flex flex-col">
            {[
              { n: "1", k: "Income", v: usd(income) },
              { n: "2", k: "Retirement contribution", v: contribution ? `−${usd(contribution)}` : "$0" },
              { n: "3", k: "MAGI", v: usd(shownMagi), strong: true },
              { n: "4", k: "Cliff (400% FPL)", sub: `for ${input.householdSize} ${input.householdSize === 1 ? "person" : "people"}`, v: usd(res.cliff) },
            ].map((r) => (
              <div key={r.n} className="flex items-baseline gap-3 border-b border-line py-3">
                <dt className="flex min-w-0 flex-1 items-baseline gap-3 text-[15px] text-ink-2">
                  <span className="line-no w-4 shrink-0">{r.n}</span>
                  <span className="min-w-0">
                    {r.k}
                    {"sub" in r && r.sub && <span className="block text-[13px] text-ink-3">{r.sub}</span>}
                  </span>
                </dt>
                <dd className={`shrink-0 text-[15px] num ${r.strong ? "font-semibold text-ink" : "text-ink"}`}>{r.v}</dd>
              </div>
            ))}
            <div className="flex items-baseline gap-3 py-4">
              <dt className="flex flex-1 items-baseline gap-3 text-[15px] font-medium">
                <span className="line-no w-4">5</span>
                Your subsidy
              </dt>
              <dd className={`text-2xl font-semibold num ${magi > res.cliff ? "text-loss-ink" : "text-safe-ink"}`}>
                {usd(magi > res.cliff ? 0 : shownSubsidy)}
              </dd>
            </div>
          </dl>

          {rescued && res.estTaxSavings > 0 && (
            <p className="swap-in rounded-xl bg-raised px-4 py-3 text-sm text-ink-2">
              The contribution also lowers federal income tax by about{" "}
              <span className="font-medium text-ink num">{usd(res.estTaxSavings)}</span> (estimate at a 22% bracket).
            </p>
          )}

          <div className="flex flex-col gap-3 pt-6">
            <Link href={planHref} className="btn btn-primary w-full">
              See my full plan
              <ArrowRight />
            </Link>
            <p className="text-center text-[13px] text-ink-3">First step free · no sign-up</p>
          </div>
        </aside>
      </div>

      {/* engine warnings (state rules, Medicaid range, …); the one already in the banner is not repeated */}
      {(() => {
        const shown = state === "over" && !canRescue ? res.warnings[0] : undefined;
        const rest = res.warnings.filter((w) => w !== shown);
        return rest.length > 0 ? (
          <ul className="flex flex-col gap-2 rounded-xl border border-line bg-card px-4 py-3 text-[15px] text-ink-2">
            {rest.map((w) => (
              <li key={w} className="flex gap-2.5">
                <Info className="mt-0.5 shrink-0 text-ink-3" />
                {w}
              </li>
            ))}
          </ul>
        ) : null;
      })()}

      <p className="max-w-[70ch] text-[13px] leading-relaxed text-ink-3">
        Estimate for illustration using IRS Rev. Proc. 2026-26 and 2026 poverty guidelines. Not tax advice.
      </p>
    </div>
  );
}
