import Link from "next/link";
import { demoFamily } from "@/lib/demoFamily";
import { fakeCalc } from "@/lib/fakeCalc";
import { CliffMini } from "@/components/CliffMini";
import { ArrowRight, Check } from "@/components/Icons";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { fplPct, usd } from "@/components/format";

const result = fakeCalc(demoFamily);

const steps = [
  {
    title: "Answer 5 questions",
    body: "ZIP, who's on your plan, what you expect to earn in 2027, how you earn it, and your benchmark plan price. About 60 seconds.",
  },
  {
    title: "See your number",
    body: "How far you are from the 400% FPL cliff and how much premium tax credit you lose by crossing it. Free.",
  },
  {
    title: "Get back under it",
    body: "A contribution plan with amounts and deadlines (SEP IRA, Solo 401(k), HSA), then a watch on your income all year.",
  },
];

const whyNow = [
  { figure: "+13%", text: "benchmark premiums for 2027" },
  { figure: "400% FPL", text: "The 400% FPL cutoff is back since Jan 1, 2026" },
  { figure: "No cap", text: "on paying back excess subsidy, starting with 2026 taxes" },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="gutter">
          <div className="mx-auto grid max-w-6xl items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-20">
            <div className="flex flex-col gap-6">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-2">
                <span className="size-2 rounded-full bg-safe" aria-hidden="true" />
                2027 open enrollment is live · ends Jan 15
              </p>
              <h1 className="text-[2.75rem] leading-[0.98] font-extrabold tracking-[-0.035em] sm:text-6xl lg:text-7xl">
                Earn $1 more.
                <br />
                <span className="text-cliff-ink">Lose $10,500.</span>
              </h1>
              <p className="max-w-[58ch] text-lg leading-relaxed text-ink-2">
                If you&apos;re self-employed and buy health insurance on the ACA Marketplace,
                crossing the subsidy cliff wipes out your entire premium tax credit. CliffGuard
                shows what you&apos;re losing and the legal way to get it back.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/quiz"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-safe px-6 font-semibold text-on-safe hover:brightness-110"
                >
                  See what I&apos;m losing — 60 sec
                  <ArrowRight />
                </Link>
                <Link
                  href="/diagnosis?demo=1"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink px-6 font-semibold text-ink hover:bg-ink hover:text-on-ink"
                >
                  Try demo family
                </Link>
              </div>
              <p className="text-sm text-ink-3">No sign-up. Educational estimate, not tax advice.</p>
            </div>

            {/* Demo family worksheet */}
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <p className="label text-ink-3">Demo family · Austin, TX</p>
                  <p className="mt-1 font-display text-xl font-semibold">Mike &amp; Jess, 2 kids</p>
                </div>
                <span className="label rounded-md bg-cliff-wash px-2 py-1 text-cliff-ink">
                  {fplPct(result.fplPercent)} FPL
                </span>
              </div>
              <div className="mt-8">
                <CliffMini input={demoFamily} result={result} />
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-5 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-ink-3">Expected 2027 income</dt>
                  <dd className="text-lg font-semibold">{usd(result.magi)}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-ink-3">Over the cliff by</dt>
                  <dd className="text-lg font-semibold text-cliff-ink">{usd(result.overBy)}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-ink-3">Subsidy lost</dt>
                  <dd className="text-lg font-semibold text-cliff-ink">{usd(result.loss)}/yr</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-ink-3">With {usd(result.contributionNeeded)} to SEP IRA</dt>
                  <dd className="text-lg font-semibold text-safe-ink">
                    {usd(result.subsidyAfterPlan)}/yr back
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="gutter scroll-mt-20 border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl py-14 sm:py-20">
            <div className="flex max-w-2xl flex-col gap-3">
              <p className="label text-ink-3">How it works</p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                The subsidy is based on MAGI, not on everything you earn.
              </h2>
              <p className="text-ink-2 leading-relaxed">
                Contributions to a SEP IRA, a traditional Solo 401(k) or an HSA lower your MAGI.
                The money stays yours. Most families on the Marketplace never hear about it until
                they file.
              </p>
            </div>
            <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
              {steps.map((s, i) => (
                <li key={s.title} className="flex flex-col gap-3 border-t-2 border-ink pt-5">
                  <span className="label text-ink-3">Step {i + 1}</span>
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="text-ink-2 leading-relaxed">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Why now */}
        <section className="gutter">
          <div className="mx-auto max-w-6xl py-14 sm:py-20">
            <div className="flex max-w-2xl flex-col gap-3">
              <p className="label text-ink-3">Why now</p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                2027 is the first year a wrong income guess costs everything.
              </h2>
            </div>
            <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
              {whyNow.map((w) => (
                <li key={w.figure} className="flex flex-col gap-2 bg-surface p-6">
                  <span className="font-display text-4xl font-bold tracking-tight text-cliff-ink">
                    {w.figure}
                  </span>
                  <span className="text-ink-2">{w.text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-ink-3">
              Sources: KFF (Oct 30, 2026), Ballotpedia, IRS (OBBBA §71305).
            </p>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="gutter scroll-mt-20 border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl py-14 sm:py-20">
            <div className="flex max-w-2xl flex-col gap-3">
              <p className="label text-ink-3">Pricing</p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Find out for free. Stay under the cliff with Pro.
              </h2>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-5 rounded-2xl border border-line p-6">
                <div>
                  <h3 className="text-xl font-semibold">Diagnosis</h3>
                  <p className="mt-1 font-display text-4xl font-bold">$0</p>
                </div>
                <ul className="flex flex-col gap-2.5 text-ink-2">
                  {[
                    "Distance to your 400% FPL cliff",
                    "Subsidy you lose, per year",
                    "Interactive income slider",
                    "First step of your rescue plan",
                  ].map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 shrink-0 text-safe-ink" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/quiz"
                  className="mt-auto inline-flex min-h-12 items-center justify-center rounded-full border border-ink px-6 font-semibold hover:bg-ink hover:text-on-ink"
                >
                  Start free
                </Link>
              </div>
              <div className="flex flex-col gap-5 rounded-2xl bg-ink p-6 text-on-ink">
                <div>
                  <h3 className="text-xl font-semibold">Pro</h3>
                  <p className="mt-1 font-display text-4xl font-bold">
                    $149<span className="text-lg font-medium opacity-70">/year</span>
                  </p>
                  <p className="text-sm opacity-70">
                    Money-back promise: if your plan estimate is under $149, get a full refund.
                  </p>
                </div>
                <ul className="flex flex-col gap-2.5 opacity-90">
                  {[
                    "Full plan: amounts and deadlines per account",
                    "Room-under-the-cliff tracker all year",
                    "December and pre-filing reminders",
                    "Marketplace income update checklist",
                  ].map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/diagnosis?demo=1"
                  className="mt-auto inline-flex min-h-12 items-center justify-center rounded-full bg-on-ink px-6 font-semibold text-ink hover:opacity-90"
                >
                  See it on the demo family
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
