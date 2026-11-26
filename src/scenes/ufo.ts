// UFO: he takes a flashlight out of the box and signals at the sky. A flying saucer comes in, hovers over each changing
// digit and beams it up, right to left, then flies off with them. It comes back from the other side and beams the new
// digits down, left to right, and zooms away; he waves it goodbye.
import { sprite, blank, fromGrid, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, FRONT, HANDS_UP, HOME_X, LOOK_UP } from "../art";
import { fetchTool, putBack, walkTo, rnd, wait, type Frames, type Scene } from "./kit";

/** The flashlight as he carries it: lamp up. */
const TORCH = sprite(["y", "m", "m"]);
/** Signalling: looking up, the flashlight raised in his right hand (the picture's right). */
const SIGNAL = sprite([
  "..hhh..m", ".hhhhhhm", ".o.o.o.o", ".ooooo.b", ".ooooo.b", "..bbbbb.", "bbbbb...", "o.bbb...", "..ppp...", "..p.p...",
  "..p.p...", ".ss.ss..",
]);
/** Waving goodbye: the right hand up by his head, two frames. */
const WAVE = ["o", ".o"].map((hand) =>
  sprite([
    "..hhh..." + "", ".hhhhhh" + (hand === "o" ? "o" : "."), ".o.o.o." + (hand === "o" ? "b" : "o"), ".ooooo.b", ".ooooo.b",
    "..bbbbb.", "bbbbb...", "o.bbb...", "..ppp...", "..p.p...", "..p.p...", ".ss.ss..",
  ]),
);
/** The saucer, 11x4: glass dome, hull, lights under it (two frames of blinking). */
const SAUCER = [
  ["....aaa....", "..aawaaaa..", "mrrrrrrrrrm", ".mmmmmmmmm."],
  ["....aaa....", "..aawaaaa..", "mrrrrrrrrrm", ".mmmmmmmmm."],
];
const LIGHTS = [".y.x.y.x.y.", ".x.y.x.y.x."];

/**
 * The digit with the rows that are inside the saucer left out: everything above `cut` (the saucer's lower hull row) on
 * the display, the digit's top being at `top`. So it goes into the saucer, not up behind it.
 */
function inShip(s: Sprite, top: number, cut: number): Sprite {
  return sprite(s.rows.map((r, j) => (top + j <= cut ? ".".repeat(r.length) : r)));
}

