// Chainsaw: from the box. He saws the old digit through the middle, sawdust flying; the top half slides off and
// falls, and the halves crumble away. Then a solid block drops in its place and he goes at it with the saw, like a
// chainsaw sculptor: a cloud of sawdust, and when it settles the new digit stands there.
import { blank, fromGrid, sprite } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, SAW } from "../art";
import { perDigit, pose14, art14, LEGS, canvasX, canvasY, rnd, wait, layer, type Frames, type Scene } from "./kit";

/**
 * The saw held level at three heights: the bar (columns 0-4, chain "r"/"m" running along it) at canvas row 3, 7 or 11,
 * which is the digit's row 2, 6 or 10; the orange engine behind it, his hand on it. For each height: [chain phase][legs].
 */
function sawPoses(row: number, engineTop: number, arm: [number, number, string][]) {
  return [0, 1].map((phase) =>
    LEGS.map((legs) => {
      const plot: [number, number, string][] = [...arm];
      for (let k = 0; k <= 4; k++) plot.push([k, row, (k + phase) % 2 ? "r" : "m"]);
      for (const [a, b] of [[5, 0], [6, 0], [5, 1], [6, 1]]) plot.push([a, engineTop + b, "e"]);
      return pose14(art14(plot), legs);
    }),
  );
}
const HIGH = sawPoses(3, 4, [[8, 7, "b"], [7, 6, "o"]]); // arm kept off his face: engine below the bar, hand under it
const MID = sawPoses(7, 7, [[8, 8, "b"], [7, 8, "o"]]);
const LOW = sawPoses(11, 10, [[8, 9, "b"], [7, 10, "o"]]);
/** The row the first cut goes through. */
const CUT_ROW = 6;

/** He stands so the bar's tip (canvas column 0) is at the digit's column k: x = digit x + 7 + k. */
const tipAt = (x0: number, k: number) => x0 + 7 + k;

interface Chip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  c: string;
}

const BLOCK = sprite(["#######", "#######", "#######", "#######", "#######", "#######", "#######", "#######", "#######", "#######", "#######", "#######"]);

