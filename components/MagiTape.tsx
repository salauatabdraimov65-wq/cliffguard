"use client";

import { calculate } from "@/lib/engine";
import { demoFamily } from "@/lib/demoFamily";
import { useInView } from "./Reveal";
import { usd } from "./format";

const demo = calculate(demoFamily);
const LO = 112000;
const HI = 140000;
const pct = (v: number) => `${((v - LO) / (HI - LO)) * 100}%`;

/*
  A measuring tape for MAGI. In view: the SEP IRA piece is cut off the end of
  the income bar and drops into its own account; the bar that is left — MAGI —
  sits behind the cliff line and turns from loss to safe.
*/
export function MagiTape() {
  const [ref, go] = useInView<HTMLDivElement>(0.5);
  const cut = demo.contributionNeeded;

  return (
    <div ref={ref} className="card p-5 sm:p-8" aria-label={`Income ${usd(demo.magi)} minus ${usd(cut)} SEP IRA equals MAGI ${usd(demo.magiAfterPlan)}, under the ${usd(demo.cliff)} cliff`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[12px] text-ink-3">Demo family · the math in one line</p>
        <p className="text-[15px] num">
          <span className="text-ink-2">{usd(demo.magi)}</span>
          <span className="text-ink-3"> − </span>
          <span className="text-ink-2">{usd(cut)} SEP IRA</span>
          <span className="text-ink-3"> = </span>
          <span className={`font-semibold transition-colors delay-700 duration-500 ${go ? "text-safe-ink" : "text-ink"}`}>{usd(demo.magiAfterPlan)} MAGI</span>
        </p>
      </div>

      <div className="relative mt-16 h-24" aria-hidden="true">
        {/* the cliff */}
        <div className="absolute bottom-0 top-[-22px] w-px bg-ink" style={{ left: pct(demo.cliff) }}>
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap font-mono text-[12px] text-ink">
            {usd(demo.cliff)} cliff
          </span>
        </div>
        {/* zone past the cliff */}
        <div className="absolute inset-y-0 right-0 rounded-r-lg bg-loss-wash" style={{ left: pct(demo.cliff) }} />

        {/* MAGI: what's left of income */}
        <div
          className={`absolute left-0 top-2 h-8 rounded-l-lg transition-colors delay-700 duration-500 ${go ? "bg-safe" : "bg-loss"}`}
          style={{ width: pct(demo.magiAfterPlan) }}
        />
        {/* the piece that becomes a SEP IRA contribution */}
        <div
          className={`absolute top-2 flex h-8 items-center justify-center rounded-r-lg border-l-2 border-card transition-[transform,background-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            go ? "translate-y-12 bg-safe-soft" : "bg-loss"
          }`}
          style={{ left: pct(demo.magiAfterPlan), width: `calc(${pct(demo.magi)} - ${pct(demo.magiAfterPlan)})`, transitionDelay: go ? "350ms" : "0ms" }}
        >
          <span className={`whitespace-nowrap font-mono text-[11px] transition-opacity duration-300 ${go ? "text-ink opacity-100 delay-700" : "opacity-0"}`}>
            SEP IRA
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
