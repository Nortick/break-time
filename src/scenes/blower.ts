// Leaf blower: takes the blower from the box, starts it, and sweeps the nozzle over the digit, top, middle, bottom:
// the old digit is blown away as dust. Then he blows the new digit up like a balloon, from tiny to full size.
import { fromGrid, blank, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, BLOWER } from "../art";
import { phased, pose14, art14, canvasX, canvasY, stepDots, drawDots, rnd, wait, type Change, type Dot, type Frames, type Scene } from "./kit";
import { type World } from "../world";

/** He stands 13 right of the digit: canvas column 0 is the digit's right edge, the nozzle just past it. */
const STAND = 13;

/**
 * Three hand-drawn poses, blower at the hip: nozzle up, level, down. The tube is always 3 pixels and the nozzle ("m")
 * one more; only the angle changes. `nozzle` is the nozzle pixel on the canvas, `motor` the motor's top row, `rows` the band of the digit it blows
 * at, `vy` which way the air goes up or down.
 */
const AIMS = [
  {
    frame: pose14(art14([[8, 8, "b"], [7, 7, "o"], [5, 6, "e"], [6, 6, "e"], [5, 7, "e"], [6, 7, "e"], [4, 6, "r"], [3, 5, "r"], [2, 4, "r"], [1, 3, "m"]])),
    nozzle: [1, 3], motor: 6, rows: [0, 4], vy: -0.4,
  },
  {
    frame: pose14(art14([[8, 8, "b"], [7, 8, "o"], [5, 8, "e"], [6, 8, "e"], [5, 9, "e"], [6, 9, "e"], [4, 8, "r"], [3, 8, "r"], [2, 8, "r"], [1, 8, "m"]])),
    nozzle: [1, 8], motor: 8, rows: [4, 8], vy: 0,
  },
  {
    frame: pose14(art14([[8, 8, "b"], [7, 9, "o"], [5, 9, "e"], [6, 9, "e"], [5, 10, "e"], [6, 10, "e"], [4, 10, "r"], [3, 11, "r"], [2, 11, "r"], [1, 12, "m"]])),
    nozzle: [1, 12], motor: 9, rows: [8, 12], vy: 0.2,
  },
];
const UP = 0, LEVEL = 1, DOWN = 2;
/** The order he sweeps in, round and round until the digit is gone. */
const SWEEP = [LEVEL, UP, LEVEL, DOWN];

/** The digit drawn smaller or bigger, sw x sh, by nearest pixel. */
function scaled(s: Sprite, sw: number, sh: number): Sprite {
  const g = blank(sw, sh);
  for (let j = 0; j < sh; j++)
    for (let i = 0; i < sw; i++) g[j][i] = s.rows[Math.floor(((j + 0.5) * s.h) / sh)].charAt(Math.floor(((i + 0.5) * s.w) / sw)) || ".";
  return fromGrid(g);
}

/** The blower in his hands at one digit: the dust and air, and helpers to run the engine. */
function rig(w: World, c: Change) {
    const slot = w.slots[c.i];
    const x0 = DIGIT_X[c.i];
    const dots: Dot[] = [];
    const x1 = Math.min(72, x0 + 15);
    /** Whether the digit in this slot has a pixel at (x, y) on the display: the air stops there, it doesn't show over it. */
    const solid = (x: number, y: number) => {
      const pic = slot.hidden ? null : slot.s;
      if (!pic) return false;
      const i = Math.round(x) - x0 - slot.dx, j = Math.round(y) - 2 - slot.dy;
      return j >= 0 && j < pic.h && i >= 0 && i < pic.w && (pic.rows[j].charAt(i) || ".") !== ".";
    };
    const show = () => {
      for (let k = dots.length - 1; k >= 0; k--) if (dots[k].c === "a" && solid(dots[k].x, dots[k].y)) dots.splice(k, 1);
      drawDots(w, dots, Math.max(0, x0 - 30), x1);
    };
    /** A puff of smoke from the motor, for the engine starting and stopping. */
    const puff = (aim: number) => {
      const a = AIMS[aim];
      const mx = canvasX(w.man.x, 5 + rnd(2)), my = canvasY(a.motor - 1);
      dots.push({ x: mx, y: my, vx: 0.3, vy: -0.5, life: 4 + rnd(3), c: "d" });
    };
    /** One frame of the engine running: new gusts from the nozzle. */
    const gust = (aim: number) => {
      const a = AIMS[aim];
      const nx = canvasX(w.man.x, a.nozzle[0]) - 1, ny = canvasY(a.nozzle[1]);
      for (let k = 0; k < 2; k++)
        dots.push({ x: nx - rnd(2), y: ny + rnd(3) - 1, vx: -2, vy: a.vy * 2, life: 3 + rnd(3), c: "a" });
    };

    return { slot, x0, dots, show, puff, gust };
}

/** Whether the engine is running: it keeps running from the first digit he blows off to the last one he blows up. */
let running = false;

