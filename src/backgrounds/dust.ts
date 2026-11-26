// BACKGROUND "Dust in the workshop": a few dim warm specks drift slowly in the air, each glowing up out of the dark,
// hanging there and fading away, like dust in a ray of light. Baked by tools/bake.ts into a looping .anim at 60 fps
// that the bar plays under everything. Done the way the bar's own animations are: no hard pixels popping in and out,
// brightness fades smoothly, and a speck between two pixels lights both of them part way (so it glides, not steps).

export interface Background {
  id: string;
  fps: number;
  /** The loop's length: everything is periodic in it, so the last frame runs on into the first. */
  seconds: number;
  /** The picture at time t (0 <= t < seconds): 72x16 BGRA, transparent where nothing is. */
  frame(t: number): Uint8Array;
  /** True when it draws the floor (the bottom row) itself: then main.ts leaves out its plain grey floor line. */
  floor?: boolean;
}

const W = 72, H = 16;
/** The top row of the floor: the dust stays above it. */
const FLOOR = 15;
const COUNT = 14;
const SECONDS = 12;
/** The color of a speck at its brightest; it fades to black from there. Warm grey-yellow, dim. */
const PEAK = [150, 128, 88];

/** A fixed list of specks: always the same dust, so the file only changes when this file does. */
function specks() {
  let a = 0x2f6b9d1;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: { x: number; y: number; vx: number; vy: number; wob: number; phase: number; life: number; bright: number }[] = [];
  for (let k = 0; k < COUNT; k++)
    out.push({
      x: r() * W,
      y: 1 + r() * (FLOOR - 3),
      vx: (r() - 0.5) * 2.4, // px per second, either way
      vy: (r() - 0.6) * 0.8, // mostly drifting up a little
      wob: 0.4 + r() * 0.6, // how far it sways up and down
      phase: r() * SECONDS, // when in the loop it appears
      life: 4 + r() * 5, // seconds it is visible
      bright: 0.55 + r() * 0.45,
    });
  return out;
}
const SPECKS = specks();

export const dust: Background = {
  id: "dust",
  fps: 60,
  seconds: SECONDS,
  frame(t) {
    const light = new Float32Array(W * H);
    const add = (x: number, y: number, v: number) => {
      if (x >= 0 && x < W && y >= 0 && y < FLOOR) light[y * W + x] += v;
    };
    for (const s of SPECKS) {
      const age = (t - s.phase + SECONDS) % SECONDS;
      if (age > s.life) continue;
      // Glows up over the first third, holds, fades over the last third (smooth both ways).
      const u = age / s.life;
      const env = u < 0.3 ? Math.sin((u / 0.3) * Math.PI * 0.5) : u > 0.7 ? Math.sin(((1 - u) / 0.3) * Math.PI * 0.5) : 1;
      const v = env * env * s.bright;
      const x = s.x + s.vx * age; // one that drifts off the edge is simply gone (no jumping across)
      const y = s.y + s.vy * age + Math.sin(age * 1.3 + s.phase) * s.wob;
      // Shared between the four pixels around its exact spot, by how near each is.
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      add(x0, y0, v * (1 - fx) * (1 - fy));
      add(x0 + 1, y0, v * fx * (1 - fy));
      add(x0, y0 + 1, v * (1 - fx) * fy);
      add(x0 + 1, y0 + 1, v * fx * fy);
    }
    const out = new Uint8Array(W * H * 4);
    for (let p = 0; p < W * H; p++) {
      // Quantized in steps, so a slow fade doesn't change every pixel every frame (smaller file, same look).
      const v = Math.min(1, Math.round(light[p] * 24) / 24);
      if (v <= 0) continue;
      out[p * 4] = Math.round(PEAK[2] * v);
      out[p * 4 + 1] = Math.round(PEAK[1] * v);
      out[p * 4 + 2] = Math.round(PEAK[0] * v);
      out[p * 4 + 3] = 255;
    }
    return out;
  },
};
