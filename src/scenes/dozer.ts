// Bulldozer + dump truck: he walks off to the right and comes back driving a little yellow bulldozer. Its blade
// catches the changing digits from the right and shoves them, piling up against each other, off the left edge. Then he
// drives in a dump truck from the left with the new digits in its bed; it stops, tips the bed, and the digits hop out one
// by one into their places. The truck drives off, and he walks back home on foot.
import { blank, fromGrid } from "../gfx";
import { DIGITS, DIGIT_X, FRONT, HANDS_UP, HOME_X } from "../art";
import { walkTo, rnd, wait, type Frames, type Scene } from "./kit";

/** The bulldozer, facing left, 15x10: blade at the left, him in the cab, the tracks below (two frames, rolling). */
const DOZER = (roll: number) => [
  "......qqqqqq...",
  "......qhhh.q.q.",
  "......hhhhhq.q.",
  "mm.....oooqq.q.",
  "mm.yyyyyyyyyyy.",
  "mmyyyyyyyyyyyyy",
  "mm.yyyyyyyyyyyy",
  "..qqqqqqqqqqqqq",
  roll ? ".q.m.q.m.q.m.q." : ".m.q.m.q.m.q.m.",
  "..qqqqqqqqqqqqq",
];
const DOZER_Y = 5;
/**
 * The dump truck, facing right, 18x9: the red bed at the left (its load drawn apart), the cab at the right with him
 * in it, the wheels (two frames, turning).
 */
const TRUCK = (roll: number) => [
  "...........qqqqq..",
  "...........qhhhq..",
  "...........qoooqq.",
  "...........qqqqqqq",
  "qqqqqqqqqqqqeeeeeq",
  "qqqqqqqqqqqqeeeeeq",
  roll ? "..qmq.....qmq.qmq." : "..mqm.....mqm.mqm.",
  roll ? "..mqm.....mqm.mqm." : "..qmq.....qmq.qmq.",
  "..qmq.....qmq.qmq.",
];
const TRUCK_Y = 6;
const BED_W = 10;

