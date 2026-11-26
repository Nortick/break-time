// Puzzle (2026-11-23, minutes only): he takes a stack of puzzle pieces out of the box and walks up to the digit. A tap,
// and the digit turns out to be a jigsaw: its six pieces come apart and drop to the floor one by one, where they
// crumble away. Then he fits the new digit together piece by piece, from the bottom up, each one clicking in; the
// pieces' colors run together into the clock's own color when the last one is in.
import { sprite, PALETTE, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, FRONT, HOME_X } from "../art";
import { fetchTool, walkTo, pose14, art14, canvasX, canvasY, drawLayer, rnd, wait, type Frames, type Scene } from "./kit";

/** The pieces' colors: the old digit's pieces in two shades, the new puzzle's in its own (baked only). */
PALETTE["D"] = "#A8A8A8";
PALETTE["P"] = "#F0B04A";
PALETTE["Q"] = "#E07848";
PALETTE["R"] = "#6CC0E8";
PALETTE["S"] = "#9AD86A";

/** The stack of new pieces he carries. */
const STACK = sprite(["PR", "SQ", "RP"]);
/** The six pieces of a 7x12 digit: [left, top, width, height], bottom row first (the order he fits them in). */
const PIECES: [number, number, number, number][] = [[0, 8, 4, 4], [4, 8, 3, 4], [0, 4, 4, 4], [4, 4, 3, 4], [0, 0, 4, 4], [4, 0, 3, 4]];
const NEW_COLORS = ["P", "R", "Q", "S", "R", "P"];

/** Tapping the digit; reaching out to fit a piece at a row (low, middle, high). */
const TAP = pose14(art14([[8, 8, "b"], [7, 8, "b"], [6, 8, "o"]]));
const FIT = [
  pose14(art14([[8, 8, "b"], [7, 9, "b"], [6, 10, "o"]])),
  pose14(art14([[8, 8, "b"], [7, 8, "b"], [6, 7, "o"]])),
  pose14(art14([[8, 8, "b"], [7, 7, "o"], [6, 5, "o"]])),
];

/** A piece of digit d: its own pixels in color c ("#" keeps the digit's color). */
function piece(d: Sprite, p: [number, number, number, number], c: string): Sprite {
  const [x0, y0, pw, ph] = p;
  const rows: string[] = [];
  for (let y = y0; y < y0 + ph; y++) {
    let r = "";
    for (let x = x0; x < x0 + pw; x++) r += d.rows[y].charAt(x) === "." ? "." : c;
    rows.push(r);
  }
  return sprite(rows);
}

/** The digit made of the pieces in `which` (indexes of PIECES), each in its color; the others empty. */
function assembled(d: Sprite, which: number[], color: (k: number) => string, dx: (k: number) => number = () => 0): Sprite {
  const g = d.rows.map(() => ".......".split(""));
  for (const k of which) {
    const [x0, y0, pw, ph] = PIECES[k];
    for (let y = y0; y < y0 + ph; y++)
      for (let x = x0; x < x0 + pw; x++) {
        const X = x + dx(k);
        if (d.rows[y].charAt(x) !== "." && X >= 0 && X < 7) g[y][X] = color(k);
      }
  }
  return sprite(g.map((r) => r.join("")));
}

/** A piece falling (or lying on the floor), its pixels relative to (x, y). */
interface Falling {
  s: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rest: boolean;
}

