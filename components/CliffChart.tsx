"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { subsidyFor } from "@/lib/engine";
import { usd, usdK } from "./format";

/*
  The cliff chart — the one loud object on the page.
  Form (dataviz): magnitude over an ordered x -> columns. 23 columns, one per
  income step, height = annual premium tax credit at that income.
  Marks: <=24px columns, 4px rounded data-end, square baseline, 2px surface gap,
  hairline grid, text in ink tokens only. Identity is never colour-alone:
  position against the labelled cliff line + stub height carry it too.
  Motion (design-motion-principles, Emil for the slider, Jakub for the plan):
  the marker follows the slider with no lag; only its height eases (250ms), so
  crossing the cliff reads as a fall. Applying the plan glides it (480ms).
*/

export type CliffChartProps = {
  householdSize: number;
  benchmark: number;
  /** Annual price of the plan actually bought; the credit can't exceed it. */
  planPrice?: number;
  cliff: number;
  /** Household income as entered. */
  income: number;
  /** MAGI after contributions; equals income when no plan is applied. */
  magi: number;
  contribution?: number;
  contributionLabel?: string;
  /** Turns on the x glide for one move (plan applied / undone). */
  glide?: boolean;
  compact?: boolean;
  /** Static preview on the landing page: no hover layer, no table. */
  preview?: boolean;
  /** Rendered under the chart, above the table toggle (the income slider). */
  controls?: ReactNode;
};

export function chartRange(cliff: number) {
  const step = Math.max(500, Math.round(cliff / 66 / 500) * 500);
  return { step, min: cliff - 11 * step, max: cliff + 11 * step };
}

function niceCeil(v: number) {
  const step = v > 12000 ? 5000 : v > 4000 ? 2000 : 1000;
  return Math.max(step, Math.ceil((v * 1.08) / step) * step);
}

// one tick style per axis: compact K when the axis reaches 10,000
const tickFmt = (top: number) => (v: number) =>
  v === 0 ? "$0" : top >= 10000 ? `$${+(v / 1000).toFixed(1)}K` : `$${v.toLocaleString("en-US")}`;

