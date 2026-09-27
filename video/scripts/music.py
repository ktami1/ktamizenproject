"""public/music.wav — 30 s at 120 BPM (elite / kinetic / sophisticated band).
Every accent sits on the video frame it belongs to (60 fps, 1 beat = 30 frames)."""
import wave
import numpy as np
from scipy.signal import butter, lfilter

SR, DUR, FPS = 48000, 30.0, 60
N = int(SR * DUR)
t = np.arange(N) / SR
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(7)
fr = lambda f: f / FPS  # frame -> seconds
note = lambda m: 440 * 2 ** ((m - 69) / 12)


def lp(x, hz, order=2):
    b, a = butter(order, hz / (SR / 2), "low")
    return lfilter(b, a, x)


def hp(x, hz, order=2):
    b, a = butter(order, hz / (SR / 2), "high")
    return lfilter(b, a, x)


def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * (1 - max(pan, 0))
    R[i:i + len(sig)] += sig * gain * (1 + min(pan, 0))


def seg(d):
    return np.arange(int(d * SR)) / SR


# ---------- instruments ----------
def kick():
    u = seg(0.45)
    f = 48 + 110 * np.exp(-u * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-u * 7) + 0.3 * np.exp(-u * 400) * rng.standard_normal(len(u))


def snare():
    u = seg(0.22)
    n = hp(rng.standard_normal(len(u)), 1800) * np.exp(-u * 22)
    return 0.7 * n + 0.4 * np.sin(2 * np.pi * 190 * u) * np.exp(-u * 30)


def hat(decay=60):
    u = seg(0.06)
    return hp(rng.standard_normal(len(u)), 7000, 4) * np.exp(-u * decay)


def bass(m, d=0.2):
    u = seg(d)
    f = note(m)
    return (np.sin(2 * np.pi * f * u) + 0.25 * np.sin(4 * np.pi * f * u)) * np.exp(-u * 6) * np.minimum(u / 0.004, 1)


def pluck(m, d=0.35):
    u = seg(d)
    f = note(m)
    return (np.sin(2 * np.pi * f * u) + 0.2 * np.sin(6 * np.pi * f * u) * np.exp(-u * 30)) * np.exp(-u * 11) * np.minimum(u / 0.002, 1)


def pad(chord, d, detune):
    u = seg(d)
    env = np.minimum(u / 0.35, 1) * np.clip((d - u) / 0.5, 0, 1)
    out = np.zeros(len(u))
    for m in chord:
        f = note(m) * (1 + detune / 1200)
        out += np.sin(2 * np.pi * f * u) + 0.3 * np.sin(4 * np.pi * f * u) + 0.1 * np.sin(6 * np.pi * f * u)
    return lp(out * env, 2600)


def impact():
    u = seg(1.6)
    boom = np.sin(2 * np.pi * (42 + 30 * np.exp(-u * 6)) * u) * np.exp(-u * 2.6)
    noise = lp(rng.standard_normal(len(u)), 900) * np.exp(-u * 5)
    return boom + 0.6 * noise


def riser(d):
    u = seg(d)
    n = hp(rng.standard_normal(len(u)), 1200) * (u / d) ** 2.5
    s = np.sin(2 * np.pi * np.cumsum(300 + 1500 * (u / d) ** 2) / SR) * (u / d) ** 3
    return 0.5 * n + 0.25 * s


def whoosh(d=0.5):
    u = seg(d)
    env = np.sin(np.pi * u / d) ** 2
    return lp(rng.standard_normal(len(u)), 2200) * env


def click():
    u = seg(0.04)
    return (0.6 * lp(rng.standard_normal(len(u)), 5000) + np.sin(2 * np.pi * 2600 * u)) * np.exp(-u * 170)


def tick():
    u = seg(0.02)
    return hp(rng.standard_normal(len(u)), 3000) * np.exp(-u * 300)


# ---------- arrangement ----------
BEAT = 0.5
chords = [([57, 60, 64, 67, 71], 45), ([53, 57, 60, 64], 41), ([60, 64, 67, 71], 48), ([55, 59, 62, 64], 43)]
for bar in range(15):
    ch, root = chords[bar % 4]
    s = bar * 2.0
    add(pad([m + 12 for m in ch], 2.3, -6), s, 0.045, pan=0.35)
    add(pad([m + 12 for m in ch], 2.3, 6), s, 0.045, pan=-0.35)
    for e in range(16):  # 8ths
        at = s + e * 0.125 * 2 / 2
        beat_frame = int(round(at * FPS))
        if 240 <= beat_frame < 1650 and e % 2 == 0:
            add(bass(root, 0.22), at, 0.34)
        if 480 <= beat_frame < 1560 and not (800 <= beat_frame < 840):  # 16th arp
            add(pluck(ch[e % len(ch)] + 24), at, 0.06, pan=0.4 if e % 2 else -0.4)

for fbeat in range(240, 1650, 30):  # drums from the red reveal to the final logo
    at = fr(fbeat)
    if 810 <= fbeat < 840:  # one-beat break before the stats drop
        continue
    add(kick(), at, 0.9)
    add(hat(), at + 0.25, 0.10, pan=0.3)
    if fbeat >= 480 and ((fbeat // 30) % 2 == 1):
        add(snare(), at, 0.28)
    if 840 <= fbeat < 1080:  # stats: 16th hats for drive
        add(hat(90), at + 0.125, 0.05, pan=-0.3)
        add(hat(90), at + 0.375, 0.05, pan=-0.3)

# cold open: word hits + wordmark
for f in (12, 60, 108):
    add(pluck(81, 0.6), fr(f), 0.22)
    add(bass(45, 0.5), fr(f), 0.25)
add(pluck(88, 0.9), fr(170), 0.2)
add(riser(fr(240 - 172)), fr(172), 0.35)
for f in (240, 840, 1650):
    add(impact(), fr(f), 0.55)

# UI sound design — only where it explains the action
for i in range(13):
    add(tick(), fr(240 + 92 + i * 3), 0.07)
add(click(), fr(240 + 145), 0.22)
add(whoosh(0.6), fr(240 + 200), 0.22)
for i in range(3):  # OCR: one soft ping per extracted line
    for j in range(2):
        add(pluck(93 + j * 2, 0.25), fr(480 + 20 + i * 110 + 58 + j * 10), 0.08)
add(whoosh(0.5), fr(1080 + 78), 0.2)
for i in range(3):
    add(pluck(84 + i * 3, 0.3), fr(1080 + 130 + i * 4), 0.1)
add(click(), fr(1320 + 112), 0.22)
for i in range(3):
    add(pluck(79 + i * 5, 0.4), fr(1320 + 140 + i * 8), 0.12)
for f in (1560, 1590, 1620):
    add(pluck(76, 0.5), fr(f), 0.2)
add(pad([57, 64, 69, 71, 76], 3.6, 0), fr(1650), 0.07)

# ---------- master ----------
fade = np.minimum(t / 0.05, 1) * np.clip((DUR - t) / 1.6, 0, 1)
mix = np.stack([L, R], 1) * fade[:, None]
mix = mix / np.max(np.abs(mix)) * 1.6
mix = np.tanh(mix) / np.tanh(1.6) * 0.89
pcm = (mix * 32767).astype("<i2")
with wave.open("public/music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok", DUR, "s")
