// Tetris: he takes a gamepad out of the box and plays. The changing digits break into colored pieces that drop to
// the floor and stack; four rows at a time flash and clear, till nothing is left. Then the new digits are built of
// pieces falling from the top, bottom first, and flash white when they are done.
import { sprite, blank, fromGrid, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, FRONT, HANDS_UP, HOME_X } from "../art";
import { fetchTool, putBack, walkTo, rnd, wait, type Frames, type Scene } from "./kit";

/** The gamepad as he carries it: grey, a red and a yellow button. */
export const GAMEPAD = sprite(["rrrr", "rxyr"]);
/** Playing, facing us, the gamepad in both hands at his belt; the frames press the buttons in turn. */
export const PLAY = ["oxrryro", "orrxyro", "oxrrrro"].map((pad) =>
  sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".o.o.o.", ".ooooo.", "..bbb..", ".bbbbb.", pad, "..ppp..", "..p.p..", "..p.p..", ".ss.ss."]),
);
/** The pieces' colors, like the seven tetrominoes. */
const COLORS = ["a", "y", "V", "G", "x", "h", "e"];
/** The lowest row a piece can lie on (the floor line is under it). */
const BOTTOM = 14;

/** A piece: its pixels on the display, its color, and whether it moves by the next step (for the in-betweens). */
interface Piece {
  px: [number, number][];
  c: string;
  /** How far it moves down by the next step. */
  v: number;
  /** Where it ends (a new digit's piece falling into place): its rows go down to here, then it stops. */
  dy?: number;
}

/** Breaks a digit's pixels into pieces of up to four touching pixels, bottom up; at (x0, y0) on the display. */
function pieces(s: Sprite, x0: number, y0: number): Piece[] {
  const left: Record<string, boolean> = {};
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) if (s.rows[j].charAt(i) === "#") left[`${i},${j}`] = true;
  const out: Piece[] = [];
  for (let j = s.h - 1; j >= 0; j--)
    for (let i = 0; i < s.w; i++) {
      if (!left[`${i},${j}`]) continue;
      const px: [number, number][] = [];
      const todo: [number, number][] = [[i, j]];
      delete left[`${i},${j}`];
      while (todo.length && px.length < 4) {
        const [a, b] = todo.shift()!;
        px.push([a, b]);
        for (const [da, db] of [[1, 0], [0, -1], [-1, 0], [0, 1]]) {
          const k = `${a + da},${b + db}`;
          if (left[k] && px.length + todo.length < 4) { delete left[k]; todo.push([a + da, b + db]); }
        }
      }
      for (const [a, b] of todo) left[`${a},${b}`] = true; // not taken this time
      out.push({ px: px.map(([a, b]) => [x0 + a, y0 + b] as [number, number]), c: COLORS[rnd(COLORS.length)], v: 0 });
    }
  return out;
}

