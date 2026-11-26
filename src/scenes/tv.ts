// TV (2026-11-23): he takes a remote out of the box and clicks it at the digits. They go off like an old TV (squash
// to a bright line, then a dot), hiss as static, a wrong channel flickers up (some other digit, wobbling), he clicks
// again, and the new digit comes on: a dot, a line, the whole picture, a last wobble. Two digits do it all at once.
import { sprite, type Sprite } from "../gfx";
import { DIGITS, FRONT, REMOTE } from "../art";
import { fetchTool, putBack, pose14, art14, scaled, rnd, wait, type Frames, type Scene } from "./kit";

/** Pointing the remote to the left; and the click, its red light on. */
const POINT_AT: [number, number, string][] = [[8, 8, "b"], [7, 8, "o"], [6, 8, "m"], [5, 8, "m"]];
const POINT = pose14(art14(POINT_AT));
const CLICK = pose14(art14([...POINT_AT, [4, 8, "x"]]));
/** Shaking the remote, up: it isn't working. */
const SHAKE = pose14(art14([[8, 8, "b"], [7, 7, "o"], [6, 6, "m"], [6, 5, "m"]]));

/** A 7x12 picture: `body` rows (a line `h` high and `w` wide, of "w") centred in the digit's box. */
function line(w: number, h: number): Sprite {
  const rows: string[] = [];
  const top = (12 - h) >> 1, left = (7 - w) >> 1;
  for (let y = 0; y < 12; y++) {
    let r = "";
    for (let x = 0; x < 7; x++) r += y >= top && y < top + h && x >= left && x < left + w ? "w" : ".";
    rows.push(r);
  }
  return sprite(rows);
}

/** A digit squashed to h rows, centred in the box (the picture of a TV going off, or coming on). */
function squash(d: Sprite, h: number): Sprite {
  const s = scaled(d, 7, h);
  const top = (12 - h) >> 1;
  const rows: string[] = [];
  for (let y = 0; y < 12; y++) rows.push(y >= top && y < top + h ? s.rows[y - top] : ".......");
  return sprite(rows);
}

/** Static: snow in the digit's box, and a brighter band rolling down it (row `band`). */
function snow(band: number): Sprite {
  const rows: string[] = [];
  for (let y = 0; y < 12; y++) {
    let r = "";
    for (let x = 0; x < 7; x++) {
      const v = rnd(10);
      const near = Math.abs(y - band) <= 1;
      r += near ? (v < 6 ? "w" : "d") : v < 2 ? "w" : v < 5 ? "d" : v < 7 ? "q" : ".";
    }
    rows.push(r);
  }
  return sprite(rows);
}

/** A picture with a bad signal: every other row (from `odd`) pushed a pixel sideways. */
function wobble(d: Sprite, odd: number, dir: number): Sprite {
  return sprite(
    d.rows.map((r, y) => ((y + odd) % 3 === 0 ? (dir > 0 ? "." + r.slice(0, 6) : r.slice(1) + ".") : r)),
  );
}

export const tv: Scene = {
  id: "tv",
  name: "Wrong channel",
  tier: "minute",
  play: function* (w, changes) {
    const order = changes.slice().sort((a, b) => b.i - a.i);
    for (const c of order) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    const show = (pic: (c: (typeof order)[number], n: number) => Sprite | null) =>
      order.forEach((c, n) => (w.slots[c.i].s = pic(c, n)));
    function* click(): Frames {
      w.man.frame = CLICK;
      w.sfx = "beep";
      yield;
      yield;
      w.man.frame = POINT;
    }

    yield* fetchTool(w, REMOTE);
    w.carry = null;
    w.man.dir = -1;
    w.man.frame = POINT;
    yield* wait(3);
    // Off: the picture squashes to a line, the line to a dot, the dot goes.
    yield* click();
    for (const h of [9, 6, 3, 1]) {
      show((c) => squash(DIGITS[c.from], h));
      yield;
    }
    for (const [lw, lh] of [[7, 1], [5, 1], [3, 1], [1, 1]]) {
      show(() => line(lw, lh));
      yield;
    }
    show(() => line(0, 0));
    yield* wait(3);
    // Static, with a band rolling down it.
    w.sfx = "static";
    for (let k = 0; k < 10; k++) {
      if (k === 5) w.sfx = "static";
      show(() => snow(k % 12));
      yield;
    }
    // A wrong channel: some other digit, wobbling.
    yield* click();
    const wrong = order.map((c) => {
      let d = rnd(10);
      while (d === c.from || d === c.to) d = rnd(10);
      return d;
    });
    for (let k = 0; k < 10; k++) {
      show((_c, n) => (k % 4 === 3 ? snow(rnd(12)) : wobble(DIGITS[wrong[n]], k, k % 2 ? 1 : -1)));
      yield;
    }
    // Static again; he shakes the remote: up, down, up.
    w.sfx = "static";
    for (let k = 0; k < 8; k++) {
      w.man.frame = k % 4 < 2 ? SHAKE : POINT;
      show(() => snow((k * 2) % 12));
      yield;
    }
    // Click: the new digit comes on, a dot, a line, the whole picture, a last wobble.
    yield* click();
    for (const [lw, lh] of [[1, 1], [3, 1], [7, 1]]) {
      show(() => line(lw, lh));
      yield;
    }
    for (const h of [3, 6, 9, 12]) {
      show((c) => squash(DIGITS[c.to], h));
      yield;
    }
    for (let k = 0; k < 4; k++) {
      show((c) => (k % 2 ? DIGITS[c.to] : wobble(DIGITS[c.to], k, -1)));
      yield;
    }
    show(() => null);
    yield* wait(4);
    // A look at it, satisfied, and the remote goes back.
    w.man.frame = FRONT;
    w.man.dir = 0;
    yield* wait(4);
    yield* putBack(w, REMOTE);
  },
};
