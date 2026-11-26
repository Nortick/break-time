// Hydraulic press: he takes the control box out of the box and works the levers. A press plate comes down from
// above on every changing digit and squashes it slowly into a flat pancake, the clock trembling. The plates go up; he
// switches the die (a click and a yellow light), and they come down again on the pancakes. Going up, they draw the
// new digits up out of the pancakes, like dough, and let go with a pop.
import { sprite, blank, fromGrid, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, FRONT, HANDS_UP, HOME_X, LOOK_UP_PAD, PAD } from "../art";
import { fetchTool, putBack, walkTo, rnd, wait, type Frames, type Scene } from "./kit";

/** The digit's bottom row: a squashed digit keeps its foot on the floor. */
const FOOT = DIGIT_Y + 11;

/**
 * The digit squashed to h rows (12 = as it is): each row is all the digit's rows it covers put together, so it reads
 * as a solid slab, not dots. Low ones spread a pixel each side, like a pancake.
 */
function squashed(s: Sprite, h: number): { s: Sprite; dx: number; dy: number } {
  if (h >= 12) return { s, dx: 0, dy: 0 };
  const rows: string[] = [];
  for (let k = 0; k < h; k++) {
    const a = Math.floor((k * 12) / h), b = Math.max(a + 1, Math.floor(((k + 1) * 12) / h));
    let r = "";
    for (let i = 0; i < 7; i++) {
      let on = false;
      for (let m = a; m < b; m++) if (s.rows[m].charAt(i) === "#") on = true;
      r += on ? "#" : ".";
    }
    rows.push(r);
  }
  if (h > 5) return { s: sprite(rows), dx: 0, dy: 12 - h };
  // Flat: spread out a pixel to each side.
  return { s: sprite(rows.map((r) => (r.charAt(0) === "#" ? "#" : ".") + r + (r.charAt(6) === "#" ? "#" : "."))), dx: -1, dy: 12 - h };
}

export const press: Scene = {
  id: "press",
  name: "Hydraulic press",
  tier: "hour",
  play: function* (w, changes) {
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    /** The plates' bottom row, and how far it moves by the next step; the die light. */
    let plate = -4, v = 0, die = false;
    const steam: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    let blink = 0;
    const pic = (t: number) => {
      const g = blank(72, 16);
      const set = (x: number, y: number, c: string) => { if (x >= 0 && x < 72 && y >= 0 && y < 16) g[y][x] = c; };
      for (const p of steam) set(Math.round(p.x + p.vx * t), Math.round(p.y + p.vy * t), "d");
      const pb = Math.round(plate + v * t);
      for (const c of changes) {
        const x0 = DIGIT_X[c.i];
        for (let y = 0; y <= pb - 3; y++) { set(x0 + 2, y, "m"); set(x0 + 4, y, "m"); set(x0 + 3, y, "r"); }
        for (let x = x0 - 1; x <= x0 + 7; x++) { set(x, pb - 2, "r"); set(x, pb - 1, "m"); set(x, pb, "q"); }
        if (die) set(x0 + 3, pb - 1, "y");
      }
      return { s: fromGrid(g), x: 0, y: 0 };
    };
    function* frame(): Frames {
      blink++;
      for (let k = steam.length - 1; k >= 0; k--) {
        const p = steam[k];
        p.x += p.vx; p.y += p.vy;
        if (--p.life <= 0) steam.splice(k, 1);
      }
      w.man.frame = LOOK_UP_PAD[v ? (blink >> 1) % 2 : 0];
      w.fx = { ...pic(0), at: pic };
      yield;
      plate += v;
    }
    function* hold(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }
    const puff = () => {
      for (const c of changes)
        if (rnd(2)) steam.push({ x: DIGIT_X[c.i] + (rnd(2) ? -2 : 8), y: plate - 1, vx: rnd(2) ? -0.5 : 0.5, vy: -0.4, life: 4 + rnd(4) });
    };
    /** The digits under the plates: squashed to fit, `pick` gives each slot's digit. */
    const fit = (pick: (i: number) => Sprite) => {
      for (const c of changes) {
        const h = Math.max(2, Math.min(12, FOOT - plate));
        const q = squashed(pick(c.i), h), s = w.slots[c.i];
        s.s = q.s; s.dx = q.dx; s.dy = q.dy;
      }
    };
    const oldOf = (i: number) => DIGITS[changes.filter((c) => c.i === i)[0].from];
    const newOf = (i: number) => DIGITS[changes.filter((c) => c.i === i)[0].to];

    yield* fetchTool(w, PAD);
    yield* walkTo(w, HOME_X);
    w.carry = null;
    w.man.dir = 0;
    yield* hold(3);

    // Down, quick, to the digits' top...
    w.sfx = "crane";
    while (plate < DIGIT_Y - 1) { v = Math.min(2, DIGIT_Y - 1 - plate); yield* frame(); }
    v = 0;
    w.sfx = "thud";
    yield* hold(4);
    // ...then slowly, crushing, the clock trembling.
    while (plate < FOOT - 2) {
      v = 1;
      w.sfx = rnd(2) ? "crumble" : "crack";
      w.shake.x = rnd(3) - 1;
      puff();
      yield* frame();
      w.shake.x = 0;
      fit(oldOf);
      v = 0;
      yield* frame(); // it groans a moment before giving the next pixel
    }
    v = 0;
    w.sfx = "boom";
    w.shake.y = 1;
    yield* frame();
    w.shake.y = 0;
    yield* hold(6);
    // Up again; pancakes left on the floor.
    while (plate > DIGIT_Y - 6) { v = -2; w.sfx = "crane"; yield* frame(); }
    v = 0;
    yield* hold(4);
    // The new die: click, light on.
    w.sfx = "ratchet";
    die = true;
    yield* hold(6);
    // Down on the pancakes...
    while (plate < FOOT - 2) { v = Math.min(2, FOOT - 2 - plate); w.sfx = "crane"; yield* frame(); }
    v = 0;
    w.sfx = "thud";
    w.shake.y = 1;
    for (const c of changes) { const s = w.slots[c.i]; const q = squashed(newOf(c.i), 2); s.s = q.s; s.dx = q.dx; s.dy = q.dy; }
    yield* frame();
    w.shake.y = 0;
    puff();
    yield* hold(6);
    // ...and up, slowly, drawing the new digits up out of them.
    while (plate > DIGIT_Y - 1) {
      v = -1;
      w.sfx = "crane";
      yield* frame();
      fit(newOf);
    }
    v = 0;
    yield* hold(3);
    // Let go.
    w.sfx = "pop";
    die = false;
    for (const c of changes) { const s = w.slots[c.i]; s.s = null; s.dx = s.dy = 0; }
    while (plate > -4) { v = -2; yield* frame(); }
    v = 0;
    while (steam.length) yield* frame();
    w.fx = null;
    w.man.frame = HANDS_UP;
    w.man.dy = -1; yield* wait(2);
    w.man.dy = 0; yield* wait(6);
    w.man.frame = FRONT;
    yield* wait(2);
    yield* putBack(w, PAD);
  },
};
