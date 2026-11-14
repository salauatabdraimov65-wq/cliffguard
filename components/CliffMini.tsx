import type { Input, Result } from "@/lib/types";
import { barIndexFor, buildSeries, niceMax } from "./cliffSeries";
import { usd, usdK } from "./format";

/**
 * Static, server-rendered cliff for the landing hero.
 * One series (subsidy by MAGI), the household's own bar emphasized.
 */
export function CliffMini({ input, result }: { input: Input; result: Result }) {
  const series = buildSeries(input, result.cliff);
  const top = niceMax(series);
  const you = barIndexFor(series, result.magi, result.cliff);
  const cliffIdx = series.findIndex((p) => p.over);

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Subsidy by household income. It shrinks slowly up to the {usd(result.cliff)} cliff, then
        drops to $0. This family is at {usd(result.magi)}.
      </figcaption>
      <div className="relative h-36 sm:h-44" aria-hidden="true">
        {/* hairline grid at 0 / half / top */}
        {[0, 0.5, 1].map((g) => (
          <div
            key={g}
            className="absolute inset-x-0 border-t border-grid"
            style={{ bottom: `${g * 100}%` }}
          />
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {series.map((p, i) => {
            const h = Math.max(2, (p.subsidy / top) * 100);
            const isYou = i === you;
            const color = p.over
              ? isYou
                ? "bg-cliff"
                : "bg-cliff-soft"
              : isYou
                ? "bg-safe"
                : "bg-safe-soft";
            return (
              <div key={p.x} className="relative flex h-full flex-1 items-end justify-center">
                <div
                  className={`w-full max-w-6 rounded-t-[4px] ${color}`}
                  style={{ height: `${h}%` }}
                />
                {isYou && (
                  <span className="label absolute -top-1 -translate-y-full whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-on-ink normal-case tracking-normal">
                    You
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {cliffIdx > 0 && (
          <div
            className="absolute inset-y-0 border-l-2 border-ink"
            style={{ left: `${(cliffIdx / series.length) * 100}%` }}
          />
        )}
      </div>
      <div className="relative mt-2 flex justify-between text-ink-3 label normal-case tracking-normal tabular">
        <span>{usdK(series[0].x)}</span>
        <span className="text-ink font-semibold">{usdK(result.cliff)} cliff</span>
        <span>{usdK(series[series.length - 1].x)}</span>
      </div>
    </figure>
  );
}
