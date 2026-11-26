// BACKGROUND "Lamp on a brick wall": a dark workshop wall of bricks; a small lamp hangs on its wire from the top and
// swings gently, its warm pool of light sliding to and fro across the wall. A slow pendulum.
import { type Background } from "./dust";
import { W, H, canvas, add, addSoft, finish, rng, floor } from "./plate";

const SECONDS = 6; // one full swing there and back
const FPS = 30;
const BRICK = [110, 52, 34], MORTAR = [36, 26, 20];
const LIGHT = [255, 190, 110];
const PIVOT_X = 45, WIRE = 4.5, SWING = 0.45; // where the wire hangs from, its length, how far it swings (radians)
/** How much light the wall gets: away from the lamp, and at its brightest. */
const AMBIENT = 0.3, POOL = 1.1;

/** The wall: 1 for brick, 0 for mortar, with a little variation brick to brick. Rows of 3 px, bricks 7 px, staggered. */
const WALL = (() => {
  const r = rng(0xb21c);
  const shade: number[] = [];
  for (let i = 0; i < 200; i++) shade.push(0.8 + r() * 0.4);
  const m = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const row = Math.floor(y / 3), off = row % 2 ? 3 : 0;
      const col = Math.floor((x + off) / 7);
      const mortar = y % 3 === 2 || (x + off) % 7 === 6;
      m[y * W + x] = mortar ? 0 : shade[(row * 13 + col) % shade.length];
    }
  return m;
})();

export const lamp: Background = {
  id: "lamp",
  floor: true,
  fps: FPS,
  seconds: SECONDS,
  frame(t) {
    const px = canvas();
    const a = SWING * Math.sin((t / SECONDS) * Math.PI * 2);
    const lx = PIVOT_X + WIRE * Math.sin(a), ly = WIRE * Math.cos(a);
    // The pool of light on the wall: under and a little ahead of the lamp, wider than it is tall.
    const cx = lx + Math.sin(a) * 10, cy = ly + 4;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x - cx) / 16, (y - cy) / 9);
        const lit = AMBIENT + POOL * Math.exp(-d * d * 2);
        const v = WALL[y * W + x];
        const c = v > 0 ? BRICK : MORTAR;
        const k = v > 0 ? v : 1;
        add(px, x, y, [c[0] * k * (lit / 1.2) + LIGHT[0] * 0.02 * lit, c[1] * k * (lit / 1.2), c[2] * k * (lit / 1.2)], 0.95);
      }
    // The wire, then the lamp: a small dark shade with the bulb glowing under it.
    for (let s = 0; s < WIRE * 3; s++) addSoft(px, PIVOT_X + Math.sin(a) * s / 3, Math.cos(a) * s / 3, [20, 16, 14], 1);
    // the shade: a little dome, 3 px wide
    for (const dx of [-1, 0, 1]) addSoft(px, lx + dx, ly, [70, 60, 48], 1);
    addSoft(px, lx, ly - 0.8, [70, 60, 48], 1);
    // the bulb under it, and a soft halo
    addSoft(px, lx, ly + 1, LIGHT, 1.4);
    for (const [dx, dy] of [[-1, 1], [1, 1], [0, 2]]) addSoft(px, lx + dx, ly + dy, LIGHT, 0.35);
    floor(px, [110, 70, 40], 1);
    return finish(px);
  },
};