export const chainsaw: Scene = {
  id: "chainsaw",
  name: "Chainsaw",
  tier: "ten",
  play: perDigit(function* (w, c): Frames {
    const slot = w.slots[c.i];
    const x0 = DIGIT_X[c.i];
    const chips: Chip[] = [];
    /** The sawdust cloud: specks that hang in the air, drift a little and vanish. */
    const cloud: Chip[] = [];
    let t = 0;
    let legs = 0;
    /** Pieces of the old digit after the cut: a picture each, falling. */
    const pieces: { g: string[][]; x: number; y: number; vy: number; down: boolean }[] = [];

    const pose = (set: typeof MID) => {
      w.man.frame = set[t % 2][legs % 2];
    };
    /** Sawdust off the bar's tip, flying up and back. */
    const spray = (x: number, y: number, n: number) => {
      for (let k = 0; k < n; k++)
        chips.push({ x, y, vx: 0.5 + Math.random() * 1.5, vy: -1 - Math.random() * 1.5, life: 6 + rnd(6), c: rnd(3) ? "#" : "d" });
    };
    const draw = () => { w.fx = layer(pic); };
    /** Everything t of the way to the next step (chips and pieces move on; the cloud just hangs). */
    const pic = (tt: number) => {
      const g = blank(72, 16);
      let lo = 72, hi = -1;
      const put = (x: number, y: number, ch: string) => {
        const X = Math.round(x), Y = Math.round(y);
        if (X < 0 || X >= 72 || Y < 0 || Y > 14) return;
        g[Y][X] = ch;
        if (X < lo) lo = X;
        if (X > hi) hi = X;
      };
      for (const p of pieces) {
        const py = p.down ? Math.min(p.y + Math.min(p.vy + 0.5, 3) * tt, 14 - (p.g.length - 1)) : p.y;
        p.g.forEach((r, j) => r.forEach((ch, k) => { if (ch !== ".") put(p.x + k, py + j, ch); }));
      }
      for (const ch of chips) put(ch.x + ch.vx * tt, ch.vy || ch.vx ? Math.min(ch.y + (ch.vy + 0.35) * tt, 14) : ch.y, ch.c);
      for (const d of cloud) put(d.x, d.y, d.c);
      return hi < 0 ? null : { s: fromGrid(g.map((r) => r.slice(lo, hi + 1))), x: lo, y: 0 };
    };
    /** Whether the engine runs (its sound goes on). */
    let engine = false;
    /** One frame: chain runs, chips fly and fall, pieces fall; then everything is drawn. */
    function* frame(): Frames {
      t++;
      if (engine) w.sfx = "saw";
      for (let k = chips.length - 1; k >= 0; k--) {
        const ch = chips[k];
        ch.vy += 0.35;
        ch.x += ch.vx;
        ch.y += ch.vy;
        if (ch.y >= 14) { ch.y = 14; ch.vx = 0; ch.vy = 0; ch.c = "d"; }
        if (--ch.life <= 0) chips.splice(k, 1);
      }
      for (let k = cloud.length - 1; k >= 0; k--) {
        const d = cloud[k];
        if (rnd(3) === 0) d.x += rnd(3) - 1;
        if (rnd(4) === 0) d.y -= 1;
        if (--d.life <= 0) cloud.splice(k, 1);
      }
      for (const p of pieces) {
        if (!p.down) continue;
        p.vy = Math.min(p.vy + 0.5, 3);
        p.y += p.vy;
        const bottom = 14 - (p.g.length - 1);
        if (p.y >= bottom) { p.y = bottom; p.down = false; w.shake.y = 1; }
      }
      draw();
      yield;
      w.shake.y = 0;
    }
    function* hold(set: typeof MID, n: number): Frames {
      for (let k = 0; k < n; k++) { pose(set); yield* frame(); }
    }
    /** Shuffles to x (the saw held at `set`), a pixel every `every` frames; `at` is called on each new spot. */
    function* move(set: typeof MID, x: number, every: number, at: () => void): Frames {
      while (w.man.x !== x) {
        w.man.x += x < w.man.x ? -1 : 1;
        legs++;
        at();
        for (let k = 0; k < every; k++) { pose(set); yield* frame(); }
      }
    }
    const tipCol = () => w.man.x - 7 - x0;

    // Engine start: a puff of smoke, and the chain runs.
    engine = true;
    w.man.x = tipAt(x0, 7);
    pose(MID);
    yield* wait(2);
    for (let k = 0; k < 3; k++) chips.push({ x: canvasX(w.man.x, 5 + rnd(2)), y: canvasY(6), vx: 0.3, vy: -0.6, life: 5, c: "d" });
    yield* hold(MID, 6);

    // The cut, through the middle, right to left.
    const old = DIGITS[c.from].rows.map((r) => r.split(""));
    yield* move(MID, tipAt(x0, -1), 2, () => {
      const k = tipCol();
      if (k >= 0 && k < 7 && old[CUT_ROW][k] !== ".") {
        old[CUT_ROW][k] = ".";
        spray(x0 + k + 1, DIGIT_Y + CUT_ROW, 2);
      }
      slot.s = fromGrid(old);
    });
    yield* move(MID, tipAt(x0, 7), 1, () => undefined);

    // The halves: the top one slides off along the cut and falls, the bottom one stands; then both crumble.
    slot.hidden = true;
    const top = { g: old.slice(0, CUT_ROW).map((r) => r.slice()), x: x0, y: DIGIT_Y, vy: 0, down: false };
    const bottom = { g: old.slice(CUT_ROW + 1).map((r) => r.slice()), x: x0, y: DIGIT_Y + CUT_ROW + 1, vy: 0, down: false };
    pieces.push(top, bottom);
    for (let k = 0; k < 3; k++) { top.x--; yield* hold(MID, 1); }
    top.down = true;
    for (let k = 0; k < 12 && top.down; k++) yield* hold(MID, 1);
    yield* hold(MID, 4);
    // Crumbling: pixels drop off the pieces as dust until none are left.
    w.sfx = "crumble";
    for (let n = 0; n < 40 && pieces.some((p) => p.g.some((r) => r.some((ch) => ch !== "."))); n++) {
      for (const p of pieces)
        for (let m = 0; m < 3; m++) {
          const j = rnd(p.g.length), k = rnd(7);
          if (p.g[j][k] !== ".") {
            p.g[j][k] = ".";
            chips.push({ x: p.x + k, y: p.y + j, vx: (Math.random() - 0.5) * 0.6, vy: 0, life: 6 + rnd(4), c: "d" });
          }
        }
      yield* hold(MID, 1);
    }
    pieces.length = 0;

    // The block drops in.
    slot.hidden = false;
    slot.s = BLOCK;
    slot.dy = -14;
    let v = 1;
    while (slot.dy < 0) {
      slot.dy = Math.min(0, slot.dy + v);
      v = Math.min(v + 1, 4);
      yield* hold(MID, 1);
    }
    w.shake.y = 1;
    yield* hold(MID, 1);
    slot.dy = -1;
    yield* hold(MID, 1);
    slot.dy = 0;
    yield* hold(MID, 3);

    // Carving, cartoon style: he goes at the block in a frenzy, the saw up, middle, down, the block rattling and a
    // cloud of sawdust swallowing it. When the dust settles, the new digit stands there.
    w.man.x = tipAt(x0, 2);
    const FRENZY = [HIGH, MID, LOW, MID];
    for (let n = 0; n < 26; n++) {
      if (n % 2 === 0) legs++;
      pose(FRENZY[(n >> 1) % 4]);
      slot.dx = n % 2 ? 1 : 0;
      const k = 1 + rnd(5), j = rnd(12);
      spray(x0 + k, DIGIT_Y + j, 2);
      for (let m = 0; m < 6; m++) cloud.push({ x: x0 - 2 + rnd(11), y: DIGIT_Y - 1 + rnd(14), vx: 0, vy: 0, life: 4 + rnd(6), c: rnd(4) ? "d" : "#" });
      if (n === 16) {
        // Thick as it gets: cover every pixel of the block, and swap in the carved digit behind the dust.
        for (let jj = 0; jj < 12; jj++) for (let kk = 0; kk < 7; kk++) cloud.push({ x: x0 + kk, y: DIGIT_Y + jj, vx: 0, vy: 0, life: 5 + rnd(6), c: "d" });
        slot.s = DIGITS[c.to];
      }
      yield* frame();
    }
    slot.dx = 0;
    // Engine off as soon as the carving is done (not while he steps back and takes the saw to the box); the dust settles.
    engine = false;
    yield* move(MID, tipAt(x0, 7), 1, () => undefined);
    slot.s = DIGITS[c.to];
    yield* hold(MID, 3);
    while (chips.length || cloud.length) yield* frame();
    w.fx = null;
    yield* wait(2);
  }, SAW, 14),
};
