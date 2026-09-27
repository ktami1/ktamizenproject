// Slidemine — 10 s product film, 1920×1080 @ 60 fps.
// Framework: one idea per shot, key object centred, eased (never linear)
// overlapping motion, 3 colours (paper, ink, red), 100 BPM pad.
import { loadFont } from "@remotion/fonts";
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Html5Audio, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

loadFont({ family: "Geist", url: staticFile("fonts/Geist.ttf"), weight: "100 900" });
loadFont({ family: "Geist Mono", url: staticFile("fonts/GeistMono.ttf"), weight: "100 900" });

const PAPER = "#f5f5f7";
const INK = "#1d1d1f";
const RED = "#e60023";
const MUTED = "rgba(29,29,31,0.56)";

const W = 1500; // browser window width on screen
const K = W / 1440; // screenshot CSS px -> screen px
const BAR = 44; // window title bar
const X0 = (1920 - W) / 2;
const Y0 = 250;

const outExpo = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);

const ramp = (f: number, a: number, b: number, from = 0, to = 1, easing = outExpo) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

// ---------- camera ----------
type Cam = [frame: number, scale: number, fx: number, fy: number, cx: number, cy: number];
const N = (f: number): Cam => [f, 1, W / 2, 470, X0 + W / 2, Y0 + 470];
const local = (cssX: number, cssY: number) => [cssX * K, BAR + cssY * K] as const;
const CMD = local(720, 370);
const BANNER = local(720, 327);
const MENU = local(1186, 425);
const CAMERA: Cam[] = [
  N(0),
  N(118),
  [172, 1.6, CMD[0], CMD[1], 960, 540],
  [226, 1.62, CMD[0], CMD[1], 960, 540],
  [262, 1.35, BANNER[0], BANNER[1], 960, 560],
  [334, 1.42, BANNER[0], BANNER[1], 960, 560],
  N(374),
  N(468),
  [500, 1.75, MENU[0], MENU[1], 1010, 600],
  [536, 1.8, MENU[0], MENU[1], 1010, 600],
  [566, 0.94, W / 2, 470, X0 + W / 2, Y0 + 470],
];

function camera(f: number) {
  let i = 0;
  while (i < CAMERA.length - 2 && f > CAMERA[i + 1][0]) i++;
  const a = CAMERA[i];
  const b = CAMERA[i + 1];
  const p = interpolate(f, [a[0], b[0]], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: inOut });
  const [, s, fx, fy, cx, cy] = a.map((v, j) => v + (b[j] - v) * p) as Cam;
  return { s, tx: cx - X0 - s * fx, ty: cy - Y0 - s * fy };
}

// ---------- text ----------
function Headline({ text, from, to, f }: { text: string; from: number; to: number; f: number }) {
  const inP = ramp(f, from, from + 22);
  const outP = ramp(f, to - 16, to, 0, 1, inOut);
  const opacity = inP * (1 - outP);
  if (opacity <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 92,
        width: "100%",
        textAlign: "center",
        fontSize: 64,
        fontWeight: 600,
        letterSpacing: "-0.035em",
        color: INK,
        opacity,
        transform: `translateY(${(1 - inP) * 28 - outP * 18}px)`,
        filter: `blur(${(1 - inP) * 12 + outP * 8}px)`,
      }}
    >
      {text}
    </div>
  );
}

function Wordmark({ f, from, size, sub }: { f: number; from: number; size: number; sub: ReactNode }) {
  const p = ramp(f, from, from + 34);
  const q = ramp(f, from + 16, from + 46);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 22 }}>
      <div
        style={{
          fontSize: size,
          fontWeight: 650,
          letterSpacing: "-0.05em",
          color: INK,
          opacity: p,
          transform: `scale(${1.06 - 0.06 * p})`,
          filter: `blur(${(1 - p) * 22}px)`,
        }}
      >
        Slidemine<span style={{ color: RED }}>.</span>
      </div>
      <div style={{ fontSize: 34, fontWeight: 450, letterSpacing: "-0.02em", color: MUTED, opacity: q, transform: `translateY(${(1 - q) * 14}px)` }}>
        {sub}
      </div>
    </AbsoluteFill>
  );
}

