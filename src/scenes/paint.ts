// Mop and brush: wipes the old digit off with a T-mop, writes the new one with a brush, stroke by stroke.
import { fromGrid, blank, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, MOP, WORK_L, FRONT, LOOK_UP } from "../art";
import { phased, pose14, art14, LEGS, clamp, wait, walkTo, WORK_R, type Change, type Frames, type Scene } from "./kit";
import { type World } from "../world";

/**
 * How each digit is written by hand: strokes in order, each a line through points on the 7x12 digit (pixel edges, so
 * the middle of a 2-pixel-thick stroke falls on a whole number).
 */
const STROKES: [number, number][][][] = [
  [[[3.5, 1], [1, 1], [1, 11], [6, 11], [6, 1], [3.5, 1]]],
  [[[1, 3], [4, 1], [4, 11]], [[1, 11.5], [7, 11.5]]],
  [[[1, 2.5], [1, 1], [6, 1], [6, 3.5], [1, 10], [1, 11], [7, 11]]],
  [[[0, 1], [6, 1], [6, 6], [2, 6]], [[6, 6], [6, 11], [0, 11]]],
  [[[1, 0], [1, 6], [7, 6]], [[6, 0], [6, 12]]],
  [[[1, 1], [1, 5], [6, 5], [6, 11], [1, 11], [1, 9.5]], [[1, 1], [7, 1]]],
  [[[6, 1], [1, 1], [1, 11], [6, 11], [6, 5], [1, 5]]],
  [[[0, 1], [6, 1], [6, 3.5], [3, 8], [3, 12]]],
  [[[6, 1], [1, 1], [1, 5.5], [6, 5.5], [6, 11], [1, 11], [1, 6], [6, 5], [6, 1]]],
  [[[6, 1], [1, 1], [1, 6], [6, 6], [6, 1], [6, 11], [1, 11]]],
];

/** Points every half pixel along a line through `pts`. */
function along(pts: [number, number][]): [number, number][] {
  const out: [number, number][] = [pts[0]];
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.5));
    for (let s = 1; s <= n; s++) out.push([ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n]);
  }
  return out;
}

/** The pixels of `s` that a pen at (px, py) covers: those whose middle is within `r`. */
function cover(s: Sprite, g: string[][], px: number, py: number, r: number, c: string | null): void {
  for (let j = Math.max(0, Math.floor(py - r)); j < Math.min(s.h, Math.ceil(py + r)); j++)
    for (let i = Math.max(0, Math.floor(px - r)); i < Math.min(s.w, Math.ceil(px + r)); i++)
      if (Math.hypot(i + 0.5 - px, j + 0.5 - py) <= r && s.rows[j].charAt(i) !== ".") g[j][i] = c ?? s.rows[j].charAt(i);
}

/**
 * The worker with the T-mop, facing left, as whole hand-drawn frames: the mop never changes, only how he holds it. For
 * each band of the digit (top, middle, bottom) one pose, in two leg frames for shuffling along. `head` is where the
 * rag's left column is, from his x.
 */
// Rows 0-13 of the drawing in front of him: rag "r" with its wooden bar "g", the handle "g", his hand "o", arm "b".
const MOP_TOP = [
  "",
  "..rg",
  "..rgg",
  "..rg.g",
  "..rg..g",
  ".......o",
  "........b",
];
const MOP_MID = [
  "", "", "", "", "",
  ".rg",
  ".rg",
  ".rggggg",
  ".rg....o",
  "........b",
];
const MOP_LOW = [
  "", "", "", "", "", "", "", "",
  "........b",
  "..rg..go",
  "..rgggg",
  "..rg",
  "..rg",
];
const MOP_POSES = [
  { frames: LEGS.map((l) => pose14(MOP_TOP, l)), head: -5, rows: [0, 4] },
  { frames: LEGS.map((l) => pose14(MOP_MID, l)), head: -6, rows: [4, 8] },
  { frames: LEGS.map((l) => pose14(MOP_LOW, l)), head: -5, rows: [8, 12] },
];

/**
 * The worker with a paint brush, facing left, one hand-drawn pose for each pair of rows of a digit: arm and brush
 * angled up for the top, level in the middle, down at the bottom. `tip` is the bristles' column, `row` their top row.
 */
const BRUSH_POSES = [
  { art: art14([[8, 7, "b"], [7, 6, "o"], [6, 5, "g"], [5, 4, "g"], [4, 3, "r"], [3, 2, "w"], [3, 1, "w"]]), tip: 3, row: 0 },
  { art: art14([[8, 8, "b"], [7, 7, "o"], [6, 6, "g"], [5, 5, "r"], [4, 4, "w"], [4, 3, "w"]]), tip: 4, row: 2 },
  { art: art14([[8, 8, "b"], [7, 8, "o"], [6, 7, "g"], [5, 6, "r"], [4, 6, "w"], [4, 5, "w"]]), tip: 4, row: 4 },
  { art: art14([[8, 8, "b"], [7, 8, "o"], [6, 8, "g"], [5, 8, "r"], [4, 8, "w"], [4, 7, "w"]]), tip: 4, row: 6 },
  { art: art14([[8, 8, "b"], [7, 9, "o"], [6, 10, "g"], [5, 10, "r"], [4, 10, "w"], [4, 9, "w"]]), tip: 4, row: 8 },
  { art: art14([[8, 9, "b"], [7, 10, "o"], [6, 11, "g"], [5, 12, "r"], [4, 12, "w"], [4, 11, "w"]]), tip: 4, row: 10 },
].map((p) => ({ frames: LEGS.map((l) => pose14(p.art, l)), tip: p.tip - 7, row: p.row }));

