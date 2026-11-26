// Rocket: he takes a bundle of little rockets out of the box and straps one to the foot of every changing digit. Back
// home he counts down, 3, 2, 1, hands over his ears: the rockets light, the clock shakes, and the digits lift off and
// shoot up out of the screen in smoke. Then the new digits come down from the sky, slowing on their own retro flames,
// and touch down softly in a puff of dust.
import { sprite, blank, fromGrid } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, FRONT, HANDS_UP, HOME_X, LOOK_UP, MAN_Y, WORK_L } from "../art";
import { fetchTool, putBack, walkTo, rnd, wait, type Frames, type Scene } from "./kit";

/** One rocket, 3x5: red nose, white body, red fins, nozzle at the bottom. */
const ROCKET_FULL = [".x.", "rrr", "rar", "rrr", "xmx"];
/** The bundle of rockets as he carries it. */
const BUNDLE = sprite(["x.x", "rrr", "rrr", "xmx"]);
/** The countdown, 3x5, shown in yellow up by the box. */
const COUNT: Record<number, string[]> = {
  3: ["yyy", "..y", "yyy", "..y", "yyy"],
  2: ["yyy", "..y", "yyy", "y..", "yyy"],
  1: [".y.", "yy.", ".y.", ".y.", "yyy"],
};
/** Hands over his ears, eyes shut. */
const EARS = sprite(["..hhh..", ".hhhhhh", "ooooooo", "oo...oo", "b.ooo.b", ".bbbbb.", "..bbb..", "..bbb..", "..ppp..", "..p.p..", "..p.p..", ".ss.ss."]);

interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  c: string;
}

