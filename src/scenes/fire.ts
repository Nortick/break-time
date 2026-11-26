// Fire: the digit catches fire, burns from where it was lit, the burnt pixels char and fall as ash into a little pile
// on the floor. Then the phoenix: the pile glows, sparks fly up out of it into the shape of the new digit, red-hot,
// and it cools to white like metal after the forge.
//   lighter — minute: he lights the digit's corner with a lighter (two digits: the tens first, then the minutes).
//   flamer  — hour: a flamethrower, one long jet that sets every changing digit alight at once.
import { blank, fromGrid, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, FRONT, HANDS_UP, LOOK_UP, WORK_L, LIGHTER, FLAMER } from "../art";
import { type Placed, type World } from "../world";
import { pose14, art14, LEGS, fetchTool, putBack, walkTo, canvasX, canvasY, rnd, wait, layer, type Change, type Frames, type Scene } from "./kit";

const FLOOR = 14;
const INTACT = 1, BURNING = 2, EMBER = 3;

interface Cell {
  state: number;
  t: number;
  /** Whether the old digit had a pixel here (burnt or not). */
  fuel: boolean;
}
/** Whether the cell at (a, b) was part of the digit: fire creeps only along the digit, not across empty space. */
const DIGITS_HAD = (g: Cell[][], a: number, b: number) => g[b][a].fuel;
interface Ash {
  x: number;
  y: number;
  vy: number;
}
interface Spark {
  x: number;
  y: number;
  tx: number;
  ty: number;
  delay: number;
}

/** The fire, the ash and the phoenix for a set of digit slots, all on the World's effect layer. */
class Fire {
  private cells: Record<number, Cell[][]> = {};
  private ash: Ash[] = [];
  /** Ash lying on the floor: how many grains in each column. */
  private pile: number[] = [];
  private sparks: Spark[] = [];
  /** A digit being born: how hot each of its pixels is (-1: not there yet), by slot. */
  private hot: Record<number, number[][]> = {};
  private w: World;
  /** A sound for this step (see World.sfx). */
  cue(name: string): void {
    this.w.sfx = name;
  }
  constructor(w: World) {
    this.w = w;
    for (let x = 0; x < 72; x++) this.pile.push(0);
  }

  /** The slot's old digit as fuel. */
  add(c: Change): void {
    this.cells[c.i] = DIGITS[c.from].rows.map((r) => r.split("").map((ch) => ({ state: ch === "." ? 0 : INTACT, t: 0, fuel: ch !== "." })));
  }

  /** Sets fire to the slot's intact pixel nearest (col, row) of the digit. */
  ignite(i: number, col: number, row: number): void {
    const g = this.cells[i];
    let best: Cell | null = null, bd = 1e9;
    g.forEach((r, j) => r.forEach((c, k) => {
      const d = Math.abs(k - col) + Math.abs(j - row);
      if (c.state === INTACT && d < bd) { bd = d; best = c; }
    }));
    if (best) { (best as Cell).state = BURNING; (best as Cell).t = 3 + rnd(3); }
  }

  /** Whether anything is still burning, smouldering or falling. */
  get burning(): boolean {
    if (this.ash.length) return true;
    for (const i of Object.keys(this.cells)) for (const r of this.cells[+i]) for (const c of r) if (c.state !== 0) return true;
    return false;
  }

  /** Whether the slot still has a pixel that has not caught fire. */
  intact(i: number): boolean {
    return this.cells[i] ? this.cells[i].some((r) => r.some((c) => c.state === INTACT)) : false;
  }

