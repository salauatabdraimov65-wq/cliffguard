"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { calculate } from "@/lib/engine";
import { demoFamily } from "@/lib/demoFamily";
import { CliffChart } from "./CliffChart";
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
  const kept = useTween(applied ? demo.subsidyAfterPlan : demo.loss, glide, 700);

  return (
    <div ref={ref} className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
      <div className="flex flex-col gap-5">
        <p className="eyebrow">Meet the demo family</p>
        <h2 id="family-h" className="text-3xl font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[44px]">
          Mike freelances. Jess runs a coffee shop. They&apos;re {usd(demo.overBy)} over.
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
                <Check size={14} /> Plan applied
              </>
            ) : (
              `${Math.round(demo.fplPercent * 100)}% FPL`
            )}
          </span>
        </div>
        <div className="px-3 pt-5 sm:px-5">
          <CliffChart
            householdSize={demoFamily.householdSize}
            benchmark={demoFamily.benchmarkPremium}
            cliff={demo.cliff}
            income={demo.magi}
            magi={magi}
            contribution={applied ? sep : 0}
            glide={glide}
            compact
            preview
          />
        </div>
        <dl className="grid grid-cols-2 border-t border-line">
          {[
            { k: applied ? "Reported income (MAGI)" : "Expected 2027 income", v: usd(magi) },
            applied
              ? { k: "Under the cliff by", v: usd(demo.cliff - demo.magiAfterPlan), tone: "safe" }
              : { k: "Over the cliff by", v: usd(demo.overBy), tone: "loss" },
            applied
              ? { k: "Subsidy kept", v: `${usd(kept)}/yr`, tone: "safe" }
              : { k: "Subsidy lost", v: `${usd(kept)}/yr`, tone: "loss" },
            applied
              ? { k: "Put into a SEP IRA", v: usd(sep), tone: "" }
              : { k: `With ${usd(sep)} to a SEP IRA`, v: `${usd(demo.subsidyAfterPlan)}/yr back`, tone: "safe" },
          ].map((r, i) => (
            <div
              key={i}
              className={`flex flex-col gap-1 px-5 py-4 transition-colors duration-500 sm:px-6 ${i % 2 === 1 ? "border-l border-line" : ""} ${
                i > 1 ? "border-t border-line" : ""
              } ${applied && r.tone === "safe" ? "bg-safe-wash/50" : ""}`}
            >
              <dt className="text-[13px] text-ink-3">{r.k}</dt>
              <dd
                key={`${i}-${applied}`}
                className={`swap-in text-lg font-semibold num ${r.tone === "loss" ? "text-loss-ink" : r.tone === "safe" ? "text-safe-ink" : ""}`}
              >
                {r.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