export const puzzle: Scene = {
  id: "puzzle",
  name: "Jigsaw",
  tier: "minute",
  minuteOnly: true,
  play: function* (w, changes) {
    const c = changes[changes.length - 1];
    const slot = w.slots[c.i];
    slot.value = c.to;
    const old = DIGITS[c.from], neu = DIGITS[c.to];
    slot.s = old;
    const dx0 = DIGIT_X[c.i];
    let falling: Falling[] = [];
    let dust: { x: number; y: number }[] = [];
    function* frame(): Frames {
      const list = falling.map((f) => ({ ...f })), ds = dust.slice();
      drawLayer(w, (put) => {
        for (const f of list)
          f.s.rows.forEach((r, j) => {
            for (let i = 0; i < r.length; i++) if (r.charAt(i) !== ".") put(f.x + i, f.y + j, r.charAt(i), f.rest ? null : { x: 0, y: 0, vx: f.vx, vy: f.vy });
          });
        for (const d of ds) put(d.x, d.y, "d");
      });
      yield;
      for (const f of falling) {
        if (f.rest) continue;
        f.x += f.vx;
        f.y += f.vy;
        f.vy = Math.min(f.vy + 0.5, 3);
        const bottom = 14 - f.s.h + 1;
        if (f.y >= bottom) {
          f.y = bottom;
          f.rest = true;
        }
      }
    }

    yield* fetchTool(w, STACK);
    yield* walkTo(w, dx0 + 8);
    w.man.dir = -1;
    w.carry = null;
    // A tap: the seams show, the pieces come apart a little.
    w.man.frame = TAP;
    w.sfx = "crack";
    const shade = (k: number) => (k === 0 || k === 3 || k === 4 ? "#" : "D");
    slot.s = assembled(old, [0, 1, 2, 3, 4, 5], shade);
    yield* wait(3);
    w.man.frame = FIT[1];
    slot.s = assembled(old, [0, 1, 2, 3, 4, 5], shade, (k) => (PIECES[k][0] === 0 ? -1 : 1));
    yield* wait(4);
    // They drop out one by one, top first, and land on the floor.
    const left = [0, 1, 2, 3, 4, 5];
    for (const k of [4, 5, 2, 3, 0, 1]) {
      left.splice(left.indexOf(k), 1);
      const p = PIECES[k];
      slot.s = assembled(old, left, shade, (q) => (PIECES[q][0] === 0 ? -1 : 1));
      falling.push({ s: piece(old, p, shade(k)), x: dx0 + p[0] + (p[0] === 0 ? -1 : 1), y: DIGIT_Y + p[1], vx: p[0] === 0 ? -0.4 : 0.4, vy: 0, rest: false });
      w.sfx = "thud";
      yield* frame();
      yield* frame();
    }
    slot.hidden = true;
    while (falling.some((f) => !f.rest)) yield* frame();
    yield* frame();
    // On the floor they crumble to dust and are gone.
    w.sfx = "crumble";
    w.man.frame = FRONT;
    w.man.dir = 0;
    for (const f of falling)
      f.s.rows.forEach((r, j) => {
        for (let i = 0; i < r.length; i++) if (r.charAt(i) !== ".") dust.push({ x: f.x + i, y: f.y + j });
      });
    falling = [];
    while (dust.length) {
      dust = dust.filter(() => rnd(3) > 0).map((d) => ({ x: d.x + (rnd(3) - 1), y: Math.min(14, d.y + rnd(2)) }));
      yield* frame();
    }
    w.fx = null;
    yield* wait(2);
    // The new pieces, one by one from the bottom up: out of his hand and into place, click.
    w.man.dir = -1;
    const fitted: number[] = [];
    slot.hidden = false;
    slot.s = assembled(neu, [], () => ".");
    for (let k = 0; k < PIECES.length; k++) {
      const p = PIECES[k];
      const row = 2 - Math.floor(p[1] / 4);
      w.man.frame = FIT[row];
      const hx = canvasX(w.man.x, 6) - p[2], hy = canvasY(row === 0 ? 10 : row === 1 ? 7 : 5) - 1;
      const tx = dx0 + p[0], ty = DIGIT_Y + p[1];
      const pic = piece(neu, p, NEW_COLORS[k]);
      for (let s = 0; s <= 3; s++) {
        w.fx = { s: pic, x: Math.round(hx + ((tx - hx) * s) / 3), y: Math.round(hy + ((ty - hy) * s) / 3) };
        yield;
      }
      w.fx = null;
      fitted.push(k);
      slot.s = assembled(neu, fitted, (q) => NEW_COLORS[q]);
      w.sfx = "click";
      yield* wait(2);
    }
    // Done: the colors run together into the digit's own.
    w.man.frame = FRONT;
    w.man.dir = 0;
    yield* wait(3);
    w.sfx = "tada";
    for (let y = 0; y <= 12; y += 2) {
      slot.s = sprite(assembled(neu, fitted, (q) => NEW_COLORS[q]).rows.map((r, j) => (j < y ? r.replace(/[PQRS]/g, "#") : r)));
      yield;
    }
    slot.s = null;
    slot.hidden = false;
    yield* wait(4);
    yield* walkTo(w, HOME_X);
  },
};