export function CliffChart({
  householdSize,
  benchmark,
  planPrice,
  cliff,
  income,
  magi,
  contribution = 0,
  contributionLabel,
  glide = false,
  compact = false,
  preview = false,
  controls,
}: CliffChartProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { step, min, max } = chartRange(cliff);
  const credit = (x: number) => Math.min(subsidyFor(x, householdSize, benchmark), planPrice ?? Infinity);
  const points = useMemo(
    () =>
      Array.from({ length: 23 }, (_, i) => {
        const x = min + i * step;
        return { x, y: Math.min(subsidyFor(x, householdSize, benchmark), planPrice ?? Infinity) };
      }),
    [min, step, householdSize, benchmark, planPrice],
  );

  const narrow = w < 520;
  const h = compact ? (narrow ? 196 : 228) : narrow ? 240 : 280;
  const pad = { l: narrow ? 40 : 48, r: narrow ? 8 : 16, t: 40, b: 32 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  const yMax = niceCeil(Math.max(...points.map((p) => p.y), credit(cliff), 1));
  const band = pw / points.length;
  const barW = Math.min(24, Math.max(4, band - 2 - band * 0.3));

  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const sx = (v: number) => pad.l + ((clamp(v) - min) / (max - min)) * (pw - band) + band / 2;
  const sy = (v: number) => pad.t + ph - (v / yMax) * ph;

  const userSubsidy = credit(magi);
  const over = magi > cliff;
  // nearest column on the same side of the cliff as the household (index 11 = the cliff itself)
  const nearest = Math.round((clamp(magi) - min) / step);
  const userIdx = over ? Math.max(12, nearest) : Math.min(11, nearest);
  const cliffX = (sx(cliff) + sx(cliff + step)) / 2; // the edge sits between the last green and first orange column
  const yTicks = [0, yMax / 2, yMax].map((v) => Math.round(v));
  const tick = tickFmt(yMax);
  const xTicks = narrow ? [min, cliff, max] : [min, min + 5 * step, cliff, cliff + 6 * step, max];

  const markerX = sx(magi);
  const markerY = sy(userSubsidy);
  // keep the label off the cliff line: just under the cliff it reads to the left
  const nearEdgeBelow = !over && cliffX - markerX < 150;
  const labelRight = !nearEdgeBelow && markerX < pad.l + pw * 0.62;
  const youLabel = over ? "You · $0 subsidy" : `You · ${usd(userSubsidy)}/yr`;
  const showIncomeGhost = contribution > 0 && Math.abs(sx(income) - markerX) > 6;

  const onKey = (e: React.KeyboardEvent) => {
    if (preview) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const d = e.key === "ArrowRight" ? 1 : -1;
      setActive((a) => Math.min(22, Math.max(0, (a ?? userIdx) + d)));
    } else if (e.key === "Escape") setActive(null);
  };

  const tip = active !== null ? points[active] : null;

  return (
    <figure className="m-0">
      <div ref={boxRef} className="relative w-full select-none">
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-labelledby={`${titleId} ${descId}`}
          className="reveal-x block overflow-visible"
          tabIndex={preview ? -1 : 0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
        >
          <title id={titleId}>Premium tax credit by household income</title>
          <desc id={descId}>
            {`Subsidy falls with income until the ${usdK(cliff)} cliff, then drops to $0. At ${usd(magi)} the estimate is ${usd(userSubsidy)} a year.`}
          </desc>

          {/* above-the-cliff zone: a quiet wash, so the drop has a place */}
          <rect x={cliffX} y={pad.t} width={pad.l + pw - cliffX} height={ph} fill="var(--loss-wash)" opacity={0.7} />

          {/* grid + y ticks */}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={pad.l + pw} y1={sy(v)} y2={sy(v)} stroke={v === 0 ? "var(--line-strong)" : "var(--grid)"} />
              <text x={pad.l - 8} y={sy(v)} dy="0.32em" textAnchor="end" className="fill-ink-3 font-mono text-[11px] num">
                {tick(v)}
              </text>
            </g>
          ))}

          {/* columns */}
          <g>
            {points.map((p, i) => {
              const isUser = i === userIdx;
              const aboveCliff = p.x > cliff;
              const bh = aboveCliff ? 3 : Math.max(3, (p.y / yMax) * ph);
              const x = sx(p.x) - barW / 2;
              const fill = isUser
                ? aboveCliff
                  ? "var(--loss)"
                  : "var(--safe)"
                : aboveCliff
                  ? "var(--loss-soft)"
                  : "var(--safe-soft)";
              const r = Math.min(4, barW / 2, bh);
              return (
                <path
                  key={p.x}
                  d={`M${x},${pad.t + ph} V${pad.t + ph - bh + r} q0,-${r} ${r},-${r} h${barW - 2 * r} q${r},0 ${r},${r} V${pad.t + ph} Z`}
                  fill={fill}
                  opacity={active !== null && active !== i ? 0.55 : 1}
                  style={{ transition: "fill 180ms var(--ease), opacity 160ms var(--ease)" }}
                />
              );
            })}
          </g>

          {/* the cliff edge */}
          <line x1={cliffX} x2={cliffX} y1={pad.t - 14} y2={pad.t + ph} stroke="var(--ink)" strokeWidth={1.25} />
          <text x={cliffX} y={pad.t - 20} textAnchor={narrow ? "end" : "middle"} dx={narrow ? 4 : 0} className="fill-ink text-[12px] font-medium num">
            {usdK(cliff)} cliff
          </text>

          {/* income before the plan — a ghost tick */}
          {showIncomeGhost && (
            <g>
              <line x1={sx(income)} x2={sx(income)} y1={pad.t + 6} y2={pad.t + ph} stroke="var(--ink-3)" strokeWidth={1} />
              <line
                x1={sx(income)}
                x2={markerX + (sx(income) > markerX ? 6 : -6)}
                y1={pad.t + 10}
                y2={pad.t + 10}
                stroke="var(--ink-3)"
                strokeWidth={1}
                markerEnd="url(#cg-arrow)"
              />
              {!narrow && contributionLabel && (
                <text x={sx(income) + 6} y={pad.t + 26} className="fill-ink-2 text-[11px] font-mono num">
                  {contributionLabel}
                </text>
              )}
            </g>
          )}
          <defs>
            <marker id="cg-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M1 1 7 4 1 7" fill="none" stroke="var(--ink-3)" strokeWidth={1.25} />
            </marker>
          </defs>

          {/* the household — x follows the slider at once, y eases: the fall */}
          <g
            style={{
              transform: `translateX(${markerX}px)`,
              transition: glide ? "transform 480ms var(--ease)" : "none",
            }}
          >
            <line x1={0} x2={0} y1={pad.t + ph} y2={markerY} stroke={over ? "var(--loss)" : "var(--safe)"} strokeWidth={2} style={{ transition: "stroke 180ms var(--ease)" }} />
            <g style={{ transform: `translateY(${markerY}px)`, transition: "transform 250ms var(--ease)" }}>
              <circle r={7} fill={over ? "var(--loss)" : "var(--safe)"} stroke="var(--card)" strokeWidth={2} style={{ transition: "fill 180ms var(--ease)" }} />
              <text
                x={labelRight ? 12 : -12}
                y={-12}
                textAnchor={labelRight ? "start" : "end"}
                className="fill-ink text-[13px] font-semibold num"
                style={{ paintOrder: "stroke", stroke: "var(--card)", strokeWidth: 4, strokeLinejoin: "round" }}
              >
                {youLabel}
              </text>
            </g>
          </g>

          {/* x ticks */}
          {xTicks.map((v) => (
            <text
              key={v}
              x={v === cliff ? cliffX : sx(v)}
              y={h - 10}
              textAnchor={v === min ? "start" : v === max ? "end" : "middle"}
              dx={v === min ? -barW / 2 : v === max ? barW / 2 : 0}
              className={`font-mono text-[11px] num ${v === cliff ? "fill-ink" : "fill-ink-3"}`}
            >
              {usdK(v)}
            </text>
          ))}

          {/* hover layer: the band is the hit target, bigger than the mark */}
          {!preview &&
            points.map((p, i) => (
              <rect
                key={`hit-${p.x}`}
                x={pad.l + i * ((pw - band) / 22)}
                y={pad.t}
                width={band}
                height={ph}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
              />
            ))}
        </svg>

        {tip && (
          <div
            className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-line bg-card px-3 py-2 shadow-lg"
            style={{
              left: Math.min(Math.max(sx(tip.x), 76), w - 76),
              top: Math.max(0, sy(tip.x > cliff ? 0 : tip.y) - 64),
              transform: "translateX(-50%)",
            }}
            role="status"
          >
            <p className="text-[15px] font-semibold num">{tip.x > cliff ? "$0" : `${usd(tip.y)}/yr`}</p>
            <p className="text-[12px] text-ink-3 num">at {usd(tip.x)} income</p>
          </div>
        )}
      </div>

      {controls}

      {!preview && (
        <details className="group mt-3">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-sm text-ink-2 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
            <span className="transition-transform duration-150 group-open:rotate-90" aria-hidden="true">›</span>
            Show the numbers as a table
          </summary>
          <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-line">
            <table className="w-full text-sm num">
              <thead className="sticky top-0 bg-raised text-left text-ink-2">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Household income</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Subsidy per year</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.x} className="border-t border-line">
                    <td className="px-3 py-1.5">{usd(p.x)}</td>
                    <td className={`px-3 py-1.5 text-right ${p.x > cliff ? "text-loss-ink" : ""}`}>{usd(p.y)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
