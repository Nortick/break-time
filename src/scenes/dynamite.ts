// Dynamite, like in the old films: he sets a plunger detonator down by the box, takes a bundle of dynamite out of it,
// puts a stick at the foot of every digit that changes and walks back unrolling the wire. A push on the plunger, the
// spark runs down the wire and the sticks go off one after another; the digits fly to bits, the clock shakes. When
// the smoke clears the new digits drop from the sky, and the plunger goes back in the box.
import { sprite } from "../gfx";
import { DIGITS, DIGIT_X, FRONT, HANDS_UP, HOME_X, LOOK_UP, MAN_Y, WORK_L } from "../art";
import { fetchTool, putBack, walkTo, rnd, wait, type Frames, type Scene } from "./kit";
import { shatter, stepChunks, drawChunks, type Chunk } from "./sledge";

/** The plunger detonator as he carries it, and where it stands on the floor, against the box's left side. */
const PLUNGER = sprite(["mmm", ".m.", "ggg", "gqg"]);
const PLUNGER_X = 56;
/** The bundle of dynamite: three red sticks, the fuses on top. */
const BUNDLE = sprite(["c.c", "xxx", "xxx", "xxx"]);
const WIRE_Y = 14;

export const dynamite: Scene = {
  id: "dynamite",
  name: "Dynamite",
  tier: "hour",
  play: function* (w, changes) {
    const order = changes.slice().sort((a, b) => a.i - b.i); // left to right
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    let chunks: Chunk[] = [];
    /** What is on the floor: the plunger (and how far its handle is down), the sticks, the wire, the spark. */
    let plunger = false, pushed = false;
    const sticks: number[] = [];
    let wire: [number, number] | null = null;
    let spark: number | null = null;
    /** Flashes of the blasts: where, and how many frames are left. */
    const blasts: { x: number; t: number }[] = [];
    const smoke: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    const extra = (g: string[][], t: number) => {
      const set = (x: number, y: number, c: string) => { if (x >= 0 && x < 72 && y >= 0 && y < 16) g[y][x] = c; };
      for (const s of smoke) set(Math.round(s.x + s.vx * t), Math.round(s.y + s.vy * t), "d");
      if (wire) for (let x = wire[0]; x <= wire[1]; x++) set(x, WIRE_Y, "c");
      for (const x of sticks) { set(x, 13, "x"); set(x, 12, "x"); set(x, 11, "x"); set(x, 10, "c"); }
      if (plunger) {
        const top = pushed ? 11 : 9;
        set(PLUNGER_X, top, "m"); set(PLUNGER_X + 1, top, "m"); set(PLUNGER_X + 2, top, "m");
        for (let y = top + 1; y < 12; y++) set(PLUNGER_X + 1, y, "m");
        for (let x = PLUNGER_X; x < PLUNGER_X + 3; x++) { set(x, 12, "g"); set(x, 13, "g"); set(x, 14, "g"); }
        set(PLUNGER_X + 1, 13, "q");
      }
      if (spark !== null) { set(spark, WIRE_Y, "y"); set(spark, WIRE_Y - 1, rnd(2) ? "f" : "y"); }
      for (const b of blasts) {
        const r = b.t > 2 ? 3 : 2;
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++)
            if (dx * dx + dy * dy <= r * r && rnd(5)) set(b.x + dx, 11 + dy, b.t > 2 ? (rnd(3) ? "w" : "y") : rnd(2) ? "f" : "y");
      }
    };
    /** While he walks back, the wire unrolls behind him. */
    let unroll = 0;
    function* frame(): Frames {
      if (unroll) wire = [unroll, Math.min(PLUNGER_X, Math.max(w.man.x + 1, wire ? wire[1] : 0))];
      stepChunks(chunks);
      for (let k = smoke.length - 1; k >= 0; k--) {
        const s = smoke[k];
        s.x += s.vx; s.y += s.vy; s.vx *= 0.9; s.vy *= 0.92;
        if (--s.life <= 0) smoke.splice(k, 1);
      }
      for (let k = blasts.length - 1; k >= 0; k--) if (--blasts[k].t <= 0) blasts.splice(k, 1);
      drawChunks(w, chunks, (c) => (c.rest ? "d" : "#"), extra);
      yield;
    }
    function* run(g: Frames): Frames {
      while (!g.next().done) yield* frame();
    }
    function* hold(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }

    // The plunger out of the box and set down by it; then the dynamite.
    yield* run(fetchTool(w, PLUNGER));
    w.carry = null;
    plunger = true;
    yield* hold(3);
    yield* run(fetchTool(w, BUNDLE));

    // To the leftmost digit, a stick at its foot; then back to the right, the wire unrolling behind him.
    const first = DIGIT_X[order[0].i];
    yield* run(walkTo(w, first + 8));
    for (let k = 0; k < order.length; k++) {
      const x0 = DIGIT_X[order[k].i];
      if (k > 0) {
        w.carry = BUNDLE;
        yield* run(walkTo(w, x0 + 8));
      }
      w.carry = null;
      w.man.dir = -1;
      w.man.frame = WORK_L;
      w.hand = { x: x0 + 4, y: MAN_Y + 8, c: "o" };
      yield* hold(3);
      sticks.push(x0 + 3);
      unroll = first + 3;
      w.hand = null;
      yield* hold(2);
    }
    w.carry = BUNDLE;
    yield* run(walkTo(w, HOME_X));
    unroll = 0;
    wire = [first + 3, PLUNGER_X];
    w.carry = null;
    w.man.dir = 1;
    w.man.frame = FRONT;
    yield* hold(4);

    // Hands on the handle... down!
    w.sfx = "beep";
    w.hand = { x: PLUNGER_X, y: 9, c: "o" };
    yield* hold(6);
    pushed = true;
    w.hand = { x: PLUNGER_X, y: 11, c: "o" };
    yield* hold(2);
    w.hand = null;
    w.man.frame = LOOK_UP;
    // The spark runs down the wire; each stick goes off as it gets there.
    const left = sticks.slice().sort((a, b) => b - a);
    for (let x = PLUNGER_X - 1; x >= first + 3; x -= 2) {
      spark = x;
      wire = [first + 3, x];
      w.sfx = "fire";
      for (let k = left.length - 1; k >= 0; k--) {
        const sx = left[k];
        if (x > sx) continue;
        left.splice(k, 1);
        sticks.splice(sticks.indexOf(sx), 1);
        const c = order.filter((o) => DIGIT_X[o.i] + 3 === sx)[0];
        const slot = w.slots[c.i];
        chunks = chunks.concat(shatter(DIGITS[c.from], DIGIT_X[c.i], sx, 13, 0).map((ch) => ({ ...ch, vy: ch.vy - 1.5 })));
        slot.hidden = true;
        blasts.push({ x: sx, t: 4 });
        w.sfx = "boom";
        for (let s = 0; s < 10; s++)
          smoke.push({ x: sx, y: 11, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 1.5, life: 10 + rnd(10) });
        w.shake.x = rnd(5) - 2;
        w.shake.y = rnd(3) - 1;
      }
      yield* frame();
      w.shake.x = w.shake.y = 0;
    }
    spark = null;
    wire = null;
    w.sfx = "boom";
    for (let k = 0; k < 6; k++) {
      w.shake.x = k < 4 ? rnd(5) - 2 : 0;
      w.shake.y = k < 4 ? rnd(3) - 1 : 0;
      yield* frame();
    }
    w.shake.x = w.shake.y = 0;
    yield* hold(12);

    // The new digits drop from the sky, one after another, scattering the rubble where they land.
    for (const c of order) {
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
      for (const ch of chunks)
        if (ch.x + 1 >= x0 && ch.x <= x0 + 6) { ch.rest = false; ch.vy = -2; ch.vx = ch.x < x0 + 3 ? -1.5 : 1.5; }
      w.shake.y = 1;
      for (const b of [-2, -1, 0]) { slot.dy = b; yield* frame(); w.shake.y = 0; }
      slot.s = null;
      yield* hold(2);
    }
    // The rubble turns to dust; the plunger goes back in the box.
    while (chunks.length || smoke.length) {
      for (let k = chunks.length - 1; k >= 0; k--) if (chunks[k].rest && rnd(4) === 0) chunks.splice(k, 1);
      yield* frame();
    }
    w.man.frame = HANDS_UP;
    w.man.dy = -1; yield* hold(2);
    w.man.dy = 0; yield* hold(6);
    w.man.frame = FRONT;
    plunger = false;
    pushed = false;
    yield* run(putBack(w, PLUNGER));
    w.fx = null;
    yield* wait(2);
  },
};
