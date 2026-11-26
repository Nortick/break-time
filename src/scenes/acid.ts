// Acid: in green gloves he takes a jerrycan of acid out of the box and pours it on each digit, right to left. Where it
// lands the digit fizzes green and melts, the melt eating its way through it and dripping to the floor into a
// bubbling puddle; the puddle fumes away. Then, control box out of his pocket, the crane lowers the new digits.
import { blank, fromGrid, sprite } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, FRONT, HANDS_UP, LOOK_UP_PAD, PAD } from "../art";
import { fetchTool, putBack, walkTo, pose14, art14, canvasX, canvasY, rnd, wait, layer, type Frames, type Scene } from "./kit";

/** The jerrycan as he carries it: green, the spout on top. */
const CAN = sprite(["m..", "nnn", "nGn", "nnn"]);
/** Pouring, facing left, gloved hand: the can tipped, its spout at canvas (3, 5). He stands 10 right of the digit. */
const STAND = 10;
const POUR = pose14(art14([[3, 5, "m"], [4, 6, "n"], [5, 6, "n"], [4, 7, "n"], [5, 7, "G"], [6, 7, "n"], [5, 8, "n"], [6, 8, "n"], [7, 7, "n"], [8, 8, "b"]]));
const TIP = pose14(art14([[4, 7, "m"], [4, 8, "n"], [5, 8, "n"], [5, 7, "n"], [6, 7, "n"], [6, 8, "n"], [7, 8, "n"], [8, 8, "b"]]));

const FLOOR = 14;
const INTACT = 1, MELT = 2;

interface Cell { state: number; t: number }

