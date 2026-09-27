import type { CSSProperties } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import slidesMeta from "../public/slides/slides.json";
import {
  BAR, BrowserFrame, camera, type Cam, cssRect, GREY, Headline, inExpo, INK, inOut, K, local, NEUTRAL, PAPER, Pointer, pop, ramp, RED, Ripple, Slam, WIN, Wordmark, WX, WY,
} from "./lib";

const shot = (name: string) => staticFile(`shots/${name}.png`);

// ============ 1 · cold open (0–250) ============
export function ColdOpen() {
  const f = useCurrentFrame();
  const blow = interpolate(f, [224, 246], [1, 90], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: inExpo });
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Slam text="Ogni post." f={f} inAt={12} outAt={54} />
      <Slam text="Ogni carousel." f={f} inAt={60} outAt={102} />
      <Slam text="Ogni frase." f={f} inAt={108} outAt={152} />
      {f >= 156 && (
        <Wordmark f={f} inAt={158} size={190} color="#fff" dotScale={blow} sub="Il testo dei post migliori. In ordine." subAt={188} fadeAt={218} />
      )}
    </AbsoluteFill>
  );
}

// ============ 2 · type a profile (240–490) ============
const CMD = local(720, 370);
const TYPED = "mindset.daily";

export function TypeProfile() {
  const f = useCurrentFrame();
  const reveal = ramp(f, 0, 24) * 1500;
  const enter = ramp(f, 4, 58);
  const keys: Cam[] = [NEUTRAL(0), NEUTRAL(62), [100, 1.8, CMD[0], CMD[1], 960, 560], [192, 1.84, CMD[0], CMD[1], 960, 560], [240, 5, CMD[0], CMD[1], 960, 560]];
  const cam = camera(keys, f);
  const through = ramp(f, 200, 236, 0, 1, inExpo);
  const chars = Math.max(0, Math.min(TYPED.length, Math.floor((f - 92) / 3)));
  const active = ramp(f, 92, 98);
  const press = f >= 145 && f < 157 ? 1 - Math.sin(((f - 145) / 12) * Math.PI) * 0.07 : 1;
  const btn: [number, number] = [984 * K, BAR + 371 * K];

  return (
    <AbsoluteFill style={{ background: RED }}>
      <AbsoluteFill style={{ background: PAPER, clipPath: `circle(${reveal}px at 50% 50%)`, perspective: 2400 }}>
        <div
          style={{
            position: "absolute",
            left: WX,
            top: WY,
            width: WIN,
            transformOrigin: "0 0",
            transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})`,
            opacity: 1 - through,
            filter: `blur(${through * 18}px)`,
          }}
        >
          <div style={{ transformOrigin: "50% 0%", transform: `translateY(${(1 - enter) * 420}px) rotateX(${(1 - enter) * 42}deg) scale(${0.82 + 0.18 * enter})` }}>
            <BrowserFrame>
              <Img src={shot("home")} style={{ width: WIN, display: "block" }} />
              <div style={{ ...cssRect(542.6, 350, 384, 42), background: "#fff", display: "flex", alignItems: "center", fontSize: 16 * K, color: INK }}>
                {TYPED.slice(0, chars)}
                <span style={{ width: 1.5 * K, height: 20 * K, background: INK, marginLeft: 1, opacity: f < 150 && (chars < TYPED.length || Math.floor(f / 16) % 2 === 0) ? 1 : 0 }} />
              </div>
              <div style={{ ...cssRect(935.2, 348.8, 97.8, 44), borderRadius: 10 * K, background: INK, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 * K, fontSize: 14 * K, fontWeight: 500, opacity: active, transform: `scale(${press})` }}>
                <svg width={16 * K} height={16 * K} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Avvia
              </div>
            </BrowserFrame>
          </div>
          <Pointer f={f} from={104} to={138} a={[1220, 700]} b={btn} click={145} show={[98, 196]} />
          <Ripple f={f} at={145} x={btn[0]} y={btn[1]} />
        </div>
        <Headline text="Scrivi un profilo." f={f} inAt={14} outAt={198} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ============ 3 · reads every slide (480–850) ============
const CARD = { x: 330, y: 300, w: 480, h: 600 };
const LIST_X = 960;
const ITEM_Y = (i: number) => 400 + i * 150;
const SLIDE_START = (i: number) => 20 + i * 110;

export function ReadSlides() {
  const f = useCurrentFrame();
  const slides = slidesMeta.carousel;
  const cardIn = pop(f, 4, 14);
  const exit = ramp(f, 336, 362, 0, 1, inExpo);
  const exitStyle: CSSProperties = { opacity: 1 - exit, transform: `translateY(${-exit * 60}px)`, filter: `blur(${exit * 12}px)` };

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Headline text="Legge ogni slide." f={f} inAt={6} outAt={336} />
      <div style={{ position: "absolute", inset: 0, ...exitStyle }}>
        {/* carousel card */}
        <div style={{ position: "absolute", left: CARD.x, top: CARD.y, width: CARD.w, height: CARD.h, borderRadius: 26, overflow: "hidden", background: "#fff", boxShadow: "0 40px 90px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.05)", transform: `scale(${0.86 + 0.14 * cardIn})`, opacity: Math.min(1, cardIn * 1.4) }}>
          {slides.map((s, i) => {
            const start = SLIDE_START(i);
            const inX = i === 0 ? 0 : interpolate(f, [start - 16, start], [CARD.w, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: inOut });
            const next = SLIDE_START(i + 1);
            const outX = i === slides.length - 1 ? 0 : interpolate(f, [next - 16, next], [0, -CARD.w], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: inOut });
            const scan = ramp(f, start + 12, start + 46, 0, 1, inOut);
            return (
              <div key={i} style={{ position: "absolute", inset: 0, transform: `translateX(${inX + outX}px)` }}>
                <Img src={staticFile(s.src)} style={{ width: "100%", height: "100%", display: "block" }} />
                {s.boxes.map((b, j) => {
                  const cy = b[1] + b[3] / 2;
                  const at = start + 12 + 34 * cy;
                  const p = pop(f, at, 13);
                  if (f < at) return null;
                  return (
                    <div
                      key={j}
                      style={{
                        position: "absolute",
                        left: b[0] * CARD.w - 10,
                        top: b[1] * CARD.h - 8,
                        width: b[2] * CARD.w + 20,
                        height: b[3] * CARD.h + 16,
                        borderRadius: 10,
                        border: `2px solid ${RED}`,
                        background: "rgba(230,0,35,0.10)",
                        transform: `scale(${1.12 - 0.12 * p})`,
                        opacity: Math.min(1, p * 1.5),
                      }}
                    />
                  );
                })}
                {scan > 0 && scan < 1 && (
                  <>
                    <div style={{ position: "absolute", left: 0, right: 0, top: scan * CARD.h - 90, height: 90, background: "linear-gradient(rgba(230,0,35,0), rgba(230,0,35,0.16))" }} />
                    <div style={{ position: "absolute", left: 0, right: 0, top: scan * CARD.h - 1.5, height: 3, background: RED, boxShadow: "0 0 26px 7px rgba(230,0,35,0.5)" }} />
                  </>
                )}
              </div>
            );
          })}
        </div>
        {/* pager dots */}
        <div style={{ position: "absolute", left: CARD.x, width: CARD.w, top: CARD.y + CARD.h + 26, display: "flex", justifyContent: "center", gap: 10, opacity: cardIn }}>
          {slides.map((_, i) => {
            const on = f >= SLIDE_START(i) - 8 && (i === slides.length - 1 || f < SLIDE_START(i + 1) - 8);
            return <span key={i} style={{ width: on ? 26 : 9, height: 9, borderRadius: 5, background: on ? INK : "#c7c7cc", transition: "none" }} />;
          })}
        </div>

        {/* extracted list */}
        <div style={{ position: "absolute", left: LIST_X, top: 318, fontFamily: "Geist Mono", fontSize: 20, color: GREY, opacity: ramp(f, 16, 36), letterSpacing: "0.01em" }}>
          @mindset.daily · <span style={{ color: RED }}>#1</span> · Carousel · 3
        </div>
        {slides.map((s, i) => {
          const numAt = SLIDE_START(i) + 54;
          const n = ramp(f, numAt, numAt + 18);
          return (
            <div key={i}>
              <div style={{ position: "absolute", left: LIST_X, top: ITEM_Y(i) + 8, fontFamily: "Geist Mono", fontSize: 22, color: GREY, opacity: n, transform: `translateX(${(1 - n) * -14}px)` }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              {s.lines.map((line, j) => {
                const flyAt = SLIDE_START(i) + 58 + j * 10;
                if (f < flyAt) return null;
                const b = s.boxes[j];
                const sx = CARD.x + (b[0] + b[2] / 2) * CARD.w;
                const sy = CARD.y + (b[1] + b[3] / 2) * CARD.h;
                const p = ramp(f, flyAt, flyAt + 28, 0, 1, inOut);
                const land = ramp(f, flyAt + 22, flyAt + 34);
                const tx = LIST_X + 58;
                const ty = ITEM_Y(i) + j * 48 + 22;
                const x = sx + (tx - sx) * p;
                const y = sy + (ty - sy) * p - Math.sin(p * Math.PI) * 60;
                return (
                  <div
                    key={j}
                    style={{
                      position: "absolute",
                      left: x,
                      top: y,
                      transform: `translate(${-50 * (1 - p)}%, -50%) scale(${1.1 - 0.1 * p})`,
                      whiteSpace: "nowrap",
                      fontSize: 40,
                      fontWeight: 520,
                      letterSpacing: "-0.025em",
                      color: INK,
                      padding: "6px 14px",
                      margin: "0 -14px",
                      borderRadius: 12,
                      background: `rgba(255,255,255,${1 - land})`,
                      boxShadow: `0 10px 30px rgba(0,0,0,${0.14 * (1 - land)})`,
                    }}
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ============ 4 · numbers (840–1080) ============
function Stat({ f, at, value, label, red }: { f: number; at: number; value: number; label: string; red?: boolean }) {
  const len = 80;
  if (f < at || f >= at + len) return null;
  const l = f - at;
  const p = ramp(l, 0, 14);
  const q = ramp(l, len - 10, len, 0, 1, inExpo);
  const count = Math.round(ramp(l, 0, 38) * value);
  const zeroPop = red ? pop(l, 0, 8) : 1;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", opacity: p * (1 - q), transform: `translateY(${(1 - p) * 70 - q * 50}px)`, filter: `blur(${(1 - p) * 16 + q * 12}px)` }}>
      <div style={{ fontFamily: "Geist", fontVariantNumeric: "tabular-nums", fontSize: 320, fontWeight: 650, letterSpacing: "-0.06em", color: red ? RED : "#fff", lineHeight: 1, transform: `scale(${red ? 0.6 + 0.4 * zeroPop : 1})` }}>
        {count.toLocaleString("it-IT")}
      </div>
      <div style={{ fontSize: 60, fontWeight: 600, letterSpacing: "-0.035em", color: GREY, marginTop: 28 }}>{label}</div>
    </AbsoluteFill>
  );
}

export function Numbers() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Stat f={f} at={0} value={287} label="post trovati" />
      <Stat f={f} at={80} value={1034} label="slide lette" />
      <Stat f={f} at={160} value={0} label="login Instagram" red />
    </AbsoluteFill>
  );
}

// ============ 5 · ranked (1080–1320) ============
const TW = 250;
const TH = 312;
const GAP = 34;
const GX = (1920 - (4 * TW + 3 * GAP)) / 2;
const slot = (k: number) => ({ x: GX + (k % 4) * (TW + GAP), y: 292 + Math.floor(k / 4) * (TH + 78) });
const PERM = [5, 2, 7, 0, 3, 6, 1, 4]; // slot -> card, before sorting
const ROT = [-6, 4, -3, 7, -5, 3, -7, 5];
const JIT = [[18, -12], [-14, 16], [10, 20], [-20, -8], [14, 10], [-8, -18], [22, 6], [-12, 14]];

export function Ranked() {
  const f = useCurrentFrame();
  const wipe = ramp(f, 0, 18);
  const exit = ramp(f, 212, 238, 0, 1, inExpo);
  return (
    <AbsoluteFill style={{ background: PAPER, clipPath: `inset(${(1 - wipe) * 100}% 0 0 0)` }}>
      <Headline text="In ordine di popolarità." f={f} inAt={8} outAt={214} />
      <div style={{ position: "absolute", inset: 0, opacity: 1 - exit, transform: `scale(${1 - exit * 0.08})`, filter: `blur(${exit * 10}px)` }}>
        {slidesMeta.thumbs.map((t, c) => {
          const startSlot = PERM.indexOf(c);
          const a = slot(startSlot);
          const b = slot(c);
          const appear = pop(f, 10 + startSlot * 3, 13);
          const m = ramp(f, 78 + c * 3, 122 + c * 3, 0, 1, inOut);
          const lift = Math.sin(m * Math.PI);
          const x = a.x + JIT[c][0] + (b.x - a.x - JIT[c][0]) * m;
          const y = a.y + JIT[c][1] + (b.y - a.y - JIT[c][1]) * m - lift * 30;
          const rot = ROT[c] * (1 - m);
          const badge = pop(f, 126 + c * 4, 10);
          const label = ramp(f, 130 + c * 4, 150 + c * 4);
          return (
            <div key={c} style={{ position: "absolute", left: x, top: y, width: TW, zIndex: Math.round(lift * 10) + 1, transform: `rotate(${rot}deg) scale(${(0.6 + 0.4 * appear) * (1 + lift * 0.06)})`, opacity: Math.min(1, appear * 1.5) }}>
              <div style={{ width: TW, height: TH, borderRadius: 18, overflow: "hidden", boxShadow: `0 ${16 + lift * 30}px ${40 + lift * 40}px rgba(0,0,0,${0.12 + lift * 0.08}), 0 0 0 1px rgba(0,0,0,0.05)`, position: "relative" }}>
                <Img src={staticFile(t.src)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", top: 12, left: 12, minWidth: 46, height: 34, padding: "0 10px", borderRadius: 17, display: "grid", placeItems: "center", fontFamily: "Geist Mono", fontSize: 17, fontWeight: 600, background: c < 3 ? RED : "#fff", color: c < 3 ? "#fff" : INK, transform: `scale(${badge})`, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                  #{c + 1}
                </div>
              </div>
              <div style={{ marginTop: 14, fontFamily: "Geist Mono", fontSize: 20, color: GREY, opacity: label, display: "flex", gap: 8, alignItems: "center" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c < 3 ? RED : GREY} strokeWidth={2.2}>
                  <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />
                </svg>
                {t.likes}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ============ 6 · download (1320–1560) ============
const MENU = local(1186, 425);
const FILES = [
  { ext: "MD", name: "mindset.daily.md", note: "per Notion" },
  { ext: "CSV", name: "mindset.daily.csv", note: "per Excel e Sheets" },
  { ext: "JSON", name: "mindset.daily.json", note: "per sviluppatori" },
];

export function Download() {
  const f = useCurrentFrame();
  const enter = ramp(f, 0, 44);
  const keys: Cam[] = [NEUTRAL(0), NEUTRAL(44), [84, 1.85, MENU[0], MENU[1], 1000, 600], [240, 1.9, MENU[0], MENU[1], 1000, 600]];
  const cam = camera(keys, f);
  const back = ramp(f, 132, 168, 0, 1, inOut);
  const layer = ramp(f, 40, 50, 0, 1, inOut);
  const hover = ramp(f, 98, 106);
  const flash = f >= 112 && f < 126 ? Math.sin(((f - 112) / 14) * Math.PI) : 0;
  const md: [number, number] = [1244 * K, BAR + 404 * K];
  const exit = ramp(f, 222, 240, 0, 1, inExpo);

  return (
    <AbsoluteFill style={{ background: PAPER, perspective: 2400 }}>
      <div style={{ position: "absolute", inset: 0, opacity: 1 - exit }}>
        <div
          style={{
            position: "absolute",
            left: WX,
            top: WY,
            width: WIN,
            transformOrigin: "0 0",
            transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s * (1 - back * 0.06)})`,
            filter: `blur(${back * 16}px)`,
            opacity: 1 - back * 0.6,
          }}
        >
          <div style={{ transformOrigin: "50% 0%", transform: `translateY(${(1 - enter) * 360}px) rotateX(${(1 - enter) * 34}deg) scale(${0.86 + 0.14 * enter})`, opacity: Math.min(1, enter * 2) }}>
            <BrowserFrame>
              <Img src={shot("results")} style={{ width: WIN, display: "block", position: "absolute", opacity: 1 - layer }} />
              <Img src={shot("export")} style={{ width: WIN, display: "block", opacity: layer }} />
              <div style={{ ...cssRect(1082, 380, 208, 34), borderRadius: 6 * K, background: `rgba(10,10,10,${0.05 * hover + 0.08 * flash})`, mixBlendMode: "multiply" }} />
            </BrowserFrame>
          </div>
          <Pointer f={f} from={68} to={100} a={[1120 * K, BAR + 300 * K]} b={md} click={112} show={[62, 136]} />
          <Ripple f={f} at={112} x={md[0]} y={md[1]} />
        </div>

        {FILES.map((file, i) => {
          const at = 140 + i * 8;
          const p = pop(f, at, 12);
          if (f < at) return null;
          const tx = 960 + (i - 1) * 300;
          const ty = 610;
          const sx = 1000;
          const sy = 560;
          const x = sx + (tx - sx) * Math.min(p, 1.05);
          const y = sy + (ty - sy) * Math.min(p, 1.05);
          return (
            <div key={file.ext} style={{ position: "absolute", left: x - 125, top: y - 150, width: 250, height: 300, borderRadius: 26, background: "#fff", boxShadow: "0 40px 80px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.05)", transform: `scale(${0.3 + 0.7 * p})`, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 26 }}>
              <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={RED} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
              <div>
                <div style={{ fontFamily: "Geist Mono", fontSize: 58, fontWeight: 600, letterSpacing: "-0.04em", color: INK }}>{file.ext}</div>
                <div style={{ fontFamily: "Geist Mono", fontSize: 15, color: GREY, marginTop: 8 }}>{file.name}</div>
                <div style={{ fontSize: 17, color: GREY, marginTop: 4 }}>{file.note}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 300, zIndex: 9, opacity: 1 - exit, background: `linear-gradient(${PAPER} 0%, ${PAPER} 62%, rgba(245,245,247,0) 100%)` }} />
      <Headline text="Scarica i dati." f={f} inAt={10} outAt={222} />
    </AbsoluteFill>
  );
}

// ============ 7 · outro (1560–1800) ============
export function Outro() {
  const f = useCurrentFrame();
  const end = ramp(f, 222, 240, 0, 1, inOut);
  return (
    <AbsoluteFill style={{ background: INK }}>
      <Slam text="Gratis." f={f} inAt={0} outAt={28} />
      <Slam text="Privato." f={f} inAt={30} outAt={58} />
      <Slam text="Senza login." f={f} inAt={60} outAt={88} />
      {f >= 90 && (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - end }}>
          <Wordmark f={f} inAt={92} size={200} color="#fff" sub="Il testo dei post migliori. In ordine." subAt={124} />
        </div>
      )}
    </AbsoluteFill>
  );
}