/** The engine starts with a couple of puffs (unless it is running already). */
function* start(w: World, r: ReturnType<typeof rig>): Frames {
  if (running) {
    w.man.frame = AIMS[LEVEL].frame;
    yield;
    return;
  }
  running = true;
  w.sfx = "whoosh";
  const { dots, show, puff } = r;
  w.man.frame = AIMS[LEVEL].frame;
  yield* wait(3);
  for (let t = 0; t < 4; t++) {
    if (t < 2) puff(LEVEL);
    stepDots(dots);
    show();
    yield;
  }

}

/** Blows the old digit away as dust, sweeping the nozzle over it. */
function* blowOff(w: World, c: Change): Frames {
  const r = rig(w, c);
  const { slot, x0, dots, show, gust } = r;
  yield* start(w, r);
  // The old digit as pixels that can be blown off, nearest the nozzle first.
  const left = DIGITS[c.from].rows.map((r) => r.split(""));
  const remaining = () => left.reduce((n, r) => n + r.filter((ch) => ch !== ".").length, 0);
  const detach = (rows: number[], n: number) => {
    for (let k = 0; k < n; k++) {
      let best: [number, number] | null = null;
      for (let j = rows[0]; j < rows[1]; j++)
        for (let i = 6; i >= 0; i--)
          if (left[j][i] !== "." && (!best || i + rnd(2) > best[0])) { best = [i, j]; break; }
      if (!best) return;
      left[best[1]][best[0]] = ".";
      dots.push({ x: x0 + best[0], y: 2 + best[1], vx: -(1 + rnd(2)), vy: (rnd(3) - 1) * 0.3, life: 6 + rnd(8), c: "#" });
    }
  };

  for (let round = 0; round < 6 && remaining() > 0; round++)
    for (const aim of SWEEP) {
      const a = AIMS[aim];
      let inBand = false;
      for (let j = a.rows[0]; j < a.rows[1]; j++) if (left[j].some((ch) => ch !== ".")) inBand = true;
      if (!inBand) continue;
      w.man.frame = a.frame;
      w.sfx = "whoosh";
      for (let t = 0; t < 5; t++) {
        for (const d of dots) if (d.c === "#") d.c = "d"; // freshly blown off: white for a frame, then dust
        detach(a.rows, 3);
        gust(aim);
        stepDots(dots);
        slot.s = fromGrid(left);
        show();
        yield;
      }
    }

  slot.hidden = true;
  while (dots.length) {
    for (const d of dots) if (d.c === "#") d.c = "d";
    stepDots(dots);
    show();
    yield;
  }
  w.fx = null;
  yield* wait(2);
}

/** Blows the new digit up like a balloon, from a tiny one on the floor to full size. */
function* inflate(w: World, c: Change): Frames {
  const r = rig(w, c);
  const { slot, dots, show, puff, gust } = r;
  yield* start(w, r);
  // The new digit inflates from a tiny one on the floor up to full size, like a balloon, overshoots a little and
  // settles. Then the engine stops with a puff and the dust settles away.
  const to = DIGITS[c.to];
  const grow = (sw: number, sh: number) => {
    slot.s = scaled(to, sw, sh);
    slot.dx = Math.floor((7 - sw) / 2);
    slot.dy = 12 - sh;
  };
  slot.hidden = true;
  for (let t = 0; t < 2; t++) { gust(DOWN); stepDots(dots); show(); yield; }
  slot.hidden = false;
  for (let sh = 1; sh <= 12; sh++) {
    const aim = sh < 5 ? DOWN : LEVEL;
    w.man.frame = AIMS[aim].frame;
    grow(Math.max(1, Math.round((7 * sh) / 12)), sh);
    if (sh % 4 === 1) w.sfx = "whoosh";
    for (let t = 0; t < 2; t++) {
      for (const d of dots) if (d.c === "#") d.c = "d";
      gust(aim);
      stepDots(dots);
      show();
      yield;
    }
  }
  // A last puff of air: it swells past full size, and springs back.
  for (const [sw, sh] of [[8, 13], [7, 12], [7, 11], [7, 12]]) {
    grow(sw, sh);
    gust(LEVEL);
    stepDots(dots);
    show();
    yield;
  }
  w.sfx = "pop";
  slot.s = null;
  slot.dx = slot.dy = 0;
  if (c.i === 3) {
    // The last one: the engine stops.
    puff(LEVEL);
    running = false;
  }
  while (dots.length) {
    for (const d of dots) if (d.c === "#") d.c = "d";
    stepDots(dots);
    show();
    yield;
  }
  w.fx = null;
  yield* wait(3);
}

/**
 * Leaf blower from the box: blows the old digits away, right to left (minutes, then tens); then blows the new ones up
 * like balloons, left to right (tens, then minutes).
 */
export const blower: Scene = {
  id: "blower",
  name: "Leaf blower",
  tier: "minute",
  play: phased([{ each: blowOff }, { each: inflate, leftFirst: true }], BLOWER, STAND),
};
