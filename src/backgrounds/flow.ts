// BACKGROUND "Flow", in the style of the bar's FLOW: a deep blue plate with soft ribbons of teal light streaming
// across it on a slant, waving as they go, and now and then a small bubble rising. Darker than the bar's own, so the
// digits stay easy to read.
import { type Background } from "./dust";
import { W, H, canvas, add, addSoft, gradient, ground, finish, rng, bump, mix } from "./plate";

const SECONDS = 12;
const FPS = 30;
const TOP = [6, 16, 44], BOTTOM = [4, 26, 60];
const DEEP = [10, 60, 110], TEAL = [40, 190, 200];
const BUBBLE = [150, 230, 245];
/** How strong the ribbons are (1 = as drawn). */
const LEVEL = 0.8;

/**
 * The ribbons: each a wavy line on a slant (rising to the right), `k` waves to the screen, sliding right `laps` times
 * a loop; `w` how wide its glow is, `a` how strong.
 */
const RIBBONS = [
  { base: 14, slope: -0.13, amp: 2.0, k: 1, laps: 1, ph: 0.0, w: 4.5, a: 0.5 },
  { base: 9, slope: -0.09, amp: 1.5, k: 2, laps: 1, ph: 2.2, w: 3.5, a: 0.38 },
  { base: 18, slope: -0.15, amp: 1.6, k: 1, laps: 2, ph: 4.4, w: 3.8, a: 0.3 },
];

/** The bubbles: where each rises, when, how many times a loop. */
const BUBBLES = (() => {
  const r = rng(0xf10);
  const out: { x: number; laps: number; phase: number; sway: number }[] = [];
  for (let i = 0; i < 7; i++) out.push({ x: 3 + r() * 66, laps: 1 + Math.floor(r() * 2), phase: r(), sway: r() * 6.283 });
  return out;
})();

export const flow: Background = {
  id: "flow",
  floor: true,
  fps: FPS,
  seconds: SECONDS,
  frame(t) {
    const px = canvas();
    gradient(px, TOP, BOTTOM);
    const loop = t / SECONDS;
    for (let x = 0; x < W; x++) {
      // A little brighter toward the right, like the bar's FLOW.
      const side = 0.6 + 0.4 * (x / W);
      for (const rb of RIBBONS) {
        const yc = rb.base + rb.slope * x + rb.amp * Math.sin((x / W * rb.k - loop * rb.laps) * Math.PI * 2 + rb.ph);
        for (let y = 0; y < H; y++) {
          const d = y - yc;
          const glow = bump(d, rb.w), core = bump(d, 1.4);
          if (glow <= 0) continue;
          add(px, x, y, mix(DEEP, TEAL, core), (glow * 0.5 + core * 0.5) * rb.a * side * LEVEL);
        }
      }
    }
    // The bubbles: rise from the bottom over a third of a lap, swaying, fading out near the top.
    for (const b of BUBBLES) {
      const u = (loop * b.laps + b.phase) % 1;
      if (u > 0.35) continue;
      const v = u / 0.35; // 0..1 of its rise
      const y = H - 1.5 - v * 11;
      const x = b.x + Math.sin(v * 6 + b.sway) * 0.8;
      addSoft(px, x, y, BUBBLE, 0.5 * Math.sin(v * Math.PI) * LEVEL);
    }
    ground(px, [2, 10, 30]); // no frame: just the floor
    return finish(px);
  },
};