  /** One frame: fire spreads (mostly upwards), burnt pixels smoulder and drop as ash, ash falls onto the pile. */
  step(): void {
    for (const key of Object.keys(this.cells)) {
      const i = +key, g = this.cells[i], x0 = DIGIT_X[i];
      const catching: Cell[] = [];
      g.forEach((r, j) => r.forEach((c, k) => {
        if (c.state === BURNING) {
          const near: [number, number, number][] = [[k, j - 1, 0.5], [k - 1, j, 0.3], [k + 1, j, 0.3], [k, j + 1, 0.15]];
          for (const [a, b, p] of near) {
            const n = g[b] && g[b][a];
            if (n && n.state === INTACT && Math.random() < p) catching.push(n);
          }
          if (--c.t <= 0) { c.state = EMBER; c.t = 2 + rnd(4); }
        } else if (c.state === EMBER && --c.t <= 0) {
          c.state = 0;
          this.ash.push({ x: x0 + k, y: DIGIT_Y + j, vy: 0.3 });
        }
      }));
      for (const c of catching) if (c.state === INTACT) { c.state = BURNING; c.t = 3 + rnd(3); }
      // If the fire went out with fuel left, it creeps on from a burnt-out neighbour: the whole digit always burns.
      if (!g.some((r) => r.some((c) => c.state === BURNING))) {
        const next: Cell[] = [];
        g.forEach((r, j) => r.forEach((c, k) => {
          if (c.state !== INTACT) return;
          for (const [a, b] of [[k, j - 1], [k - 1, j], [k + 1, j], [k, j + 1]]) {
            const n = g[b] && g[b][a];
            if (n && n.state !== INTACT && DIGITS_HAD(g, a, b)) { next.push(c); break; }
          }
        }));
        if (next.length) { const c = next[rnd(next.length)]; c.state = BURNING; c.t = 3 + rnd(3); }
      }
    }
    for (let k = this.ash.length - 1; k >= 0; k--) {
      const a = this.ash[k];
      a.vy = Math.min(a.vy + 0.25, 1.5);
      a.y += a.vy;
      if (rnd(3) === 0) a.x += rnd(3) - 1;
      if (a.y >= FLOOR - (this.pile[Math.round(a.x)] >= 3 ? 1 : 0)) {
        this.pile[Math.max(0, Math.min(71, Math.round(a.x)))]++;
        this.ash.splice(k, 1);
      }
    }
    // The phoenix: sparks fly to their pixels; a pixel that has its spark heats up, then cools.
    for (let k = this.sparks.length - 1; k >= 0; k--) {
      const s = this.sparks[k];
      if (s.delay > 0) { s.delay--; continue; }
      const dx = s.tx - s.x, dy = s.ty - s.y;
      if (Math.abs(dx) + Math.abs(dy) <= 1.5) {
        for (const key of Object.keys(this.hot)) {
          const i = +key, x0 = DIGIT_X[i];
          if (s.tx >= x0 && s.tx < x0 + 7) this.hot[i][s.ty - DIGIT_Y][s.tx - x0] = 0;
        }
        this.sparks.splice(k, 1);
      } else {
        s.x += Math.sign(dx) * Math.min(Math.abs(dx), 1 + rnd(2) * 0.5);
        s.y += Math.sign(dy) * Math.min(Math.abs(dy), 1.5);
      }
    }
    for (const key of Object.keys(this.hot)) for (const r of this.hot[+key]) for (let k = 0; k < r.length; k++) if (r[k] >= 0) r[k]++;
  }

  /** Starts the phoenix for these slots: one spark from the slot's ash for every pixel of the new digit. */
  rise(changes: Change[]): void {
    for (const c of changes) {
      const x0 = DIGIT_X[c.i];
      this.hot[c.i] = DIGITS[c.to].rows.map((r) => r.split("").map(() => -1));
      const targets: [number, number][] = [];
      DIGITS[c.to].rows.forEach((r, j) => { for (let k = 0; k < r.length; k++) if (r.charAt(k) !== ".") targets.push([k, j]); });
      // Bottom pixels first, so the digit is built up from the pile.
      targets.sort((a, b) => b[1] - a[1] + (Math.random() - 0.5) * 6);
      targets.forEach(([k, j], n) => {
        this.sparks.push({ x: x0 + rnd(7), y: FLOOR, tx: x0 + k, ty: DIGIT_Y + j, delay: Math.floor(n / 2) });
      });
    }
  }

