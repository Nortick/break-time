// Flip the sign: a wrench from the box cranks a bolt on the digit's side and the digit turns over; more digits turn
// one after another off the same bolt.
import { sprite, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, WRENCH, FRONT } from "../art";
import { fetchTool, putBack, walkTo, pose14, art14, wait, type Scene } from "./kit";

/** A digit squeezed to `height` rows, centred in its 12: the edge-on moment of a flip over the horizontal axis. */
function squeezeV(s: Sprite, height: number): Sprite {
  const off = (s.h - height) >> 1;
  const rows: string[] = [];
  for (let j = 0; j < s.h; j++) {
    const k = j - off;
    rows.push(k >= 0 && k < height ? s.rows[Math.floor(((k + 0.5) * s.h) / height)] : ".".repeat(s.w));
  }
  return sprite(rows);
}
/**
 * The worker with a wrench on the bolt at the digit's right edge, facing left: handle up, level, down, as he cranks.
 * Same 14x14 layout as the mop poses; the bolt "m" is in column 3, so he stands 11 to the right of the digit.
 */
const JAW: [number, number, string][] = [[3, 7, "m"], [3, 6, "r"], [3, 8, "r"]];
const WRENCH_POSES = [
  art14([...JAW, [4, 6, "r"], [5, 6, "r"], [6, 5, "r"], [7, 5, "o"], [8, 7, "b"]]),
  art14([...JAW, [4, 7, "r"], [5, 7, "r"], [6, 7, "r"], [7, 7, "o"], [8, 8, "b"]]),
  art14([...JAW, [4, 8, "r"], [5, 8, "r"], [6, 9, "r"], [7, 9, "o"], [8, 8, "b"]]),
].map((art) => pose14(art));

/** The flip, step by step (two frames each): the old digit closing edge-on, then the new one opening. */
const FLIP: [boolean, number][] = [[false, 9], [false, 6], [false, 3], [false, 1], [true, 1], [true, 3], [true, 6], [true, 9], [true, 12]];
/**
 * How many steps after one digit the next one starts turning: the first turns all the way over, he cranks on for two
 * more turns of the handle, then the next one goes.
 */
const STAGGER = FLIP.length + 2;

/**
 * Takes a wrench from the box and cranks the bolt on the side of the rightmost digit that changes. The digit turns
 * over like a sign; when more digits change, he keeps cranking in the same place and, once it is done, the next
 * one turns, right to left, as if on one shaft.
 */
export const flip: Scene = {
  id: "flip",
  name: "Flip the sign",
  tier: "minute",
  play: function* (w, changes) {
    const order = changes.slice().sort((a, b) => b.i - a.i);
    yield* fetchTool(w, WRENCH);
    yield* walkTo(w, DIGIT_X[order[0].i] + 11);
    w.carry = null;
    w.man.dir = -1;
    // Like perDigit: each slot holds its new value already, the old digit stays on as the picture.
    for (const c of order) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    // Up, level, down, level: one turn of the crank.
    const CRANK = [0, 1, 2, 1];
    let k = 0;
    const crank = () => {
      if (k % 4 === 0) w.sfx = "ratchet";
      w.man.frame = WRENCH_POSES[CRANK[k++ % 4]];
    };
    w.man.frame = WRENCH_POSES[1];
    yield* wait(3);
    for (let n = 0; n < 4; n++) { crank(); yield; yield; }
    const steps = (order.length - 1) * STAGGER + FLIP.length;
    for (let t = 0; t < steps; t++) {
      order.forEach((c, n) => {
        const f = FLIP[t - n * STAGGER];
        if (f) w.slots[c.i].s = squeezeV(f[0] ? DIGITS[c.to] : DIGITS[c.from], f[1]);
      });
      crank();
      yield;
      yield;
    }
    w.sfx = "pop";
    for (const c of order) w.slots[c.i].s = null;
    w.man.frame = WRENCH_POSES[1];
    yield* wait(3);
    w.man.frame = FRONT;
    yield* wait(2);
    yield* putBack(w, WRENCH);
  },
};
