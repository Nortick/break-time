// BACKGROUND "Blueprint": a dark sheet of graph paper; a drawing (a car, a house, a light bulb) draws itself line by
// line with a bright pen tip, stays a moment, fades away, and the next one begins. Fits the worker.
// 2026-11-22: the sheet went from blue to teal (the worker, in blue, melted into it), no frame round it, new drawings.
import { type Background } from "./dust";
import { W, H, canvas, add, addSoft, gradient, ground, finish } from "./plate";

const PER = 8; // seconds per drawing: draw, hold, fade
const DRAW = 4.2, HOLD = 2.4; // the rest of PER is the fade
const FPS = 30;
const TOP = [4, 30, 30], BOTTOM = [6, 40, 38];
const GRID = [40, 130, 115], INK = [120, 240, 210], TIP = [235, 255, 245];
/** How strong the drawing is (1 = as drawn). */
const LEVEL = 0.38;

type Pt = [number, number];

function circle(cx: number, cy: number, r: number, n = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push([cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2)]);
  return out;
}

/** Each drawing: a list of strokes (polylines), drawn in order (then blown up, see ZOOM). */
const DRAWINGS: Pt[][][] = [
  // a car from the side: the body, the window, both wheels
  [
    [[57, 8], [57, 6], [60, 5.5], [62, 3], [67, 3], [69, 5.5], [71, 6], [71, 8], [57, 8]],
    [[62.5, 5.5], [63.5, 3.8], [66.5, 3.8], [67.5, 5.5], [62.5, 5.5]],
    circle(60, 8.3, 1.5, 12),
    circle(68, 8.3, 1.5, 12),
  ],
  // a little house: walls, roof, door, window
  [
    [[59, 9], [59, 5], [70, 5], [70, 9], [59, 9]],
    [[58, 5], [64.5, 0.5], [71, 5]],
    [[61.5, 9], [61.5, 6.8], [63.5, 6.8], [63.5, 9]],
    [[66, 6], [68, 6], [68, 8], [66, 8], [66, 6]],
  ],
  // a light bulb: the glass, the filament, the screw base, rays round it
  [
    circle(65, 4, 3.2, 18),
    [[63.5, 6.8], [63.5, 8.8], [66.5, 8.8], [66.5, 6.8]],
    [[64, 9.8], [66, 9.8]],
    [[63.8, 4.6], [64.5, 2.8], [65.5, 4.6], [66.2, 2.8]],
    [[59.5, 0.5], [61, 1.6]], [[70.5, 0.5], [69, 1.6]], [[59, 4], [60.8, 4]], [[69.2, 4], [71, 4]],
  ],
];

/** Each drawing's strokes as one list of short steps, with how far along the whole drawing each step is. */
/**
 * The drawings blown up ZOOM times round a point of each, so only bits of their lines cross the screen: no picture to
 * make out, just lines sweeping past (asked for 2026-11-22: the small drawings drew the eye). Each drawing its own
 * spot, so the streaks come from different sides.
 */
const ZOOM = 14;
const FOCI: Pt[] = [[62, 5], [66, 6], [63, 4]];
const PATHS = DRAWINGS.map((raw, n) => {
  const [fx, fy] = FOCI[n % FOCI.length];
  const strokes = raw.map((s) => s.map(([x, y]) => [W / 2 + (x - fx) * ZOOM, H / 2 + (y - fy) * ZOOM] as Pt));
  const pts: { x: number; y: number; d: number }[] = [];
  let d = 0;
  for (const s of strokes)
    for (let i = 1; i < s.length; i++) {
      const [x0, y0] = s[i - 1], [x1, y1] = s[i];
      const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(len * 3));
      for (let k = 0; k < steps; k++) {
        const f = k / steps;
        pts.push({ x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, d: d + len * f });
      }
      d += len;
    }
  return { pts, total: d };
});

export const blueprint: Background = {
  id: "blueprint",
  floor: true,
  fps: FPS,
  seconds: PER * DRAWINGS.length,
  frame(t) {
    const px = canvas();
    gradient(px, TOP, BOTTOM);
    // Graph paper: faint lines every 4 px, a touch stronger every 8.
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const major = x % 8 === 0 || y % 8 === 0, minor = x % 4 === 0 || y % 4 === 0;
        if (major) add(px, x, y, GRID, 0.25);
        else if (minor) add(px, x, y, GRID, 0.1);
      }
    const i = Math.floor(t / PER) % DRAWINGS.length, u = t - i * PER;
    const path = PATHS[i];
    const drawn = Math.min(1, u / DRAW) * path.total;
    const fade = u < DRAW + HOLD ? 1 : Math.max(0, 1 - (u - DRAW - HOLD) / (PER - DRAW - HOLD));
    for (const p of path.pts) if (p.d <= drawn) addSoft(px, p.x, p.y, INK, 0.55 * fade * LEVEL);
    // The pen tip while it draws.
    if (u < DRAW) {
      let tip = path.pts[0];
      for (const p of path.pts) if (p.d <= drawn) tip = p;
      addSoft(px, tip.x, tip.y, TIP, 1.2 * LEVEL);
    }
    ground(px, [20, 70, 62]); // the floor; no frame
    return finish(px);
  },
};