  /** Whether the new digits are all there and cooled down. */
  get risen(): boolean {
    if (this.sparks.length) return false;
    for (const key of Object.keys(this.hot)) for (const r of this.hot[+key]) for (const h of r) if (h >= 0 && h < 12) return false;
    return true;
  }

  /** Puts it all on the display: the slots' pictures, and flames, ash, pile and sparks on the effect layer. */
  draw(): void {
    const w = this.w;
    for (const key of Object.keys(this.cells)) {
      const i = +key, slot = w.slots[i];
      if (this.hot[i]) continue;
      slot.s = fromGrid(this.cells[i].map((r) => r.map((c) =>
        c.state === INTACT ? "#" : c.state === BURNING ? (rnd(2) ? "y" : "f") : c.state === EMBER ? (c.t > 1 ? "x" : "q") : ".",
      )));
    }
    for (const key of Object.keys(this.hot)) {
      const i = +key;
      // Cooled down: the new digit's own color (white on the clock; the focus timer bakes others).
      const ink = DIGITS[w.slots[i].value].rows.join("").replace(/\./g, "").charAt(0) || "#";
      w.slots[i].s = fromGrid(this.hot[i].map((r) => r.map((h) => (h < 0 ? "." : h < 3 ? "x" : h < 6 ? "f" : h < 9 ? "y" : ink))));
    }
    w.fx = layer((t) => this.layer(t));
  }

  /** The effect layer t of the way to the next step: ash and sparks on their way, the flames as they are now. */
  private layer(t: number): Placed | null {
    const g = blank(72, 16);
    let lo = 72, hi = -1;
    const put = (x: number, y: number, c: string) => {
      const X = Math.round(x), Y = Math.round(y);
      if (X < 0 || X >= 72 || Y < 0 || Y >= 16) return;
      g[Y][X] = c;
      if (X < lo) lo = X;
      if (X > hi) hi = X;
    };
    // Flame tongues above the burning pixels, where the digit has none.
    for (const key of Object.keys(this.cells)) {
      const i = +key, cg = this.cells[i];
      if (this.hot[i]) continue;
      cg.forEach((r, j) => r.forEach((c, k) => {
        if (c.state !== BURNING) return;
        for (let up = 1; up <= 1 + rnd(2); up++) {
          const above = cg[j - up] && cg[j - up][k];
          if (!above || above.state === 0) put(DIGIT_X[i] + k + (up > 1 ? rnd(3) - 1 : 0), DIGIT_Y + j - up, up > 1 ? "y" : "f");
        }
      }));
    }
    for (const a of this.ash) put(a.x, a.y + Math.min(a.vy + 0.25, 1.5) * t, "q");
    const glowing = this.sparks.length > 0;
    this.pile.forEach((n, x) => {
      if (n > 0) put(x, FLOOR, glowing && rnd(3) === 0 ? "x" : "q");
      if (n >= 3) put(x, FLOOR - 1, glowing && rnd(3) === 0 ? "f" : "q");
    });
    for (const s of this.sparks) {
      if (s.delay > 0) continue;
      const dx = s.tx - s.x, dy = s.ty - s.y;
      const go = Math.abs(dx) + Math.abs(dy) <= 1.5 ? 0 : t;
      put(s.x + Math.sign(dx) * Math.min(Math.abs(dx), 1.25) * go, s.y + Math.sign(dy) * Math.min(Math.abs(dy), 1.5) * go, rnd(2) ? "y" : "f");
    }
    return hi < 0 ? null : { s: fromGrid(g.map((r) => r.slice(lo, hi + 1))), x: lo, y: 0 };
  }

  /** The pile goes as the sparks leave it: a share of every column's ash is left each frame. */
  usePile(share: number): void {
    for (let x = 0; x < 72; x++) if (this.pile[x] > 0 && Math.random() > share) this.pile[x]--;
  }

