import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Brand mark: a level path that steps off a ledge. */
export function LogoMark(p: P) {
  return (
    <svg {...base} width={24} height={24} {...p}>
      <path d="M3 8h9v10h9" />
      <path d="M12 8l2.5-2.5" opacity={0.5} />
    </svg>
  );
}

export function ArrowRight(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowLeft(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function Check(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function Lock(p: P) {
  return (
    <svg {...base} {...p}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function Alert(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M12 4l9 16H3l9-16z" />
      <path d="M12 10v4M12 17v.01" />
    </svg>
  );
}

export function Shield(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function Calendar(p: P) {
  return (
    <svg {...base} {...p}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

export function Bell(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function TrendUp(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M4 17l6-6 4 4 6-7" />
      <path d="M15 8h5v5" />
    </svg>
  );
}

export function Undo(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

export function Upload(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

export function External(p: P) {
  return (
    <svg {...base} {...p}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}