// ---------- window content ----------
const shot = (name: string) => staticFile(`shots/${name}.png`);
const cssRect = (x: number, y: number, w: number, h: number): CSSProperties => ({
  position: "absolute",
  left: x * K,
  top: y * K,
  width: w * K,
  height: h * K,
});

function Layer({ opacity, children, y = 0 }: { opacity: number; children: ReactNode; y?: number }) {
  if (opacity <= 0.001) return null;
  return <div style={{ position: "absolute", inset: 0, opacity, transform: `translateY(${y}px)` }}>{children}</div>;
}

const TYPED = "mindset.daily";

function HomeOverlay({ f }: { f: number }) {
  const chars = Math.max(0, Math.min(TYPED.length, Math.floor((f - 124) / 3.4)));
  const caretOn = chars < TYPED.length ? true : Math.floor(f / 18) % 2 === 0;
  const active = ramp(f, 124, 132);
  const press = f >= 200 && f < 214 ? 1 - Math.sin(((f - 200) / 14) * Math.PI) * 0.06 : 1;
  return (
    <>
      <div style={{ ...cssRect(542.6, 350, 384, 42), background: "#fff", display: "flex", alignItems: "center", fontSize: 16 * K, color: "#0a0a0a", fontFamily: "Geist" }}>
        {TYPED.slice(0, chars)}
        <span style={{ width: 1.5 * K, height: 20 * K, background: INK, marginLeft: 1, opacity: caretOn && f < 214 ? 1 : 0 }} />
      </div>
      <div
        style={{
          ...cssRect(935.2, 348.8, 97.8, 44),
          borderRadius: 10 * K,
          background: "#0a0a0a",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8 * K,
          fontSize: 14 * K,
          fontWeight: 500,
          opacity: active,
          transform: `scale(${press})`,
        }}
      >
        <svg width={16 * K} height={16 * K} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        Avvia
      </div>
    </>
  );
}

function RunningOverlay({ f }: { f: number }) {
  const p = interpolate(f, [258, 362], [0.447, 0.68], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: inOut });
  return (
    <div style={{ ...cssRect(161, 330.6, 1118, 4), background: "#f4f4f5", borderRadius: 4 * K, overflow: "hidden" }}>
      <div style={{ width: `${p * 100}%`, height: "100%", background: "#0a0a0a", borderRadius: 4 * K }} />
    </div>
  );
}

function ExportOverlay({ f }: { f: number }) {
  const hover = ramp(f, 488, 498);
  const flash = f >= 505 && f < 520 ? Math.sin(((f - 505) / 15) * Math.PI) : 0;
  return (
    <div
      style={{
        ...cssRect(1082, 380, 208, 34),
        borderRadius: 6 * K,
        background: `rgba(29,29,31,${0.05 * hover + 0.07 * flash})`,
        mixBlendMode: "multiply",
      }}
    />
  );
}

