// Slidemine — 30 s product film, 1920×1080 @ 60 fps, 120 BPM (1 beat = 30 frames).
import { loadFont } from "@remotion/fonts";
import { AbsoluteFill, Html5Audio, Sequence, staticFile } from "remotion";
import { INK } from "./lib";
import { ColdOpen, Download, Numbers, Outro, Ranked, ReadSlides, TypeProfile } from "./scenes";

loadFont({ family: "Geist", url: staticFile("fonts/Geist.ttf"), weight: "100 900" });
loadFont({ family: "Geist Mono", url: staticFile("fonts/GeistMono.ttf"), weight: "100 900" });

export const Promo = () => (
  <AbsoluteFill style={{ background: INK, fontFamily: "Geist, system-ui, sans-serif", overflow: "hidden" }}>
    <Html5Audio src={staticFile("music.wav")} />
    <Sequence from={0} durationInFrames={250}>
      <ColdOpen />
    </Sequence>
    <Sequence from={240} durationInFrames={250}>
      <TypeProfile />
    </Sequence>
    <Sequence from={480} durationInFrames={360}>
      <ReadSlides />
    </Sequence>
    <Sequence from={840} durationInFrames={240}>
      <Numbers />
    </Sequence>
    <Sequence from={1080} durationInFrames={240}>
      <Ranked />
    </Sequence>
    <Sequence from={1320} durationInFrames={240}>
      <Download />
    </Sequence>
    <Sequence from={1560} durationInFrames={240}>
      <Outro />
    </Sequence>
  </AbsoluteFill>
);
