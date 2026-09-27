// Shared tokens and motion primitives for the Slidemine promo.
// Framework rules: 3 colours (paper, ink, red), eased motion only, one idea per shot.
import type { CSSProperties, ReactNode } from "react";
import { Easing, interpolate, spring } from "remotion";

export const FPS = 60;
export const PAPER = "#f5f5f7";
export const INK = "#0a0a0a";
export const RED = "#e60023";
export const GREY = "#86868b";

export const outExpo = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);
export const inExpo = Easing.bezier(0.7, 0, 0.84, 0);

export const ramp = (f: number, a: number, b: number, from = 0, to = 1, easing = outExpo) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

export const pop = (f: number, at: number, damping = 12) =>
  spring({ frame: f - at, fps: FPS, config: { damping, stiffness: 170, mass: 0.8 } });

/** Text whose trailing full stop is the brand's red dot. */
export function Dotted({ text }: { text: string }) {
  if (!text.endsWith(".")) return <>{text}</>;
  return (
    <>
      {text.slice(0, -1)}
      <span style={{ color: RED }}>.</span>
    </>
  );
}

/** Words rise from a mask one after another (Apple keynote title). */
export function Words({ text, f, inAt, outAt, stagger = 3, style }: { text: string; f: number; inAt: number; outAt: number; stagger?: number; style?: CSSProperties }) {
  const words = text.split(" ");
  return (
    <div style={style}>
      {words.map((w, i) => {
        const p = ramp(f, inAt + i * stagger, inAt + i * stagger + 26);
        const q = ramp(f, outAt + i * 2, outAt + i * 2 + 14, 0, 1, inExpo);
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", padding: "0.06em 0 0.14em", margin: "-0.06em 0 -0.14em" }}>
            <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 115 - q * 115}%)` }}>
              <Dotted text={w} />
              {i < words.length - 1 ? " " : ""}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function Headline({ text, f, inAt, outAt }: { text: string; f: number; inAt: number; outAt: number }) {
  return (
    <Words
      text={text}
      f={f}
      inAt={inAt}
      outAt={outAt}
      style={{ position: "absolute", top: 92, width: "100%", textAlign: "center", fontSize: 76, fontWeight: 650, letterSpacing: "-0.045em", color: INK, zIndex: 10 }}
    />
  );
}

/** Single phrase that slams in on the beat. */
export function Slam({ text, f, inAt, outAt, color = "#fff", size = 190 }: { text: string; f: number; inAt: number; outAt: number; color?: string; size?: number }) {
  const p = ramp(f, inAt, inAt + 10);
  const q = ramp(f, outAt - 7, outAt, 0, 1, inExpo);
  if (f < inAt || f > outAt) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size,
        fontWeight: 700,
        letterSpacing: "-0.055em",
        color,
        opacity: p * (1 - q),
        transform: `scale(${1.28 - 0.28 * p - 0.06 * q})`,
        filter: `blur(${(1 - p) * 22 + q * 14}px)`,
      }}
    >
      <Dotted text={text} />
    </div>
  );
}

/** "Slidemine" with letters rising in and a red dot that pops (and can blow up). */
export function Wordmark({ f, inAt, size, color, dotScale = 1, sub, subAt, fadeAt }: { f: number; inAt: number; size: number; color: string; dotScale?: number; sub?: ReactNode; subAt?: number; fadeAt?: number }) {
  const letters = "Slidemine".split("");
  const dot = pop(f, inAt + 20, 9);
  const fade = fadeAt == null ? 0 : ramp(f, fadeAt, fadeAt + 10, 0, 1, inOut);
  const subP = subAt == null ? 0 : ramp(f, subAt, subAt + 24);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: size * 0.16 }}>
      <div style={{ display: "flex", alignItems: "baseline", fontSize: size, fontWeight: 680, letterSpacing: "-0.055em", color }}>
        {letters.map((c, i) => {
          const p = ramp(f, inAt + i * 2, inAt + i * 2 + 24);
          return (
            <span key={i} style={{ display: "inline-block", overflow: "hidden", padding: "0.05em 0 0.12em", margin: "-0.05em 0 -0.12em", opacity: 1 - fade }}>
              <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 110}%)` }}>{c}</span>
            </span>
          );
        })}
        <span
          style={{
            display: "inline-block",
            width: size * 0.19,
            height: size * 0.19,
            marginLeft: size * 0.03,
            borderRadius: "50%",
            background: RED,
            transform: `scale(${dot * dotScale})`,
            position: "relative",
            zIndex: 5,
          }}
        />
      </div>
      {sub && (
        <div style={{ fontSize: size * 0.2, fontWeight: 480, letterSpacing: "-0.02em", color: GREY, opacity: subP * (1 - fade), transform: `translateY(${(1 - subP) * 18}px)` }}>{sub}</div>
      )}
    </div>
  );
}