function Pointer({ f, path }: { f: number; path: { from: number; to: number; a: [number, number]; b: [number, number]; click: number; show: [number, number] } }) {
  const vis = ramp(f, path.show[0], path.show[0] + 10) * (1 - ramp(f, path.show[1] - 10, path.show[1], 0, 1, inOut));
  if (vis <= 0.001) return null;
  const p = interpolate(f, [path.from, path.to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: inOut });
  const x = path.a[0] + (path.b[0] - path.a[0]) * p;
  const y = path.a[1] + (path.b[1] - path.a[1]) * p;
  const press = f >= path.click && f < path.click + 12 ? 1 - Math.sin(((f - path.click) / 12) * Math.PI) * 0.15 : 1;
  return (
    <svg
      width={26}
      height={34}
      viewBox="0 0 26 34"
      style={{ position: "absolute", left: x, top: y, opacity: vis, transform: `scale(${press})`, transformOrigin: "2px 2px", filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))" }}
    >
      <path d="M2 2 L2 27 L8.5 21 L13 31.5 L17.5 29.5 L13 19.5 L22 19.5 Z" fill={INK} stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

function BrowserWindow({ f }: { f: number }) {
  const enter = ramp(f, 58, 112);
  const exit = ramp(f, 538, 566, 0, 1, inOut);
  const cam = camera(f);
  const home = 1 - ramp(f, 244, 262, 0, 1, inOut);
  const running = ramp(f, 244, 262, 0, 1, inOut) * (1 - ramp(f, 358, 376, 0, 1, inOut));
  const results = ramp(f, 358, 376, 0, 1, inOut) * (1 - ramp(f, 470, 480, 0, 1, inOut));
  const exportL = ramp(f, 470, 480, 0, 1, inOut);
  const scroll = interpolate(f, [360, 470], [760, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.33, 0, 0.15, 1) });

  return (
    <div
      style={{
        position: "absolute",
        left: X0,
        top: Y0,
        width: W,
        transformOrigin: "0 0",
        transform: `translate(${cam.tx}px, ${cam.ty + (1 - enter) * 620 + exit * 40}px) scale(${cam.s})`,
        opacity: enter * (1 - exit),
      }}
    >
      <div
        style={{
          borderRadius: 18,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 50px 100px rgba(0,0,0,0.12), 0 12px 30px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ height: BAR, display: "flex", alignItems: "center", padding: "0 18px", gap: 8, borderBottom: "1px solid #ececf0", background: "#fbfbfd", position: "relative" }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: "#dcdce1" }} />
          ))}
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              height: 28,
              padding: "0 80px",
              borderRadius: 8,
              background: "#f0f0f3",
              display: "flex",
              alignItems: "center",
              fontSize: 14,
              color: MUTED,
            }}
          >
            slidemine.app
          </div>
        </div>
        <div style={{ position: "relative", height: 900 * K, overflow: "hidden", background: "#fafafa" }}>
          <Layer opacity={home}>
            <Img src={shot("home")} style={{ width: W, display: "block" }} />
            <HomeOverlay f={f} />
          </Layer>
          <Layer opacity={running}>
            <Img src={shot("running")} style={{ width: W, display: "block" }} />
            <RunningOverlay f={f} />
          </Layer>
          <Layer opacity={results} y={-scroll * K}>
            <Img src={shot("results-full")} style={{ width: W, display: "block" }} />
          </Layer>
          <Layer opacity={exportL}>
            <Img src={shot("export")} style={{ width: W, display: "block" }} />
            <ExportOverlay f={f} />
          </Layer>
        </div>
      </div>
      <Pointer f={f} path={{ from: 150, to: 194, a: [1180, 640], b: [984 * K, BAR + 366 * K], click: 200, show: [140, 246] }} />
      <Pointer f={f} path={{ from: 478, to: 498, a: [1120 * K, BAR + 300 * K], b: [1244 * K, BAR + 404 * K], click: 505, show: [474, 538] }} />
    </div>
  );
}

export const Promo = () => {
  const f = useCurrentFrame();
  const titleOut = ramp(f, 76, 100, 0, 1, inOut);
  const band = ramp(f, 90, 110) * (1 - ramp(f, 540, 560, 0, 1, inOut));
  return (
    <AbsoluteFill style={{ background: PAPER, fontFamily: "Geist, system-ui, sans-serif", overflow: "hidden" }}>
      <Html5Audio src={staticFile("music.wav")} />

      {f < 104 && (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - titleOut, transform: `scale(${1 - titleOut * 0.05})`, filter: `blur(${titleOut * 10}px)` }}>
          <Wordmark f={f} from={4} size={150} sub="Il testo dei post migliori. In ordine." />
        </div>
      )}

      <BrowserWindow f={f} />

      {/* keeps headlines legible when the camera pushes in */}
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 290, opacity: band, background: `linear-gradient(${PAPER} 0%, ${PAPER} 64%, rgba(245,245,247,0) 100%)` }} />

      <Headline f={f} from={102} to={244} text="Scrivi un profilo." />
      <Headline f={f} from={250} to={360} text="Legge ogni slide." />
      <Headline f={f} from={366} to={470} text="In ordine di popolarità." />
      <Headline f={f} from={476} to={546} text="Scarica i dati." />

      {f >= 548 && (
        <Wordmark
          f={f}
          from={550}
          size={120}
          sub={<span style={{ fontFamily: "Geist Mono", fontSize: 28, letterSpacing: "0.02em" }}>Markdown · CSV · JSON</span>}
        />
      )}
    </AbsoluteFill>
  );
};
