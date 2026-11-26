// Flood: he takes a hydrant out of the box, sets it down and opens the valve. Water gushes out and fills the screen
// to the very top; the changing digits float up on it and out over the top edge. He is left under water, cheeks
// puffed, bubbles rising: he turns the valve back, the hydrant swallows the water, and as the water goes down it brings
// the new digits down with it, floating on the surface, till they settle on the floor.
import { sprite, blank, fromGrid, PALETTE } from "../gfx";
import { COLON, COLON_X, COLON_Y, DIGITS, DIGIT_X, DIGIT_Y, FRONT, HANDS_UP, HOME_X, MAN_Y } from "../art";
import { fetchTool, putBack, walkTo, rnd, wait, WORK_R, type Frames, type Scene } from "./kit";

/** The water's own colors, teal, so he shows against it in his blue overalls (scenes are only baked: tools/bake.ts). */
PALETTE["t"] = "#2B8A9A";
PALETTE["T"] = "#1A5563";
/** The hydrant: grey valve wheel on top, red body. */
const HYDRANT = sprite([".m.", "xxx", ".x.", "xxx", "xxx"]);
/** Where it stands on the floor, by the box. */
const HYD_X = 55, HYD_Y = 10;
/** The highest the water gets (its surface row, above the screen: the floating digits are gone over the top), and
 * the floor row it starts from. */
const TOP = -12, FLOOR = 15;
/** Swimming under water, cheeks puffed: arms and legs out, then in (9 wide, a column to the left). */
const SWIM = [
  ["...hhh...", "..hhhhhh.", "..ooooo..", "..o.o.o..", "o.ooooo.o", "b..bbb..b", ".bbbbbbb.", "...bbb...", "...ppp...", "..p...p..", ".p.....p.", "s.......s"],
  ["...hhh...", "..hhhhhh.", "..ooooo..", "..o.o.o..", "..ooooo..", "...bbb...", "obbbbbbbo", "...bbb...", "...ppp...", "...p.p...", "...p.p...", "..ss.ss.."],
].map((r) => Object.assign(sprite(r), { ox: -1, oy: 0 }));
/** Scared of the water coming up: arms up, mouth open. */
const SCARED = Object.assign(
  sprite(["...hhh...", "..hhhhhh.", "..ooooo..", "o.o.o.o.o", "b.oo.oo.b", ".b.bbb.b.", "..bbbbb..", "...bbb...", "...ppp...", "...p.p...", "...p.p...", "..ss.ss.."]),
  { ox: -1, oy: 0 },
);

