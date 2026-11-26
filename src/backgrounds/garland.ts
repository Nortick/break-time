// OVERLAY "Garland": a string of New Year lights hanging along the top edge, over whatever background is on. Played
// as its own looping file on top of everything (main.ts), so it only draws the wire and the bulbs (the rest is
// transparent) and keeps to the top two rows, above the digits. Its loop goes through three moods: the bulbs
// breathing in two groups, a run of light chasing along, and a random twinkle. Shown in December and early January,
// or always / never: "garland" in the settings.
import { type Background } from "./dust";
import { W, H, rng } from "./plate";

const SECONDS = 24;
const FPS = 30;
/** Where the wire is hooked up (x), and how far it sags between hooks (px). */
const HOOKS = [0, 18, 36, 54, 71];
const SAG = 1.4;
const WIRE = [24, 58, 30];
const COLORS = [
  [255, 60, 50], // red
  [60, 230, 90], // green
  [255, 200, 40], // yellow
  [60, 140, 255], // blue
];

/** The wire's row at each column (0 at a hook, 1 in the middle of a span). */
const WIRE_Y = (() => {
  const y: number[] = [];
  for (let x = 0; x < W; x++) {
    let k = 0;
    while (k < HOOKS.length - 2 && x > HOOKS[k + 1]) k++;
    const a = HOOKS[k], b = HOOKS[k + 1];
    y.push(Math.round(SAG * Math.sin((Math.PI * (x - a)) / (b - a))));
  }
  return y;
})();

/** The bulbs: every 4 px along the wire, hanging just under it, colours in turn. */
const BULBS = (() => {
  const r = rng(0x9a71);
  const out: { x: number; y: number; c: number[]; group: number; tw: number; ph: number }[] = [];
  for (let x = 2, i = 0; x < W - 1; x += 4, i++)
    out.push({ x, y: WIRE_Y[x] + 1, c: COLORS[i % COLORS.length], group: i % 2, tw: 1 + Math.floor(r() * 4), ph: r() });
  return out;
})();

/** How bright bulb n is at time t (0 dim .. 1 full), by the mood of the moment. */
function brightness(n: number, t: number): number {
  const b = BULBS[n];
  const part = SECONDS / 3, mood = Math.floor(t / part), u = (t % part) / part;
  // Fade the moods into each other over their first and last half second, so the change is soft.
  if (mood === 0) {
    // Breathing: the two groups take turns, slowly.
    const s = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 4 + (b.group ? Math.PI : 0));
    return 0.25 + 0.75 * s;
  }
  if (mood === 1) {
    // Chase: a bright spot runs along right to left, three times, with a soft tail.
    const head = (1 - ((u * 3) % 1)) * (BULBS.length + 4) - 2;
    const d = n - head;
    return d >= 0 && d < 4 ? 1 - d / 4 : 0.2;
  }
  // Twinkle: each bulb flickers on its own beat.
  const s = Math.sin((u * b.tw + b.ph) * Math.PI * 2);
  return s > 0.6 ? 1 : 0.3 + 0.3 * Math.max(0, s);
}

export const garland: Background = {
  id: "garland",
  fps: FPS,
  seconds: SECONDS,
  frame(t) {
    const out = new Uint8Array(W * H * 4);
    const put = (x: number, y: number, c: number[]) => {
      if (x < 0 || x >= W || y < 0 || y >= H) return;
      const o = (y * W + x) * 4;
      out[o] = Math.min(255, Math.round(c[2]));
      out[o + 1] = Math.min(255, Math.round(c[1]));
      out[o + 2] = Math.min(255, Math.round(c[0]));
      out[o + 3] = 255;
    };
    for (let x = 0; x < W; x++) put(x, WIRE_Y[x], WIRE);
    BULBS.forEach((b, n) => {
      const k = brightness(n, t);
      put(b.x, b.y, b.c.map((v) => 20 + v * k));
      // A bright bulb tints the wire beside it: a hint of glow without covering anything.
      if (k > 0.7) {
        for (const dx of [-1, 1]) {
          const x = b.x + dx;
          if (x >= 0 && x < W) put(x, WIRE_Y[x], WIRE.map((v, i) => v + b.c[i] * 0.35 * k));
        }
      }
    });
    return out;
  },
};
