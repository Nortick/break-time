// Sand: the old digits turn yellow and run down into heaps of sand. He looks up — what was that? — goes to the box for
// the broom and sweeps it all to the right with short strokes: the heaps run together into one pile that he pushes along,
// behind the box and off the screen. Broom back in the box; then sand pours from the top of the screen in thin streams,
// like in an hourglass, filling the new digits from the bottom up, and they set white.
import { blank, fromGrid, mirror } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, BROOM, LOOK_UP, FRONT } from "../art";
import { pose14, art14, LEGS, fetchTool, putBack, walkTo, rnd, wait, layer, type Frames, type Scene } from "./kit";

/** The sand is a grid of grains over the whole display and a bit past its right edge, top to floor. */
const W = 84, H = 15;

/**
 * The twig broom in front of him, facing left: the handle down from his hand, the red binding, and the twigs fanning
 * out on the floor in columns 0-3. Two frames whose twig tips differ, for the swish.
 */
const BROOM_ART = (tips: string): [number, number, string][] => [
  [8, 8, "b"], [7, 8, "o"], [6, 9, "g"], [5, 10, "g"], [4, 11, "x"],
  [3, 11, "y"], [2, 12, "y"], [3, 12, "g"], [1, 12, "y"],
  ...tips.split("").map((ch, k) => [k, 13, ch] as [number, number, string]),
];
const BROOM_POSE = [BROOM_ART("ygyy"), BROOM_ART("yygy")].map((art, k) => pose14(art14(art), LEGS[k]));
/** Facing right, sweeping: the same poses mirrored. He stands in columns 0-6; the twigs are at his x + 10..13. */
const BROOM_R = BROOM_POSE.map((s) => Object.assign(mirror(s), { ox: 0, oy: -2 }));
const TWIG_L = 10, TWIG_R = 13;