export const flood: Scene = {
  id: "flood",
  name: "Flood",
  tier: "hour",
  play: function* (w, changes) {
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    let level = FLOOR; // the water's surface row; FLOOR = no water, below 0 = over the top of the screen
    let hydrant = false, spray = false, swirl = false, breath = false;
    const drops: { x: number; y: number; vx: number; vy: number }[] = [];
    const bubbles: { x: number; y: number }[] = [];
    let tick = 0;
    /** Whether a digit (or the colon) has a pixel at (x, y) now: the water goes round them, behind. */
    const solid = (x: number, y: number) => {
      for (let i = 0; i < 4; i++) {
        const s = w.slots[i];
        if (s.hidden) continue;
        const pic = s.s ?? DIGITS[s.value];
        const u = x - (DIGIT_X[i] + s.dx), v = y - (DIGIT_Y + s.dy);
        if (u >= 0 && u < pic.w && v >= 0 && v < pic.h && (pic.rows[v].charAt(u) || ".") !== ".") return true;
      }
      const u = x - COLON_X, v = y - COLON_Y;
      return u >= 0 && u < 2 && v >= 0 && v < 6 && COLON.rows[v].charAt(u) === "#";
    };
    const draw = () => {
      const g = blank(72, 16);
      const set = (x: number, y: number, c: string) => { if (x >= 0 && x < 72 && y >= 0 && y < 16) g[y][x] = c; };
      for (let y = Math.max(0, level); y < FLOOR; y++)
        for (let x = 0; x < 72; x++) {
          if (solid(x, y)) continue;
          if (y === level) set(x, y, (x + tick) % 6 < 2 ? "w" : "a"); // the surface, waves running along it
          else set(x, y, y - level < 3 ? "t" : "T");
        }
      if (hydrant)
        HYDRANT.rows.forEach((r, j) => { for (let i = 0; i < 3; i++) if (r.charAt(i) !== ".") set(HYD_X + i, HYD_Y + j, i === 1 && j === 0 && (spray || swirl) && tick % 2 ? "r" : r.charAt(i)); });
      if (swirl) for (let k = 0; k < 4; k++) { const a = tick * 0.9 + (k * Math.PI) / 2; set(Math.round(HYD_X + 1 + Math.cos(a) * 2.5), Math.round(HYD_Y - 2 + Math.sin(a)), "w"); }
      for (const d of drops) set(Math.round(d.x), Math.round(d.y), rnd(3) ? "a" : "w");
      for (const b of bubbles) set(b.x, b.y, "a");
      // Bubbles rising in the water.
      for (let k = 0; k < 5; k++) {
        const x = (k * 17 + 5) % 70, y = FLOOR - 1 - ((tick + k * 3) % 12);
        if (y > level && !solid(x, y)) set(x, y, "a");
      }
      w.fx = { s: fromGrid(g), x: 0, y: 0 };
    };
    function* frame(): Frames {
      tick++;
      for (let k = drops.length - 1; k >= 0; k--) {
        const d = drops[k];
        d.x += d.vx; d.y += d.vy; d.vy += 0.4;
        if (d.y >= level || d.y > 15) drops.splice(k, 1);
      }
      if (spray && level > 6) for (let k = 0; k < 3; k++) drops.push({ x: HYD_X + 1, y: HYD_Y - 1, vx: (Math.random() - 0.5) * 1.6, vy: -1.5 - Math.random() * 1.2 });
      // His breath: a bubble now and then from his mouth, wobbling up to the surface.
      for (let k = bubbles.length - 1; k >= 0; k--) {
        const b = bubbles[k];
        b.y--;
        if (tick % 2) b.x += rnd(3) - 1;
        if (b.y <= level || b.y < 0) bubbles.splice(k, 1);
      }
      if (breath && level < MAN_Y + 3 && tick % 5 === 0) bubbles.push({ x: w.man.x + 3, y: MAN_Y + w.man.dy + 3 });
      draw();
      yield;
    }
    function* hold(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }
    /** One step of swimming: paddling, floating up a little off the floor, bobbing and drifting to and fro. */
    let home = 0;
    function* swim(toX?: number, toDy = -3): Frames {
      w.man.frame = SWIM[(tick >> 1) % 2];
      w.man.dir = 0;
      const want = toDy + ((tick >> 3) % 2 ? 0 : 1);
      if (w.man.dy > want) w.man.dy--; else if (w.man.dy < want) w.man.dy++;
      const tx = toX ?? home + ((tick >> 4) % 2 ? 2 : -2);
      if (tick % 2 === 0 && w.man.x !== tx) w.man.x += w.man.x < tx ? 1 : -1;
      yield* frame();
    }
    function* run(g: Frames): Frames {
      while (!g.next().done) yield* frame();
    }
    /** A floating digit rides the surface, two rows under it, bobbing a little; it never goes below its place. */
    const float = (i: number) => {
      const s = w.slots[i];
      const bob = level > 0 && (tick >> 2) % 2 === (i % 2) ? -1 : 0;
      s.dy = Math.min(0, level + 2 - (DIGIT_Y + 11) + bob);
    };

    // The hydrant out of the box, set down by it; he opens the valve.
    yield* run(fetchTool(w, HYDRANT));
    w.carry = null;
    hydrant = true;
    w.man.frame = WORK_R;
    w.man.dir = 1;
    w.hand = { x: HYD_X + 1, y: HYD_Y, c: "o" };
    w.sfx = "ratchet";
    yield* hold(6);
    w.hand = null;
    spray = true;
    w.sfx = "splash";
    w.man.frame = FRONT;
    w.man.dir = 0;
    yield* hold(3);

    home = w.man.x;
    // The water rises to the very top; the digits float up with it and out over the top edge.
    while (level > TOP) {
      if (tick % 2 === 0) { level--; if (level % 3 === 0) w.sfx = "splash"; }
      if (level < DIGIT_Y + 10) for (const c of changes) float(c.i);
      if (level <= 14 && level > MAN_Y + 3) {
        // It's coming up round him: he panics, hopping, arms up.
        w.man.frame = (tick >> 1) % 2 ? SCARED : FRONT;
        w.man.dy = (tick >> 1) % 2 ? -1 : 0;
        if (tick % 8 === 0) w.sfx = "grumble";
      }
      if (level <= MAN_Y + 3) { breath = true; yield* swim(); continue; }
      yield* frame();
    }
    spray = false;
    for (const c of changes) { const s = w.slots[c.i]; s.hidden = true; s.dy = 0; }
    for (let k = 0; k < 16; k++) yield* swim();

    // He swims down to the hydrant and turns the valve back.
    while (w.man.x !== home || w.man.dy !== 0) yield* swim(home, 0);
    w.man.dy = 0;
    w.man.frame = WORK_R;
    w.man.dir = 1;
    yield* hold(3);
    w.hand = { x: HYD_X + 1, y: HYD_Y, c: "o" };
    w.sfx = "ratchet";
    yield* hold(4);
    w.hand = { x: HYD_X + 2, y: HYD_Y, c: "o" };
    yield* hold(4);
    w.hand = null;

    // The hydrant swallows the water; the new digits come down with it, floating on the surface, and settle.
    for (const c of changes) { const s = w.slots[c.i]; s.s = DIGITS[c.to]; s.hidden = false; float(c.i); }
    swirl = true;
    w.sfx = "gulp";
    while (level < FLOOR) {
      if (tick % 2 === 0) level++;
      if (tick % 6 === 0) w.sfx = "gulp";
      for (const c of changes) float(c.i);
      if (breath && level >= MAN_Y + 4) { breath = false; w.man.frame = FRONT; w.man.dy = 0; w.man.x = home; }
      if (breath) { yield* swim(home, level < 0 ? -2 : 0); continue; }
      yield* frame();
    }
    swirl = false;
    breath = false;
    for (const c of changes) { const s = w.slots[c.i]; s.dy = 0; s.s = null; }
    w.sfx = "thud";
    w.man.frame = FRONT;
    while (bubbles.length || drops.length) yield* frame();
    yield* hold(3);
    // A deep breath; the hydrant back in the box.
    hydrant = false;
    w.fx = null;
    yield* putBack(w, HYDRANT);
    yield* walkTo(w, HOME_X);
    w.man.frame = HANDS_UP;
    w.man.dy = -1; yield* wait(2);
    w.man.dy = 0; yield* wait(6);
    w.man.frame = FRONT;
    yield* wait(2);
  },
};
