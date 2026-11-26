// 3D printer (2026-11-23): he presses a button on the box and a printer's frame comes down from the top over the
// changing digits: two posts, a rail, a print head on a rod. The head's laser runs down the old digits row by row and
// they are gone; then it prints the new ones from the bottom up, row by row, back and forth over all of them at once,
// the fresh plastic hot orange, cooling white. The frame goes back up and he walks home.
import { DIGITS, DIGIT_X, DIGIT_Y, FRONT, BOX_STAND, HOME_X } from "../art";
import { sprite, type Sprite } from "../gfx";
import { walkTo, wait, drawLayer, rnd, WORK_R, type Frames, type Scene } from "./kit";

/** The digit's rows from `from` down only (the rows above it are gone). */
function below(d: Sprite, from: number): Sprite {
  return sprite(d.rows.map((r, y) => (y >= from ? r : ".".repeat(r.length))));
}

export const printer: Scene = {
  id: "printer",
  name: "3D print",
  tier: "minute",
  play: function* (w, changes) {
    const order = changes.slice().sort((a, b) => a.i - b.i);
    for (const c of order) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    /** The span it prints over (display columns), the posts just outside it. */
    const x0 = DIGIT_X[order[0].i], x1 = DIGIT_X[order[order.length - 1].i] + 6;
    const left = x0 - 1, right = x1 + 1;
    /** The frame's top row (0 = down, in place), the head's nozzle (column, row) and where they go by the next step. */
    let top = -16, vTop = 0;
    let hx = x0, ny = 1, vx = 0, vy = 0;
    let laser = -1, hot = false;
    const sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

    function* frame(): Frames {
      const T = top, VT = vTop, HX = hx, NY = ny, VX = vx, VY = vy, L = laser, H = hot, sp = sparks.map((s) => ({ ...s }));
      drawLayer(w, (put) => {
        const frameM = { x: 0, y: 0, vy: VT };
        // The rail and the posts.
        for (let x = left; x <= right; x++) put(x, T, "m", frameM);
        for (let y = T + 1; y <= 14; y++) {
          put(left, y, "m", frameM);
          put(right, y, "m", frameM);
        }
        // The head on its rod, hanging from the rail: rod, body, nozzle.
        const headM = { x: 0, y: 0, vx: VX, vy: VY + VT };
        const ry = T + NY - 0;
        for (let y = T + 1; y < ry - 1; y++) put(HX, y, "r", { x: 0, y: 0, vx: VX, vy: VT });
        put(HX - 1, ry - 1, "m", headM);
        put(HX, ry - 1, "m", headM);
        put(HX + 1, ry - 1, "m", headM);
        put(HX, ry, H ? "x" : "m", headM);
        // The laser's line across the row it burns away.
        if (L >= 0) for (let x = x0; x <= x1; x++) if (rnd(3)) put(x, L, rnd(4) ? "x" : "f");
        for (const s of sp) put(s.x, s.y, s.life > 2 ? "y" : "f", s);
      });
      yield;
      top += vTop;
      hx += vx;
      ny += vy;
      for (let k = sparks.length - 1; k >= 0; k--) {
        const s = sparks[k];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.3;
        if (--s.life <= 0) sparks.splice(k, 1);
      }
    }

    // He walks to the box and presses a button on it.
    yield* walkTo(w, BOX_STAND);
    w.man.dir = 1;
    w.man.frame = WORK_R;
    yield* wait(2);
    w.sfx = "beep";
    yield* wait(3);
    w.man.frame = FRONT;
    w.man.dir = 0;
    // The frame comes down.
    w.sfx = "crane";
    vTop = 2;
    while (top < 0) {
      if (top + vTop > 0) vTop = -top;
      yield* frame();
    }
    vTop = 0;
    // The head goes to the middle of the top row, and its laser burns the old digits away, row by row from the top.
    const mid = Math.round((x0 + x1) / 2);
    while (hx !== mid) {
      vx = Math.sign(mid - hx) * Math.min(4, Math.abs(mid - hx));
      yield* frame();
    }
    vx = 0;
    hot = true;
    w.sfx = "fire";
    for (let r = 0; r < 12; r++) {
      const row = DIGIT_Y + r;
      ny = row - 1;
      laser = row;
      for (const c of order) w.slots[c.i].s = below(DIGITS[c.from], r + 1);
      for (let k = 0; k < 2; k++) sparks.push({ x: x0 + rnd(x1 - x0 + 1), y: row, vx: (Math.random() - 0.5) * 1.2, vy: -0.8 - Math.random(), life: 3 + rnd(3) });
      if (r === 6) w.sfx = "fire";
      yield* frame();
    }
    laser = -1;
    for (const c of order) w.slots[c.i].hidden = true;
    yield* wait(1);
    // Printing, from the bottom row up, back and forth: the nozzle lays the row's pixels as it passes.
    const xs: number[] = [];
    for (let x = x0; x < x1; x += 4) xs.push(x);
    xs.push(x1);
    /** Rows printed so far (counted from the bottom), and how far along the row in print it is. */
    let rows = 0;
    const lay = (upTo: number, fromLeft: boolean) => {
      for (const c of order) {
        const d = DIGITS[c.to], slot = w.slots[c.i];
        slot.hidden = false;
        const pic = d.rows.map((r, y) => {
          const age = 11 - y - rows; // 0: the row in print now, 1: the one before ...
          if (age > 0) return r;
          return r
            .split("")
            .map((ch, x) => {
              if (ch === ".") return ".";
              if (age < -2) return ch;
              if (age === 0) {
                const X = DIGIT_X[c.i] + x;
                if (fromLeft ? X > upTo : X < upTo) return ".";
              }
              return age === 0 ? "f" : age === -1 ? "y" : ch;
            })
            .join("");
        });
        // Rows not reached yet are empty.
        slot.s = sprite(pic.map((r, y) => (11 - y - rows > 0 ? ".".repeat(r.length) : r)));
      }
    };
    for (rows = 0; rows < 12; rows++) {
      const fromLeft = rows % 2 === 0;
      const path = fromLeft ? xs : xs.slice().reverse();
      ny = DIGIT_Y + 11 - rows - 1;
      vy = 0;
      if (rows % 3 === 0) w.sfx = "print";
      for (let k = 0; k < path.length; k++) {
        hx = path[k];
        vx = k + 1 < path.length ? path[k + 1] - path[k] : 0;
        vy = k + 1 === path.length && rows < 11 ? -1 : 0;
        lay(hx, fromLeft);
        yield* frame();
      }
    }
    // The last rows cool down.
    rows = 14;
    lay(x1, true);
    hot = false;
    vx = vy = 0;
    yield* wait(2);
    for (let k = 0; k < 3; k++) {
      rows = 12 + k;
      for (const c of order) w.slots[c.i].s = null;
      yield* frame();
    }
    // The head parks, the frame goes back up.
    while (hx !== left + 1) {
      vx = Math.sign(left + 1 - hx) * Math.min(4, Math.abs(left + 1 - hx));
      yield* frame();
    }
    vx = 0;
    w.sfx = "crane";
    vTop = -2;
    while (top > -17) yield* frame();
    w.fx = null;
    for (const c of order) {
      w.slots[c.i].s = null;
      w.slots[c.i].hidden = false;
    }
    yield* wait(3);
    yield* walkTo(w, HOME_X);
  },
};
