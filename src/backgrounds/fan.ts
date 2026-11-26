// BACKGROUND "Ceiling fan": a ceiling fan seen from a little below, a lamp under its hub. The blades turn on a
// flattened circle (the fan in perspective) with a soft motion blur behind each, dark against the warm glow of the
// lamp; the light under the fan flickers as the blades pass, and spreads as a soft cone down to the floor. Dust
// floats in the air and shows only where the lamp's light catches it.
import { type Background } from "./dust";

const W = 72, H = 16;
const FLOOR = 15;
/** A long loop for the dust to wander in; the fan turns once a second. */
const SECONDS = 12;
const TURNS = 6; // half a turn a second: calm, doesn't pull the eye
/** The fan's hub. */
const CX = 45, CY = 2.2;
/** How loud the whole background is (1 = the first, brighter version). Lower = less noticeable. */
const QUIET = 0.6;
/** The blades' circle in perspective: wide, very flat. */
const RX = 9, RY = 1.8;
const GLOW = [120, 96, 60];
const BLADE = [26, 24, 22];
const LAMP = [255, 214, 140];
const SPECK = [200, 170, 115];

/** How much lamp light falls on a point (0..1): the glow round the lamp and the cone under it. */
function lightAt(x: number, y: number): number {
  const dx = x - CX, dy = y - CY;
  const glow = Math.exp(-(dx * dx + dy * dy * 3) / 18) * 0.9;
  const half = 3 + Math.max(0, dy) * 1.5;
  const e = Math.abs(dx) / half;
  const cone = dy > 0 && e < 1.3 ? (e < 1 ? 1 : (1.3 - e) / 0.3) * 0.32 * (1 - dy / 22) : 0;
  return glow + cone;
}

/** The dust: each speck wanders round its own spot and is back there every loop, so the loop joins. */
const SPECKS = (() => {
  let a = 0x51ab7e3;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: { x: number; y: number; ax: number; ay: number; phase: number; tw: number }[] = [];
  for (let k = 0; k < 22; k++)
    out.push({ x: CX - 16 + r() * 32, y: 3 + r() * 11, ax: 2 + r() * 4, ay: 0.8 + r() * 1.6, phase: r() * 6.283, tw: r() * 6.283 });
  return out;
})();

export const fan: Background = {
  id: "fan",
  fps: 60,
  seconds: SECONDS,
  frame(t) {
    const turn = (t / SECONDS) * TURNS * Math.PI * 2;
    // How much of the lamp the blades hide right now: 3 blades pass in front of it 3 times a turn.
    const flicker = 0.95 + 0.05 * Math.cos(turn * 3);
    const col = new Float32Array(W * H * 3);
    const add = (x: number, y: number, c: number[], k: number) => {
      if (x < 0 || x >= W || y < 0 || y >= FLOOR || k <= 0) return;
      for (let i = 0; i < 3; i++) col[(y * W + x) * 3 + i] += c[i] * k;
    };
    // The light: a warm glow around the lamp and a soft cone under it.
    for (let y = 0; y < FLOOR; y++)
      for (let x = 0; x < W; x++) {
        add(x, y, GLOW, lightAt(x + 0.5, y + 0.5) * flicker * QUIET);
      }
    // The dust, lit by the lamp: bright where the light is, invisible in the dark.
    const k = (t / SECONDS) * Math.PI * 2;
    for (const sp of SPECKS) {
      const x = sp.x + Math.sin(k + sp.phase) * sp.ax + Math.sin(3 * k + sp.phase) * 0.6;
      const y = sp.y + Math.cos(k + sp.phase) * sp.ay + Math.sin(2 * k + sp.tw) * 0.4;
      const lit = Math.min(1, lightAt(x, y) * 1.8) * flicker * QUIET * (0.65 + 0.35 * Math.sin(5 * k + sp.tw));
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      add(xi, yi, SPECK, lit * (1 - fx) * (1 - fy));
      add(xi + 1, yi, SPECK, lit * fx * (1 - fy));
      add(xi, yi + 1, SPECK, lit * (1 - fx) * fy);
      add(xi + 1, yi + 1, SPECK, lit * fx * fy);
    }
    // The blades: dark, each with a fading blur behind it (where it just was), drawn over the glow.
    const dark = new Float32Array(W * H);
    for (let b = 0; b < 3; b++)
      for (let s = 0; s < 8; s++) {
        const a = turn + (b * Math.PI * 2) / 3 - s * 0.09; // s steps back along its path: the blur
        const k = s === 0 ? 1 : 0.55 * (1 - s / 8);
        for (let u = 0.25; u <= 1.0001; u += 0.08) {
          const x = CX + Math.cos(a) * RX * u, y = CY + Math.sin(a) * RY * u;
          const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
          const v = k * 0.3;
          const put = (px: number, py: number, w: number) => {
            if (px >= 0 && px < W && py >= 0 && py < FLOOR) dark[py * W + px] = Math.min(1, dark[py * W + px] + v * w);
          };
          put(xi, yi, (1 - fx) * (1 - fy));
          put(xi + 1, yi, fx * (1 - fy));
          put(xi, yi + 1, (1 - fx) * fy);
          put(xi + 1, yi + 1, fx * fy);
        }
      }
    const out = new Uint8Array(W * H * 4);
    for (let p = 0; p < W * H; p++) {
      const d = Math.min(1, dark[p]);
      let rgb = [0, 1, 2].map((i) => col[p * 3 + i] * (1 - d) + BLADE[i] * d);
      if (d > 0 && Math.max(...rgb) < BLADE[0]) rgb = BLADE.map((c) => c * d);
      // The rod and the lamp: a bright dot under the hub, the rod above it.
      const x = p % W, y = Math.floor(p / W);
      if (x === 45 && y === 0) rgb = [44, 42, 38];
      if (x === 45 && y === 3) rgb = LAMP.map((c) => c * 0.6 * (0.9 + 0.1 * flicker));
      if ((x === 44 || x === 46) && y === 3) rgb = LAMP.map((c) => c * 0.2);
      const q = rgb.map((c) => Math.min(255, Math.round(c / 4) * 4));
      if (q[0] + q[1] + q[2] < 6) continue;
      out[p * 4] = q[2];
      out[p * 4 + 1] = q[1];
      out[p * 4 + 2] = q[0];
      out[p * 4 + 3] = 255;
    }
    return out;
  },
};