export const tetris: Scene = {
  id: "tetris",
  name: "Tetris",
  tier: "hour",
  play: function* (w, changes) {
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    let pile: Piece[] = [];
    /** Rows flashing before they clear. */
    let flash: number[] = [];
    let blink = 0;
    const pic = (t: number) => {
      const g = blank(72, 16);
      for (const p of pile) {
        const d = Math.trunc(p.v * t);
        for (const [x, y] of p.px) {
          const Y = y + d;
          if (x >= 0 && x < 72 && Y >= 0 && Y < 16) g[Y][x] = flash.indexOf(y) >= 0 ? (blink % 2 ? "w" : "y") : p.c;
        }
      }
      return { s: fromGrid(g), x: 0, y: 0 };
    };
    let pose = 0;
    function* frame(press = false): Frames {
      if (press) { pose = (pose + 1) % PLAY.length; w.man.frame = PLAY[pose]; }
      w.fx = { ...pic(0), at: pic };
      yield;
    }
    /** Lets everything in the pile fall a pixel a step, as whole pieces, till it all lies still. */
    function* settle(): Frames {
      for (;;) {
        const taken: Record<string, Piece> = {};
        for (const p of pile) for (const [x, y] of p.px) taken[`${x},${y}`] = p;
        let moved = false;
        // Lowest pieces first, so a piece can follow the one under it in the same step.
        pile.sort((a, b) => Math.max(...b.px.map((q) => q[1])) - Math.max(...a.px.map((q) => q[1])));
        for (const p of pile) {
          const free = p.px.every(([x, y]) => y + 1 <= BOTTOM && (!taken[`${x},${y + 1}`] || taken[`${x},${y + 1}`] === p));
          p.v = free ? 1 : 0;
          if (!free) continue;
          for (const q of p.px) delete taken[`${q[0]},${q[1]}`];
          for (const q of p.px) { q[1]++; taken[`${q[0]},${q[1]}`] = p; }
          moved = true;
        }
        // (moved this step: draw where they were, gliding to where they are now)
        for (const p of pile) if (p.v) for (const q of p.px) q[1]--;
        yield* frame(moved && rnd(3) === 0);
        for (const p of pile) if (p.v) for (const q of p.px) q[1]++;
        for (const p of pile) p.v = 0;
        if (!moved) return;
      }
    }

    // The gamepad from the box; home, and he starts to play.
    yield* fetchTool(w, GAMEPAD);
    yield* walkTo(w, HOME_X);
    w.carry = null;
    w.man.dir = 0;
    w.man.frame = PLAY[0];
    yield* frame();
    yield* frame(true);

    // The old digits go to pieces and come down.
    for (const c of changes) {
      pile = pile.concat(pieces(DIGITS[c.from], DIGIT_X[c.i], DIGIT_Y));
      w.slots[c.i].hidden = true;
    }
    w.sfx = "pop";
    for (let k = 0; k < 4; k++) yield* frame(k % 2 === 0);
    yield* settle();

    // Four rows at a time (a "tetris") flash and clear, and what is above drops down.
    while (pile.length) {
      w.sfx = "beep";
      for (let k = 0; k < 4; k++) yield* frame(k % 2 === 0);
      flash = [BOTTOM, BOTTOM - 1, BOTTOM - 2, BOTTOM - 3];
      w.sfx = "magic";
      for (blink = 0; blink < 5; blink++) yield* frame(blink === 0);
      for (const p of pile) p.px = p.px.filter(([, y]) => flash.indexOf(y) < 0);
      pile = pile.filter((p) => p.px.length);
      flash = [];
      yield* frame();
      yield* settle();
    }
    yield* wait(4);

    // The new digits, built of falling pieces, bottom first, a little apart in time across the digits.
    const falling: Piece[] = [];
    const queue: Piece[][] = changes.map((c) => {
      const ps = pieces(DIGITS[c.to], DIGIT_X[c.i], DIGIT_Y);
      for (const p of ps) { p.dy = Math.max(...p.px.map((q) => q[1])); for (const q of p.px) q[1] -= 16; }
      return ps;
    });
    let n = 0;
    pile = [];
    while (queue.some((q) => q.length) || falling.length) {
      if (n % 2 === 0) for (const q of queue) { const p = q.shift(); if (p) { falling.push(p); pile.push(p); } }
      n++;
      for (let k = falling.length - 1; k >= 0; k--) {
        const p = falling[k];
        const bottom = Math.max(...p.px.map((q) => q[1]));
        p.v = Math.min(3, p.dy! - bottom);
        if (!p.v) { falling.splice(k, 1); continue; }
      }
      if (n % 3 === 0) w.sfx = "beep";
      yield* frame(n % 2 === 0);
      for (const p of falling) for (const q of p.px) q[1] += p.v;
      for (const p of pile) if (falling.indexOf(p) < 0) p.v = 0;
    }
    for (const p of pile) p.v = 0;
    yield* frame();
    // Done: they flash white, and they are the digits.
    w.sfx = "tada";
    for (let k = 0; k < 4; k++) {
      for (const p of pile) p.c = k % 2 ? COLORS[rnd(COLORS.length)] : "#";
      yield* frame();
    }
    for (const c of changes) { const s = w.slots[c.i]; s.hidden = false; s.s = null; }
    pile = [];
    w.fx = null;
    w.man.frame = HANDS_UP;
    w.man.dy = -1; yield* wait(2);
    w.man.dy = 0; yield* wait(6);
    w.man.frame = FRONT;
    yield* wait(2);
    yield* putBack(w, GAMEPAD);
  },
};
