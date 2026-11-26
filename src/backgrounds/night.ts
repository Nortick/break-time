// BACKGROUND "Night sky", in the style of the bar's CHILL TIME: a deep violet plate, a soft nebula drifting slowly
// along the bottom, and a few stars that twinkle in turn (a dot that flares into a little cross and fades). Kept
// darker than the bar's own, so the white digits stay easy to read over it.
import { type Background } from "./dust";
import { W, H, canvas, add, gradient, ground, finish, rng, mix, drift } from "./plate";

const SECONDS = 24;
const FPS = 30; // the nebula moves slowly, 30 frames are as smooth as 60 here and the file is half the size
const TOP = [16, 10, 44], BOTTOM = [30, 18, 74];
const NEBULA = [88, 52, 150], NEBULA_HOT = [150, 84, 170];
const STAR = [235, 225, 255];
/** How strong the whole thing is (1 = as drawn). */
const LEVEL = 1;

/** The nebula's waves: how many to a screen width, how strong, where they start. All wrap round the screen once a loop. */
const WAVES = [
  { k: 1, a: 0.55, p: 0.3 },
  { k: 2, a: 0.35, p: 2.1 },
  { k: 3, a: 0.25, p: 4.0 },
  { k: 5, a: 0.12, p: 1.2 },
];

/** The stars: where, how often they flare in a loop, when. Most sit off the digits, a few peek between them. */
const STARS = (() => {
  const r = rng(0x5a7);
  const spots = [[44, 2], [49, 1], [57, 4], [63, 1], [68, 3], [53, 7], [66, 8], [3, 3], [12, 1], [24, 1], [31, 2], [42, 9]];
  return spots.map(([x, y]) => ({ x, y, laps: 2 + Math.floor(r() * 3), phase: r() }));
})();

export const night: Background = {
  id: "night",
  floor: true,
  fps: FPS,
  seconds: SECONDS,
  frame(t) {
    const px = canvas();
    gradient(px, TOP, BOTTOM);
    const loop = t / SECONDS; // 0..1 through the loop
    // The nebula: a band of soft cloud along the bottom, its shape made of waves sliding left, one screen a loop.
    for (let x = 0; x < W; x++) {
      let n = 0;
      for (const w of WAVES) n += w.a * Math.sin(((x / W + loop) * w.k) * Math.PI * 2 + w.p);
      // A second, slower-looking layer: the same waves the other way round, weaker, so it churns a little.
      let m = 0;
      for (const w of WAVES) m += w.a * Math.sin(((x / W - loop) * w.k) * Math.PI * 2 + w.p * 1.7);
      const top = 9.5 - n * 2.6; // where the cloud's upper edge is in this column
      for (let y = 0; y < H; y++) {
        const depth = y - top; // how far into the cloud
        if (depth < -2) continue;
        const k = Math.min(1, (depth + 2) / 5) * (0.55 + 0.25 * m);
        add(px, x, y, mix(NEBULA, NEBULA_HOT, Math.max(0, Math.min(1, n * 0.8 + 0.2))), Math.max(0, k) * 0.85 * LEVEL);
      }
    }
    // The stars: a faint dot always, and now and then a flare, a cross at its brightest.
    for (const s of STARS) {
      const u = (loop * s.laps + s.phase) % 1;
      const flare = u < 0.18 ? Math.sin((u / 0.18) * Math.PI) : 0;
      add(px, s.x, s.y, STAR, (0.22 + 0.7 * flare) * LEVEL);
      if (flare > 0.35) {
        const arm = (flare - 0.35) * 0.7 * LEVEL;
        add(px, s.x - 1, s.y, STAR, arm);
        add(px, s.x + 1, s.y, STAR, arm);
        add(px, s.x, s.y - 1, STAR, arm);
        add(px, s.x, s.y + 1, STAR, arm);
      }
    }
    drift(px, t, SECONDS, [170, 150, 220], 0.35 * LEVEL, 0xd57);
    ground(px, [10, 6, 28]); // no frame: just the floor
    return finish(px);
  },
};
