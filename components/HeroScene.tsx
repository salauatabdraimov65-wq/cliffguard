"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subsidyFor } from "@/lib/engine";
import { usd } from "./format";

/*
  Hero scene — the subsidy cliff as a lit, three-dimensional ledge.
  Storyboard (vizavi-motion: one causal thread, moving camera, typography in
  the action; design-motion-principles: rare once-per-visit entrance, so
  Jakub/Jhey weighting, reduced-motion renders the final frame):
    0.2s  columns rise out of the ground in a left-to-right wave
    1.0s  the household marker lands on the first column
    1.1s  it walks the plateau; the income counter runs $110,000 -> $132,000
    2.6s  it stops at the edge. A beat. "+$1"
    2.95s one step right — and it drops. The credit flips to $0.
    3.4s  impact; the headline's second line lands with it (CSS, same clock)
  The camera drifts the whole time and settles at 3.8s; afterwards the scene
  is a scrubbable chart — pointer x = household income.
  Rendering: a small perspective projector to inline SVG, painter-sorted
  boxes, back-face culled. No WebGL, no dependencies.
*/

const HH = 4;
const BENCH = 24000;
const CLIFF = 132000;
const STEP = 2000;
const MIN = CLIFF - 11 * STEP;
const N = 23;

const PITCH = 1.14; // column spacing (world units)
const W = 1.0; // column width
const D = 4.6; // column depth — deep slabs read as a ledge, not a bar chart
const HS = 0.33; // world units per $1,000 of credit
const STUB = 0.07;

const T = {
  rise: 200,
  riseEach: 34,
  riseDur: 720,
  land: 1000,
  walk0: 1150,
  walk1: 2600,
  plus: 2780,
  hop: 2950,
  impact: 3400,
  settle: 3700,
  camEnd: 3900,
};

// face colours come from the theme (globals.css: --s-*), light or dark with the device
const COL = {
  safe: { top: "var(--s-safe-top)", front: "var(--s-safe-front)", side: "var(--s-safe-side)" },
  loss: { top: "var(--s-loss-top)", front: "var(--s-loss-front)", side: "var(--s-loss-side)" },
};

// Chips that break off the edge when the household drops (deterministic: same on every load).
const DEBRIS = Array.from({ length: 11 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 97.13 + n * 13.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    y: -D / 2 + r(1) * D * 0.9, // where along the edge
    z0: 0.55 + r(2) * 0.45, // fraction of the edge height it starts at
    vx: 0.6 + r(3) * 1.6, // outward speed, units/s
    size: 0.1 + r(4) * 0.16,
    spin: (r(5) - 0.5) * 14,
    delay: r(6) * 140,
    tone: r(7) > 0.5 ? "var(--s-safe-side)" : "var(--s-safe-front)",
  };
});
const G = 30; // gravity, units/s²

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeIn = (k: number) => k * k;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const credit = (inc: number) => subsidyFor(inc, HH, BENCH);
const colX = (i: number) => (i - 11) * PITCH;
const incomeToX = (inc: number) => ((inc - MIN) / STEP - 11) * PITCH;
const heightAt = (inc: number) => (inc > CLIFF ? STUB : (credit(inc) / 1000) * HS);
const COL_H = Array.from({ length: N }, (_, i) => heightAt(MIN + i * STEP));

type Cam = { yaw: number; pitch: number; dist: number };
type Frame = {
  rise: number[];
  markerInc: number;
  markerX: number;
  markerZ: number;
  markerOn: number; // 0..1 scale-in
  fallen: boolean;
  plus: number; // 0..1 chip visibility
  cam: Cam;
  flash: number; // above-cliff highlight after impact
  t: number;
};

