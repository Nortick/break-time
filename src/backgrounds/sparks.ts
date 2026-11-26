// BACKGROUND "Forge sparks", in the style of the bar's ending_particles: an almost black workshop, a warm glow along
// the floor as from a forge's embers, breathing slowly, and small sparks drifting up from it, swaying, cooling from
// yellow to dim red and going out.
import { type Background } from "./dust";
import { W, H, canvas, add, addSoft, finish, rng, mix, drift, floor } from "./plate";

const SECONDS = 10;
const FPS = 30;
const EMBER = [120, 40, 8];
const HOT = [255, 200, 90], COOL = [170, 40, 10];
/** How strong the whole thing is (1 = as drawn). */
const LEVEL = 1;

/** The sparks: where each starts, how high it gets, how long it lives (part of a lap), how many laps a loop. */
const SPARKS = (() => {
  const r = rng(0xf0e9);
  const out: { x: number; rise: number; life: number; laps: number; phase: number; sway: number; drift: number }[] = [];
  for (let i = 0; i < 16; i++)
    out.push({
      x: 2 + r() * 68,
      rise: 5 + r() * 9,
      life: 0.25 + r() * 0.3,
      laps: 1 + Math.floor(r() * 3),
      phase: r(),
      sway: r() * 6.283,
      drift: (r() - 0.5) * 4,
    });
  return out;
})();

export const sparks: Background = {
  id: "sparks",
  floor: true,
  fps: FPS,
  seconds: SECONDS,
  frame(t) {
    const px = canvas();
    const loop = t / SECONDS;
    // The embers' glow along the floor: brighter in a few spots that breathe at their own pace.
    for (let x = 0; x < W; x++) {
      const spot =
        0.55 +
        0.25 * Math.sin((x / W) * Math.PI * 2 * 2 + loop * Math.PI * 2) +
        0.2 * Math.sin((x / W) * Math.PI * 2 * 5 - loop * Math.PI * 2 * 2 + 1.3);
      for (let y = 9; y < H; y++) {
        const k = Math.pow((y - 8) / (H - 8), 2.2) * Math.max(0, spot);
        add(px, x, y, EMBER, k * 0.75 * LEVEL);
      }
    }
    // The sparks: up fast, slowing as they go, a little sideways, cooling and fading.
    for (const s of SPARKS) {
      const u = (loop * s.laps + s.phase) % 1;
      if (u > s.life) continue;
      const v = u / s.life; // 0..1 of its life
      const up = s.rise * (1 - (1 - v) * (1 - v)); // eases out: slows near the top
      const x = s.x + s.drift * v + Math.sin(v * 5 + s.sway) * 0.7;
      const y = H - 1.2 - up;
      const fade = v < 0.1 ? v / 0.1 : 1 - (v - 0.1) / 0.9;
      const c = mix(HOT, COOL, v);
      addSoft(px, x, y, c, fade * 1.6 * LEVEL);
      // A short glowing trail below it, where it just was.
      addSoft(px, x - s.drift * 0.03, y + 1.1 * (1 - v) + 0.3, c, fade * 0.5 * LEVEL);
    }
    drift(px, t, SECONDS, [150, 110, 80], 0.3 * LEVEL, 0xd5a);
    floor(px, [130, 60, 24], 1);
    return finish(px);
  },
};
