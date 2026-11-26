// BACKGROUND "Aurora": a dark night plate with soft green-teal curtains of light hanging across the top, rippling
// slowly; fine vertical rays in them drift and shimmer, and a few faint stars sit above.
import { type Background } from "./dust";
import { W, H, canvas, add, gradient, ground, finish, mix } from "./plate";

const SECONDS = 16;
const FPS = 30;
const TOP = [4, 10, 18], BOTTOM = [6, 14, 22];
const GREEN = [40, 210, 120], TEAL = [40, 160, 190], VIOLET = [120, 70, 170];
/** How strong it is (1 = as drawn). */
const LEVEL = 0.9;
const STARS = [[5, 2], [17, 1], [29, 3], [44, 1], [53, 4], [61, 2], [69, 5], [38, 6]];

export const aurora: Background = {
  id: "aurora",
  floor: true,
  fps: FPS,
  seconds: SECONDS,
  frame(t) {
    const px = canvas();
    gradient(px, TOP, BOTTOM);
    for (const [x, y] of STARS) add(px, x, y, [180, 200, 220], 0.25);
    const L = (t / SECONDS) * Math.PI * 2;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      // Where the curtain's lower edge is in this column, and how bright the curtain is here: slow waves, both ways.
      const edge = 6.5 + 2 * Math.sin(u * Math.PI * 2 * 1 + L) + 1.2 * Math.sin(u * Math.PI * 2 * 3 - L * 2 + 1);
      const glow = 0.55 + 0.3 * Math.sin(u * Math.PI * 2 * 2 - L + 2) + 0.15 * Math.sin(u * Math.PI * 2 * 5 + L * 3);
      // Fine rays: thin vertical streaks drifting along.
      const ray = 0.7 + 0.3 * Math.sin(u * Math.PI * 2 * 11 - L * 2) * Math.sin(u * Math.PI * 2 * 7 + L);
      for (let y = 0; y < H; y++) {
        const above = edge - y; // > 0: inside the curtain, above its lower edge
        if (above < -1) continue;
        // brightest just above the lower edge, fading upward; a soft rim below it
        const k = above < 0 ? (1 + above) * 0.6 : Math.exp(-above / 3.2);
        const c = mix(mix(GREEN, TEAL, Math.min(1, Math.max(0, above / 4))), VIOLET, Math.min(1, Math.max(0, (above - 4) / 4)));
        add(px, x, y, c, k * glow * ray * LEVEL);
      }
    }
    ground(px, [2, 6, 10]); // no frame: just the floor
    return finish(px);
  },
};
