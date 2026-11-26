// The sounds: 8-bit style effects made in code, the way old game consoles made them (square and triangle waves, a
// noise channel, pitch sweeps, volume envelopes). Writes each as src/sounds/<name>.snd, the BUSY Bar's format: raw
// mono 44.1 kHz signed 16-bit little-endian PCM, no header; and tools/sfx-preview.wav, all of them one after another,
// to listen to on the PC. Each also has a quiet copy, <name>_q.snd, for "Sound: Quiet" in the settings (the bar has
// only its own volume for everything, which an app should not change). Run: npm run sfx (esbuild + node, like the bake).
import { writeFileSync, mkdirSync } from "fs";

const RATE = 44100;
/** The console's own rate: the sound is computed at this rate and held, which gives the crunchy 8-bit edge. */
const CHIP = 22050;
const STEP = Math.round(RATE / CHIP);
/** Loudness of everything (0..1): leaves room so nothing clips. */
const MASTER = 0.55;
/** The quiet copies, against the normal ones. */
const QUIET = 0.3;

type Wave = "square" | "square25" | "square12" | "triangle" | "noise" | "noiseShort";

/** A tone: wave, length (s), pitch from f0 to f1 (Hz, slid along the way), volume envelope, start (s). */
interface Tone {
  wave: Wave;
  at?: number;
  dur: number;
  f0: number;
  f1?: number;
  /** "exp": pitch slides exponentially (sounds natural); "lin": linearly. */
  slide?: "exp" | "lin";
  vol?: number;
  /** Attack and release, seconds. */
  a?: number;
  r?: number;
  /** Vibrato: depth (fraction of pitch) and speed (Hz). */
  vib?: [number, number];
  /** Chops the volume on and off this many times a second (crackle, ratchet). */
  gate?: number;
}

/** NES-like noise: a 15-bit shift register clocked at the "pitch"; short mode gives a metallic buzz. */
function noise(short: boolean) {
  let reg = 1;
  return () => {
    const bit = (reg ^ (reg >> (short ? 6 : 1))) & 1;
    reg = (reg >> 1) | (bit << 14);
    return reg & 1 ? 1 : -1;
  };
}

