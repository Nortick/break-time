// Easter egg, the cat: he takes a laser pointer out of the box and plays the red dot over the floor, then onto the
// digit. A ginger cat dashes in, pounces on the dot and tears the digit to shreds. He runs the dot off to the right,
// the cat chases it out of the screen, and the new digit drops from the sky into the empty place.
import { fromGrid, sprite, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, FRONT, HOME_X } from "../art";
import { fetchTool, putBack, walkTo, pose14, art14, rnd, wait, drawLayer, type Frames, type Scene } from "./kit";

/** The laser pointer, carried; and held out, facing left, the beam's tip at canvas (4, 8). */
const LASER = sprite(["x", "m", "m"]);
const POINT = pose14(art14([[8, 8, "b"], [7, 8, "o"], [6, 8, "m"], [5, 8, "m"], [4, 8, "x"]]));
/** He points from here. */
const AT = HOME_X - 4;

/** The cat facing left: standing, running (two frames), and up on its hind legs scratching (two frames). */
const CAT_STAND = sprite(["e.e....", "eee...e", "eqeeee.", ".eeeee.", ".e...e."]);
const CAT_RUN = [
  sprite(["e.e....", "eee....", "eqeeeee", ".eeeee.", "e.....e"]),
  sprite(["e.e....", "eee....", "eqeeeee", ".eeeee.", "..e.e.."]),
];
const CAT_UP = [
  sprite(["e.e..", "eee..", "eqe..", "eee..", ".ee..", ".eee.", ".ee.e", ".e.e."]),
  sprite(["e....", "eee.e", "eqe..", "eee..", ".ee..", ".eee.", ".ee.e", ".e.e."]),
];
/** Facing right (going back out): the standing and running frames mirrored. */
const flip = (s: Sprite): Sprite => sprite(s.rows.map((r) => r.split("").reverse().join("")));
const CAT_RUN_R = CAT_RUN.map(flip);