  /** Done: the slots show their digits again. */
  clear(changes: Change[]): void {
    for (const c of changes) {
      delete this.cells[c.i];
      delete this.hot[c.i];
    }
    for (let x = 0; x < 72; x++) this.pile[x] = 0;
  }
}

/** Burns everything that is lit until it is ash on the floor, then raises the new digits out of it. */
function* burnAndRise(fire: Fire, changes: Change[]): Frames {
  for (let t = 0; t < 150 && fire.burning; t++) { fire.cue("fire"); fire.step(); fire.draw(); yield; }
  for (let t = 0; t < 4; t++) { fire.draw(); yield; }
  fire.rise(changes);
  fire.cue("magic");
  for (let t = 0; t < 120 && !fire.risen; t++) {
    fire.usePile(0.85);
    fire.step();
    fire.draw();
    yield;
  }
  fire.clear(changes);
  fire.draw(); // nothing left: the effect layer empties
}

// THE LIGHTER. He stands 9 right of the digit: canvas column 4 is the digit's right column. Arm down, the lighter in
// his hand at the digit's bottom corner; off, and lit (flame flickering).
const STAND_L = 9;
const LIGHTER_ART = [[8, 9, "b"], [7, 10, "o"], [6, 10, "x"], [5, 10, "m"]] as [number, number, string][];
const LIGHTER_OFF = pose14(art14(LIGHTER_ART));
const LIGHTER_ON = [
  pose14(art14([...LIGHTER_ART, [5, 9, "f"], [5, 8, "y"]])),
  pose14(art14([...LIGHTER_ART, [5, 9, "y"], [4, 8, "f"]])),
];

/**
 * The lighter from the box: he lights the digit's bottom corner and the fire spreads. With two digits he lights the
 * tens first and, while they catch, steps over and lights the minutes too; then both burn down and rise again.
 */
