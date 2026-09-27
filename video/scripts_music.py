"""Generates public/music.wav: 100 BPM ambient pad, 10 s, plus two soft UI clicks."""
import wave, numpy as np
SR = 48000; DUR = 10.0; BPM = 100; BEAT = 60 / BPM
t = np.arange(int(SR * DUR)) / SR
out = np.zeros_like(t)
note = lambda m: 440 * 2 ** ((m - 69) / 12)
chords = [[53, 57, 60, 64], [57, 60, 64, 67], [50, 57, 60, 64, 65], [48, 55, 59, 64]]  # Fmaj7 Am7 Dm9 Cmaj7
bar = 4 * BEAT
for i, ch in enumerate(chords):
    s, e = i * bar, (i + 1) * bar + 0.6
    m = (t >= s) & (t < e); tt = t[m] - s
    env = np.minimum(tt / 0.5, 1) * np.clip((e - s - tt) / 0.8, 0, 1)
    for n in ch:
        f = note(n + 12)
        for det in (-0.12, 0.12):
            out[m] += 0.045 * env * np.sin(2 * np.pi * f * (1 + det / 100) * tt) * (1 + 0.15 * np.sin(2 * np.pi * 0.3 * tt))
    out[m] += 0.07 * env * np.sin(2 * np.pi * note(ch[0] - 12) * tt)  # soft sub
    # gentle pulse: chord tones on each beat, high octave, fast decay
    for b in range(4):
        bs = s + b * BEAT; mm = (t >= bs) & (t < bs + 0.6); u = t[mm] - bs
        f = note(ch[(b + i) % len(ch)] + 24)
        out[mm] += 0.035 * np.exp(-u * 7) * np.sin(2 * np.pi * f * u) * np.minimum(u / 0.004, 1)
def click(at, gain):
    m = (t >= at) & (t < at + 0.05); u = t[m] - at
    rng = np.random.default_rng(1)
    noise = rng.standard_normal(m.sum())
    noise = np.convolve(noise, np.ones(6) / 6, mode="same")  # soften
    out[m] += gain * np.exp(-u * 160) * (noise * 0.6 + np.sin(2 * np.pi * 2400 * u))
click(205 / 60, 0.10)  # "Avvia" press
click(505 / 60, 0.09)  # export click
fade = np.minimum(t / 0.6, 1) * np.clip((DUR - t) / 1.2, 0, 1)
out *= fade
out = out / np.max(np.abs(out)) * 0.7
pcm = (np.stack([out, out], 1) * 32767).astype("<i2")
with wave.open("public/music.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("ok", len(out) / SR, "s")