export const rocket: Scene = {
  id: "rocket",
  name: "Liftoff",
  tier: "hour",
  play: function* (w, changes) {
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    /** Slots with a rocket strapped on; the rocket goes where the digit goes. */
    const strapped: number[] = [];
    /** Slots whose rocket (or retro flame) is firing. */
    const firing: number[] = [];
    /** For each slot, how far its digit moves by the next step (the rocket and flame glide with it). */
    const vy: number[] = [0, 0, 0, 0];
    let count: number | null = null;
    const puffs: Puff[] = [];
    let tick = 0;
    const pic = (t: number) => {
      const g = blank(72, 16);
      const set = (x: number, y: number, c: string) => { if (x >= 0 && x < 72 && y >= 0 && y < 15) g[y][x] = c; };
      for (const p of puffs) set(Math.round(p.x + p.vx * t), Math.round(p.y + p.vy * t), p.c);
      for (const i of strapped) {
        const y0 = DIGIT_Y + w.slots[i].dy + Math.trunc(vy[i] * t) + 8, x0 = DIGIT_X[i] + 2;
        ROCKET_FULL.forEach((r, j) => { for (let k = 0; k < 3; k++) if (r.charAt(k) !== ".") set(x0 + k, y0 + j, r.charAt(k)); });
      }
      for (const i of firing) {
        // The flame under the rocket, or under the landing digit.
        const bottom = DIGIT_Y + w.slots[i].dy + Math.trunc(vy[i] * t) + 12 + (strapped.indexOf(i) >= 0 ? 1 : 0);
        const x0 = DIGIT_X[i] + 2;
        const len = 2 + ((tick + i) % 2);
        for (let j = 0; j < len; j++) for (let k = 0; k < 3; k++) if (k === 1 || j === 0) set(x0 + k, bottom + j, j === 0 ? "y" : (tick + j) % 2 ? "f" : "x");
      }
      if (count !== null) COUNT[count].forEach((r, j) => { for (let k = 0; k < 3; k++) if (r.charAt(k) !== ".") set(61 + k, 2 + j, "y"); });
      return { s: fromGrid(g), x: 0, y: 0 };
    };
    function* frame(): Frames {
      tick++;
      for (let k = puffs.length - 1; k >= 0; k--) {
        const p = puffs[k];
        p.x += p.vx; p.y += p.vy; p.vx *= 0.85; p.vy *= 0.85;
        if (--p.life <= 0) puffs.splice(k, 1);
      }
      w.fx = { ...pic(0), at: pic };
      yield;
      for (let i = 0; i < 4; i++) { w.slots[i].dy += vy[i]; }
    }
    function* hold(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }
    function* run(g: Frames): Frames {
      while (!g.next().done) yield* frame();
    }
    const smoke = (x: number, y: number, n: number, spread = 2) => {
      for (let k = 0; k < n; k++)
        puffs.push({ x: x + rnd(3), y, vx: (Math.random() - 0.5) * spread, vy: -Math.random() * 0.4, life: 8 + rnd(10), c: rnd(3) ? "d" : "q" });
    };

    // The rockets from the box; one strapped to each digit, right to left.
    yield* run(fetchTool(w, BUNDLE));
    const order = changes.slice().sort((a, b) => b.i - a.i);
    for (const c of order) {
      yield* run(walkTo(w, DIGIT_X[c.i] + 9));
      w.carry = null;
      w.man.dir = -1;
      w.man.frame = WORK_L;
      w.hand = { x: DIGIT_X[c.i] + 6, y: MAN_Y + 8, c: "o" };
      yield* hold(2);
      strapped.push(c.i);
      w.sfx = "ratchet";
      yield* hold(3);
      w.hand = null;
      w.carry = BUNDLE;
    }
    yield* run(putBack(w, BUNDLE));

    // The countdown.
    w.man.frame = FRONT;
    w.man.dir = 0;
    for (const n of [3, 2, 1]) {
      count = n;
      w.sfx = "beep";
      yield* hold(6);
      count = null;
      yield* hold(2);
    }
    // Ignition!
    w.man.frame = EARS;
    for (const c of changes) firing.push(c.i);
    w.sfx = "fire";
    for (let k = 0; k < 10; k++) {
      w.shake.x = rnd(3) - 1;
      for (const c of changes) smoke(DIGIT_X[c.i] + 2, 14, 2, 3);
      if (k % 3 === 0) w.sfx = "fire";
      yield* frame();
    }
    w.shake.x = 0;
    // Liftoff: slow, then faster and faster, a trail of smoke behind.
    w.sfx = "boom";
    let v = 0;
    while (changes.some((c) => w.slots[c.i].dy > -24)) {
      v = Math.min(v + 0.6, 4);
      for (const c of changes) {
        vy[c.i] = -Math.round(v);
        smoke(DIGIT_X[c.i] + 2, DIGIT_Y + w.slots[c.i].dy + 14, 1, 1);
      }
      if (tick % 3 === 0) w.sfx = "fire";
      yield* frame();
    }
    for (const c of changes) { vy[c.i] = 0; w.slots[c.i].hidden = true; w.slots[c.i].dy = 0; }
    strapped.length = 0;
    firing.length = 0;
    w.man.frame = LOOK_UP;
    while (puffs.length) yield* frame();
    yield* hold(4);

    // The new digits come down on their retro flames, slowing, and touch down softly.
    const land = changes.slice().sort((a, b) => a.i - b.i);
    land.forEach((c, k) => {
      const s = w.slots[c.i];
      s.s = DIGITS[c.to];
      s.dy = -16 - k * 6;
      s.hidden = false;
    });
    while (land.some((c) => w.slots[c.i].dy < 0)) {
      for (const c of land) {
        const dy = w.slots[c.i].dy;
        // Fast high up, slow near the floor.
        vy[c.i] = dy >= 0 ? 0 : Math.min(-dy, dy < -10 ? 3 : dy < -4 ? 2 : 1);
        const on = dy < 0 && dy > -16;
        if (on && firing.indexOf(c.i) < 0) firing.push(c.i);
        if (!on && firing.indexOf(c.i) >= 0) firing.splice(firing.indexOf(c.i), 1);
        if (dy === -1) { smoke(DIGIT_X[c.i] + 2, 14, 6, 4); w.sfx = "thud"; }
      }
      if (!w.sfx && tick % 3 === 0) w.sfx = "fire";
      yield* frame();
    }
    for (const c of land) vy[c.i] = 0;
    firing.length = 0;
    while (puffs.length) yield* frame();
    for (const c of land) w.slots[c.i].s = null;
    w.fx = null;
    w.man.frame = HANDS_UP;
    w.man.dy = -1; yield* wait(2);
    w.man.dy = 0; yield* wait(6);
    w.man.frame = FRONT;
    yield* walkTo(w, HOME_X);
    yield* wait(2);
  },
};