// ---------- browser window ----------
export const WIN = 1500;
export const K = WIN / 1440;
export const BAR = 44;
export const WX = (1920 - WIN) / 2;
export const WY = 250;

export function BrowserFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ borderRadius: 20, overflow: "hidden", background: "#fff", boxShadow: "0 60px 120px rgba(0,0,0,0.16), 0 14px 34px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)" }}>
      <div style={{ height: BAR, display: "flex", alignItems: "center", padding: "0 18px", gap: 8, borderBottom: "1px solid #ececf0", background: "#fbfbfd", position: "relative" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: "#dcdce1" }} />
        ))}
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", height: 28, padding: "0 84px", borderRadius: 8, background: "#f0f0f3", display: "flex", alignItems: "center", fontSize: 14, color: GREY }}>
          slidemine.app
        </div>
      </div>
      <div style={{ position: "relative", height: 900 * K, overflow: "hidden", background: "#fafafa" }}>{children}</div>
    </div>
  );
}

export const cssRect = (x: number, y: number, w: number, h: number): CSSProperties => ({ position: "absolute", left: x * K, top: y * K, width: w * K, height: h * K });
export const local = (cssX: number, cssY: number) => [cssX * K, BAR + cssY * K] as const;

// camera: [frame, scale, focusX, focusY, screenX, screenY] in window-local px
export type Cam = [number, number, number, number, number, number];
export const NEUTRAL = (f: number): Cam => [f, 1, WIN / 2, 470, WX + WIN / 2, WY + 470];
export function camera(keys: Cam[], f: number) {
  let i = 0;
  while (i < keys.length - 2 && f > keys[i + 1][0]) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const p = interpolate(f, [a[0], b[0]], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: inOut });
  const [, s, fx, fy, cx, cy] = a.map((v, j) => v + (b[j] - v) * p) as Cam;
  return { s, tx: cx - WX - s * fx, ty: cy - WY - s * fy };
}

export function Pointer({ f, from, to, a, b, click, show }: { f: number; from: number; to: number; a: [number, number]; b: [number, number]; click: number; show: [number, number] }) {
  const vis = ramp(f, show[0], show[0] + 8) * (1 - ramp(f, show[1] - 8, show[1], 0, 1, inOut));
  if (vis <= 0.001) return null;
  const p = interpolate(f, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: inOut });
  const x = a[0] + (b[0] - a[0]) * p;
  const y = a[1] + (b[1] - a[1]) * p;
  const press = f >= click && f < click + 10 ? 1 - Math.sin(((f - click) / 10) * Math.PI) * 0.18 : 1;
  return (
    <svg width={26} height={34} viewBox="0 0 26 34" style={{ position: "absolute", left: x, top: y, opacity: vis, transform: `scale(${press})`, transformOrigin: "2px 2px", filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))", zIndex: 20 }}>
      <path d="M2 2 L2 27 L8.5 21 L13 31.5 L17.5 29.5 L13 19.5 L22 19.5 Z" fill={INK} stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

export function Ripple({ f, at, x, y, color = INK }: { f: number; at: number; x: number; y: number; color?: string }) {
  const p = ramp(f, at, at + 26);
  if (f < at || p >= 1) return null;
  const r = 10 + p * 110;
  return <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `2px solid ${color}`, opacity: (1 - p) * 0.35, zIndex: 19 }} />;
}