export const acid: Scene = {
  id: "acid",
  name: "Acid",
  tier: "hour",
  play: function* (w, changes) {
    const order = changes.slice().sort((a, b) => b.i - a.i);
    const cells: Record<number, Cell[][]> = {};
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
      cells[c.i] = DIGITS[c.from].rows.map((r) => r.split("").map((ch) => ({ state: ch === "." ? 0 : INTACT, t: 0 })));
    }
    const drops: { x: number; y: number; vy: number }[] = [];
    const fumes: { x: number; y: number; life: number }[] = [];
    /** The puddle: how much acid lies in each column of the floor. */
    const puddle: number[] = [];
    for (let x = 0; x < 72; x++) puddle.push(0);
    let stream: [number, number] | null = null;
    let hook: { x: number; y: number; vy: number } | null = null;

    /** Which digits have had acid on them. */
    const lit: Record<number, boolean> = {};
    const melting = () => Object.keys(cells).some((k) => cells[+k].some((r) => r.some((c) => c.state === MELT))) || drops.length > 0;
    /** Acid lands on the digit: the intact pixel nearest (col, row) starts to melt. */
    const splash = (i: number, col: number, row: number) => {
      let best: Cell | null = null, bd = 1e9;
      cells[i].forEach((r, j) => r.forEach((c, k) => {
        const d = Math.abs(k - col) + Math.abs(j - row) * 0.7;
        if (c.state === INTACT && d < bd) { bd = d; best = c; }
      }));
      if (best) { (best as Cell).state = MELT; (best as Cell).t = 3 + rnd(3); }
      lit[i] = true;
    };

    function* frame(): Frames {
      for (const key of Object.keys(cells)) {
        const i = +key, g = cells[i], x0 = DIGIT_X[i];
        const catching: Cell[] = [];
        g.forEach((r, j) => r.forEach((c, k) => {
          if (c.state !== MELT) return;
          // It eats downwards most, sideways some, upwards a little.
          for (const [a, b, p] of [[k, j + 1, 0.45], [k - 1, j, 0.25], [k + 1, j, 0.25], [k, j - 1, 0.12]] as [number, number, number][]) {
            const n = g[b] && g[b][a];
            if (n && n.state === INTACT && Math.random() < p) catching.push(n);
          }
          if (--c.t <= 0) {
            c.state = 0;
            if (rnd(2)) drops.push({ x: x0 + k, y: DIGIT_Y + j, vy: 0.4 });
            if (rnd(3) === 0) fumes.push({ x: x0 + k, y: DIGIT_Y + j, life: 4 + rnd(4) });
          }
        }));
        for (const c of catching) if (c.state === INTACT) { c.state = MELT; c.t = 3 + rnd(4); }
        // Once lit it never stalls: if nothing is melting but some is left, the melt goes on from a gap.
        if (lit[i] && !g.some((r) => r.some((c) => c.state === MELT))) {
          const left: Cell[] = [];
          g.forEach((r) => r.forEach((c) => { if (c.state === INTACT) left.push(c); }));
          if (left.length) { const c = left[rnd(left.length)]; c.state = MELT; c.t = 3; }
        }
        w.slots[i].s = w.slots[i].hidden ? null : fromGrid(g.map((r) => r.map((c) => (c.state === INTACT ? "#" : c.state === MELT ? (rnd(3) ? "G" : "n") : "."))));
      }
      for (let k = drops.length - 1; k >= 0; k--) {
        const d = drops[k];
        d.vy = Math.min(d.vy + 0.3, 1.6);
        d.y += d.vy;
        if (d.y >= FLOOR) { puddle[Math.max(0, Math.min(71, Math.round(d.x)))]++; drops.splice(k, 1); }
      }
      // The puddle spreads out flat, bubbles, and fumes away.
      for (let x = 1; x < 71; x++)
        if (puddle[x] > 2) { const s = rnd(2) ? -1 : 1; puddle[x]--; puddle[x + s]++; }
      for (let x = 0; x < 72; x++)
        if (puddle[x] > 0 && rnd(30) === 0) fumes.push({ x, y: FLOOR - 1, life: 4 + rnd(5) });
      for (let k = fumes.length - 1; k >= 0; k--) {
        const f = fumes[k];
        f.y -= 0.5;
        if (rnd(3) === 0) f.x += rnd(3) - 1;
        if (--f.life <= 0) fumes.splice(k, 1);
      }
      // The sound of this step: pouring, the crane's motor, or the acid hissing as it eats.
      if (stream) w.sfx = "splash";
      else if (hook) w.sfx = "crane";
      else if (drops.length || fumes.length) w.sfx = "fire";
      w.fx = layer((t) => {
        const g = blank(72, 16);
        const set = (x: number, y: number, c: string) => { const X = Math.round(x), Y = Math.round(y); if (X >= 0 && X < 72 && Y >= 0 && Y < 16) g[Y][X] = c; };
        puddle.forEach((n, x) => { if (n > 0) set(x, FLOOR, rnd(8) ? "n" : "G"); });
        // Drops fall on and fumes rise on between steps (the 60 fps in-betweens).
        for (const d of drops) set(d.x, t ? Math.min(d.y + Math.min(d.vy + 0.3, 1.6) * t, FLOOR - 0.01) : d.y, "G");
        for (const f of fumes) set(f.x, f.y - 0.5 * t, f.life > 3 ? "n" : "q");
        if (stream) for (let y = stream[1]; y < stream[1] + 4; y++) if (rnd(4)) set(stream[0] - (y - stream[1] > 1 ? 1 : 0), y, "G");
        if (hook) {
          const hy = hook.y + Math.trunc(hook.vy * t);
          for (let y = 0; y < hy && y < 16; y++) g[y][hook.x] = "r";
          if (hy >= 0 && hy < 16) for (const dx of [-1, 0, 1]) g[hy][hook.x + dx] = "m";
        }
        return { s: fromGrid(g), x: 0, y: 0 };
      });
      yield;
    }
    function* run(gen: Frames): Frames {
      while (!gen.next().done) yield* frame();
    }
    function* hold(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }

    yield* run(fetchTool(w, CAN));
    for (const c of order) {
      w.carry = CAN;
      yield* run(walkTo(w, DIGIT_X[c.i] + STAND));
      w.carry = null;
      w.man.dir = -1;
      w.man.frame = TIP;
      yield* hold(3);
      w.man.frame = POUR;
      stream = [canvasX(w.man.x, 3) - 1, canvasY(6)];
      for (let t = 0; t < 10; t++) {
        if (t % 3 === 1) splash(c.i, 6, 4 + rnd(5));
        yield* frame();
      }
      stream = null;
      w.man.frame = TIP;
      yield* hold(3);
    }
    // The can back in the box while it eats through; he watches, control box in hand.
    w.man.frame = FRONT;
    yield* run(putBack(w, CAN, PAD));
    w.carry = null;
    w.man.frame = LOOK_UP_PAD[0];
    for (let t = 0; t < 200 && melting(); t++) yield* frame();
    for (const c of changes) w.slots[c.i].hidden = true;
    // The puddle fumes away.
    w.sfx = "fire";
    for (let t = 0; t < 120 && puddle.some((n) => n > 0); t++) {
      for (let x = 0; x < 72; x++) if (puddle[x] > 0 && rnd(6) === 0) { puddle[x]--; fumes.push({ x, y: FLOOR - 1, life: 5 + rnd(4) }); }
      yield* frame();
    }
    yield* hold(6);
    // The crane brings the new digits, left to right.
    let blink = 0;
    for (const c of changes.slice().sort((a, b) => a.i - b.i)) {
      const slot = w.slots[c.i], x0 = DIGIT_X[c.i];
      delete cells[c.i];
      slot.hidden = false;
      slot.s = DIGITS[c.to];
      slot.dy = -15;
      // vy: how far the hook goes by the next step, so it glides with the digit (60 fps).
      const down = (dy: number) => Math.min(0, dy + (dy < -4 ? 2 : 1)) - dy;
      hook = { x: x0 + 3, y: DIGIT_Y + slot.dy - 1, vy: down(slot.dy) };
      while (slot.dy < 0) {
        slot.dy += down(slot.dy);
        hook.y = DIGIT_Y + slot.dy - 1;
        hook.vy = down(slot.dy);
        w.man.frame = LOOK_UP_PAD[(blink++ >> 1) % 2];
        yield* frame();
      }
      yield* hold(2);
      hook.vy = -2;
      while (hook.y > -1) { hook.y -= 2; w.man.frame = LOOK_UP_PAD[(blink++ >> 1) % 2]; yield* frame(); }
      hook = null;
    }
    while (fumes.length) yield* frame();
    for (const c of changes) { const s = w.slots[c.i]; s.s = null; s.dy = 0; }
    w.fx = null;
    w.man.frame = FRONT;
    yield* wait(3);
    w.man.frame = HANDS_UP;
    w.man.dy = -1; yield* wait(2);
    w.man.dy = 0; yield* wait(6);
    w.man.frame = FRONT;
    yield* wait(2);
  },
};

