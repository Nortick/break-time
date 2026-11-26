// Bricks (2026-11-23, minutes only): he opens the box and walks to the digit: it is built of toy bricks. He pulls them
// off from the top down and tosses each one over his shoulder into the box. Back at the box he throws new bricks, in
// toy colors, onto the digit's place, from the bottom up, each snapping onto the last. Then the colors fade into the
// clock's own and he shuts the box.
import { sprite, PALETTE, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, FRONT, BOX_X, BOX_RIM, BOX_STAND, HOME_X } from "../art";
import { walkTo, pose14, art14, canvasX, canvasY, drawLayer, wait, WORK_R, type Frames, type Scene } from "./kit";

/** The old digit's bricks in two shades; the new ones in toy colors (baked only). */
PALETTE["D"] = "#A8A8A8";
PALETTE["L"] = "#E04A3A";
PALETTE["Y"] = "#F2C32E";
PALETTE["A"] = "#3A8EE0";
PALETTE["E"] = "#4CBF58";
const TOY = ["L", "Y", "A", "E"];

/** A brick: a 2x2 block of the digit's grid (the last column is 1 wide): its left, top, and which pixels are digit. */
interface Brick {
  x: number;
  y: number;
}
/** The bricks of a digit, from the top row down, left to right in a row. */
function bricksOf(d: Sprite): Brick[] {
  const out: Brick[] = [];
  for (let y = 0; y < 12; y += 2)
    for (let x = 0; x < 7; x += 2) {
      let any = false;
      for (let j = y; j < y + 2; j++) for (let i = x; i < Math.min(7, x + 2); i++) if (d.rows[j].charAt(i) !== ".") any = true;
      if (any) out.push({ x, y });
    }
  return out;
}
/** The digit with only the bricks in `which`, brick k in color col(k) ("#": the digit's own). */
function built(d: Sprite, bricks: Brick[], which: Set<number>, col: (k: number) => string): Sprite {
  const g = d.rows.map(() => ".......".split(""));
  bricks.forEach((b, k) => {
    if (!which.has(k)) return;
    for (let j = b.y; j < b.y + 2; j++) for (let i = b.x; i < Math.min(7, b.x + 2); i++) if (d.rows[j].charAt(i) !== ".") g[j][i] = col(k);
  });
  return sprite(g.map((r) => r.join("")));
}
/** One brick's own pixels as a little picture. */
function brickPic(d: Sprite, b: Brick, c: string): Sprite {
  const rows: string[] = [];
  for (let j = b.y; j < b.y + 2; j++) {
    let r = "";
    for (let i = b.x; i < Math.min(7, b.x + 2); i++) r += d.rows[j].charAt(i) === "." ? "." : c;
    rows.push(r);
  }
  return sprite(rows);
}

/** Pulling a brick off the digit (reaching at a height), and the toss over his shoulder, arm up behind him. */
const PULL = [10, 8, 6, 4].map((r) => pose14(art14([[8, 8, "b"], [7, Math.max(r, 6) + (r > 8 ? 1 : 0), "b"], [6, r, "o"]])));
const TOSS = pose14(art14([[12, 5, "o"], [11, 6, "b"]]));
/** At the box, throwing to the left: arm back, arm forward. */
const THROW_BACK = pose14(art14([[12, 6, "o"], [11, 7, "b"]]));
const THROW = pose14(art14([[8, 8, "b"], [7, 7, "b"], [6, 6, "o"]]));

/** A brick in the air: from (x0, y0) to (x1, y1) in n steps on an arc `h` high. Where it is at step s. */
function arc(x0: number, y0: number, x1: number, y1: number, n: number, h: number, s: number): [number, number] {
  const t = s / n;
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 4 * h * t * (1 - t)];
}

interface Flying {
  pic: Sprite;
  from: [number, number];
  to: [number, number];
  n: number;
  h: number;
  s: number;
  /** When it lands: the brick's index, and whether it lands on the digit (else into the box). */
  k: number;
  onDigit: boolean;
}

