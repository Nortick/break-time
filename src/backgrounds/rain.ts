// BACKGROUND "Rain on the window": a dark blue-grey pane with thin slanted streaks of rain falling behind it, and now
// and then a drop on the glass that slips down, leaving a fading trail. The only background that moves downward.
import { type Background } from "./dust";
import { W, H, canvas, addSoft, gradient, finish, rng, floor } from "./plate";

const SECONDS = 8;
const FPS = 30;
const TOP = [12, 18, 26], BOTTOM = [18, 26, 36];
const RAIN = [120, 150, 180], DROP = [170, 200, 225];
/** How strong it is (1 = as drawn). */
const LEVEL = 1;
const SLANT = 0.3; // px sideways for each px down

/** The streaks: column, speed (falls a whole number of times a loop), length, start. */
const STREAKS = (() => {
  const r = rng(0x4a1);
  const out: { x: number; laps: number; len: number; phase: number; k: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const near = r();
    out.push({ x: r() * (W + 8), laps: 6 + Math.floor(near * 5), len: 2 + near * 2.5, phase: r(), k: 0.25 + near * 0.35 });
  }
  return out;
})();

/** Drops on the glass: where, when in the loop they let go, how far they slide. */
const DROPS = [
  { x: 44, y: 1.5, at: 0.05, slide: 9 },
  { x: 67, y: 2, at: 0.4, slide: 11 },
  { x: 14, y: 1, at: 0.65, slide: 7 },
  { x: 58, y: 3, at: 0.8, slide: 6 },
];

export const rain: Background = {
  id: "rain",
  floor: true,
  fps: FPS,
  seconds: SECONDS,
  frame(t) {
    const px = canvas();
    gradient(px, TOP, BOTTOM);
    const loop = t / SECONDS;
    // The streaks: each a short slanted line falling, wrapping from bottom back to top.
    for (const s of STREAKS) {
      const u = (loop * s.laps + s.phase) % 1;
      const yHead = -s.len + u * (H + s.len * 2);
      for (let j = 0; j < s.len * 3; j++) {
        const y = yHead - j / 3;
        const x = s.x - 6 + (y + 6) * SLANT - 4;
        addSoft(px, x, y, RAIN, (s.k * (1 - j / (s.len * 3))) * 0.75 * LEVEL);
      }
    }
    // The drops: sit still, then slip down (slow, then quicker), the trail behind fading; gone, back at the next loop.
    for (const d of DROPS) {
      const u = (loop - d.at + 1) % 1; // 0 when it lets go
      const sit = 0.25; // part of a loop it sits before letting go (shown at the end of the previous loop)
      let y = d.y;
      if (u < 0.45) y = d.y + d.slide * Math.pow(u / 0.45, 1.6);
      else if (u < 1 - sit) continue; // slid off / not formed yet
      const slid = u < 0.45 ? u / 0.45 : 0;
      addSoft(px, d.x, y, DROP, 1.1 * LEVEL);
      // the trail: a fading wet line above it
      for (let k = 1; k < (y - d.y) * 2; k++) addSoft(px, d.x, y - k / 2, DROP, 0.3 * (1 - k / ((y - d.y) * 2)) * (1 - slid * 0.5) * LEVEL);
    }
    floor(px, [60, 74, 90], 1);
    return finish(px);
  },
};
