// BACKGROUND "Steel plate", in the style of the bar's BOOKED: a dark brushed-metal plate with a rivet in each corner,
// a bevel round the edge, and every few seconds a soft glint sweeping across it on a slant. Fits the workshop.
import { type Background } from "./dust";
import { W, H, canvas, add, gradient, finish, rng, bump, drift, floor } from "./plate";

const SECONDS = 14; // the glint crosses twice a loop; the dust needs the longer loop to drift slowly
const FPS = 60; // still most of the time, so the file stays small even at 60
const TOP = [46, 52, 60], BOTTOM = [20, 23, 28];
const GLINT = [200, 215, 230];
/** The glint: when in the loop it starts and how long it takes to cross, in seconds. */
const SWEEP_AT = [1, 8], SWEEP = 1.6;
/** How strong the glint is at its brightest. */
const SHINE = 0.32;

/** The brushed grain: a faint lighter or darker streak along each row, the same every frame. */
const GRAIN = (() => {
  const r = rng(0x57ee1);
  const g = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    let v = 0;
    for (let x = 0; x < W; x++) {
      v = v * 0.85 + (r() - 0.5) * 0.6; // wanders slowly along the row: a streak, not noise
      g[y * W + x] = v;
    }
  }
  return g;
})();

const RIVETS = [[3, 3], [68, 3], [3, 12], [68, 12]];

export const steel: Background = {
  id: "steel",
  floor: true,
  fps: FPS,
  seconds: SECONDS,
  frame(t) {
    const px = canvas();
    gradient(px, TOP, BOTTOM);
    for (let p = 0; p < W * H; p++) {
      const k = 1 + GRAIN[p] * 0.12;
      px[p * 3] *= k;
      px[p * 3 + 1] *= k;
      px[p * 3 + 2] *= k;
    }
    // The rivets: a light top-left, a dark shadow bottom-right.
    for (const [x, y] of RIVETS) {
      add(px, x, y, [120, 130, 140], 1);
      add(px, x + 1, y, [60, 66, 74], 1);
      add(px, x, y + 1, [60, 66, 74], 1);
      add(px, x + 1, y + 1, [-20, -20, -20], 1);
    }
    drift(px, t, SECONDS, [150, 158, 168], 0.3, 0xd59);
    floor(px, [92, 100, 110], 1);
    // The glint: a soft slanted band with a bright thin middle, crossing left to right, then gone till the next loop.
    for (const at0 of SWEEP_AT) {
    const u = (t - at0) / SWEEP;
    if (u > 0 && u < 1) {
      const ease = u * u * (3 - 2 * u);
      const at = -16 + ease * (W + 32);
      const fade = Math.sin(u * Math.PI);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const d = x + (H - y) * 0.7 - at;
          const k = (bump(d, 7) * 0.5 + bump(d, 1.6) * 0.8) * SHINE * fade;
          add(px, x, y, GLINT, k);
        }
    }
    }
    // Keep the rounded corners black after the glint.
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [W - 1, 0], [W - 2, 0], [W - 1, 1], [0, H - 1], [1, H - 1], [0, H - 2], [W - 1, H - 1], [W - 2, H - 1], [W - 1, H - 2]]) {
      const o = (y * W + x) * 3;
      px[o] = px[o + 1] = px[o + 2] = 0;
    }
    return finish(px);
  },
};
