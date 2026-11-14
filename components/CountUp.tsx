"use client";

import { useEffect, useState } from "react";
import { useInView } from "./Reveal";

/** Counts 0 -> `to` once, when scrolled into view. Reduced motion: shows `to`. */
export function CountUp({ to, prefix = "", suffix = "", ms = 1100 }: { to: number; prefix?: string; suffix?: string; ms?: number }) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.6);
  const [v, setV] = useState(0);

  useEffect(() => {
    if (!seen) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = reduce ? 1 : Math.min(1, (now - t0) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - k, 4))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, to, ms]);

  return (
    <span ref={ref} className="num" aria-label={`${prefix}${to}${suffix}`}>
      {prefix}
      {v}
      {suffix}
    </span>
  );
}