export const sand: Scene = {
  id: "sand",
  name: "Sand",
  tier: "ten",
  play: function* (w, changes): Frames {
    const order = changes.slice().sort((a, b) => b.i - a.i);
    const g: boolean[][] = [];
    for (let j = 0; j < H; j++) { const r: boolean[] = []; for (let k = 0; k < W; k++) r.push(false); g.push(r); }
    /** Dust kicked up by the broom: drifting dots. */
    const dust: { x: number; y: number; vx: number; life: number }[] = [];
    /** The pouring streams: each in its column, from row `from` down to row `to`. */
    let streams: { x: number; from: number; to: number }[] = [];
    // Like perDigit: each slot holds its new value already, the old digit stays on as its picture.
    for (const c of order) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }

    const draw = () => { w.fx = layer(picture); };
    /** The layer t of the way to the next step: the broom's dust drifts on; the sand moves a grain a step. */
    const picture = (t: number) => {
      const pic = blank(72, 16);
      let lo = 72, hi = -1;
      const put = (x: number, y: number, ch: string) => {
        const X = Math.round(x), Y = Math.round(y);
        if (X < 0 || X >= 72 || Y < 0 || Y > 14) return;
        pic[Y][X] = ch;
        if (X < lo) lo = X;
        if (X > hi) hi = X;
      };
      for (let j = 0; j < H; j++) for (let k = 0; k < 72; k++) if (g[j][k]) put(k, j, "c");
      for (const st of streams) for (let y = st.from; y <= st.to; y++) if (rnd(5)) put(st.x, y, "c");
      for (const d of dust) put(d.x + d.vx * t, d.y, "d");
      return hi < 0 ? null : { s: fromGrid(pic.map((r) => r.slice(lo, hi + 1))), x: lo, y: 0 };
    };
    /** The columns that have sand, so falling only looks there. */
    const span = (): [number, number] => {
      let a = W, b = -1;
      for (let k = 0; k < W; k++) for (let j = 0; j < H; j++) if (g[j][k]) { if (k < a) a = k; if (k > b) b = k; break; }
      return [Math.max(0, a - 1), Math.min(W - 1, b + 1)];
    };
    /** One step of falling sand: each grain drops, or slides off to a side; true if anything moved. */
    const fall = (): boolean => {
      let moved = false;
      const [a, b] = span();
      for (let j = H - 2; j >= 0; j--) {
        const cols: number[] = [];
        for (let k = a; k <= b; k++) cols.push(k);
        cols.sort(() => Math.random() - 0.5);
        for (const k of cols) {
          if (!g[j][k]) continue;
          if (!g[j + 1][k]) { g[j][k] = false; g[j + 1][k] = true; moved = true; continue; }
          for (const s of rnd(2) ? [-1, 1] : [1, -1]) {
            const n = k + s;
            if (n >= 0 && n < W && !g[j + 1][n] && !g[j][n]) { g[j][k] = false; g[j + 1][n] = true; moved = true; break; }
          }
        }
      }
      return moved;
    };
    /** Sand in the columns from..to is pushed into the column just right of them, piling up there. */
    const push = (from: number, to: number) => {
      const into = to + 1;
      if (into >= W) return;
      let n = 0;
      for (let k = Math.max(0, from); k <= to; k++)
        for (let j = 0; j < H; j++)
          if (g[j][k]) {
            g[j][k] = false;
            // A little of it goes up as dust each push, so the pile gets smaller on its way.
            w.sfx = "sweep";
            if (rnd(7)) n++;
            else dust.push({ x: k, y: j, vx: 0.4 + Math.random(), life: 3 + rnd(4) });
          }
      // Stack them on the pile at `into`, the rest spill over it to the right.
      for (let col = into; n > 0 && col < W; col++)
        for (let j = H - 1; j >= 0 && n > 0; j--) if (!g[j][col]) { g[j][col] = true; n--; }
      if (rnd(2)) dust.push({ x: into, y: 13, vx: 0.6 + Math.random(), life: 3 + rnd(3) });
    };
    function* frame(): Frames {
      for (let k = dust.length - 1; k >= 0; k--) {
        const d = dust[k];
        d.x += d.vx;
        d.y -= 0.4;
        if (--d.life <= 0) dust.splice(k, 1);
      }
      draw();
      yield;
    }
    /** Plays a kit animation (walking, the box) through frame(), so the sand and dust stay on the screen. */
    function* run(an: Frames): Frames {
      while (!an.next().done) yield* frame();
    }

    // The digits go sand-yellow, and run down into heaps.
    w.sfx = "crumble";
    yield* wait(2);
    for (const c of order)
      w.slots[c.i].s = fromGrid(DIGITS[c.from].rows.map((r) => r.split("").map((ch) => (ch === "." ? "." : "c"))));
    yield* wait(5);
    for (const c of order) {
      DIGITS[c.from].rows.forEach((r, j) => { for (let k = 0; k < 7; k++) if (r.charAt(k) !== ".") g[DIGIT_Y + j][DIGIT_X[c.i] + k] = true; });
      w.slots[c.i].hidden = true;
    }
    for (let t = 0; t < 40 && fall(); t++) yield* frame();
    // He looks: what was that? Then off to the box for the broom.
    w.sfx = "boing";
    w.man.frame = LOOK_UP;
    yield* run(wait(6));
    w.man.frame = FRONT;
    yield* run(wait(3));
    yield* run(fetchTool(w, BROOM));

    // Round to the left of the sand, and sweep it all to the right: a push of three pixels, the broom back one.
    const [left] = span();
    yield* run(walkTo(w, left - TWIG_L));
    w.carry = null;
    w.man.dir = 1;
    let legs = 0;
    w.man.frame = BROOM_R[0];
    yield* frame();
    for (let guard = 0; guard < 120 && span()[1] >= 0 && span()[0] < 73; guard++) {
      for (let k = 0; k < 3; k++) {
        w.man.x++;
        push(0, w.man.x + TWIG_R);
        for (let f = 0; f < 4; f++) fall(); // the pile ahead of the broom slumps into a slope
      }
      w.man.frame = BROOM_R[++legs % 2];
      yield* frame();
      w.man.x--;
      w.man.frame = BROOM_R[++legs % 2];
      fall();
      yield* frame();
    }
    for (const r of g) for (let k = 0; k < W; k++) r[k] = false;
    while (dust.length) yield* frame();

    // The broom goes back in the box (he is right by it), and he goes home to watch.
    w.man.frame = FRONT;
    w.man.dir = 0;
    yield* run(putBack(w, BROOM));
    w.man.frame = LOOK_UP;

    // The pour: a stream over each new digit, down to its lowest unfilled pixel; they fill from the bottom row up.
    w.sfx = "sweep";
    const jobs = order.map((c) => {
      const todo: [number, number][] = [];
      DIGITS[c.to].rows.forEach((r, j) => { for (let k = 0; k < 7; k++) if (r.charAt(k) !== ".") todo.push([k, j]); });
      todo.sort((a, b) => b[1] - a[1] || Math.random() - 0.5);
      const slot = w.slots[c.i];
      slot.hidden = false;
      const fill = blank(7, 12);
      slot.s = fromGrid(fill);
      return { c, slot, todo, fill, n: 0, stream: { x: DIGIT_X[c.i] + 3, from: 0, to: -1 } };
    });
    streams = jobs.map((j) => j.stream);
    for (let y = 0; y <= DIGIT_Y + 11; y += 3) { for (const j of jobs) j.stream.to = y; yield* frame(); }
    while (jobs.some((j) => j.n < j.todo.length)) {
      for (const j of jobs) {
        for (let m = j.n; m < Math.min(j.todo.length, j.n + 3); m++) j.fill[j.todo[m][1]][j.todo[m][0]] = "c";
        j.n = Math.min(j.todo.length, j.n + 3);
        j.slot.s = fromGrid(j.fill);
        j.stream.to = DIGIT_Y + j.todo[Math.max(0, j.n - 1)][1];
      }
      yield* frame();
    }
    // The last grains: the streams run dry from the top.
    while (jobs.some((j) => j.stream.from < j.stream.to)) { for (const j of jobs) j.stream.from += 4; yield* frame(); }
    streams = [];
    yield* frame();
    // They set: grain by grain the sand goes white.
    w.sfx = "magic";
    for (const j of jobs) j.todo.sort(() => Math.random() - 0.5);
    for (let n = 0; jobs.some((j) => n < j.todo.length); n += 5) {
      for (const j of jobs) {
        for (let m = n; m < Math.min(j.todo.length, n + 5); m++) j.fill[j.todo[m][1]][j.todo[m][0]] = "#";
        j.slot.s = fromGrid(j.fill);
      }
      yield* frame();
    }
    for (const j of jobs) j.slot.s = null;
    w.fx = null;
    yield* wait(4);
    w.man.frame = FRONT;
    yield* wait(2);
  },
};