/**
 * Takes the T-mop from the box and wipes the old digit off in three bands, top to bottom: for each he holds the mop
 * at that height and shuffles along, the rag passing right to left. Then he writes the new digit with a brush, stroke
 * by stroke the way it is written by hand: the brush pose changes with the height, and he steps along with it.
 */
/** Wipes the old digit off with the mop, in three bands top to bottom. */
function* wipe(w: World, c: Change): Frames {
  const slot = w.slots[c.i];
  const x0 = DIGIT_X[c.i];
  const left = blank(7, 12);
  DIGITS[c.from].rows.forEach((r, j) => { for (let i = 0; i < 7; i++) left[j][i] = r.charAt(i); });
  let step = 0;
  for (const p of MOP_POSES) {
    // Into position at the digit's right edge (frame switch, no in-between: it is a new pose).
    w.man.x = x0 + 5 - p.head;
    w.man.frame = p.frames[0];
    w.sfx = "sweep";
    yield* wait(2);
    for (let hx = x0 + 5; hx >= x0; hx--) {
      w.man.x = hx - p.head;
      w.man.frame = p.frames[++step % 2];
      for (let j = p.rows[0]; j < p.rows[1]; j++) for (let i = hx - x0; i < Math.min(7, hx - x0 + 2); i++) left[j][i] = ".";
      slot.s = fromGrid(left);
      yield;
    }
    yield;
  }
  slot.hidden = true;
  w.man.frame = WORK_L;
  yield* wait(4);
}

/** Writes the new digit with the brush, stroke by stroke as it is written by hand; he steps along with the brush. */
function* brush(w: World, c: Change): Frames {
  const slot = w.slots[c.i];
  const x0 = DIGIT_X[c.i];
  let step = 0;
  const paintG = blank(7, 12);
  const to = DIGITS[c.to];
  slot.hidden = false;
  slot.s = fromGrid(paintG);
  const place = (px: number, py: number) => {
    const p = BRUSH_POSES[clamp(Math.floor(py / 2), 0, 5)];
    const nx = x0 + Math.floor(px) - p.tip;
    if (nx !== w.man.x) step++;
    w.man.x = nx;
    w.man.frame = p.frames[step % 2];
  };
  let at: [number, number] | null = null;
  for (const st of STROKES[c.to]) {
    if (at) for (const [px, py] of along([at, st[0]]).filter((_, k) => k % 2 === 1)) { place(px, py); yield; }
    const path = along(st);
    for (let k = 0; k < path.length; k += 2) {
      for (let m = Math.max(0, k - 2); m <= k; m++) cover(to, paintG, path[m][0], path[m][1], 1.25, null);
      slot.s = fromGrid(paintG);
      place(path[k][0], path[k][1]);
      yield;
    }
    at = path[path.length - 1];
  }
  w.sfx = "pop";
  slot.s = DIGITS[c.to]; // the finished digit (an "oops" take may still wipe it off again)
  w.man.frame = WORK_L;
  yield* wait(4);
}

/**
 * Takes the T-mop from the box and wipes the old digits off, right to left; then writes the new ones with a brush,
 * left to right (tens, then minutes), stroke by stroke the way they are written by hand.
 */
export const paint: Scene = {
  id: "paint",
  name: "Mop and brush",
  tier: "minute",
  play: phased([{ each: wipe }, { each: brush, leftFirst: true }], MOP, 11),
};

/** For each digit, one that is clearly not it: what he paints by mistake in the "oops" take. */
const WRONG = [8, 7, 5, 8, 9, 2, 9, 1, 3, 6];

/**
 * The "oops" take of the brush pass: on the minutes he paints a wrong digit, steps back to look, shakes his head,
 * wipes it off and paints the right one.
 */
function* oops(w: World, c: Change): Frames {
  if (c.i !== 3) {
    yield* brush(w, c);
    return;
  }
  const wrong = WRONG[c.to];
  yield* brush(w, { ...c, to: wrong });
  yield* walkTo(w, w.man.x + 3);
  w.man.frame = LOOK_UP;
  yield* wait(8);
  w.sfx = "grumble";
  for (let k = 0; k < 3; k++) {
    w.man.frame = WORK_L; yield* wait(2);
    w.man.frame = WORK_R; yield* wait(2);
  }
  w.man.frame = FRONT;
  yield* wait(3);
  yield* wipe(w, { ...c, from: wrong });
  yield* brush(w, c);
}

/** Mop and brush, the "oops" take: now and then (see main.ts) he gets the minute wrong first. */
export const paintOops: Scene = {
  id: "paint_oops",
  name: "Mop and brush",
  tier: "minute",
  variantOf: "paint",
  play: phased([{ each: wipe }, { each: oops, leftFirst: true }], MOP, 11),
};
