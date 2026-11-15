"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { calculate } from "@/lib/engine";
import { demoFamily } from "@/lib/demoFamily";
import { ArrowRight, Check, Undo } from "./Icons";
import { useInView } from "./Reveal";
import { usd } from "./format";
import { useTween } from "./useTween";

const demo = calculate(demoFamily);
const sep = demo.plan.find((s) => s.account === "SEP_IRA")?.amount ?? demo.contributionNeeded;

/*
  A dealt moment in its own section: when the card is in view, the rescue plan
  applies itself — the marker glides back under the cliff and the worksheet
  rows turn from loss to kept. Then it's a toggle the visitor can replay.
*/
export function FamilyStory() {
  const [ref, seen] = useInView<HTMLDivElement>(0.45);
  const [applied, setApplied] = useState(false);
  const [glide, setGlide] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const toggle = (next: boolean) => {
    setApplied(next);
    setGlide(true);
    timers.current.push(setTimeout(() => setGlide(false), 700));
  };

  useEffect(() => {
    if (!seen) return;
    const list = timers.current;
    const t = setTimeout(() => {
      setApplied(true);
      setGlide(true);
      list.push(setTimeout(() => setGlide(false), 700));
    }, 1100);
    return () => {
      clearTimeout(t);
      list.forEach(clearTimeout);
    };
  }, [seen]);

  const magi = applied ? demo.magiAfterPlan : demo.magi;
  const kept = useTween(applied ? demo.subsidyAfterPlan : 0, glide, 700);
  const magiShown = useTween(magi, glide, 700);

  return (
    <div ref={ref} className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
      <div className="flex flex-col gap-5">
        <h2 id="family-h" className="text-3xl font-medium leading-[1.1] tracking-[-0.02em] sm:text-[44px]">
          Mike freelances, Jess runs a coffee shop, and they&apos;re {usd(demo.overBy)} over
        </h2>
        <p className="max-w-[46ch] text-[17px] leading-relaxed text-ink-2">
          Two kids, Austin, an expected {usd(demo.magi)} for 2027. That last {usd(demo.overBy)} costs them their whole
          credit. A {usd(sep)} SEP IRA contribution brings them back under the line.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => toggle(!applied)} className="btn btn-secondary">
            {applied ? (
              <>
                <Undo /> Undo the plan
              </>
            ) : (
              <>Apply {usd(sep)} → SEP IRA</>
            )}
          </button>
          <Link href="/diagnosis?demo=1" className="btn btn-dark">
            Open their diagnosis <ArrowRight />
          </Link>
        </div>
      </div>

      <div className={`card overflow-hidden shadow-lg transition-[border-color] duration-500 ${applied ? "border-safe/40" : ""}`}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <p className="eyebrow">Demo family · Austin, TX</p>
            <p className="mt-1 text-[17px] font-semibold">Mike &amp; Jess, 2 kids</p>
          </div>
          <span
            key={applied ? "a" : "b"}
            className={`swap-in inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[12px] num ${
              applied ? "bg-safe-wash text-safe-ink" : "bg-loss-wash text-loss-ink"
            }`}
          >
            {applied ? (
              <>
                <Check size={16} /> Plan applied
              </>
            ) : (
              `${Math.round(demo.fplPercent * 100)}% FPL`
            )}
          </span>
        </div>
        {/* the worksheet, not a second chart: the hero already is the chart */}
        <dl className="flex flex-col px-5 sm:px-6">
          {[
            { n: "1", k: "Expected 2027 income", v: usd(demo.magi) },
            { n: "2", k: "SEP IRA contribution", v: applied ? `−${usd(sep)}` : "$0" },
            { n: "3", k: "MAGI", v: usd(magiShown), strong: true },
            { n: "4", k: "Cliff (400% FPL)", v: usd(demo.cliff) },
          ].map((r) => (
            <div key={r.n} className="flex items-baseline gap-3 border-b border-line py-3">
              <dt className="flex flex-1 items-baseline gap-3 text-[15px] text-ink-2">
                <span className="line-no w-4 shrink-0">{r.n}</span>
                {r.k}
              </dt>
              <dd className={`text-[15px] num ${r.strong ? "font-semibold" : ""}`}>{r.v}</dd>
            </div>
          ))}
          <div className="flex items-baseline gap-3 py-4">
            <dt className="flex flex-1 items-baseline gap-3 text-[15px] font-medium">
              <span className="line-no w-4 shrink-0">5</span>
              Premium tax credit
            </dt>
            <dd className={`text-2xl font-semibold num transition-colors duration-300 ${applied ? "text-safe-ink" : "text-loss-ink"}`}>
              {applied ? `${usd(kept)}/yr` : "$0"}
            </dd>
          </div>
        </dl>
        <p
          key={applied ? "a" : "b"}
          className={`swap-in border-t px-5 py-3 text-[14px] sm:px-6 ${applied ? "border-safe/20 bg-safe-wash text-safe-ink" : "border-loss/20 bg-loss-wash text-loss-ink"}`}
        >
          {applied
            ? `${usd(demo.cliff - demo.magiAfterPlan)} under the cliff · the credit is back`
            : `${usd(demo.overBy)} over the cliff · losing ${usd(demo.loss)} a year`}
        </p>
      </div>
    </div>
  );
}
