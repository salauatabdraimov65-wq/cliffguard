import Link from "next/link";
import { calculate } from "@/lib/engine";
import { demoFamily } from "@/lib/demoFamily";
import { CountUp } from "@/components/CountUp";
import { FamilyStory } from "@/components/FamilyStory";
import { HeroScene } from "@/components/HeroScene";
import { ArrowRight, Check, Shield } from "@/components/Icons";
import { MagiTape } from "@/components/MagiTape";
import { Reveal } from "@/components/Reveal";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { usd } from "@/components/format";

const demo = calculate(demoFamily);

const steps = [
  {
    title: "Answer five questions",
    body: "Your ZIP, who is on your plan, what you expect to earn in 2027, how you earn it, and your benchmark plan price.",
  },
  {
    title: "See your number",
    body: "How far you are from the 400% FPL cliff and how much premium tax credit crossing it costs you. Free.",
  },
  {
    title: "Get back under it",
    body: "A contribution plan with amounts and deadlines (SEP IRA, Solo 401(k), HSA), plus a watch on your income all year.",
  },
];

const words1 = ["Earn", "$1", "more."];

export default function Home() {
  return (
    <>
      <main className="flex-1">
        {/* 1 · Hero — the cliff, lit */}
        <section className="hero relative overflow-hidden">
          <SiteHeader overlay />
          {/* phone: headline -> scene -> copy; desktop: copy left, scene right across both rows */}
          <div className="wrap grid grid-cols-[minmax(0,1fr)] gap-6 pb-12 pt-20 lg:min-h-[100svh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-rows-[1fr_auto_1fr] lg:gap-x-4 lg:gap-y-6 lg:pb-12 lg:pt-20">
            <div className="relative z-10 flex flex-col gap-6 lg:col-start-1 lg:row-start-1 lg:self-end">
              <p className="hero-after inline-flex w-fit items-center gap-2 rounded-full border border-[var(--h-line)] px-3 py-1.5 text-[13px] text-[var(--h-ink-2)]">
                <span className="size-1.5 rounded-full bg-safe" aria-hidden="true" />
                2027 open enrollment is live · ends Jan 15
              </p>
              <h1 className="whitespace-nowrap text-[44px] font-semibold leading-[1.0] tracking-[-0.035em] sm:text-[64px] lg:text-[60px] xl:text-[68px]">
                <span className="block">
                  {words1.map((w, i) => (
                    <span key={w} className="hero-word" style={{ animationDelay: `${250 + i * 110}ms` }}>
                      {w}
                      {i < words1.length - 1 ? " " : ""}
                    </span>
                  ))}
                </span>
                <span className="hero-line2 block w-fit text-loss-ink">Lose $10,500.</span>
              </h1>
            </div>

            <div className="relative -mx-2 h-[320px] sm:h-[420px] lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:-mr-8 lg:ml-0 lg:h-[min(540px,64svh)] lg:self-center">
              <HeroScene />
              <p className="sr-only">
                A family of four earning {usd(demo.cliff)} keeps a premium tax credit of about {usd(demo.loss)} a year. At{" "}
                {usd(demo.cliff + 1)} the credit is $0.
              </p>
            </div>

            <div className="relative z-10 flex flex-col gap-6 lg:col-start-1 lg:row-span-2 lg:row-start-2 lg:self-start">
              <p className="hero-after max-w-[34rem] text-[17px] leading-[1.6] text-[var(--h-ink-2)] sm:text-lg" style={{ animationDelay: "800ms" }}>
                If you&apos;re self-employed and buy health insurance on the ACA Marketplace, crossing the subsidy cliff
                wipes out your entire premium tax credit. CliffGuard shows what you&apos;re losing and the legal way to get
                it back.
              </p>
              <div className="hero-after flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "1000ms" }}>
                <Link href="/quiz" className="btn btn-primary">
                  See what I&apos;m losing — 60 sec
                  <ArrowRight />
                </Link>
                <Link href="/diagnosis?demo=1" className="btn border border-[var(--h-line)] text-[var(--h-ink)] hover:bg-[var(--h-line)]">
                  Try demo family
                </Link>
              </div>
              <p className="hero-after text-[13px] text-[var(--h-ink-3)]" style={{ animationDelay: "1150ms" }}>
                No sign-up. Educational estimate, not tax advice.
              </p>
            </div>
          </div>
        </section>

        {/* 2 · From the picture to a real household — the plan applies itself in view */}
        <section aria-labelledby="family-h" className="border-y border-line bg-page">
          <Reveal className="wrap py-16 sm:py-24">
            <FamilyStory />
          </Reveal>
        </section>

        {/* 3 · How it works */}
        <section id="how" aria-labelledby="how-h" className="scroll-mt-4">
          <div className="wrap flex flex-col gap-12 py-16 sm:py-24">
            <Reveal className="flex max-w-2xl flex-col gap-4">
              <p className="eyebrow" data-reveal-item>
                How it works
              </p>
              <h2 id="how-h" data-reveal-item className="text-3xl font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">
                The subsidy follows MAGI, not everything you earn
              </h2>
              <p data-reveal-item className="text-[17px] leading-relaxed text-ink-2">
                Contributions to a SEP IRA, a traditional Solo 401(k) or an HSA lower your MAGI. The money stays yours, in
                your own retirement or health account.
              </p>
            </Reveal>

            <Reveal>
              <MagiTape />
            </Reveal>

            <Reveal as="ol" className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3" stagger={110}>
              {steps.map((s, i) => (
                <li key={s.title} data-reveal-item className="group flex flex-col gap-3 bg-page p-6 transition-colors duration-200 hover:bg-card sm:p-8">
                  <span className="line-no transition-colors duration-200 group-hover:text-safe-ink">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="text-xl font-semibold tracking-[-0.01em]">{s.title}</h3>
                  <p className="leading-relaxed text-ink-2">{s.body}</p>
                </li>
              ))}
            </Reveal>
          </div>
        </section>

        {/* 4 · Why now — a dark band in both themes */}
        <section aria-labelledby="now-h" className="band-dark">
          <div className="wrap py-16 sm:py-24">
            <Reveal className="flex max-w-2xl flex-col gap-4">
              <p data-reveal-item className="font-mono text-[12px] text-[var(--b-ink-3)]">
                Why now
              </p>
              <h2 id="now-h" data-reveal-item className="text-3xl font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">
                A low income guess now costs the full credit
              </h2>
            </Reveal>
            <Reveal as="ul" className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8" stagger={120}>
              <li data-reveal-item className="flex flex-col gap-3 border-t border-[var(--b-line)] pt-6">
                <span className="text-5xl font-semibold tracking-[-0.03em] lg:text-6xl">
                  <CountUp to={13} prefix="+" suffix="%" />
                </span>
                <span className="max-w-[28ch] leading-relaxed text-[var(--b-ink-2)]">benchmark premiums for 2027</span>
              </li>
              <li data-reveal-item className="flex flex-col gap-3 border-t border-[var(--b-line)] pt-6">
                <span className="text-5xl font-semibold tracking-[-0.03em] lg:text-6xl">
                  <CountUp to={400} suffix="% FPL" ms={1300} />
                </span>
                <span className="max-w-[28ch] leading-relaxed text-[var(--b-ink-2)]">The 400% FPL cutoff is back since Jan 1, 2026</span>
              </li>
              <li data-reveal-item className="flex flex-col gap-3 border-t border-[var(--b-line)] pt-6">
                <span className="text-5xl font-semibold tracking-[-0.03em] text-[#ff9a68] lg:text-6xl">No cap</span>
                <span className="max-w-[28ch] leading-relaxed text-[var(--b-ink-2)]">on paying back excess subsidy, starting with 2026 taxes</span>
              </li>
            </Reveal>
            <p className="mt-12 text-[13px] text-[var(--b-ink-3)]">Sources: KFF (Oct 30, 2026), Ballotpedia, IRS (OBBBA §71305).</p>
          </div>
        </section>

        {/* 5 · Pricing */}
        <section id="pricing" aria-labelledby="pricing-h" className="scroll-mt-4">
          <div className="wrap py-16 sm:py-24">
            <Reveal className="flex max-w-2xl flex-col gap-4">
              <p data-reveal-item className="eyebrow">
                Pricing
              </p>
              <h2 id="pricing-h" data-reveal-item className="text-3xl font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">
                Find out for free. Stay under the cliff with Pro.
              </h2>
            </Reveal>
            <Reveal className="mt-12 grid gap-6 md:grid-cols-2" stagger={120}>
              <div data-reveal-item className="card flex flex-col gap-6 p-6 transition-transform duration-300 hover:-translate-y-0.5 sm:p-8">
                <div>
                  <h3 className="text-[17px] font-semibold">Diagnosis</h3>
                  <p className="mt-2 text-5xl font-semibold tracking-[-0.03em]">$0</p>
                </div>
                <ul className="flex flex-col gap-3 text-ink-2">
                  {["Distance to your 400% FPL cliff", "Subsidy you lose, per year", "Interactive income slider", "First step of your rescue plan"].map((f) => (
                    <li key={f} className="flex gap-3">
                      <Check className="mt-0.5 shrink-0 text-safe-ink" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/quiz" className="btn btn-secondary mt-auto">
                  Start the 60-second check
                </Link>
              </div>

              <div data-reveal-item className="band-dark flex flex-col gap-6 rounded-2xl p-6 shadow-lg transition-transform duration-300 hover:-translate-y-0.5 sm:p-8">
                <div>
                  <h3 className="text-[17px] font-semibold">Pro</h3>
                  <p className="mt-2 text-5xl font-semibold tracking-[-0.03em]">
                    $99<span className="text-lg font-normal text-[var(--b-ink-3)]"> / year</span>
                  </p>
                  <p className="mt-1 text-sm text-[var(--b-ink-3)]">or $12.99 a month</p>
                </div>
                <ul className="flex flex-col gap-3 text-[var(--b-ink-2)]">
                  {[
                    "Full plan: amount and deadline for each account",
                    "Room-under-the-cliff tracker all year",
                    "December and pre-filing reminders",
                    "Marketplace income update checklist",
                  ].map((f) => (
                    <li key={f} className="flex gap-3">
                      <Check className="mt-0.5 shrink-0 text-[#5fcfa3]" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/plan?demo=1" className="btn mt-auto bg-[#f6f3ec] text-[#12110f] hover:bg-white">
                  See Pro on the demo family
                </Link>
              </div>
            </Reveal>
            <p className="mt-6 inline-flex items-start gap-2 text-sm text-ink-2">
              <Shield className="mt-0.5 shrink-0 text-ink-3" />
              We never sell insurance, open accounts or move your money. You make every contribution yourself.
            </p>
          </div>
        </section>

        {/* 6 · Close */}
        <section className="border-t border-line bg-card">
          <Reveal className="wrap flex flex-col items-start gap-6 py-16 sm:py-20 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">Enroll by Dec 15 for coverage that starts Jan 1</h2>
              <p className="text-ink-2">Check where your household lands before you report your 2027 income.</p>
            </div>
            <Link href="/quiz" className="btn btn-primary w-full md:w-auto">
              See what I&apos;m losing — 60 sec
              <ArrowRight />
            </Link>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
