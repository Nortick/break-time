// BACKGROUND "Matrix", for 13:37 only (main.ts switches to it for that minute): green code rain. Streams of glyphs
// fall down the columns, a bright head and a fading tail, the glyphs in the tail flickering. Kept dim, so the digits
// stay easy to read over it.
import { type Background } from "./dust";

const W = 72, H = 16, FLOOR = 15;
const SECONDS = 4;
const FPS = 30;
/** How dim the whole thing is (1 = full green). */
const LEVEL = 0.55;

/** The streams: a column each (some columns have none), where it starts, how long its tail is, how many laps a loop. */
const STREAMS = (() => {
  let a = 0x1337;
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out: { x: number; phase: number; tail: number; laps: number }[] = [];
  for (let x = 0; x < W; x++) if (r() < 0.55) out.push({ x, phase: r(), tail: 4 + Math.floor(r() * 6), laps: 1 + Math.floor(r() * 3) });
  return out;
})();

/** A glyph's flicker: steady for a few frames, then another "glyph" (brightness), so the tail shimmers. */
function flick(x: number, y: number, k: number): number {
  let h = Math.imul(x * 73856093 ^ y * 19349663 ^ Math.floor(k / 4) * 83492791, 2654435761) >>> 0;
  h ^= h >>> 13;
  return 0.55 + 0.45 * ((h & 255) / 255);
}

export const matrix: Background = {
  id: "matrix",
  fps: FPS,
  seconds: SECONDS,
  frame(t) {
    const out = new Uint8Array(W * H * 4);
    const k = Math.round(t * FPS);
    for (const s of STREAMS) {
      const span = FLOOR + s.tail;
      const head = ((s.phase + (t / SECONDS) * s.laps) % 1) * span;
      for (let n = 0; n <= s.tail; n++) {
        const y = Math.floor(head) - n;
        if (y < 0 || y >= FLOOR) continue;
        const fade = n === 0 ? 1 : (1 - n / (s.tail + 1)) * 0.6 * flick(s.x, y, k);
        const g = Math.round(255 * fade * LEVEL), rb = n === 0 ? Math.round(170 * LEVEL) : Math.round(40 * fade * LEVEL);
        const o = (y * W + s.x) * 4;
        out[o] = rb; // B
        out[o + 1] = g; // G
        out[o + 2] = rb; // R
        out[o + 3] = 255;
      }
    }
    return out;
  },
};
