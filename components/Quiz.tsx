"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Input } from "@/lib/types";
import { ArrowLeft, ArrowRight, ExternalLink, Minus, Plus } from "./Icons";
import { IncomeUpload } from "./IncomeUpload";
import { inputToQuery } from "./inputParams";
import { STATES, UNSUPPORTED, stateName, zipToState } from "./zipToState";
import { usd } from "./format";

type Earn = "freelance" | "business" | "mix";
type Steady = "steady" | "uneven" | "lumpy";

// Illustrative only, labelled as such in the UI: $500 per person per month.
const ESTIMATE_PER_PERSON_MONTH = 500;

const digits = (s: string) => s.replace(/[^\d]/g, "");
const money = (s: string) => {
  const d = digits(s);
  return d ? Number(d).toLocaleString("en-US") : "";
};
const toNum = (s: string) => Number(digits(s) || 0);

const TOTAL = 5;

export function Quiz() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [zip, setZip] = useState("");
  const [state, setState] = useState("");
  const [size, setSize] = useState(2);
  const [ages, setAges] = useState<string[]>(["", ""]);
  const [income, setIncome] = useState("");
  const [steady, setSteady] = useState<Steady>("uneven");
  const [earn, setEarn] = useState<Earn>("freelance");
  const [seIncome, setSeIncome] = useState("");
  const [premium, setPremium] = useState("");
  const [hsa, setHsa] = useState(false);
  const [error, setError] = useState("");
  const headRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headRef.current?.focus();
  }, [step]);

  const onZip = (v: string) => {
    const z = digits(v).slice(0, 5);
    setZip(z);
    setError("");
    const s = zipToState(z);
    if (s) setState(s);
  };

  const resize = (n: number) => {
    const next = Math.min(8, Math.max(1, n));
    setSize(next);
    setAges((a) => Array.from({ length: next }, (_, i) => a[i] ?? ""));
  };

  function validate(): string {
    if (step === 1) {
      if (zip.length !== 5) return "Enter a 5-digit ZIP code.";
      if (!state) return "Pick your state.";
      if (UNSUPPORTED.has(state)) return `${stateName(state)} is not supported yet — Alaska and Hawaii use their own poverty tables.`;
    }
    if (step === 2) {
      const bad = ages.findIndex((a) => a === "" || Number(a) > 120);
      if (bad >= 0) return `Enter an age for person ${bad + 1}.`;
    }
    if (step === 3 && toNum(income) < 1000) return "Enter your expected 2027 household income.";
    if (step === 4 && earn === "mix" && (toNum(seIncome) <= 0 || toNum(seIncome) > toNum(income))) {
      return "Enter the self-employment part — it can't be more than your total income.";
    }
    if (step === 5 && toNum(premium) < 50) return "Enter the monthly price, or use the estimate.";
    return "";
  }

  function finish(monthly: number) {
    const inc = toNum(income);
    const input: Input = {
      householdSize: size,
      state,
      zip,
      ages: ages.map((a) => Number(a)),
      income: inc,
      netSelfEmploymentIncome: earn === "mix" ? toNum(seIncome) : inc,
      benchmarkPremium: monthly * 12,
      hsaEligible: hsa,
      coverageYear: 2027,
    };
    router.push(`/diagnosis?${inputToQuery(input)}`);
  }

  function next(e?: React.FormEvent) {
    e?.preventDefault();
    const msg = validate();
    if (msg) {
      setError(msg);
      return;
    }
    setError("");
    if (step < TOTAL) setStep(step + 1);
    else finish(toNum(premium));
  }

  const back = () => {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  };

  const errId = "quiz-error";
  const errProps = error ? { "aria-invalid": true, "aria-describedby": errId } : {};

  return (
    <div className="wrap flex max-w-2xl flex-col gap-8 py-8 sm:py-14">
      {/* progress */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="eyebrow num">
            Step {step} of {TOTAL}
          </p>
          <Link href="/diagnosis?demo=1" className="inline-flex min-h-11 items-center text-sm text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
            Skip — try demo family
          </Link>
        </div>
        <div className="grid grid-cols-5 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={step} aria-label="Quiz progress">
          {Array.from({ length: TOTAL }, (_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-colors duration-300 ${i < step ? "bg-accent" : "bg-line-strong"}`}
            />
          ))}
        </div>
      </div>

      <form key={step} onSubmit={next} noValidate className="swap-in flex flex-col gap-8">
        {step === 1 && (
          <fieldset className="flex flex-col gap-6">
            <legend className="contents">
              <h1 ref={headRef} tabIndex={-1} className="text-3xl font-semibold tracking-[-0.02em] outline-none sm:text-4xl">
                What&apos;s your ZIP code?
              </h1>
            </legend>
            <p className="-mt-2 text-ink-2">Subsidy rules and plan prices depend on where you live.</p>
            <div className="flex flex-col gap-2">
              <label htmlFor="zip" className="text-[15px] font-medium">ZIP code</label>
              <input
                id="zip"
                inputMode="numeric"
                autoComplete="postal-code"
                className="field max-w-48 font-mono text-2xl tracking-[0.08em]"
                value={zip}
                onChange={(e) => onZip(e.target.value)}
                placeholder="78701"
                autoFocus
                {...errProps}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="state" className="text-[15px] font-medium">State</label>
              <select id="state" className="field max-w-80 text-base" value={state} onChange={(e) => { setState(e.target.value); setError(""); }}>
                <option value="">Select your state</option>
                {STATES.map(([c, n]) => (
                  <option key={c} value={c}>{n}</option>
                ))}
              </select>
              {state && UNSUPPORTED.has(state) && (
                <p className="text-sm text-loss-ink">{stateName(state)} is not supported yet.</p>
              )}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className="flex flex-col gap-6">
            <legend className="contents">
              <h1 ref={headRef} tabIndex={-1} className="text-3xl font-semibold tracking-[-0.02em] outline-none sm:text-4xl">
                Who&apos;s on your plan?
              </h1>
            </legend>
            <p className="-mt-2 text-ink-2">Count everyone on your tax return who needs coverage.</p>
            <div className="flex items-center gap-4">
              <span id="size-label" className="text-[15px] font-medium">People</span>
              <div className="flex items-center rounded-xl border border-line-strong bg-card" role="group" aria-labelledby="size-label">
                <button type="button" onClick={() => resize(size - 1)} disabled={size <= 1} className="flex size-12 items-center justify-center rounded-l-xl text-ink-2 transition-colors hover:bg-raised disabled:opacity-40" aria-label="One person fewer">
                  <Minus />
                </button>
                <output aria-live="polite" className="w-12 text-center text-xl font-semibold num">{size}</output>
                <button type="button" onClick={() => resize(size + 1)} disabled={size >= 8} className="flex size-12 items-center justify-center rounded-r-xl text-ink-2 transition-colors hover:bg-raised disabled:opacity-40" aria-label="One person more">
                  <Plus />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {ages.map((a, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <label htmlFor={`age-${i}`} className="text-sm text-ink-2">
                    {i === 0 ? "Your age" : `Person ${i + 1}`}
                  </label>
                  <input
                    id={`age-${i}`}
                    inputMode="numeric"
                    className="field"
                    value={a}
                    onChange={(e) => {
                      const v = digits(e.target.value).slice(0, 3);
                      setAges((arr) => arr.map((x, j) => (j === i ? v : x)));
                      setError("");
                    }}
                    autoFocus={i === 0}
                    {...(error ? errProps : {})}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        )}

        {step === 3 && (
          <fieldset className="flex flex-col gap-6">
            <legend className="contents">
              <h1 ref={headRef} tabIndex={-1} className="text-3xl font-semibold tracking-[-0.02em] outline-none sm:text-4xl">
                What will your household earn in 2027?
              </h1>
            </legend>
            <p className="-mt-2 text-ink-2">Your best guess before retirement contributions. You can adjust it on the next screen.</p>
            <div className="flex flex-col gap-2">
              <label htmlFor="income" className="text-[15px] font-medium">Expected household income</label>
              <div className="relative max-w-72">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-ink-3">$</span>
                <input
                  id="income"
                  inputMode="numeric"
                  className="field pl-9 text-2xl"
                  value={income}
                  onChange={(e) => { setIncome(money(e.target.value)); setError(""); }}
                  placeholder="136,000"
                  autoFocus
                  {...errProps}
                />
              </div>
            </div>
            <IncomeUpload
              onIncome={(n) => {
                setIncome(Math.round(n).toLocaleString("en-US"));
                setError("");
              }}
            />
            <div className="flex flex-col gap-3">
              <p id="steady-label" className="text-[15px] font-medium">How steady is it?</p>
              <div role="radiogroup" aria-labelledby="steady-label" className="grid gap-2 sm:grid-cols-3">
                {([
                  ["steady", "Steady", "About the same each month"],
                  ["uneven", "Uneven", "Good and slow months"],
                  ["lumpy", "Lumpy", "A few big payments"],
                ] as const).map(([v, t, d]) => (
                  <label key={v} className={`flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-xl border px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${steady === v ? "border-ink bg-card" : "border-line-strong hover:bg-card"}`}>
                    <input type="radio" name="steady" value={v} checked={steady === v} onChange={() => setSteady(v)} className="sr-only" />
                    <span className="font-medium">{t}</span>
                    <span className="text-sm text-ink-3">{d}</span>
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
        )}

        {step === 4 && (
          <fieldset className="flex flex-col gap-6">
            <legend className="contents">
              <h1 ref={headRef} tabIndex={-1} className="text-3xl font-semibold tracking-[-0.02em] outline-none sm:text-4xl">
                How do you earn?
              </h1>
            </legend>
            <p className="-mt-2 text-ink-2">Self-employment income decides how much you can put into a SEP IRA.</p>
            <div role="radiogroup" aria-label="How you earn" className="flex flex-col gap-2">
              {([
                ["freelance", "Freelance or 1099", "Clients pay you directly"],
                ["business", "Own business", "Sole proprietor, LLC or partnership"],
                ["mix", "Mix of W-2 and self-employment", "A paycheck plus side or partner income"],
              ] as const).map(([v, t, d]) => (
                <label key={v} className={`flex min-h-14 cursor-pointer items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${earn === v ? "border-ink bg-card" : "border-line-strong hover:bg-card"}`}>
                  <input type="radio" name="earn" value={v} checked={earn === v} onChange={() => { setEarn(v); setError(""); }} className="size-5 accent-[var(--accent)]" />
                  <span className="flex flex-col">
                    <span className="font-medium">{t}</span>
                    <span className="text-sm text-ink-3">{d}</span>
                  </span>
                </label>
              ))}
            </div>
            {earn === "mix" && (
              <div className="swap-in flex flex-col gap-2">
                <label htmlFor="se" className="text-[15px] font-medium">Self-employment part of your income</label>
                <div className="relative max-w-72">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-ink-3">$</span>
                  <input id="se" inputMode="numeric" className="field pl-9 text-2xl" value={seIncome} onChange={(e) => { setSeIncome(money(e.target.value)); setError(""); }} autoFocus {...errProps} />
                </div>
                <p className="text-sm text-ink-3">Net profit after business expenses, of {usd(toNum(income))} total.</p>
              </div>
            )}
          </fieldset>
        )}

        {step === 5 && (
          <fieldset className="flex flex-col gap-6">
            <legend className="contents">
              <h1 ref={headRef} tabIndex={-1} className="text-3xl font-semibold tracking-[-0.02em] outline-none sm:text-4xl">
                What does your benchmark silver plan cost?
              </h1>
            </legend>
            <p className="-mt-2 text-ink-2">
              The second-cheapest silver plan in your area sets your subsidy, whichever plan you buy. It is shown
              when you browse plans.
            </p>
            <div className="flex flex-col gap-2">
              <label htmlFor="premium" className="text-[15px] font-medium">Full monthly price, before any subsidy</label>
              <div className="relative max-w-72">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-ink-3">$</span>
                <input id="premium" inputMode="numeric" className="field pl-9 pr-16 text-2xl" value={premium} onChange={(e) => { setPremium(money(e.target.value)); setError(""); }} placeholder="2,000" autoFocus {...errProps} />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-3">/ mo</span>
              </div>
              <a href="https://www.healthcare.gov/see-plans/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
                See plans &amp; prices on healthcare.gov <ExternalLink size={14} />
              </a>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line-strong px-4 py-3 hover:bg-card">
              <input type="checkbox" checked={hsa} onChange={(e) => setHsa(e.target.checked)} className="mt-0.5 size-5 accent-[var(--accent)]" />
              <span className="flex flex-col">
                <span className="font-medium">I&apos;ll pick a bronze or catastrophic plan</span>
                <span className="text-sm text-ink-3">From 2026 these plans are HSA-eligible, which adds an HSA to your plan options.</span>
              </span>
            </label>
          </fieldset>
        )}

        {error && (
          <p id={errId} role="alert" className="-mt-4 text-[15px] text-loss-ink">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          {step > 1 ? (
            <button type="button" onClick={back} className="btn btn-secondary">
              <ArrowLeft /> Back
            </button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {step === 5 && (
              <button type="button" onClick={() => finish(ESTIMATE_PER_PERSON_MONTH * size)} className="btn btn-secondary">
                I don&apos;t know — use an estimate
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              {step === TOTAL ? "See my diagnosis" : "Continue"}
              <ArrowRight />
            </button>
          </div>
        </div>
        {step === 5 && (
          <p className="-mt-4 text-[13px] text-ink-3">
            The estimate is illustrative: {usd(ESTIMATE_PER_PERSON_MONTH)} per person per month ({usd(ESTIMATE_PER_PERSON_MONTH * size)} for {size}). Check your real price on healthcare.gov.
          </p>
        )}
      </form>
    </div>
  );
}
