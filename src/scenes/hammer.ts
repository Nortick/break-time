// The worker with a sledgehammer, facing left. Each pose is a 15×15 picture; the worker himself stands in
// columns 5–11 from row 3, so the picture goes at (man.x - 5, MAN_Y - 3). g = handle, m = hammer head.
import { blank, fromGrid, mirror, sprite, type Sprite } from "../gfx";

const HEAD = ["..hhh..", "hhhhh..", ".oooo..", ".o.oo..", ".oooo.."];
const BODY = ["..bbb..", "..bbb..", "..bbb..", "..ppp..", "..p.p..", "..p.p..", ".ss.ss."];

function pose(plot: [number, number, string][], legs = BODY.slice(3)): Sprite {
  const g = blank(15, 15);
  [...HEAD, ...BODY.slice(0, 3), ...legs].forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r.charAt(i) !== ".") g[3 + j][5 + i] = r.charAt(i);
  });
  for (const [x, y, c] of plot) g[y][x] = c;
  return Object.assign(fromGrid(g), { ox: -5, oy: -3 });
}

/** Hammer resting, head on the floor in front of him. */
export const H_READY = pose([
  [5, 9, "b"], [4, 10, "o"], [3, 11, "g"], [2, 12, "g"],
  [0, 13, "m"], [1, 13, "m"], [0, 14, "m"], [1, 14, "m"],
]);

const TRAIL_PLOT: [number, number, string][] = [
  [10, 9, "b"], [11, 10, "o"], [12, 11, "g"], [13, 12, "g"],
  [13, 13, "m"], [14, 13, "m"], [13, 14, "m"], [14, 14, "m"],
];
/** Walking left, dragging the heavy hammer behind him along the floor. */
export const H_DRAG_L = [
  pose(TRAIL_PLOT, ["..ppp..", ".pp.p..", ".p...p.", "ss...ss"]),
  pose(TRAIL_PLOT, ["..ppp..", "..pp...", "..pp...", "..sss.."]),
];
/** Walking right, the hammer still behind him. Mirrored, the worker stands in columns 3-9. */
export const H_DRAG_R = H_DRAG_L.map((s) => Object.assign(mirror(s), { ox: -3, oy: -3 }));

/**
 * Walking right, the hammer behind him and the crane's control box in his free hand, held out in front: arm, hand,
 * the dark box with its two levers on top, a yellow button and a red light. [light off, light on][leg frame].
 */
function withRemote(s: Sprite, light: boolean): Sprite {
  const g = s.rows.map((r) => r.padEnd(s.w, ".").split(""));
  const plot: [number, number, string][] = [
    [8, 9, "b"], [9, 9, "o"],
    [10, 7, "m"], [12, 7, "m"], [10, 8, "q"], [11, 8, "q"], [12, 8, "q"], [10, 9, "q"], [11, 9, light ? "x" : "r"], [12, 9, "y"],
  ];
  for (const [x, y, c] of plot) g[y][x] = c;
  return Object.assign(fromGrid(g), { ox: -3, oy: -3 });
}
export const H_DRAG_R_REMOTE = [false, true].map((light) => H_DRAG_R.map((s) => withRemote(s, light)));

/** The sledgehammer upright, as it comes out of the box and as he carries it: handle up, head down. */
export const SLEDGE = sprite([".g.", ".g.", ".g.", ".g.", "mmm", "mmm"]);

/** Swung back over his shoulder. */
export const H_BACK = pose([
  [10, 8, "b"], [10, 7, "b"], [11, 6, "o"], [12, 5, "g"], [13, 4, "g"],
  [13, 2, "m"], [14, 2, "m"], [13, 3, "m"], [14, 3, "m"],
]);

/** Straight up over his head. */
export const H_UP = pose([
  [10, 8, "b"], [10, 7, "b"], [10, 6, "b"], [10, 5, "b"], [10, 4, "o"], [10, 3, "g"], [10, 2, "g"],
  [9, 0, "m"], [10, 0, "m"], [11, 0, "m"], [9, 1, "m"], [10, 1, "m"], [11, 1, "m"],
]);

/** The blow: arms out, hammer level, head forward. */
export const H_STRIKE = pose([
  [5, 9, "b"], [4, 9, "o"], [3, 9, "g"], [2, 9, "g"],
  [0, 8, "m"], [1, 8, "m"], [0, 9, "m"], [1, 9, "m"], [0, 10, "m"], [1, 10, "m"],
]);
