// Garden: he takes a shovel out of the box and digs the old digit into the ground, stroke by stroke, until only a
// mound of soil is left where it stood. Then he swaps the shovel for a watering can and waters the mound: a sprout
// comes up, then the new digit grows out of the ground, green, and turns white when it is fully grown.
// Two digits: he buries the minutes, then the tens; waters the tens, then the minutes.
import { blank, fromGrid, sprite, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, FRONT, HANDS_UP } from "../art";
import { fetchTool, putBack, walkTo, pose14, art14, canvasX, canvasY, rnd, wait, type Frames, type Scene, layer } from "./kit";

/** The shovel, carried blade down; the watering can, carried by its handle. */
const SHOVEL = sprite([".g", ".g", ".g", ".g", "mm", "mm"]);
const CAN = sprite(["m..", ".rr", ".rr"]);
/** He stands 10 right of the digit: canvas column 3 is the digit's right column. */
const STAND = 10;
/** Digging, facing left: the blade pushed in at the digit's foot, then levered up with a clod of earth. */
const DIG_IN = pose14(art14([[8, 8, "b"], [7, 8, "o"], [6, 9, "g"], [5, 10, "g"], [4, 11, "g"], [3, 12, "m"], [2, 12, "m"], [3, 13, "m"], [2, 13, "m"]]));
const DIG_UP = pose14(art14([[8, 8, "b"], [7, 7, "o"], [6, 8, "g"], [5, 8, "g"], [4, 9, "g"], [3, 10, "m"], [2, 10, "m"], [3, 9, "s"], [2, 9, "s"]]));
/** Watering, facing left: the can tipped, water from the spout at canvas (2, 7). */
const WATER = pose14(art14([[8, 8, "b"], [7, 8, "o"], [6, 8, "r"], [5, 8, "r"], [6, 9, "r"], [5, 9, "r"], [4, 8, "m"], [3, 7, "m"]]));

/** The digit sunk `n` rows into the ground: its top part, pushed down, the rest under the floor. */
function sunk(s: Sprite, n: number): Sprite {
  const rows: string[] = [];
  for (let j = 0; j < 12; j++) rows.push(j >= n ? s.rows[j - n] : ".......");
  return sprite(rows);
}
/**
 * The digit growing up out of the ground, `n` rows of it above the floor (its top first, the rest still under it):
 * green while it grows, white from the top down to row `white` once it is ripe.
 */
