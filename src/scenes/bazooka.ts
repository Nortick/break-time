// Bazooka: he takes a bazooka out of the box, shoulders it and shoots the digits one by one, right to left; each hit
// blows the digit to bits and shakes the clock. When the smoke clears the new digits drop from the sky.
import { sprite } from "../gfx";
import { DIGITS, DIGIT_X, FRONT, HANDS_UP, LOOK_UP } from "../art";
import { fetchTool, putBack, walkTo, pose14, art14, canvasX, canvasY, rnd, wait, type Frames, type Scene } from "./kit";
import { shatter, stepChunks, drawChunks, type Chunk } from "./sledge";

/** The bazooka as he carries it, upright: olive tube, dark ends. */
const BAZOOKA = sprite(["q", "l", "l", "l", "l", "q"]);
/** He stands here to shoot: far enough from the digits for the tube to clear them. */
const SHOOT_X = 46;
/** On the shoulder, facing left: the tube along row 7, the bell at the front, his hand on the grip under it. */
const AIM_ART: [number, number, string][] = [
  [1, 6, "l"], [1, 7, "q"], [1, 8, "l"],
  [2, 7, "l"], [3, 7, "l"], [4, 7, "l"], [5, 7, "l"], [6, 7, "l"], [7, 7, "l"], [8, 7, "l"], [9, 7, "l"], [10, 7, "l"], [11, 7, "l"], [12, 7, "l"], [13, 7, "q"],
  [7, 8, "o"], [8, 9, "b"], [6, 8, "l"],
];
const AIM = pose14(art14(AIM_ART));
/** The muzzle and the back of the tube, on the canvas. */
const MUZZLE = [0, 7], BACK = [13, 7];
const ROCKET_Y = canvasY(MUZZLE[1]);

export const bazooka: Scene = {
  id: "bazooka",
  name: "Bazooka",
  tier: "hour",
  play: function* (w, changes) {
    const order = changes.slice().sort((a, b) => b.i - a.i); // right to left
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    let chunks: Chunk[] = [];
    let rocket: number | null = null;
    const puffs: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
    /** How far the rocket flies by the next step (for the 60 fps in-betweens). */
    let rocketV = 0;
    const extra = (g: string[][], t: number) => {
      const set = (x: number, y: number, c: string) => { if (x >= 0 && x < 72 && y >= 0 && y < 15) g[y][x] = c; };
      for (const p of puffs) set(Math.round(p.x + p.vx * t), Math.round(p.y + p.vy * t), p.c);
      if (rocket !== null) {
        const r = rocket + Math.round(rocketV * t);
        set(r, ROCKET_Y, "x"); set(r + 1, ROCKET_Y, "m"); set(r + 2, ROCKET_Y, "m");
        set(r + 3, ROCKET_Y, rnd(2) ? "f" : "y");
      }
    };
    function* frame(): Frames {
      stepChunks(chunks);
      for (let k = puffs.length - 1; k >= 0; k--) {
        const p = puffs[k];
        p.x += p.vx; p.y += p.vy; p.vx *= 0.85;
        if (--p.life <= 0) puffs.splice(k, 1);
      }
      drawChunks(w, chunks, (c) => (c.rest ? "d" : "#"), extra);
      yield;
    }
    function* run(g: Frames): Frames {
      while (!g.next().done) yield* frame();
    }
    function* hold(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }

    yield* run(fetchTool(w, BAZOOKA));
    yield* run(walkTo(w, SHOOT_X));
    w.carry = null;
    w.man.dir = -1;
    w.man.frame = AIM;
    yield* hold(6);

    for (const c of order) {
      const slot = w.slots[c.i], x0 = DIGIT_X[c.i];
      yield* hold(4);
      // Fire: a blast out of the back of the tube, the kick pushes him back a step.
      w.sfx = "boom";
      for (let k = 0; k < 6; k++)
        puffs.push({ x: canvasX(w.man.x, BACK[0]) + 1, y: ROCKET_Y + rnd(3) - 1, vx: 1 + Math.random() * 1.5, vy: (Math.random() - 0.5) * 0.6, life: 4 + rnd(4), c: k < 2 ? "y" : "d" });
      rocket = canvasX(w.man.x, MUZZLE[0]) - 3;
      rocketV = -3;
      w.man.x += 1;
      yield* frame();
      w.man.x -= 1;
      while (rocket !== null && rocket > x0 + 6) {
        rocket -= 3;
        puffs.push({ x: rocket + 4, y: ROCKET_Y, vx: 0, vy: -0.1, life: 3 + rnd(3), c: "d" });
        yield* frame();
      }
      // Hit.
      w.sfx = "boom";
      rocket = null;
      chunks = chunks.concat(shatter(slot.s ?? DIGITS[c.from], x0, x0 + 7, ROCKET_Y, 0));
      slot.hidden = true;
      for (let k = 0; k < 12; k++)
        puffs.push({ x: x0 + 5, y: ROCKET_Y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.7) * 2, life: 3 + rnd(6), c: k < 5 ? (rnd(2) ? "y" : "f") : "d" });
      for (let k = 0; k < 5; k++) {
        w.shake.x = k < 4 ? rnd(5) - 2 : 0;
        w.shake.y = k < 4 ? rnd(3) - 1 : 0;
        yield* frame();
      }
      w.shake.x = w.shake.y = 0;
    }
    yield* hold(6);
    w.man.frame = LOOK_UP;
    yield* hold(8);

    // The new digits drop from the sky, one after another from the left, landing with a thud that scatters the
    // rubble.
    for (const c of order.slice().reverse()) {
      const slot = w.slots[c.i], x0 = DIGIT_X[c.i];
      slot.hidden = false;
      slot.s = DIGITS[c.to];
      slot.dy = -15;
      let v = 1;
      while (slot.dy < 0) {
        slot.dy = Math.min(0, slot.dy + v);
        v = Math.min(v + 1, 4);
        yield* frame();
      }
      for (const k of chunks)
        if (k.x + 1 >= x0 && k.x <= x0 + 6) { k.rest = false; k.vy = -2; k.vx = k.x < x0 + 3 ? -1.5 : 1.5; }
      w.shake.y = 1;
      for (const b of [-2, -1, 0]) { slot.dy = b; yield* frame(); w.shake.y = 0; }
      slot.s = null;
      yield* hold(2);
    }
    for (const c of changes) { const s = w.slots[c.i]; s.s = null; s.dx = s.dy = 0; }
    // The rubble turns to dust.
    while (chunks.length || puffs.length) {
      for (let k = chunks.length - 1; k >= 0; k--) if (chunks[k].rest && rnd(4) === 0) chunks.splice(k, 1);
      yield* frame();
    }
    w.fx = null;
    w.man.frame = FRONT;
    yield* wait(2);
    yield* putBack(w, BAZOOKA);
    w.man.frame = HANDS_UP;
    w.man.dy = -1; yield* wait(2);
    w.man.dy = 0; yield* wait(6);
    w.man.frame = FRONT;
    yield* wait(2);
  },
};