function timeline(t: number, reduce: boolean): Frame {
  if (reduce) t = 99999;
  const tNow = t;
  const rise = COL_H.map((_, i) => easeOut(clamp((t - T.rise - i * T.riseEach) / T.riseDur)));

  let markerInc = MIN;
  let markerX = colX(0);
  let markerZ = COL_H[0];
  let fallen = false;

  if (t >= T.walk0) {
    const k = easeInOut(clamp((t - T.walk0) / (T.walk1 - T.walk0)));
    markerInc = Math.round(lerp(MIN, CLIFF, k) / 10) * 10;
    markerX = incomeToX(markerInc);
    markerZ = heightAt(markerInc);
  }
  if (t >= T.hop) {
    // the one-dollar step: a short arc right, then gravity
    markerInc = CLIFF + 1;
    const hopK = clamp((t - T.hop) / 160);
    const fallK = clamp((t - T.hop - 160) / (T.impact - T.hop - 160));
    markerX = lerp(incomeToX(CLIFF), incomeToX(CLIFF) + PITCH * 0.78, easeOut(hopK));
    const top = COL_H[11];
    const arc = Math.sin(hopK * Math.PI) * 0.35;
    markerZ = hopK < 1 ? top + arc : lerp(top, STUB, easeIn(fallK));
    if (t >= T.impact) {
      const b = clamp((t - T.impact) / 260);
      markerZ = STUB + Math.sin(b * Math.PI) * 0.32 * (1 - b);
    }
    fallen = t >= T.impact - 60;
  }

  const ck = easeInOut(clamp(t / T.camEnd));
  const cam = { yaw: lerp(-0.8, REST.yaw, ck), pitch: lerp(0.5, REST.pitch, ck), dist: lerp(35, REST.dist, ck) };
  const markerOn = easeOut(clamp((t - T.land) / 260));
  const plus = t < T.plus ? 0 : t < T.impact + 500 ? 1 : 1 - clamp((t - T.impact - 500) / 300);
  const flash = t < T.impact ? 0 : 1 - clamp((t - T.impact) / 900);
  return { rise, markerInc, markerX, markerZ, markerOn, fallen, plus, cam, flash, t: tNow };
}

const REST: Cam = { yaw: -0.5, pitch: 0.34, dist: 29 };
const READOUT = 72; // px reserved under the scene for the live readout
const LABEL = 40; // px reserved above for the cliff label

function fitFrame(w: number, h: number) {
  const cY = Math.cos(REST.yaw);
  const sY = Math.sin(REST.yaw);
  const cP = Math.cos(REST.pitch);
  const sP = Math.sin(REST.pitch);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  COL_H.forEach((hgt, i) => {
    for (const x of [colX(i) - W / 2, colX(i) + W / 2])
      for (const y of [-D / 2, D / 2])
        for (const z of [0, hgt + (i === 11 ? 2.1 : 0)]) {
          const xr = x * cY + y * sY;
          const yr = -x * sY + y * cY;
          const k = REST.dist / (REST.dist + (yr * cP - z * sP));
          const px = xr * k;
          const py = -(yr * sP + z * cP) * k;
          minX = Math.min(minX, px);
          maxX = Math.max(maxX, px);
          minY = Math.min(minY, py);
          maxY = Math.max(maxY, py);
        }
  });
  const availH = Math.max(120, h - READOUT - LABEL);
  const unit = Math.min((w * (w < 560 ? 0.96 : 1.04)) / (maxX - minX), availH / (maxY - minY));
  return {
    unit,
    cx: w / 2 - ((minX + maxX) / 2) * unit,
    cy: LABEL + availH / 2 - ((minY + maxY) / 2) * unit,
  };
}