function grown(s: Sprite, n: number, white: number): Sprite {
  return sprite(sunk(s, 12 - n).rows.map((r, j) => r.replace(/#/g, j < white ? "#" : "G")));
}

export const garden: Scene = {
  id: "garden",
  name: "Garden",
  tier: "ten",
  play: function* (w, changes) {
    const right = changes.slice().sort((a, b) => b.i - a.i), left = right.slice().reverse();
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    /** The mounds of soil, by slot: how big (0..3); sprouts, by slot: how tall (0..4). */
    const mound: Record<number, number> = {}, sprout: Record<number, number> = {};
    const bits: { x: number; y: number; vx: number; vy: number; c: string }[] = [];
    function* frame(): Frames {
      for (let k = bits.length - 1; k >= 0; k--) {
        const b = bits[k];
        b.vy += 0.4; b.x += b.vx; b.y += b.vy;
        if (b.y >= 14) bits.splice(k, 1);
      }
      w.fx = layer((t) => {
        const g = blank(72, 16);
        const set = (x: number, y: number, c: string) => { const X = Math.round(x), Y = Math.round(y); if (X >= 0 && X < 72 && Y >= 0 && Y < 15) g[Y][X] = c; };
        for (const key of Object.keys(mound)) {
          const i = +key, x0 = DIGIT_X[i], m = mound[i];
          if (m >= 1) for (let x = 1; x < 6; x++) set(x0 + x, 14, "s");
          if (m >= 2) { set(x0, 14, "s"); set(x0 + 6, 14, "s"); for (let x = 2; x < 5; x++) set(x0 + x, 13, "s"); }
          if (m >= 3) { set(x0 + 1, 13, "s"); set(x0 + 5, 13, "s"); }
          const sp = sprout[i] ?? 0;
          for (let k = 1; k <= Math.min(sp, 3); k++) set(x0 + 3, 13 - k, "G");
          if (sp >= 4) { set(x0 + 2, 11, "G"); set(x0 + 4, 10, "G"); }
        }
        // Clods and drops fly on between steps (60 fps).
        for (const b of bits) {
          const y = b.y + (b.vy + 0.4) * t;
          if (y < 14) set(b.x + b.vx * t, y, b.c);
        }
        return { s: fromGrid(g), x: 0, y: 0 };
      });
      yield;
    }
    function* run(gen: Frames): Frames {
      while (!gen.next().done) yield* frame();
    }
    function* hold(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }

    // Dig the old digits in, right to left.
    yield* run(fetchTool(w, SHOVEL));
    for (const c of right) {
      const slot = w.slots[c.i], x0 = DIGIT_X[c.i];
      w.carry = SHOVEL;
      yield* run(walkTo(w, x0 + STAND));
      w.carry = null;
      w.man.dir = -1;
      mound[c.i] = 0;
      for (let n = 0; n < 12; n += 2) {
        w.man.frame = DIG_IN;
        yield* hold(2);
        slot.s = sunk(DIGITS[c.from], n + 2);
        w.man.frame = DIG_UP;
        // A shovelful of earth over the digit's head onto the mound.
        w.sfx = "sweep";
        for (let k = 0; k < 3; k++)
          bits.push({ x: canvasX(w.man.x, 2) - rnd(2), y: canvasY(9), vx: -0.6 - Math.random() * 0.8, vy: -1.5 - Math.random(), c: "s" });
        mound[c.i] = Math.min(3, Math.floor((n + 2) / 4));
        yield* hold(3);
      }
      slot.hidden = true;
      mound[c.i] = 3;
      yield* hold(4);
    }
    // Shovel back, the watering can out.
    w.man.frame = FRONT;
    yield* run(putBack(w, SHOVEL));
    yield* run(fetchTool(w, CAN));
    for (const c of left) {
      const slot = w.slots[c.i], x0 = DIGIT_X[c.i];
      w.carry = CAN;
      yield* run(walkTo(w, x0 + STAND));
      w.carry = null;
      w.man.dir = -1;
      w.man.frame = WATER;
      // Water, moving along the mound; a sprout comes up.
      w.sfx = "splash";
      sprout[c.i] = 0;
      for (let t = 0; t < 16; t++) {
        if (t === 6) w.man.x += 3;
        if (t === 11) w.man.x -= 3;
        if (t % 2 === 0) bits.push({ x: canvasX(w.man.x, 2), y: canvasY(7), vx: -0.2, vy: 0.3, c: "a" });
        if (t % 4 === 3) sprout[c.i] = Math.min(4, sprout[c.i] + 1);
        yield* frame();
      }
      w.man.x = x0 + STAND;
      // It grows: up out of the ground, green, and the mound sinks back.
      w.sfx = "pop";
      slot.hidden = false;
      delete sprout[c.i];
      for (let n = 1; n <= 12; n++) {
        slot.s = grown(DIGITS[c.to], n, 0);
        if (n === 4) mound[c.i] = 2;
        if (n === 8) mound[c.i] = 1;
        yield* hold(n % 2 ? 1 : 2);
      }
      delete mound[c.i];
      // Ripe: white from the top down.
      w.sfx = "magic";
      for (let white = 2; white <= 12; white += 2) {
        slot.s = grown(DIGITS[c.to], 12, white);
        yield* frame();
      }
      slot.s = null;
      yield* hold(3);
    }
    w.man.frame = FRONT;
    yield* run(putBack(w, CAN));
    while (bits.length) yield* frame();
    w.fx = null;
    w.man.frame = HANDS_UP;
    w.man.dy = -1; yield* wait(2);
    w.man.dy = 0; yield* wait(5);
    w.man.frame = FRONT;
  },
};