export const ufo: Scene = {
  id: "ufo",
  name: "UFO",
  tier: "hour",
  play: function* (w, changes) {
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    /** The saucer's left column and top row, and how far it moves by the next step; null when it is away. */
    let ship: { x: number; y: number; vx: number; vy: number } | null = null;
    /** The beam under it, down to the floor, and the slot it carries (its digit is left out of the beam). */
    let beam: number | null = null;
    /** The flashlight's light above his hand. */
    let torch = false;
    let tick = 0;
    const pic = (t: number) => {
      const g = blank(72, 16);
      const set = (x: number, y: number, c: string) => { if (x >= 0 && x < 72 && y >= 0 && y < 16) g[y][x] = c; };
      if (torch) for (let y = 0; y < 3; y++) if ((y + tick) % 3) set(w.man.x + 7, y, "y");
      if (ship) {
        const sx = Math.round(ship.x + ship.vx * t), sy = Math.round(ship.y + ship.vy * t);
        if (beam !== null) {
          const slot = w.slots[beam], dx = DIGIT_X[beam];
          for (let y = sy + 4; y < 15; y++)
            for (let x = sx + 2; x < sx + 9; x++) {
              if ((x + y + tick) % 2 === 0) continue;
              // The digit in the beam stays in front of it.
              const pic = slot.hidden ? null : slot.s ?? DIGITS[slot.value];
              const u = x - dx, v = y - (DIGIT_Y + slot.dy);
              if (pic && u >= 0 && u < 7 && v >= 0 && v < 12 && pic.rows[v].charAt(u) === "#") continue;
              set(x, y, (y + tick) % 4 < 2 ? "G" : "n");
            }
        }
        [...SAUCER[tick % 2], LIGHTS[(tick >> 1) % 2]].forEach((r, j) => {
          for (let i = 0; i < r.length; i++) if (r.charAt(i) !== ".") set(sx + i, sy + j, r.charAt(i));
        });
      }
      return { s: fromGrid(g), x: 0, y: 0 };
    };
    function* frame(): Frames {
      tick++;
      w.fx = { ...pic(0), at: pic };
      yield;
      if (ship) { ship.x += ship.vx; ship.y += ship.vy; }
    }
    function* hold(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }
    /** Flies the saucer to (x, y), at most `speed` pixels a step. */
    function* fly(x: number, y: number, speed = 3): Frames {
      while (ship && (ship.x !== x || ship.y !== y)) {
        ship.vx = Math.max(-speed, Math.min(speed, x - ship.x));
        ship.vy = Math.max(-2, Math.min(2, y - ship.y));
        yield* frame();
      }
      if (ship) ship.vx = ship.vy = 0;
    }
    /** Hovers a moment, bobbing a pixel. */
    function* hover(n: number): Frames {
      for (let k = 0; k < n; k++) {
        if (ship) ship.vy = k % 4 === 0 ? 1 : k % 4 === 2 ? -1 : 0;
        yield* frame();
      }
      if (ship) ship.vy = 0;
    }
    const over = (i: number) => DIGIT_X[i] + 3 - 5;

    // The flashlight from the box; home, and he signals at the sky: three short, three long.
    yield* fetchTool(w, TORCH);
    yield* walkTo(w, HOME_X);
    w.carry = null;
    w.man.dir = 0;
    w.man.frame = SIGNAL;
    for (const n of [2, 2, 4, 4]) {
      torch = true; w.sfx = "beep"; yield* hold(n);
      torch = false; yield* hold(2);
    }
    w.man.frame = LOOK_UP;
    w.carry = TORCH;
    w.man.dir = 1;
    yield* hold(4);

    // In it comes from the right, and beams the old digits up, right to left.
    ship = { x: 74, y: -4, vx: 0, vy: 0 };
    w.sfx = "whoosh";
    const up = changes.slice().sort((a, b) => b.i - a.i);
    for (const c of up) {
      yield* fly(over(c.i), 0);
      yield* hover(2);
      beam = c.i;
      w.sfx = "magic";
      yield* hold(2);
      const slot = w.slots[c.i];
      const old = DIGITS[c.from];
      while (slot.dy > -12) {
        slot.dy -= 2;
        slot.s = inShip(old, DIGIT_Y + slot.dy, ship!.y + 3);
        if (rnd(3) === 0) w.sfx = "crane";
        yield* frame();
      }
      slot.hidden = true;
      slot.dy = 0;
      beam = null;
      yield* hover(2);
    }
    // Off to the left with them...
    w.sfx = "whoosh";
    yield* fly(-14, -4, 4);
    ship = null;
    yield* hold(6);

    // ...and back from the left with the new ones, beamed down left to right.
    ship = { x: -14, y: -4, vx: 0, vy: 0 };
    w.sfx = "whoosh";
    const down = changes.slice().sort((a, b) => a.i - b.i);
    for (const c of down) {
      yield* fly(over(c.i), 0);
      yield* hover(2);
      const slot = w.slots[c.i];
      slot.dy = -12;
      slot.s = inShip(DIGITS[c.to], DIGIT_Y + slot.dy, ship!.y + 3);
      slot.hidden = false;
      beam = c.i;
      w.sfx = "magic";
      yield* hold(2);
      while (slot.dy < 0) {
        slot.dy += 2;
        slot.s = inShip(DIGITS[c.to], DIGIT_Y + slot.dy, ship!.y + 3);
        yield* frame();
      }
      slot.s = DIGITS[c.to];
      w.sfx = "pop";
      yield* hold(2);
      beam = null;
      slot.s = null;
      yield* hover(2);
    }
    // Goodbye: it zooms off up to the right; he waves.
    w.carry = null;
    w.man.dir = 0;
    for (let k = 0; k < 4; k++) { w.man.frame = WAVE[k % 2]; yield* hold(2); }
    w.sfx = "whoosh";
    if (ship) { ship.vx = 6; ship.vy = -1; }
    while (ship && ship.x < 74) { w.man.frame = WAVE[tick % 2]; yield* frame(); }
    ship = null;
    w.fx = null;
    w.man.frame = HANDS_UP;
    yield* wait(6);
    w.man.frame = FRONT;
    yield* wait(2);
    yield* putBack(w, TORCH);
  },
};