export function HeroScene() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 760, h: 520 });
  const [frame, setFrame] = useState<Frame>(() => timeline(0, false));
  const [scrub, setScrub] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const live = useRef({ t0: 0, done: false, reduce: false, yawOff: 0, yawTarget: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // the intro clock + after-intro easing (parallax, scrub)
  useEffect(() => {
    const L = live.current;
    L.reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    L.t0 = performance.now();
    const root = document.documentElement;
    let raf = 0;
    let impacted = false;
    let settled = false;
    const loop = (now: number) => {
      const t = now - L.t0;
      const prevYaw = L.yawOff;
      L.yawOff += (L.yawTarget - L.yawOff) * 0.08;
      // after the intro, only re-render while the camera is still easing
      const moving = Math.abs(L.yawOff - prevYaw) > 0.00005;
      if (!settled || moving) {
        const f = timeline(t, L.reduce);
        f.cam = { ...f.cam, yaw: f.cam.yaw + L.yawOff };
        setFrame(f);
      }
      if (!impacted && (L.reduce || t >= T.impact - 40)) {
        impacted = true;
        root.dataset.heroImpact = "1"; // the headline's second line lands on the same clock
      }
      if ((t > T.camEnd || L.reduce) && !L.done) {
        L.done = true;
        setDone(true);
      }
      settled = L.done && t > 4900; // keep drawing until the last chip has faded
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      delete root.dataset.heroImpact;
    };
  }, []);

  // ---- projection -------------------------------------------------------
  const { w, h } = size;
  const narrow = w < 560;
  // frame the ledge inside its own box (fitted on the resting camera, so the
  // drift during the intro is a real camera move, not a re-crop)
  const fit = fitFrame(w, h);
  const unit = fit.unit * (29 / frame.cam.dist);
  const cx = fit.cx;
  const cy = fit.cy;
  const cY = Math.cos(frame.cam.yaw);
  const sY = Math.sin(frame.cam.yaw);
  const cP = Math.cos(frame.cam.pitch);
  const sP = Math.sin(frame.cam.pitch);
  const dist = frame.cam.dist;

  const proj = useCallback(
    (x: number, y: number, z: number): [number, number, number] => {
      const xr = x * cY + y * sY;
      const yr = -x * sY + y * cY;
      const depth = yr * cP - z * sP;
      const up = yr * sP + z * cP;
      const k = dist / (dist + depth);
      return [cx + xr * unit * k, cy - up * unit * k, depth];
    },
    [cY, sY, cP, sP, dist, cx, cy, unit],
  );

  // scrubbed or scripted marker
  let mInc = frame.markerInc;
  let mX = frame.markerX;
  let mZ = frame.markerZ;
  if (scrub !== null && done) {
    mInc = scrub;
    mX = incomeToX(scrub);
    mZ = heightAt(scrub);
  }
  const fallen = mInc > CLIFF;

  const onMove = (e: React.PointerEvent) => {
    const L = live.current;
    const r = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    L.yawTarget = (nx - 0.5) * 0.12;
    if (!L.done) return;
    // invert x on the ground line through the column centres
    const a = proj(colX(0), 0, 0)[0];
    const b = proj(colX(N - 1), 0, 0)[0];
    const k = clamp((e.clientX - r.left - a) / (b - a));
    const inc = Math.round(lerp(MIN, MIN + (N - 1) * STEP, k) / 100) * 100;
    setScrub(inc === CLIFF ? CLIFF : inc);
  };

  // ---- geometry ---------------------------------------------------------
  type Poly = { pts: string; fill: string; depth: number; opacity?: number };
  const polys: Poly[] = [];
  const pathOf = (p: [number, number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = (p: [number, number, number][]) => {
    let s = 0;
    for (let i = 0; i < p.length; i++) {
      const [x1, y1] = p[i];
      const [x2, y2] = p[(i + 1) % p.length];
      s += x1 * y2 - x2 * y1;
    }
    return s;
  };

  const boxes = COL_H.map((full, i) => {
    const hgt = Math.max(0.001, full * frame.rise[i]);
    const x0 = colX(i) - W / 2;
    const x1 = x0 + W;
    const y0 = -D / 2;
    const y1 = D / 2;
    const above = MIN + i * STEP > CLIFF;
    const c = above ? COL.loss : COL.safe;
    const faces: { v: [number, number, number][]; fill: string }[] = [
      { v: [proj(x0, y0, 0), proj(x1, y0, 0), proj(x1, y0, hgt), proj(x0, y0, hgt)], fill: c.front },
      { v: [proj(x1, y0, 0), proj(x1, y1, 0), proj(x1, y1, hgt), proj(x1, y0, hgt)], fill: c.side },
      { v: [proj(x0, y1, 0), proj(x0, y0, 0), proj(x0, y0, hgt), proj(x0, y1, hgt)], fill: c.side },
      { v: [proj(x0, y0, hgt), proj(x1, y0, hgt), proj(x1, y1, hgt), proj(x0, y1, hgt)], fill: c.top },
    ];
    const centerDepth = proj(colX(i), 0, hgt / 2)[2];
    return { faces, depth: centerDepth, above, i };
  });
  boxes.sort((a, b) => b.depth - a.depth);
  for (const bx of boxes) {
    for (const f of bx.faces) {
      if (area(f.v) >= 0) continue; // back face
      polys.push({
        pts: pathOf(f.v),
        fill: f.fill,
        depth: bx.depth,
        opacity: bx.above ? 0.75 + 0.25 * frame.flash : 1,
      });
    }
  }

  // ground: ledger lines running with the income axis
  const ground: string[] = [];
  for (let gy = -3; gy <= 5; gy++) {
    const yy = gy * 1.4;
    const a = proj(colX(0) - 2.5, yy, 0);
    const b = proj(colX(N - 1) + 2.5, yy, 0);
    ground.push(`M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}`);
  }

  // cliff marker line + label
  const edgeX = (colX(11) + colX(12)) / 2;
  const edgeTop = proj(edgeX, -D / 2, COL_H[11] * frame.rise[11] + 2.1);
  const edgeGround = proj(edgeX, -D / 2, 0);

  // household marker
  const mk = proj(mX, 0, mZ + 0.32);
  const sh = proj(mX, 0, (mInc > CLIFF ? STUB : heightAt(Math.min(mInc, CLIFF))) + 0.01);
  const mr = Math.max(6, unit * 0.34) * frame.markerOn;

  const axisL = proj(colX(0), -D / 2 - 0.9, 0);
  const axisR = proj(colX(N - 1), -D / 2 - 0.9, 0);

  const shownCredit = fallen ? 0 : credit(Math.min(mInc, CLIFF));

  // contact shadow: the ledge footprint, pushed away from the light and blurred
  const foot = [
    proj(colX(0) - W / 2 + 0.4, -D / 2 + 0.6, 0),
    proj(colX(N - 1) + W / 2 + 0.4, -D / 2 + 0.6, 0),
    proj(colX(N - 1) + W / 2 + 1.2, D / 2 + 1.4, 0),
    proj(colX(0) - W / 2 + 1.2, D / 2 + 1.4, 0),
  ];
  const riseAll = frame.rise.reduce((a, b) => a + b, 0) / N;

  // chips breaking off the edge as the household drops — each a small tumbling square on the cliff face
  const debris: { pts: string; fill: string; o: number }[] = [];
  if (scrub === null) {
    const edgeH = COL_H[11];
    const x0 = colX(11) + W / 2;
    for (const d of DEBRIS) {
      const s = (frame.t - (T.hop + 120 + d.delay)) / 1000;
      if (s <= 0) continue;
      const zStart = edgeH * d.z0;
      const tLand = Math.sqrt((2 * Math.max(0, zStart - STUB)) / G);
      const sf = Math.min(s, tLand);
      const x = x0 + 0.05 + d.vx * sf;
      const z = Math.max(STUB, zStart - 0.5 * G * sf * sf);
      const o = s < tLand ? 1 : Math.max(0, 1 - (s - tLand) / 0.6);
      if (o <= 0) continue;
      const a = d.spin * sf;
      const c = Math.cos(a) * d.size;
      const n = Math.sin(a) * d.size;
      const pts = [
        proj(x - c + n, d.y, z - n - c),
        proj(x + c + n, d.y, z + n - c),
        proj(x + c - n, d.y, z + n + c),
        proj(x - c - n, d.y, z - n + c),
      ];
      debris.push({ pts: pathOf(pts), fill: d.tone, o });
    }
  }

  // the landing ring: dust kicked up on impact, spreading across the ground
  let ring = "";
  let ringO = 0;
  if (scrub === null && frame.t > T.impact) {
    const k = clamp((frame.t - T.impact) / 800);
    if (k < 1) {
      const r = 0.3 + 2.4 * easeOut(k);
      const lx = incomeToX(CLIFF) + PITCH * 0.78;
      ring = pathOf(
        Array.from({ length: 28 }, (_, i) => {
          const a = (i / 28) * Math.PI * 2;
          return proj(lx + Math.cos(a) * r, Math.sin(a) * r * 0.9, STUB + 0.01);
        }),
      );
      ringO = (1 - k) * 0.7;
    }
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={boxRef}
        className="absolute inset-0 touch-pan-y"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => {
          live.current.yawTarget = 0;
          setScrub(null);
        }}
        aria-hidden="true"
      >
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block overflow-visible">
          <defs>
            <radialGradient id="hs-floor" cx="50%" cy="62%" r="60%">
              <stop offset="0%" style={{ stopColor: "var(--h-floor)" }} />
              <stop offset="100%" style={{ stopColor: "var(--h-bg)", stopOpacity: 0 }} />
            </radialGradient>
            <filter id="hs-soft" x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation={Math.max(6, unit * 0.5)} />
            </filter>
          </defs>
          <rect x="0" y="0" width={w} height={h} fill="url(#hs-floor)" />
          <path d={ground.join("")} stroke="var(--h-grid)" strokeWidth={1} fill="none" />
          <polygon points={pathOf(foot)} fill="#000" style={{ opacity: `calc(var(--h-shadow) * ${riseAll.toFixed(3)})` }} filter="url(#hs-soft)" />
          {ring && <polygon points={ring} fill="none" stroke="var(--h-ink-3)" strokeWidth={1.25} opacity={ringO} />}

          {polys.map((p, i) => (
            <polygon key={i} points={p.pts} fill={p.fill} opacity={p.opacity} stroke={p.fill} strokeWidth={0.6} strokeLinejoin="round" />
          ))}
          {debris.map((d, i) => (
            <polygon key={`d${i}`} points={d.pts} fill={d.fill} opacity={d.o} />
          ))}

          {/* the cliff edge */}
          <line x1={edgeGround[0]} y1={edgeGround[1]} x2={edgeTop[0]} y2={edgeTop[1]} stroke="var(--h-ink-3)" strokeWidth={1} opacity={frame.rise[11]} />
          <g opacity={frame.rise[11]}>
            <text x={edgeTop[0]} y={edgeTop[1] - 10} textAnchor="middle" className="font-mono" fontSize={narrow ? 11 : 13} fill="var(--h-ink)">
              $132,000 · 400% FPL
            </text>
          </g>

          {/* axis ends */}
          <text x={axisL[0]} y={axisL[1] + 18} textAnchor="middle" className="font-mono" fontSize={11} fill="var(--h-ink-3)" opacity={frame.rise[0]}>
            $110k
          </text>
          <text x={axisR[0]} y={axisR[1] + 18} textAnchor="middle" className="font-mono" fontSize={11} fill="var(--h-ink-3)" opacity={frame.rise[N - 1]}>
            $154k
          </text>

          {/* household marker: shadow, then the puck */}
          {frame.markerOn > 0 && (
            <g>
              <ellipse cx={sh[0]} cy={sh[1]} rx={mr * 1.1} ry={mr * 0.42} fill="rgb(0 0 0 / 0.28)" />
              <circle
                cx={mk[0]}
                cy={mk[1]}
                r={mr}
                fill={fallen ? "var(--s-loss-front)" : "var(--s-marker)"}
                stroke="var(--s-marker-ring)"
                strokeWidth={2.5}
              />
              {frame.plus > 0 && scrub === null && (
                <g opacity={frame.plus} transform={`translate(${mk[0] + mr + 10} ${mk[1] - mr - 8})`}>
                  <rect x={0} y={-15} width={44} height={24} rx={6} fill="var(--s-chip)" />
                  <text x={22} y={2} textAnchor="middle" fontSize={14} fontWeight={600} fill="var(--s-chip-ink)" className="font-mono">
                    +$1
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* live readout — a worksheet strip */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-1 sm:bottom-2">
        <div className="flex flex-col">
          <span className="font-mono text-[11px] text-[var(--h-ink-3)] sm:text-[12px]">Household income</span>
          <span className="font-mono text-xl text-[var(--h-ink)] num sm:text-2xl">{usd(mInc)}</span>
        </div>
        <p className={`hidden self-center font-mono text-[12px] text-[var(--h-ink-3)] transition-opacity duration-500 lg:block ${done ? "opacity-100" : "opacity-0"}`}>
          Move across the ledge to try any income
        </p>
        <div className="flex flex-col items-end">
          <span className="font-mono text-[11px] text-[var(--h-ink-3)] sm:text-[12px]">Premium tax credit</span>
          <span className={`font-mono text-xl num sm:text-2xl ${fallen ? "text-loss-ink" : "text-safe-ink"}`}>
            {fallen && <span className="mr-2 text-base text-[var(--h-ink-3)] line-through">{usd(credit(CLIFF))}</span>}
            {usd(shownCredit)}
          </span>
        </div>
      </div>
    </div>
  );
}
