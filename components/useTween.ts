"use client";

import { useEffect, useState } from "react";

/**
 * Tweens a number only when `animate` is true (a rare, deliberate action such
 * as applying the plan). Slider-driven changes jump instantly: the slider is a
 * high-frequency control and lag would read as sluggishness.
 */
export function useTween(value: number, animate: boolean, ms = 600) {
  // v = what is on screen, target = the value v is heading to
  const [t, setT] = useState({ v: value, target: value });

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    if (!animate || reduce) {
      raf = requestAnimationFrame(() => setT({ v: value, target: value }));
      return () => cancelAnimationFrame(raf);
    }
    let start: number | null = null;
    let from = value;
    const tick = (now: number) => {
      if (start === null) start = now;
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setT((prev) => {
        if (k === 0) from = prev.v;
        return { v: from + (value - from) * e, target: k < 1 ? prev.target : value };
      });
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, animate, ms]);

  if (!animate) return value;
  return t.target === value ? value : t.v;
}
