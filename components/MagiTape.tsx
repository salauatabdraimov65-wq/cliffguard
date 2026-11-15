"use client";

import { calculate } from "@/lib/engine";
import { demoFamily } from "@/lib/demoFamily";
import { useInView } from "./Reveal";
import { usd } from "./format";

const demo = calculate(demoFamily);
// a tight window around the cliff, so the $4,500 piece is wide enough to read on a phone
const LO = 118000;
const HI = 140000;
const pct = (v: number) => `${((v - LO) / (HI - LO)) * 100}%`;

/*
  A measuring tape for MAGI. In view: the SEP IRA piece is cut off the end of
  the income bar and drops into its own account; the bar that is left (MAGI)
  sits behind the cliff line and turns from loss to safe.
*/
export function MagiTape() {
  const [ref, go] = useInView<HTMLDivElement>(0.5);
  const cut = demo.contributionNeeded;

  return (
    <div
      ref={ref}
      className="card p-5 sm:p-8"
      aria-label={`Income ${usd(demo.magi)} minus ${usd(cut)} SEP IRA equals MAGI ${usd(demo.magiAfterPlan)}, under the ${usd(demo.cliff)} cliff`}
    >
      <p className="font-mono text-[12px] text-ink-3">Demo family · the math in one line</p>

      {/* the equation as three labelled figures: it reads the same on any width */}
      <dl className="mt-4 grid grid-cols-[auto_auto_auto] items-end justify-start gap-x-3 gap-y-1 sm:gap-x-6">
        <div className="flex flex-col">
          <dt className="text-[13px] text-ink-3">Income</dt>
          <dd className="text-lg font-semibold num sm:text-2xl">{usd(demo.magi)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-[13px] text-ink-3">SEP IRA</dt>
          <dd className="text-lg font-semibold text-ink-2 num sm:text-2xl">−{usd(cut)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-[13px] text-ink-3">MAGI</dt>
          <dd className={`text-lg font-semibold num transition-colors delay-700 duration-500 sm:text-2xl ${go ? "text-safe-ink" : "text-loss-ink"}`}>
            {usd(demo.magiAfterPlan)}
          </dd>
        </div>
      </dl>

      <div className="relative mt-12 h-28" aria-hidden="true">
        {/* the cliff */}
        <div className="absolute bottom-0 top-[-20px] w-px bg-ink" style={{ left: pct(demo.cliff) }}>
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap font-mono text-[12px] text-ink">
            {usd(demo.cliff)} cliff
          </span>
        </div>
        {/* zone past the cliff */}
        <div className="absolute inset-y-0 right-0 rounded-r-lg bg-loss-wash" style={{ left: pct(demo.cliff) }} />

        {/* MAGI: what's left of income */}
        <div
          className={`absolute left-0 top-3 h-8 rounded-l-lg transition-colors delay-700 duration-500 ${go ? "bg-safe" : "bg-loss"}`}
          style={{ width: pct(demo.magiAfterPlan) }}
        />
        {/* the piece that becomes a SEP IRA contribution; its label sits under it, never squeezed inside */}
        <div
          className={`absolute top-3 h-8 rounded-r-lg border-l-2 border-card transition-[transform,background-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            go ? "translate-y-12 bg-safe-soft" : "bg-loss"
          }`}
          style={{ left: pct(demo.magiAfterPlan), width: `calc(${pct(demo.magi)} - ${pct(demo.magiAfterPlan)})`, transitionDelay: go ? "350ms" : "0ms" }}
        >
          <span
            className={`absolute right-0 top-full mt-1.5 whitespace-nowrap font-mono text-[12px] text-ink-2 transition-opacity duration-300 ${
              go ? "opacity-100 delay-700" : "opacity-0"
            }`}
          >
            into a SEP IRA
          </span>
        </div>
      </div>

      <div className="mt-2 flex justify-between font-mono text-[12px] text-ink-3 num">
        <span>{usd(LO)}</span>
        <span>{usd(HI)}</span>
      </div>
    </div>
  );
}