export const dozer: Scene = {
  id: "dozer",
  name: "Roadworks",
  tier: "hour",
  play: function* (w, changes) {
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    /** The vehicle on screen: which, its left column, how far it moves by the next step. */
    let car: { kind: "dozer" | "truck"; x: number; v: number } | null = null;
    /** The truck's bed: how far it is tipped (0 down .. 1 up), and how many digits are still in it. */
    let tip = 0, load = 0;
    const puffs: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    let tick = 0;
    const pic = (t: number) => {
      const g = blank(72, 16);
      const set = (x: number, y: number, c: string) => { if (x >= 0 && x < 72 && y >= 0 && y < 16) g[y][x] = c; };
      for (const p of puffs) set(Math.round(p.x + p.vx * t), Math.round(p.y + p.vy * t), "d");
      if (car) {
        const x0 = Math.round(car.x + car.v * t), roll = car.v ? Math.floor(tick / 1) % 2 : 0;
        if (car.kind === "dozer")
          DOZER(roll).forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r.charAt(i) !== ".") set(x0 + i, DOZER_Y + j, r.charAt(i)); });
        else {
          TRUCK(roll).forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r.charAt(i) !== ".") set(x0 + i, TRUCK_Y + j, r.charAt(i)); });
          // The bed, hinged at its back end (its left), its front lifted by `tip`; the load heaped in it.
          for (let i = 0; i < BED_W; i++) {
            const lift = Math.round(((BED_W - 1 - i) === 0 ? 0 : 0) + tip * i * 0.7);
            const y = TRUCK_Y + 3 - lift;
            set(x0 + i, y, "x");
            set(x0 + i, y - 1, i === 0 || i === BED_W - 1 ? "x" : load && i > 1 && i < BED_W - 2 && (i + load) % 3 ? "#" : ".");
            set(x0 + i, y - 2, i === 0 || i === BED_W - 1 ? "x" : load > 1 && i > 2 && i < BED_W - 3 ? "#" : ".");
            if (i === 0 || i === BED_W - 1) set(x0 + i, y - 2, "x");
          }
          if (tip) for (let y = TRUCK_Y + 3 - Math.round(tip * 3); y < TRUCK_Y + 4; y++) set(x0 + 6, y, "m"); // the ram
        }
      }
      return { s: fromGrid(g), x: 0, y: 0 };
    };
    function* frame(): Frames {
      tick++;
      if (car && car.v && tick % 2 === 0) {
        const ex = car.kind === "dozer" ? car.x + 13 : car.x + 17;
        puffs.push({ x: ex, y: car.kind === "dozer" ? DOZER_Y : TRUCK_Y + 3, vx: car.v > 0 ? -0.3 : 0.3, vy: -0.5, life: 5 + rnd(4) });
      }
      for (let k = puffs.length - 1; k >= 0; k--) {
        const p = puffs[k];
        p.x += p.vx; p.y += p.vy;
        if (--p.life <= 0) puffs.splice(k, 1);
      }
      w.front = { ...pic(0), at: pic };
      yield;
      if (car) car.x += car.v;
    }

    // He walks off to the right...
    yield* walkTo(w, 80);
    yield* wait(4);

    // ...and comes back in the bulldozer. It rolls up to the rightmost changing digit and shoves.
    const order = changes.slice().sort((a, b) => b.i - a.i);
    car = { kind: "dozer", x: 74, v: -2 };
    const right = (i: number) => DIGIT_X[i] + 7 + w.slots[i].dx; // a digit's right edge, where it is now
    while (car.x + car.v > right(order[0].i)) { if (tick % 4 === 0) w.sfx = "crane"; yield* frame(); }
    car.v = right(order[0].i) - car.x;
    yield* frame();
    w.sfx = "thud";
    w.shake.x = -1;
    car.v = 0;
    yield* frame();
    w.shake.x = 0;
    yield* frame();
    // Shoving: each digit is pushed by the blade or by the digit to its right, a pixel a step, wobbling a little.
    car.v = -1;
    while (car.x > -16) {
      let edge = car.x + car.v; // the blade, by the next step
      for (const c of order) {
        const s = w.slots[c.i];
        if (DIGIT_X[c.i] + 7 + s.dx > edge) {
          const was = s.dx;
          s.dx = edge - 7 - DIGIT_X[c.i];
          s.dy = rnd(4) === 0 ? -1 : 0;
          if (was !== s.dx && rnd(3) === 0) w.sfx = "crumble";
        }
        edge = DIGIT_X[c.i] + s.dx; // its left edge pushes the next one
      }
      if (!w.sfx && tick % 4 === 0) w.sfx = "crane";
      yield* frame();
    }
    for (const c of changes) { const s = w.slots[c.i]; s.hidden = true; s.dx = s.dy = 0; }
    car = null;
    while (puffs.length) yield* frame();
    yield* wait(4);

    // The dump truck with the new digits, in from the left; it stops right of the digits and tips its bed.
    load = changes.length;
    car = { kind: "truck", x: -20, v: 2 };
    const stop = DIGIT_X[3] + 9;
    while (car.x + car.v < stop) { if (tick % 4 === 0) w.sfx = "crane"; yield* frame(); }
    car.v = stop - car.x;
    yield* frame();
    car.v = 0;
    yield* frame();
    w.sfx = "ratchet";
    for (const k of [0.25, 0.5, 0.75, 1]) { tip = k; yield* frame(); }
    // Out they hop, one by one, the nearest first, each in an arc to its place.
    for (const c of order) {
      const s = w.slots[c.i];
      s.s = DIGITS[c.to];
      s.hidden = false;
      const fromX = stop - 4 - DIGIT_X[c.i], fromY = -2;
      const N = 8;
      w.sfx = "boing";
      load--;
      for (let k = 0; k <= N; k++) {
        const u = k / N;
        s.dx = Math.round(fromX * (1 - u));
        s.dy = Math.round(fromY * (1 - u) - 10 * 4 * u * (1 - u));
        yield* frame();
      }
      w.sfx = "thud";
      w.shake.y = 1;
      s.dy = -1; yield* frame();
      w.shake.y = 0;
      s.dy = 0; s.dx = 0; yield* frame();
      s.s = null;
    }
    for (const k of [0.75, 0.5, 0.25, 0]) { tip = k; yield* frame(); }
    yield* frame();
    // Off it goes to the right, and he walks back home.
    car.v = 2;
    while (car.x < 74) { if (tick % 4 === 0) w.sfx = "crane"; yield* frame(); }
    car = null;
    while (puffs.length) yield* frame();
    w.front = null;
    yield* walkTo(w, HOME_X);
    w.man.frame = HANDS_UP;
    w.man.dy = -1; yield* wait(2);
    w.man.dy = 0; yield* wait(6);
    w.man.frame = FRONT;
    yield* wait(2);
  },
};
