"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/** Fires once when the element is ~20% into the viewport. */
export function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

/**
 * Scroll reveal: rise 16px + fade, 600ms on the house curve. Children marked
 * data-reveal-item stagger by `stagger` ms. Reduced motion: shown at once (CSS).
 */
export function Reveal({
  as: Tag = "div",
  children,
  className = "",
  stagger = 70,
  delay = 0,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      className={`reveal ${seen ? "is-in" : ""} ${className}`}
      style={{ ["--stagger" as string]: `${stagger}ms`, ["--delay" as string]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
