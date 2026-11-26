// Shared pieces for the backgrounds made in the style of the bar's own animations (CHILL TIME, FLOW, BOOKED): a
// rounded plate with a one-pixel bevel round the edge, soft light drawn in floating-point colour, and a tidy way to
// turn it into the 72x16 BGRA picture the bake writes.
export const W = 72, H = 16;

/** A picture being drawn: R, G, B per pixel, 0..255 and more (clipped at the end). */
export type Canvas = Float32Array;

export function canvas(): Canvas {
  return new Float32Array(W * H * 3);
}

/** Adds colour c times k to a pixel (outside the screen: nothing). */
export function add(px: Canvas, x: number, y: number, c: number[], k: number): void {
  if (x < 0 || x >= W || y < 0 || y >= H || k <= 0) return;
  const o = (y * W + x) * 3;
  px[o] += c[0] * k;
  px[o + 1] += c[1] * k;
  px[o + 2] += c[2] * k;
}

/** Adds colour at a point between pixels: spread over the four round it, so it moves smoothly, not pixel by pixel. */
export function addSoft(px: Canvas, x: number, y: number, c: number[], k: number): void {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  add(px, xi, yi, c, k * (1 - fx) * (1 - fy));
  add(px, xi + 1, yi, c, k * fx * (1 - fy));
  add(px, xi, yi + 1, c, k * (1 - fx) * fy);
  add(px, xi + 1, yi + 1, c, k * fx * fy);
}

/** Mixes a toward b by t (0..1). */
export function mix(a: number[], b: number[], t: number): number[] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** The plate: a vertical gradient from top to bottom colour. */
export function gradient(px: Canvas, top: number[], bottom: number[]): void {
  for (let y = 0; y < H; y++) {
    const c = mix(top, bottom, y / (H - 1));
    for (let x = 0; x < W; x++) add(px, x, y, c, 1);
  }
}

/**
 * The plate's bottom edge alone (the bevel's dark line along the bottom, without the frame round the rest): the floor
 * he stands on, for the backgrounds that had it from their bevel. No frame since 2026-11-22.
 */
export function ground(px: Canvas, dark: number[]): void {
  for (let x = 0; x < W; x++) {
    const o = ((H - 1) * W + x) * 3;
    px[o] = dark[0];
    px[o + 1] = dark[1];
    px[o + 2] = dark[2];
  }
}

/** Whether a pixel is cut off by the plate's rounded corners. */
function corner(x: number, y: number): boolean {
  const cx = Math.min(x, W - 1 - x), cy = Math.min(y, H - 1 - y);
  return (cx === 0 && cy <= 1) || (cx === 1 && cy === 0);
}

/**
 * The bevel round the plate's edge, like the bar's own buttons: a light line along the top, a dimmer one down the
 * sides and a dark one along the bottom; the corners rounded off. `light` is the top line's colour.
 */
export function bevel(px: Canvas, light: number[], dark: number[]): void {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      if (corner(x, y)) { px[o] = px[o + 1] = px[o + 2] = 0; continue; }
      const edge = x === 0 || x === W - 1 || y === 0 || y === H - 1;
      if (!edge) continue;
      // How lit this bit of edge is: 1 on top, 0 at the bottom, in between down the sides.
      const lit = y === 0 ? 1 : y === H - 1 ? 0 : 0.75 - (y / H) * 0.6;
      const c = mix(dark, light, lit);
      px[o] = c[0];
      px[o + 1] = c[1];
      px[o + 2] = c[2];
    }
}

/**
 * The finished picture, 72x16 BGRA. Colours are rounded to steps of 4 (the eye doesn't see the difference on the bar,
 * and the file packs much smaller); a pixel that comes out black is left transparent.
 */
export function finish(px: Canvas): Uint8Array {
  const out = new Uint8Array(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    const q = [0, 1, 2].map((i) => Math.max(0, Math.min(255, Math.round(px[p * 3 + i] / 4) * 4)));
    if (q[0] + q[1] + q[2] < 6) continue;
    out[p * 4] = q[2];
    out[p * 4 + 1] = q[1];
    out[p * 4 + 2] = q[0];
    out[p * 4 + 3] = 255;
  }
  return out;
}

/** A repeatable random number source, so the bake writes the same file every time. */
export function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth bump: 1 at 0, falling to 0 at |d| = r. */
export function bump(d: number, r: number): number {
  const u = Math.abs(d) / r;
  return u >= 1 ? 0 : 0.5 + 0.5 * Math.cos(u * Math.PI);
}

/**
 * Dust drifting right to left across the whole screen: small soft specks, nearer ones faster and brighter (a little
 * depth), each bobbing gently. Every speck crosses a whole number of times a loop, so the loop joins seamlessly.
 */
export function drift(px: Canvas, t: number, seconds: number, c: number[], level: number, seed: number, count = 12): void {
  const r = rng(seed);
  const span = W + 6; // a speck enters 3 px off the right edge and leaves 3 px past the left one
  const loop = t / seconds;
  for (let i = 0; i < count; i++) {
    const near = r(); // 0 far .. 1 near
    const laps = 1 + Math.floor(near * 2.99); // far specks cross once a loop, near ones up to three times
    const phase = r(), y0 = 1 + r() * 13, bob = 0.4 + r() * 0.8, bp = r() * 6.283, tw = r() * 6.283;
    const x = W + 3 - (((loop * laps + phase) % 1) * span);
    const y = y0 + Math.sin(loop * Math.PI * 2 * (laps + 1) + bp) * bob;
    const k = (0.35 + 0.65 * near) * (0.75 + 0.25 * Math.sin(loop * Math.PI * 2 * 3 + tw)) * level;
    addSoft(px, x, y, c, k);
  }
}

/** The floor he stands on: the bottom row, a light top edge on a darker strip. */
export function floor(px: Canvas, c: number[], k: number): void {
  for (let x = 1; x < W - 1; x++) {
    const o = ((H - 1) * W + x) * 3;
    // a little lighter in the middle of the screen, falling off to the sides
    const f = k * (0.75 + 0.25 * Math.sin((x / W) * Math.PI));
    px[o] = c[0] * f;
    px[o + 1] = c[1] * f;
    px[o + 2] = c[2] * f;
  }
}