export const lighter: Scene = {
  id: "lighter",
  name: "Lighter",
  tier: "minute",
  play: function* (w, changes) {
    const order = changes.slice().sort((a, b) => a.i - b.i); // tens first
    const fire = new Fire(w);
    let lit = false;
    /** The fire keeps burning while he does anything else. */
    function* run(g: Frames): Frames {
      while (!g.next().done) {
        if (lit) { fire.step(); fire.draw(); w.sfx = "fire"; }
        yield;
      }
    }
    yield* fetchTool(w, LIGHTER);
    for (const c of order) {
      fire.add(c);
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    for (const c of order) {
      w.carry = LIGHTER;
      yield* run(walkTo(w, DIGIT_X[c.i] + STAND_L));
      w.carry = null;
      w.man.dir = -1;
      w.man.frame = LIGHTER_OFF;
      yield* run(wait(3));
      // Click: a spark, a second click, and it lights.
      if (!lit) w.fx = { s: { w: 1, h: 1, rows: ["y"] }, x: canvasX(w.man.x, 5), y: canvasY(9) };
      w.sfx = "crack";
      yield* run(wait(1));
      if (!lit) w.fx = null;
      yield* run(wait(2));
      for (let t = 0; t < 6; t++) { w.man.frame = LIGHTER_ON[t % 2]; yield* run(wait(1)); }
      fire.ignite(c.i, 6, 11);
      lit = true;
      w.sfx = "fire";
      for (let t = 0; t < 3; t++) { w.man.frame = LIGHTER_ON[t % 2]; yield* run(wait(1)); }
      w.man.frame = WORK_L;
      yield* run(wait(2));
    }
    // Lighter shut, he watches it burn.
    yield* burnAndRise(fire, order);
    for (const c of order) { const s = w.slots[c.i]; s.s = null; s.dx = s.dy = 0; s.hidden = false; }
    w.fx = null;
    yield* wait(3);
    w.man.frame = FRONT;
    yield* putBack(w, LIGHTER);
  },
};

// THE FLAMETHROWER. Held at the hip: the red tank, the barrel out in front, nozzle in column 1. He stands 12 right of a
// digit (canvas column 0 is the digit's column 5), so the flame goes into it.
const STAND_F = 12;
const FLAMER_ART = [[8, 8, "b"], [7, 8, "o"], [5, 8, "x"], [6, 8, "x"], [5, 9, "x"], [6, 9, "x"], [4, 8, "m"], [3, 8, "m"], [2, 8, "m"], [1, 8, "m"]] as [number, number, string][];
const FLAMER_POSE = LEGS.map((l) => pose14(art14(FLAMER_ART), l));

/** The stream of fire out of the nozzle at (nx, ny), to the left, `len` long: a flickering tongue, widening. */
function stream(nx: number, ny: number, len: number): { s: Sprite; x: number; y: number } {
  const g = blank(len, 5);
  for (let k = 0; k < len; k++) {
    const spread = k < 2 ? 0 : k < 5 ? 1 : 2;
    for (let d = -spread; d <= spread; d++) if (rnd(4) > 0 || d === 0) g[2 + d][len - 1 - k] = rnd(3) ? "f" : k < 3 ? "y" : "x";
  }
  return { s: fromGrid(g), x: nx - len, y: ny - 2 };
}

export const flamer: Scene = {
  id: "flamer",
  name: "Flamethrower",
  tier: "hour",
  play: function* (w, changes) {
    const order = changes.slice().sort((a, b) => b.i - a.i);
    const fire = new Fire(w);
    for (const c of order) {
      fire.add(c);
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    /** How long the jet of fire is now; 0 when it is off. */
    let jet = 0;
    /** Whether the fire is going (it roars from the jet on, while the digits burn). */
    let burnt = false;
    /** One frame of the scene: the fire goes on burning whatever he is doing, the jet roars when it is on. */
    function* frame(): Frames {
      fire.step();
      fire.draw();
      if (burnt) w.sfx = "fire";
      if (jet) {
        const st = stream(canvasX(w.man.x, 1), canvasY(8), jet);
        // The fire has the effect layer, so the jet goes on the free item layer (it is only used at the box).
        w.item = st;
        w.shake.x = rnd(3) === 0 ? rnd(3) - 1 : 0;
      } else {
        w.item = null;
        w.shake.x = 0;
      }
      yield;
    }
    function* run(g: Frames): Frames {
      while (!g.next().done) yield* frame();
    }

    yield* run(fetchTool(w, FLAMER));
    // To the right of the rightmost digit, shuffling, the flamethrower at the hip.
    const to = DIGIT_X[order[0].i] + STAND_F;
    let step = 0;
    w.carry = null;
    while (w.man.x !== to) {
      w.man.x += to < w.man.x ? -1 : 1;
      w.man.frame = FLAMER_POSE[(++step >> 1) % 2];
      yield* frame();
    }
    w.man.frame = FLAMER_POSE[0];
    yield* frame();
    // One long jet, shooting out across every digit that changes: each one catches as the flame reaches it, and keeps
    // being lit while the jet holds.
    const nx = canvasX(w.man.x, 1);
    const far = nx - DIGIT_X[order[order.length - 1].i] + 1;
    jet = 3;
    burnt = true;
    for (let t = 0; t < 22; t++) {
      jet = Math.min(far, jet + 5);
      for (const c of order)
        if (nx - jet <= DIGIT_X[c.i] + 6 && fire.intact(c.i)) fire.ignite(c.i, rnd(7), 3 + rnd(7));
      yield* frame();
    }
    jet = 0;
    yield* frame();
    // The tool goes back while it all burns; he watches from home.
    w.carry = FLAMER;
    yield* run(putBack(w, FLAMER));
    w.man.frame = LOOK_UP;
    w.fx = null;
    yield* burnAndRise(fire, order);
    w.man.frame = HANDS_UP;
    w.sfx = "tada";
    w.man.dy = -1; yield* wait(2);
    w.man.dy = 0; yield* wait(6);
    w.man.frame = FRONT;
    for (const c of changes) { const s = w.slots[c.i]; s.s = null; s.dx = s.dy = 0; s.hidden = false; }
    yield* wait(2);
  },
};