function render(tones: Tone[], seed = 1): Float32Array {
  const end = Math.max(...tones.map((t) => (t.at ?? 0) + t.dur));
  const out = new Float32Array(Math.ceil(end * RATE));
  let rnd = seed;
  const random = () => ((rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (const t of tones) {
    const start = Math.floor((t.at ?? 0) * RATE), n = Math.floor(t.dur * RATE);
    const f1 = t.f1 ?? t.f0, a = t.a ?? 0.004, r = t.r ?? t.dur * 0.6, vol = t.vol ?? 1;
    const nz = t.wave === "noise" || t.wave === "noiseShort" ? noise(t.wave === "noiseShort") : null;
    let phase = 0, held = 0, nzAcc = 0, nzVal = 1;
    for (let i = 0; i < n; i++) {
      const s = i / n;
      let f = t.slide === "lin" ? t.f0 + (f1 - t.f0) * s : t.f0 * Math.pow(f1 / t.f0, s);
      if (t.vib) f *= 1 + t.vib[0] * Math.sin((2 * Math.PI * t.vib[1] * i) / RATE);
      // The chip's rate: a new value only every RATE/CHIP samples.
      if (i % STEP === 0) {
        phase = (phase + (f * STEP) / RATE) % 1;
        let v: number;
        if (nz) {
          nzAcc += (f * STEP) / RATE;
          while (nzAcc >= 1) { nzAcc -= 1; nzVal = nz(); }
          v = nzVal;
        } else if (t.wave === "triangle") v = Math.round((phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase) * 7.5) / 7.5; // 4-bit steps
        else {
          const duty = t.wave === "square" ? 0.5 : t.wave === "square25" ? 0.25 : 0.125;
          v = phase < duty ? 1 : -1;
        }
        held = v;
      }
      const tt = i / RATE;
      let env = Math.min(1, tt / a) * Math.min(1, (t.dur - tt) / r);
      env = Math.max(0, env);
      if (t.gate) env *= Math.sin(Math.PI * t.gate * tt) ** 2 > 0.3 + 0.4 * random() ? 1 : 0.15;
      const k = start + i;
      if (k < out.length) out[k] += held * env * vol;
    }
  }
  return out;
}

/** Several sounds back to back (`gap` s between) and mixed. */
function seq(parts: [number, Tone[]][]): Tone[] {
  const out: Tone[] = [];
  for (const [at, tones] of parts) for (const t of tones) out.push({ ...t, at: (t.at ?? 0) + at });
  return out;
}

/** The library: name -> how it is made. Short and dry: they sit under a small clock, not a game. */
const SOUNDS: Record<string, Tone[]> = {
  // The toolbox: the lid creaks open; shuts with a wooden knock.
  box_open: [{ wave: "square25", dur: 0.22, f0: 180, f1: 260, vol: 0.35, vib: [0.06, 28], r: 0.08 }],
  box_close: [
    { wave: "triangle", dur: 0.1, f0: 220, f1: 90, vol: 0.9, r: 0.08 },
    { wave: "noise", dur: 0.05, f0: 3000, vol: 0.35 },
  ],
  // A hammer / sledgehammer blow, and the crack in the digit.
  hit: [
    { wave: "noise", dur: 0.12, f0: 2500, f1: 600, vol: 0.8, r: 0.1 },
    { wave: "square", dur: 0.16, f0: 160, f1: 50, vol: 0.6, r: 0.12 },
  ],
  crack: [{ wave: "noise", dur: 0.06, f0: 9000, f1: 4000, vol: 0.6, r: 0.05 }],
  // A digit falling apart into bits.
  crumble: [{ wave: "noise", dur: 0.55, f0: 4000, f1: 900, vol: 0.55, gate: 18, r: 0.35 }],
  // A rush of air: the blower, a swing of the bat.
  whoosh: [{ wave: "noise", dur: 0.38, f0: 1200, f1: 6000, vol: 0.45, a: 0.15, r: 0.2 }],
  // Something light pops into place (the blown-up digit, a reaction).
  pop: [{ wave: "square", dur: 0.07, f0: 400, f1: 1300, vol: 0.5, r: 0.04 }],
  // The wand's sparkle: a quick climbing arpeggio.
  magic: seq([0, 0.06, 0.12, 0.18, 0.24, 0.3].map((t, i) => [t, [{ wave: "square12", dur: 0.1, f0: [1047, 1319, 1568, 2093, 1568, 2637][i], vol: 0.35, r: 0.08 }]])),
  // The chainsaw: a rough, steady two-stroke buzz (noise over a low growl), no rising pitch or wobble — the old one
  // sounded like an alarm. Short, so it stops soon after the engine does (the bake notes it again while it runs).
  saw: [
    { wave: "noise", dur: 0.4, f0: 3200, vol: 0.34, a: 0.02, r: 0.04 },
    { wave: "square25", dur: 0.4, f0: 104, f1: 110, vol: 0.24, a: 0.02, r: 0.04 },
    { wave: "square12", dur: 0.4, f0: 52, vol: 0.2, a: 0.02, r: 0.04 },
  ],
  // Fire: crackling flames.
  fire: [{ wave: "noise", dur: 0.6, f0: 1500, f1: 900, vol: 0.4, gate: 26, a: 0.06, r: 0.25 }],
  // An explosion: dynamite, the bazooka's shell landing.
  boom: [
    { wave: "noise", dur: 0.9, f0: 1400, f1: 120, vol: 0.8, r: 0.75 },
    { wave: "triangle", dur: 0.35, f0: 110, f1: 40, vol: 0.7, r: 0.3 },
  ],
  // A digit landing: a solid low thump.
  thud: [
    { wave: "triangle", dur: 0.14, f0: 140, f1: 55, vol: 1, r: 0.12 },
    { wave: "noise", dur: 0.04, f0: 1500, vol: 0.3 },
  ],
  // Liquid: acid, the watering can. Bubbly blips.
  splash: seq([0, 0.05, 0.11, 0.16, 0.22, 0.3].map((t, i) => [t, [{ wave: "square12", dur: 0.06, f0: [700, 900, 620, 1000, 760, 880][i], f1: [1100, 1300, 900, 1500, 1000, 1200][i], vol: 0.3, r: 0.04 }]])),
  // Sweeping: the mop, the broom.
  sweep: [{ wave: "noise", dur: 0.28, f0: 7000, f1: 3500, vol: 0.28, a: 0.08, r: 0.12 }],
  // The wrench turning: ratchet clicks.
  ratchet: seq([0, 0.07, 0.14, 0.21].map((t) => [t, [{ wave: "noiseShort", dur: 0.03, f0: 6000, vol: 0.45, r: 0.02 }]])),
  // The crane's motor.
  crane: [{ wave: "square25", dur: 0.8, f0: 70, f1: 85, vol: 0.3, vib: [0.03, 9], a: 0.08, r: 0.15 }],
  // A spring: startled jump, falling flat.
  boing: [{ wave: "square", dur: 0.26, f0: 220, f1: 660, vol: 0.4, vib: [0.08, 22], r: 0.1 }],
  // A button on the control box / the plunger's beep.
  beep: [{ wave: "square", dur: 0.08, f0: 1760, vol: 0.3, r: 0.02 }],
  // The cat.
  meow: [
    { wave: "square25", dur: 0.18, f0: 700, f1: 1100, vol: 0.35, vib: [0.03, 12], a: 0.03 },
    { wave: "square25", at: 0.18, dur: 0.2, f0: 1100, f1: 600, vol: 0.35, vib: [0.03, 12], r: 0.12 },
  ],
  // Ta-da: a little fanfare when a big show is over.
  tada: seq([[0, [{ wave: "square", dur: 0.1, f0: 784, vol: 0.35, r: 0.04 }]], [0.1, [{ wave: "square", dur: 0.1, f0: 988, vol: 0.35, r: 0.04 }]], [0.2, [{ wave: "square", dur: 0.28, f0: 1319, vol: 0.4, r: 0.18 }, { wave: "square25", dur: 0.28, f0: 659, vol: 0.2, r: 0.18 }]]]),
  // A sip / a bite: two soft low blips.
  gulp: seq([0, 0.12].map((t) => [t, [{ wave: "triangle", dur: 0.08, f0: 330, f1: 200, vol: 0.6, r: 0.06 }]])),
  // Fireworks: a whistle up, then a crackling burst.
  firework: [
    { wave: "square12", dur: 0.5, f0: 600, f1: 2400, vol: 0.25, a: 0.05, r: 0.05 },
    { wave: "noise", at: 0.5, dur: 0.6, f0: 3000, f1: 800, vol: 0.6, gate: 30, r: 0.45 },
  ],
  // Whistling a little tune.
  whistle: seq([[0, 1568], [0.18, 1760], [0.36, 1976], [0.54, 1568], [0.8, 2093]].map(([t, f]) => [t, [{ wave: "triangle", dur: 0.16, f0: f, vol: 0.5, vib: [0.02, 7], a: 0.02, r: 0.06 }]] as [number, Tone[]])),
  // Grumbling (woken at night): a low wobbly mutter.
  grumble: [{ wave: "triangle", dur: 0.45, f0: 150, f1: 110, vol: 0.7, vib: [0.15, 9], a: 0.03, r: 0.12 }],
  // Glass shattering (2026-11-23): a sharp crack, then high tinkles falling and bouncing.
  glass: [
    { wave: "noise", dur: 0.08, f0: 12000, f1: 6000, vol: 0.6, r: 0.06 },
    ...[[0.05, 3520], [0.11, 2794], [0.16, 4186], [0.23, 3136], [0.3, 3729], [0.38, 2637], [0.47, 3322]].map(
      ([t, f]) => ({ wave: "square12" as Wave, at: t, dur: 0.07, f0: f, f1: f * 0.94, vol: 0.22, r: 0.05 }),
    ),
    { wave: "noiseShort", at: 0.04, dur: 0.4, f0: 9000, f1: 5000, vol: 0.18, gate: 22, r: 0.3 },
  ],
  // A TV with no signal: hissing static.
  static: [{ wave: "noise", dur: 0.5, f0: 14000, vol: 0.32, a: 0.02, r: 0.08 }],
  // A snap: a puzzle piece or a brick clicking into place.
  click: [{ wave: "noiseShort", dur: 0.025, f0: 7000, vol: 0.5, r: 0.02 }, { wave: "square", at: 0.01, dur: 0.03, f0: 1200, f1: 900, vol: 0.25, r: 0.02 }],
  // The 3D printer's stepper motors: a whining buzz that steps in pitch.
  print: seq([[0, 520], [0.12, 660], [0.24, 590], [0.36, 700]].map(([t, f]) => [t, [{ wave: "square25", dur: 0.12, f0: f, vol: 0.16, a: 0.01, r: 0.02 }]] as [number, Tone[]])),
  // The alarm clock: a bell hammered fast, two bright tones.
  ring: [
    { wave: "square12", dur: 0.55, f0: 2093, vol: 0.3, gate: 26, vib: [0.02, 40], a: 0.005, r: 0.08 },
    { wave: "square25", dur: 0.55, f0: 2637, vol: 0.14, gate: 26, a: 0.005, r: 0.08 },
  ],
};

/** 16-bit little-endian PCM from samples (-1..1). */
function pcm(x: Float32Array, gain = 1): Buffer {
  const b = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * MASTER * gain * 32767))), i * 2);
  return b;
}

function wav(data: Buffer): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

mkdirSync("src/sounds", { recursive: true });
const preview: Buffer[] = [];
const gap = Buffer.alloc(Math.round(RATE * 0.7) * 2);
let total = 0, at = 0;
const list: string[] = [];
for (const [name, tones] of Object.entries(SOUNDS)) {
  const wave = render(tones);
  const data = pcm(wave);
  writeFileSync(`src/sounds/${name}.snd`, data);
  writeFileSync(`src/sounds/${name}_q.snd`, pcm(wave, QUIET));
  preview.push(data, gap);
  list.push(`${at.toFixed(1)}s  ${name}`);
  at += data.length / 2 / RATE + 0.7;
  total += data.length * 2;
}
writeFileSync("tools/sfx-preview.wav", wav(Buffer.concat(preview)));
writeFileSync("tools/sfx-preview.txt", list.join("\n") + "\n");
console.log(`${Object.keys(SOUNDS).length} sounds, ${Math.round(total / 1024)} KiB`);
console.log(list.join("\n"));
