// BACKGROUND "Light from a window": a soft ray of warm light falls slant-wise from the top right down to the floor,
// breathing a little brighter and dimmer, and the dust shows only where the light catches it, as it really does.
import { type Background } from "./dust";

const W = 72, H = 16;
const FLOOR = 15;
const SECONDS = 12;
/** The ray's color at its brightest, and the dust's (brighter: lit specks stand out of the ray). */
const RAY = [44, 34, 20];
const SPECK = [190, 160, 105];

/** Where the ray's middle is at row y: it comes in at the top around x=58 and lands on the floor around x=40. */
const rayX = (y: number) => 60 - y * 1.3;
/** How lit a point is: 1 in the middle of the ray, fading out to 0 over its soft edges. */
function inRay(x: number, y: number): number {
  const d = Math.abs(x - rayX(y));
  const half = 4 + y * 0.35; // widens as it goes down
  if (d > half + 3) return 0;
  if (d < half) return 1;
  const u = 1 - (d - half) / 3;
  return u * u * (3 - 2 * u);
}

function specks() {
  let a = 0x51ab7e3;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: { x: number; y: number; vx: number; vy: number; wob: number; phase: number; f: number }[] = [];
  for (let k = 0; k < 26; k++)
    out.push({
      x: 30 + r() * 38,
      y: r() * FLOOR,
      vx: (r() - 0.5) * 1.6,
      vy: (r() - 0.55) * 0.9,
      wob: 0.3 + r() * 0.7,
      phase: r() * Math.PI * 2,
      f: 0.5 + r() * 0.5,
    });
  return out;
}
const SPECKS = specks();

export const ray: Background = {
  id: "ray",
  fps: 60,
  seconds: SECONDS,
  frame(t) {
    const out = new Uint8Array(W * H * 4);
    // The ray breathes slowly (a cloud passing), over the whole loop so it joins up.
    const breath = 0.8 + 0.2 * Math.sin((t / SECONDS) * Math.PI * 2);
    const light = new Float32Array(W * H);
    const dust = new Float32Array(W * H);
    for (let y = 0; y < FLOOR; y++) for (let x = 0; x < W; x++) light[y * W + x] = inRay(x + 0.5, y + 0.5) * breath;
    for (const s of SPECKS) {
      // Each speck wanders around its spot and comes back to it every loop (whole turns of the sines), so the loop joins.
      const k = (t / SECONDS) * Math.PI * 2;
      const x = s.x + Math.sin(k + s.phase) * 4 * s.f + Math.sin(2 * k + s.phase * 2) * s.wob;
      const y = s.y + Math.cos(k + s.phase) * 2 * s.f + Math.sin(3 * k + s.phase) * s.wob * 0.5;
      const lit = inRay(x, y) * breath * (0.6 + 0.4 * Math.sin(4 * k + s.phase * 3));
      if (lit <= 0) continue;
      const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const put = (px: number, py: number, v: number) => {
        if (px >= 0 && px < W && py >= 0 && py < FLOOR) dust[py * W + px] += v;
      };
      put(x0, y0, lit * (1 - fx) * (1 - fy));
      put(x0 + 1, y0, lit * fx * (1 - fy));
      put(x0, y0 + 1, lit * (1 - fx) * fy);
      put(x0 + 1, y0 + 1, lit * fx * fy);
    }
    for (let p = 0; p < W * H; p++) {
      const l = Math.round(light[p] * 12) / 12, d = Math.min(1, Math.round(dust[p] * 16) / 16);
      if (l <= 0 && d <= 0) continue;
      const c = [0, 1, 2].map((i) => Math.min(255, Math.round(RAY[i] * l + (SPECK[i] - RAY[i] * l) * d)));
      out[p * 4] = c[2];
      out[p * 4 + 1] = c[1];
      out[p * 4 + 2] = c[0];
      out[p * 4 + 3] = 255;
    }
    return out;
  },
};