export const cat: Scene = {
  id: "cat",
  name: "The cat",
  tier: "minute",
  rare: true,
  play: function* (w, changes) {
    const order = changes.slice().sort((a, b) => b.i - a.i); // minutes first
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    /** The red dot, the cat (picture and top-left), shreds of digit falling and lying on the floor. */
    let dot: { x: number; y: number } | null = null;
    let kitty: { s: Sprite; x: number; y: number } | null = null;
    const shreds: { x: number; y: number; vx: number; vy: number; rest: number }[] = [];
    /** Whether the cat is on the item layer now (it is free: the laser comes out of the box before, goes back after). */
    let kittyShown = false;
    function* frame(): Frames {
      for (let k = shreds.length - 1; k >= 0; k--) {
        const s = shreds[k];
        if (s.rest > 0) {
          if (--s.rest === 0) { shreds.splice(k, 1); continue; }
        } else {
          s.vy += 0.4; s.x += s.vx; s.y += s.vy; s.vx *= 0.9;
          if (s.y >= 14) { s.y = 14; s.rest = 40 + rnd(40); }
        }
      }
      // Shreds fly on between steps (60 fps), behind the cat as before; the cat is on the item layer, so it runs smoothly.
      const onCat = (x: number, y: number) => {
        if (!kitty) return false;
        const r = kitty.s.rows[Math.round(y) - kitty.y], i = Math.round(x) - kitty.x;
        return !!r && i >= 0 && r.charAt(i) !== "" && r.charAt(i) !== ".";
      };
      drawLayer(w, (put) => {
        for (let k = shreds.length - 1; k >= 0; k--) {
          const s = shreds[k];
          const m = s.rest > 0 ? null : { x: s.x, y: s.y, vx: s.vx, vy: s.vy, ay: 0.4, floor: 14 };
          if (!onCat(s.x, s.y)) put(s.x, s.y, s.rest > 0 && s.rest < 15 ? "d" : "#", m);
        }
        if (dot) put(dot.x, dot.y, "x");
      }, 15);
      if (kitty) w.item = { s: kitty.s, x: kitty.x, y: kitty.y };
      else if (kittyShown) w.item = null;
      kittyShown = !!kitty;
      yield;
    }
    function* run(gen: Frames): Frames {
      while (!gen.next().done) yield* frame();
    }
    function* hold(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }
    /** Moves the dot to (x, y), `speed` pixels a frame, the cat (if it is chasing) running after it on the floor. */
    function* dotTo(x: number, y: number, speed: number, chase = false): Frames {
      let step = 0;
      while (dot && (dot.x !== x || dot.y !== y)) {
        dot.x += Math.sign(x - dot.x) * Math.min(speed, Math.abs(x - dot.x));
        dot.y += Math.sign(y - dot.y) * Math.min(1, Math.abs(y - dot.y));
        if (chase && kitty) {
          const tx = dot.x - 3;
          kitty.x += Math.sign(tx - kitty.x) * Math.min(2, Math.abs(tx - kitty.x));
          kitty.s = tx >= kitty.x ? CAT_RUN_R[(++step >> 1) % 2] : CAT_RUN[(++step >> 1) % 2];
        }
        yield* frame();
      }
    }

    yield* run(fetchTool(w, LASER));
    yield* run(walkTo(w, AT));
    w.carry = null;
    w.man.dir = -1;
    w.man.frame = POINT;
    yield* hold(3);
    // Click: the dot dances about on the floor a little, then climbs the first digit.
    w.sfx = "beep";
    dot = { x: AT - 6, y: 14 };
    for (const [x, y] of [[AT - 12, 14], [AT - 8, 13], [AT - 15, 14]]) yield* dotTo(x, y, 1);

    for (const c of order) {
      const slot = w.slots[c.i], x0 = DIGIT_X[c.i];
      yield* dotTo(x0 + 5, 14, 2);
      yield* dotTo(x0 + 5, DIGIT_Y + 7, 1);
      if (!kitty) {
        // The cat dashes in from the right, behind him and the box.
        w.sfx = "meow";
        kitty = { s: CAT_RUN[0], x: 74, y: 10 };
        let step = 0;
        while (kitty.x > x0 + 8) {
          kitty.x -= 2;
          kitty.s = CAT_RUN[(++step >> 1) % 2];
          if (step % 6 === 0 && dot) dot.y = DIGIT_Y + 6 + rnd(3);
          yield* frame();
        }
      } else {
        yield* dotTo(x0 + 5, DIGIT_Y + 7, 1, true);
        while (kitty.x > x0 + 8) { kitty.x -= 2; kitty.s = CAT_RUN[kitty.x % 2]; yield* frame(); }
      }
      // A wiggle, and the pounce.
      w.sfx = "meow";
      kitty.s = CAT_STAND;
      for (let k = 0; k < 6; k++) { kitty.x += k % 2 ? 1 : -1; yield* frame(); }
      kitty = { s: CAT_UP[0], x: x0 + 5, y: 6 };
      // Scratching: slashes torn out of the digit, shreds flying.
      w.sfx = "crumble";
      const left = DIGITS[c.from].rows.map((r) => r.split(""));
      for (let t = 0; t < 26; t++) {
        kitty.s = CAT_UP[t % 2];
        if (dot) { dot.x = x0 + 2 + rnd(4); dot.y = DIGIT_Y + 2 + rnd(9); }
        const sy = rnd(12), sx = rnd(3);
        for (let k = 0; k < 5; k++) {
          const j = sy + k, i = sx + k;
          if (j < 12 && i < 7 && left[j][i] !== ".") {
            left[j][i] = ".";
            shreds.push({ x: x0 + i, y: DIGIT_Y + j, vx: (Math.random() - 0.3) * 2, vy: -Math.random() * 1.5, rest: 0 });
          }
        }
        // Near the end it pulls down whatever is left.
        if (t > 18)
          left.forEach((r, j) => r.forEach((ch, i) => {
            if (ch !== "." && rnd(4) === 0) { r[i] = "."; shreds.push({ x: x0 + i, y: DIGIT_Y + j, vx: (Math.random() - 0.5) * 1.5, vy: 0, rest: 0 }); }
          }));
        slot.s = fromGrid(left);
        yield* frame();
      }
      for (const r of left) for (let i = 0; i < r.length; i++) r[i] = ".";
      slot.hidden = true;
      kitty = { s: CAT_STAND, x: x0 + 1, y: 10 };
      yield* hold(4);
    }

    // The dot runs off to the right, the cat after it, out of the screen.
    yield* dotTo(dot!.x, 14, 1);
    yield* dotTo(78, 14, 2, true);
    kitty = null;
    dot = null;
    yield* hold(10);
    // The new digits drop from the sky into the empty places, left to right, with a thud that scatters the shreds.
    for (const c of order.slice().reverse()) {
      const slot = w.slots[c.i], x0 = DIGIT_X[c.i];
      slot.hidden = false;
      slot.s = DIGITS[c.to];
      slot.dy = -15;
      let v = 1;
      while (slot.dy < 0) {
        slot.dy = Math.min(0, slot.dy + v);
        v = Math.min(v + 1, 4);
        yield* frame();
      }
      for (const sh of shreds)
        if (sh.x >= x0 - 1 && sh.x <= x0 + 7) { sh.rest = 0; sh.vy = -1.5; sh.vx = sh.x < x0 + 3 ? -1.2 : 1.2; }
      w.shake.y = 1;
      for (const bnc of [-2, -1, 0]) { slot.dy = bnc; yield* frame(); w.shake.y = 0; }
      slot.s = null;
      yield* hold(3);
    }
    // What is left of the shreds melts away quickly now.
    for (const sh of shreds) if (sh.rest > 16) sh.rest = 10 + rnd(8);
    w.man.frame = FRONT;
    yield* hold(3);
    yield* run(putBack(w, LASER));
    while (shreds.length) yield* frame();
    w.fx = null;
    yield* wait(2);
  },
};
