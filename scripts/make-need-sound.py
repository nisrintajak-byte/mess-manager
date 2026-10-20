"""Builds assets/sounds/need_alert.wav: the special Need Request alert (founder 2026-10-20).
About 4.5 seconds — longer than a normal ping, shorter than a phone ring: a soft bell motif
played twice, then a short closing chime. No voice. Pure Python, no extra packages."""
import math, struct, wave

RATE = 22050

def bell(freq, dur, vol):
    out = []
    for i in range(int(RATE * dur)):
        t = i / RATE
        env = math.exp(-3.2 * t) * min(1.0, t * 200)  # quick attack, gentle decay
        s = (math.sin(2 * math.pi * freq * t)
             + 0.45 * math.sin(2 * math.pi * freq * 2.0 * t) * math.exp(-2 * t)
             + 0.20 * math.sin(2 * math.pi * freq * 3.01 * t) * math.exp(-4 * t))
        out.append(vol * env * s / 1.65)
    return out

def mix(track, sound, at):
    start = int(RATE * at)
    need = start + len(sound)
    if len(track) < need:
        track.extend([0.0] * (need - len(track)))
    for i, v in enumerate(sound):
        track[start + i] += v

C5, E5, G5, C6, E6 = 523.25, 659.25, 783.99, 1046.5, 1318.5
track = []
for rep in range(2):
    base = rep * 1.6
    for k, f in enumerate((C5, E5, G5, C6)):
        mix(track, bell(f, 1.2, 0.55), base + k * 0.18)
mix(track, bell(E6, 1.4, 0.45), 3.2)
mix(track, bell(C6, 1.4, 0.35), 3.2)
track = track[: int(RATE * 4.6)]
fade = int(RATE * 0.3)
for i in range(fade):
    track[-fade + i] *= 1 - i / fade
peak = max(abs(v) for v in track)
with wave.open('assets/sounds/need_alert.wav', 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(b''.join(struct.pack('<h', int(32767 * 0.9 * v / peak)) for v in track))
print('ok', len(track) / RATE, 's')