export const bricks: Scene = {
  id: "bricks",
  name: "Toy bricks",
  tier: "minute",
  minuteOnly: true,
  play: function* (w, changes) {
    const c = changes[changes.length - 1];
    const slot = w.slots[c.i];
    slot.value = c.to;
    const old = DIGITS[c.from], neu = DIGITS[c.to];
    const oldB = bricksOf(old), newB = bricksOf(neu);
    slot.s = old; // the old digit stays on till the bricks come off (the slot already holds the new value)
    const dx0 = DIGIT_X[c.i];
    const shade = (k: number) => ((oldB[k].x / 2 + oldB[k].y / 2) % 2 ? "D" : "#");
    const color = (k: number) => TOY[(newB[k].x / 2 + newB[k].y / 2 + k) % TOY.length];
    const left = new Set(oldB.map((_, k) => k));
    const placed = new Set<number>();
    let flying: Flying[] = [];

    function* frame(): Frames {
      const list = flying.map((f) => ({ ...f }));
      drawLayer(w, (put) => {
        for (const f of list) {
          const [x, y] = arc(f.from[0], f.from[1], f.to[0], f.to[1], f.n, f.h, f.s);
          const [nx, ny] = arc(f.from[0], f.from[1], f.to[0], f.to[1], f.n, f.h, Math.min(f.n, f.s + 1));
          f.pic.rows.forEach((r, j) => {
            for (let i = 0; i < r.length; i++)
              if (r.charAt(i) !== ".") put(x + i, y + j, r.charAt(i), { x: 0, y: 0, vx: nx - x, vy: ny - y });
          });
        }
      });
      yield;
      for (const f of flying) f.s++;
      const landed = flying.filter((f) => f.s >= f.n);
      flying = flying.filter((f) => f.s < f.n);
      for (const f of landed)
        if (f.onDigit) {
          placed.add(f.k);
          slot.s = built(neu, newB, placed, color);
          w.sfx = "click";
        }
    }

    // He opens the box, leaves it open, and walks to the digit.
    yield* walkTo(w, BOX_STAND);
    w.man.dir = 1;
    w.man.frame = WORK_R;
    yield* wait(2);
    w.box = 1; yield;
    w.box = 2; yield* wait(2);
    w.man.frame = FRONT;
    yield* walkTo(w, dx0 + 8);
    w.man.dir = -1;
    // The digit is bricks: the seams show.
    slot.s = built(old, oldB, left, shade);
    yield* wait(4);
    // Off they come, top down, over his shoulder into the box.
    const BOX_IN: [number, number] = [BOX_X + 2, BOX_RIM];
    for (let k = 0; k < oldB.length; k++) {
      const b = oldB[k];
      w.man.frame = PULL[Math.min(3, Math.floor(b.y / 3))];
      w.sfx = "click";
      yield* frame();
      left.delete(k);
      slot.s = built(old, oldB, left, shade);
      w.man.frame = TOSS;
      flying.push({ pic: brickPic(old, b, shade(k)), from: [dx0 + b.x, DIGIT_Y + b.y], to: BOX_IN, n: 7, h: 6, s: 0, k, onDigit: false });
      yield* frame();
    }
    slot.hidden = true;
    w.man.frame = FRONT;
    while (flying.length) yield* frame();
    // Back to the box; from there the new bricks, bottom up, thrown onto the digit's place.
    w.man.dir = 0;
    yield* walkTo(w, BOX_STAND);
    w.man.dir = -1;
    slot.hidden = false;
    slot.s = built(neu, newB, placed, color);
    const order = newB.map((_, k) => k).reverse();
    for (const k of order) {
      const b = newB[k];
      w.man.frame = THROW_BACK;
      yield* frame();
      w.man.frame = THROW;
      flying.push({ pic: brickPic(neu, b, color(k)), from: [canvasX(w.man.x, 5), canvasY(6)], to: [dx0 + b.x, DIGIT_Y + b.y], n: 6, h: 4, s: 0, k, onDigit: true });
      yield* frame();
    }
    w.man.frame = FRONT;
    w.man.dir = 0;
    while (flying.length) yield* frame();
    w.fx = null;
    yield* wait(3);
    // The toy colors fade into the clock's own, top to bottom.
    w.sfx = "tada";
    for (let y = 0; y <= 12; y += 2) {
      slot.s = sprite(built(neu, newB, placed, color).rows.map((r, j) => (j < y ? r.replace(/[LYAE]/g, "#") : r)));
      yield;
    }
    slot.s = null;
    yield* wait(2);
    // Shut the box, go home.
    w.man.dir = 1;
    w.man.frame = WORK_R;
    w.box = 1; yield;
    w.box = 0; yield* wait(2);
    w.man.frame = FRONT;
    w.man.dir = 0;
    yield* walkTo(w, HOME_X);
  },
};
