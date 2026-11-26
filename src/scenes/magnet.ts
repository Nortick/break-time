// Magnet: he takes a big horseshoe magnet out of the box and holds it out towards the digits. They start to tremble,
// then one by one, nearest first, they come off the floor and fly at it, sticking together in a lump. He drops the lump
// in the box; a lump of new digits jumps out of it onto the magnet. He turns the magnet over (the poles swap, red and
// blue), and the new digits are pushed off the lump one by one, flying back to their places.
import { sprite, blank, fromGrid } from "../gfx";
import { BOX_RIM, BOX_STAND, DIGITS, DIGIT_X, FRONT, HANDS_UP, HOME_X } from "../art";
import { fetchTool, putBack, walkTo, pose14, art14, LEGS, rnd, wait, WORK_R, type Frames, type Scene } from "./kit";

/** The magnet as he carries it, opening up: red pole and blue pole, grey tips. */
const MAGNET = sprite(["m..m", "x..h", "x..h", "xxhh"]);
/** Held out in front of him, facing left, the opening towards the digits; the poles as given. */
function holding(top: string, bottom: string) {
  return pose14(art14([
    [2, 5, "m"], [3, 5, top], [4, 5, top], [5, 5, top], [6, 5, top],
    [6, 6, top], [6, 7, bottom],
    [2, 8, "m"], [3, 8, bottom], [4, 8, bottom], [5, 8, bottom], [6, 8, bottom],
    [7, 7, "o"], [8, 8, "b"],
  ]), LEGS[0]);
}
const HOLD = holding("x", "h");
const HOLD_FLIPPED = holding("h", "x");
/** Where the magnet's tips are on the display, with him at home: the lump sticks to the left of them. */
const TIPS_X = HOME_X - 7 + 2;

