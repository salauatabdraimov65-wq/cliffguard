import { ImageResponse } from "next/og";

// Link preview for chats, forms and social posts (1200x630). System fonts only: no network at build.
export const alt = "CliffGuard — Earn $1 more. Lose $10,500.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const bars = [92, 90, 88, 86, 84, 82, 80, 78, 76, 74];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f3efe6",
          padding: "64px 72px",
          fontFamily: "sans-serif",
          color: "#1d1b17",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 600 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#1d1b17", display: "flex" }} />
          CliffGuard
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 78, fontWeight: 600, lineHeight: 1.05 }}>Earn $1 more.</div>
            <div style={{ fontSize: 78, fontWeight: 600, lineHeight: 1.05, color: "#b4441e" }}>Lose $10,500.</div>
            <div style={{ fontSize: 28, color: "#5b564c", marginTop: 20, maxWidth: 640 }}>
              The ACA subsidy cliff is back. See what it costs your family and the legal way back under it.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 260 }}>
            {bars.map((h, i) => (
              <div key={i} style={{ width: 22, height: `${h}%`, background: "#9fd3bd", borderRadius: 4, display: "flex" }} />
            ))}
            <div style={{ width: 3, height: "100%", background: "#1d1b17", display: "flex" }} />
            {[0, 1, 2, 3].map((i) => (
              <div key={`z${i}`} style={{ width: 22, height: 6, background: "#f0b49b", borderRadius: 3, display: "flex" }} />
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
