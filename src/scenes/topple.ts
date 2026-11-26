// Topple: the digit starts to wobble on its own and falls over backwards, flat on the floor. He walks over, grabs
// its edge and heaves it back up, and what comes up is the new digit. With two digits the fall of the first shakes
// the second loose too; he lifts the tens first, then the minutes.
import { sprite, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, FRONT, HOME_X, LOOK_UP } from "../art";
import { walkTo, wait, stepDots, drawDots, rnd, type Dot, type Frames, type Scene } from "./kit";

/**
 * The digit tipped back, `h` rows tall instead of 12, standing on its bottom edge (as seen from the front). Low down
 * each row is all the digit's rows it covers put together, so lying flat it reads as a solid slab, not dots.
 */
function tipped(s: Sprite, h: number): Sprite {
  const rows: string[] = [];
  for (let j = 0; j < 12; j++) {
    const k = j - (12 - h);
    if (k < 0) { rows.push("......."); continue; }
    if (h >= 8) { rows.push(s.rows[Math.floor(((k + 0.5) * s.h) / h)]); continue; }
    const a = Math.floor((k * s.h) / h), b = Math.floor(((k + 1) * s.h) / h);
    let r = "";
    for (let i = 0; i < 7; i++) {
      let on = false;
      for (let m = a; m < b; m++) if (s.rows[m].charAt(i) === "#") on = true;
      r += on ? "#" : ".";
    }
    rows.push(r);
  }
  return sprite(rows);
}

/** How tall the digit looks as it falls back: slow to start, fast at the end. */
const FALL = [12, 12, 11, 11, 10, 8, 5, 2];
/** The wobble before it goes: how far it sways, frame by frame. */
const WOBBLE = [0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 0, 1, 1, 1];

// He lifts with his hands at the digit's top edge, facing left, at the digit's right side (x = digit + 7: his hand
// in column 0 touches its right column). Short arms always: the hand is the "o" in column 0.
/** Crouching, hands down at the fallen digit's edge (display row 12). */
const CROUCH = sprite([".......", ".......", ".......", "..hhh..", "hhhhh..", ".oooo..", ".o.oo..", ".oooo..", ".bbbb..", "obbbb..", "pp.pp..", "ss.ss.."]);
/** Half up, hands at row 9, straining (two frames: a tremble). */
const HEAVE = [
  sprite([".......", "..hhh..", "hhhhh..", ".oooo..", ".o.oo..", ".oooo..", "obbb...", ".bbbb..", "..bbb..", ".ppp...", ".p..p..", "ss..ss."]),
  sprite([".......", "..hhh..", "hhhhh..", ".oooo..", ".o.oo..", ".oooo..", "obbb...", ".bbbb..", "..bbb..", ".ppp...", "pp..p..", "s...ss."]),
];
/** The last push, standing, hands out at head height (row 7). */
const PUSH = sprite(["..hhh..", "hhhhh..", ".oooo..", ".o.oo..", "obooo..", ".bbbb..", "..bbb..", "..bbb..", "..ppp..", ".pp.p..", ".p...p.", "ss...ss"]);

export const topple: Scene = {
  id: "topple",
  name: "Timber!",
  tier: "minute",
  play: function* (w, changes) {
    const fallOrder = changes.slice().sort((a, b) => b.i - a.i); // minutes first
    const liftOrder = changes.slice().sort((a, b) => a.i - b.i); // tens first
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    const dots: Dot[] = [];
    function* frame(): Frames {
      stepDots(dots);
      drawDots(w, dots);
      yield;
    }
    function* frames(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }

    // He notices it swaying, and it goes over.
    for (const c of fallOrder) {
      const slot = w.slots[c.i];
      for (const dx of WOBBLE) {
        slot.dx = dx;
        if (dx && w.man.frame === FRONT) w.man.frame = LOOK_UP;
        yield* frame();
      }
      slot.dx = 0;
      for (const h of FALL) {
        slot.s = tipped(DIGITS[c.from], h);
        yield* frame();
      }
      // Thud: dust puffs out from both ends, the clock shakes.
      w.sfx = "thud";
      const x0 = DIGIT_X[c.i];
      for (let k = 0; k < 6; k++) {
        dots.push({ x: x0 - 1, y: 13 - rnd(2), vx: -0.5 - Math.random() * 0.7, vy: -0.3 - Math.random() * 0.4, life: 5 + rnd(5), c: "d" });
        dots.push({ x: x0 + 7, y: 13 - rnd(2), vx: 0.5 + Math.random() * 0.7, vy: -0.3 - Math.random() * 0.4, life: 5 + rnd(5), c: "d" });
      }
      w.shake.y = 1;
      yield* frame();
      w.shake.y = 0;
      yield* frames(4);
    }
    w.man.frame = FRONT;
    yield* frames(6);

    // He lifts them back up, and they come up new.
    for (const c of liftOrder) {
      const slot = w.slots[c.i];
      yield* walkTo(w, DIGIT_X[c.i] + 7);
      w.man.dir = -1;
      w.man.frame = CROUCH;
      yield* wait(4);
      slot.s = tipped(DIGITS[c.to], 2); // from the floor it looks the same; what comes up is the new one
      for (let k = 0; k < 6; k++) {
        w.man.frame = HEAVE[k % 2];
        slot.s = tipped(DIGITS[c.to], k < 2 ? 3 : 5);
        yield;
      }
      w.man.frame = PUSH;
      slot.s = tipped(DIGITS[c.to], 7);
      yield* wait(2);
      // It swings up the rest of the way by itself and rocks to a stop.
      w.sfx = "pop";
      for (const h of [9, 11, 12]) {
        slot.s = tipped(DIGITS[c.to], h);
        yield;
      }
      slot.s = null;
      for (const dx of [-1, -1, 0, 1, 0]) {
        slot.dx = dx;
        yield;
      }
      slot.dx = 0;
      w.man.frame = FRONT;
      yield* wait(3);
    }
    yield* walkTo(w, HOME_X);
  },
};