export const magnet: Scene = {
  id: "magnet",
  name: "Magnet",
  tier: "hour",
  play: function* (w, changes) {
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    const order = changes.slice().sort((a, b) => b.i - a.i); // nearest first
    /** How many digits are in the lump; where it is (null: on the magnet); the field lines. */
    let lump = 0;
    let lumpAt: { x: number; y: number } | null = null;
    let field = false;
    let tick = 0;
    const pic = (t: number) => {
      void t;
      const g = blank(72, 16);
      const set = (x: number, y: number, c: string) => { if (x >= 0 && x < 72 && y >= 0 && y < 16) g[y][x] = c; };
      if (field)
        for (let k = 0; k < 3; k++) {
          const x = TIPS_X - 2 - ((tick + k * 4) % 12);
          set(x, 6, "a"); set(x, 9, "a"); set(x - 1, 7, "a"); set(x - 1, 8, "a");
        }
      if (lump && !lumpAt) {
        // A jumble of digit bits stuck to the tips, wider for each digit in it.
        const w0 = 2 + lump * 2;
        for (let y = 5; y <= 10; y++)
          for (let x = TIPS_X - w0; x < TIPS_X; x++) if ((x * 7 + y * 13 + lump) % 4 !== 0) set(x, y, "#");
      }
      return { s: fromGrid(g), x: 0, y: 0 };
    };
    function* frame(): Frames {
      tick++;
      w.fx = { ...pic(0) };
      yield;
    }
    function* hold(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }

    yield* fetchTool(w, MAGNET);
    yield* walkTo(w, HOME_X);
    w.carry = null;
    w.man.dir = -1;
    w.man.frame = HOLD;
    field = true;
    w.sfx = "magic";
    // The digits tremble...
    for (let k = 0; k < 10; k++) {
      for (const c of changes) w.slots[c.i].dx = rnd(3) === 0 ? (rnd(2) ? 1 : -1) : 0;
      if (k % 3 === 0) w.sfx = "ratchet";
      yield* frame();
    }
    for (const c of changes) w.slots[c.i].dx = 0;
    // ...and fly at the magnet, one by one, faster and faster, and stick.
    for (const c of order) {
      const s = w.slots[c.i];
      let v = 1;
      w.sfx = "whoosh";
      for (;;) {
        const edge = TIPS_X - 2 - lump * 2; // the lump's left side: where this one stops
        if (DIGIT_X[c.i] + 7 + s.dx + v >= edge) break;
        s.dx += v;
        s.dy = Math.max(s.dy - 1, -1);
        v = Math.min(v + 1, 5);
        yield* frame();
      }
      s.hidden = true;
      s.dx = s.dy = 0;
      lump++;
      w.sfx = "hit";
      w.shake.x = -1;
      w.man.x += 1; // the hit pushes him back a step
      yield* frame();
      w.shake.x = 0;
      w.man.x -= 1;
      yield* hold(2);
    }
    field = false;
    yield* hold(4);

    // To the box with the lump; it drops in.
    w.man.x = BOX_STAND;
    w.man.dir = 1;
    w.man.frame = WORK_R;
    w.carry = MAGNET;
    lumpAt = { x: 0, y: 0 };
    w.box = 1; yield* hold(1);
    w.box = 2; yield* hold(2);
    const LUMP = sprite(["####.#", "#.####", "######", ".##.##"]);
    for (let y = BOX_RIM - 7; y <= BOX_RIM; y++) {
      w.item = { s: LUMP, x: BOX_STAND + 7, y };
      yield* frame();
    }
    w.item = null;
    w.sfx = "crumble";
    w.shake.y = 1; yield* frame(); w.shake.y = 0;
    yield* hold(4);

    // A lump of new digits rises out of the box and jumps onto the magnet.
    w.sfx = "magic";
    for (let y = BOX_RIM; y >= BOX_RIM - 6; y--) {
      w.item = { s: LUMP, x: BOX_STAND + 7, y };
      yield* frame();
    }
    w.item = null;
    lumpAt = null;
    lump = changes.length;
    w.man.x = HOME_X;
    w.man.dir = -1;
    w.carry = null;
    w.man.frame = HOLD;
    w.sfx = "hit";
    yield* frame();
    w.box = 1; yield* hold(1);
    w.box = 0; yield* hold(4);

    // He turns the magnet over: the poles swap, and the digits are pushed off the lump one by one, the outer one
    // first, each flying back to its place and slowing down as it gets there.
    w.sfx = "magic";
    for (let k = 0; k < 6; k++) { w.man.frame = k % 2 ? HOLD : HOLD_FLIPPED; yield* hold(1); }
    w.man.frame = HOLD_FLIPPED;
    field = true;
    yield* hold(4);
    for (const c of order.slice().reverse()) {
      const s = w.slots[c.i];
      // It comes off the lump's left side, at full size.
      const edge = TIPS_X - 2 - (lump - 1) * 2;
      lump--;
      s.s = DIGITS[c.to];
      s.hidden = false;
      s.dx = edge - 7 - DIGIT_X[c.i];
      s.dy = -1;
      w.sfx = "whoosh";
      w.man.x += 1; // the push back
      yield* frame();
      w.man.x -= 1;
      while (s.dx > 0) {
        s.dx -= Math.max(1, Math.min(5, Math.ceil(s.dx / 3)));
        if (s.dx < 0) s.dx = 0;
        yield* frame();
      }
      w.sfx = "thud";
      s.dy = 0;
      w.shake.y = 1; yield* frame(); w.shake.y = 0;
      s.s = null;
      yield* hold(2);
    }
    field = false;
    yield* hold(4);
    w.fx = null;
    lump = 0;
    // Back to how it was, and into the box.
    w.carry = MAGNET;
    yield* putBack(w, MAGNET);
    w.man.frame = HANDS_UP;
    w.man.dy = -1; yield* wait(2);
    w.man.dy = 0; yield* wait(6);
    w.man.frame = FRONT;
    yield* wait(2);
  },
};
