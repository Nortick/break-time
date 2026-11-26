// Hour show, the sledgehammer from the box: digit by digit from the right, cracks, rubble and a shake; then he works
// the crane with a remote, and it brings the new digits while he takes the hammer back.
import { sprite, blank, fromGrid, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, BOX_STAND, FRONT, HANDS_UP, WALK_L, PAD, LOOK_UP_PAD } from "../art";
import { type World } from "../world";
import { wait, rnd, clamp, fetchTool, putBack, layer, type Frames, type Scene } from "./kit";
import { H_READY, H_BACK, H_UP, H_STRIKE, H_DRAG_L, H_DRAG_R, H_DRAG_R_REMOTE, SLEDGE } from "./hammer";

/** A digit with a crack down it: a zigzag line of pixels knocked out. */
export function cracked(s: Sprite): Sprite {
  let col = 2 + rnd(3);
  return sprite(
    s.rows.map((r) => {
      col = clamp(col + rnd(3) - 1, 1, 5);
      return r.substring(0, col) + "." + r.substring(col + 1);
    }),
  );
}

export interface Chunk {
  px: [number, number][];
  x: number;
  y: number;
  vx: number;
  vy: number;
  rest: boolean;
  /** Frames left before it starts to move: the blow reaches far digits a little later. */
  delay: number;
}

const FLOOR_Y = 14;

/** Breaks a digit into 2×2 chunks that fly away from the blow at (bx, by). */
export function shatter(s: Sprite, ox: number, bx: number, by: number, delay: number): Chunk[] {
  const out: Chunk[] = [];
  for (let cy = 0; cy < s.h; cy += 2)
    for (let cx = 0; cx < s.w; cx += 2) {
      const px: [number, number][] = [];
      for (let j = cy; j < cy + 2 && j < s.h; j++)
        for (let i = cx; i < cx + 2 && i < s.w; i++) if (s.rows[j].charAt(i) !== ".") px.push([i - cx, j - cy]);
      if (!px.length) continue;
      const x = ox + cx, y = DIGIT_Y + cy;
      const push = clamp((x - bx) * 0.12, -2.5, 2.5);
      out.push({ px, x, y, vx: push + (Math.random() - 0.5), vy: -1 - Math.random() * 2 + (y - by) * 0.05, rest: false, delay });
    }
  return out;
}

/** One frame of the rubble: gravity, a bounce or two on the floor, then it lies still. */
export function stepChunks(chunks: Chunk[]): void {
  for (let k = chunks.length - 1; k >= 0; k--) {
    const c = chunks[k];
    if (c.delay > 0) { c.delay--; continue; }
    if (c.rest) continue;
    c.vy += 0.5;
    c.x += c.vx;
    c.y += c.vy;
    if (c.y + 1 >= FLOOR_Y) {
      c.y = FLOOR_Y - 1;
      if (Math.abs(c.vy) < 1.2) { c.rest = true; c.vx = c.vy = 0; }
      else { c.vy = -c.vy * 0.35; c.vx *= 0.5; }
    }
    if (c.x < -2 || c.x > 73) chunks.splice(k, 1);
  }
}

/**
 * Draws the rubble on the effect layer; `extra` draws more onto the same picture (a crane, sparks) for a part t of the
 * way to the next step. Between steps the flying chunks are drawn on their way (the 60 fps in-betweens).
 */
export function drawChunks(w: World, chunks: Chunk[], color: (c: Chunk) => string, extra?: (g: string[][], t: number) => void): void {
  const pic = (t: number) => {
    const g = blank(72, 16);
    if (extra) extra(g, t);
    for (const c of chunks) {
      const m = c.rest || c.delay > 0 ? 0 : t;
      const cx = c.x + c.vx * m, cy = Math.min(c.y + (c.vy + 0.5) * m, FLOOR_Y - 1);
      for (const [i, j] of c.px) {
        const X = Math.round(cx) + i, Y = Math.round(cy) + j;
        if (X >= 0 && X < 72 && Y >= 0 && Y < 16) g[Y][X] = color(c);
      }
    }
    return { s: fromGrid(g), x: 0, y: 0 };
  };
  w.fx = layer(pic);
}

/**
 * Hour show: the sledgehammer, digit by digit from the right. The first blow cracks a digit, the next one breaks it and
 * cracks the next; the last breaks alone. Then a crane lowers the new digits, and the rubble turns to dust.
 */
export const sledge: Scene = {
  id: "sledge",
  name: "Sledgehammer",
  tier: "hour",
  play: function* (w, changes) {
    const order = changes.slice().sort((a, b) => b.i - a.i); // right to left
    let chunks: Chunk[] = [];
    // The hook's tip while the crane works; vy: how far it goes by the next step (so it moves with the digit it holds).
    let crane: { x: number; y: number; vy: number } | null = null;
    const rubble = (c: Chunk) => (c.rest ? "d" : "#");
    const drawCrane = (g: string[][], t: number) => {
      if (!crane) return;
      const cy = crane.y + Math.trunc(crane.vy * t);
      for (let y = 0; y < cy && y < 16; y++) g[y][crane.x] = "r";
      if (cy >= 0 && cy < 16) for (const dx of [-1, 0, 1]) g[cy][crane.x + dx] = "m";
    };
    /** The crane at work, alongside whatever he is doing; null when it is not working. */
    let job: Frames | null = null;
    /** Every frame of the scene goes through here, so the rubble keeps falling and the crane keeps working. */
    function* frame(): Frames {
      if (job && job.next().done) job = null;
      if (crane) w.sfx = "crane";
      stepChunks(chunks);
      drawChunks(w, chunks, rubble, drawCrane);
      yield;
    }
    function* hold(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }
    function* drag(x: number): Frames {
      let step = 0;
      while (w.man.x !== x) {
        const dir = x < w.man.x ? -1 : 1;
        w.man.x += dir;
        step++;
        w.man.frame = (dir < 0 ? H_DRAG_L : H_DRAG_R)[(step >> 1) % 2];
        yield* frame();
      }
    }
    /** Plays a kit animation (walking, the box) frame by frame through frame(), so the crane and rubble go on. */
    function* run(g: Frames): Frames {
      while (!g.next().done) yield* frame();
    }
    /** Drags the hammer right, remote in hand; its light blinks while the crane works. */
    function* dragRight(x: number): Frames {
      let step = 0;
      while (w.man.x < x) {
        w.man.x++;
        step++;
        const light = job ? (step >> 1) % 2 : 0;
        w.man.frame = H_DRAG_R_REMOTE[light][(step >> 1) % 2];
        yield* frame();
      }
    }
    function* blow(hard: boolean): Frames {
      w.man.frame = H_BACK; yield* hold(hard ? 2 : 3);
      w.man.frame = H_UP; yield* hold(hard ? 5 : 4);
      w.man.frame = H_STRIKE;
      w.sfx = "hit";
    }
    function* shake(n: number, amp: number): Frames {
      for (let k = 0; k < n; k++) {
        w.shake.x = rnd(2 * amp + 1) - amp;
        w.shake.y = rnd(3) - 1;
        yield* frame();
      }
      w.shake.x = w.shake.y = 0;
    }

    // The hammer comes out of the box upright. He backs off a few steps holding it behind him, then lets its head
    // down on the floor and drags it to work.
    yield* run(fetchTool(w, SLEDGE));
    for (let k = 0; k < 4; k++) {
      w.man.x--;
      w.man.frame = WALK_L[(k >> 1) % 2];
      w.man.dir = 1; // so the hammer he carries stays at his back
      yield* frame();
    }
    w.carry = null;

    for (let k = 0; k < order.length; k++) {
      const c = order[k], slot = w.slots[c.i];
      yield* drag(DIGIT_X[c.i] + 10); // the hammer head lands on the digit's right edge
      yield* hold(2);
      if (k === 0) {
        yield* blow(false);
        slot.s = cracked(DIGITS[c.from]);
        yield* shake(2, 1);
        yield* hold(2);
        w.man.frame = H_READY;
        yield* hold(5);
      }
      yield* blow(true);
      chunks = chunks.concat(shatter(slot.s ?? DIGITS[c.from], DIGIT_X[c.i], DIGIT_X[c.i] + 7, 9, 0));
      slot.hidden = true;
      const next = order[k + 1];
      if (next) w.slots[next.i].s = cracked(DIGITS[next.from]);
      yield* shake(4, 1);
      yield* hold(4);
      w.man.frame = H_READY;
      yield* hold(4);
    }
    // The crane brings the new digits from the left, each as soon as he is out of its way, while he goes home.
    /** Whether the worker (and his hammer) is clear of the digit at x0: he is all to its right. */
    const clear = (x0: number) => w.man.x - 1 + (w.man.frame.ox ?? 0) > x0 + 7;
    function* craneJob(): Frames {
      for (const c of changes.slice().sort((a, b) => a.i - b.i)) {
        const slot = w.slots[c.i], x0 = DIGIT_X[c.i];
        while (!clear(x0)) yield;
        // Down fast, slow at the end, lets go, back up.
        slot.hidden = false;
        slot.s = DIGITS[c.to];
        slot.dy = -15;
        const down = (dy: number) => Math.min(0, dy + (dy < -4 ? 2 : 1)) - dy;
        crane = { x: x0 + 3, y: DIGIT_Y + slot.dy - 1, vy: down(slot.dy) };
        while (slot.dy < 0) {
          slot.dy += down(slot.dy);
          crane.y = DIGIT_Y + slot.dy - 1;
          crane.vy = down(slot.dy);
          yield;
        }
        for (const ch of chunks)
          if (ch.x + 1 >= x0 && ch.x <= x0 + 6) { ch.rest = false; ch.vy = -2.5; ch.vx = ch.x < x0 + 3 ? -1.5 : 1.5; }
        for (let k = 0; k < 3; k++) yield;
        crane.vy = -2;
        while (crane.y > -1) {
          crane.y -= 2;
          yield;
        }
        crane = null;
      }
    }
    // Remote out of his pocket: the crane starts behind him as he drags the hammer back to the box. The hammer goes
    // in, and he watches the crane finish from home, remote in hand.
    job = craneJob();
    yield* hold(3);
    yield* dragRight(BOX_STAND - 4);
    yield* run(putBack(w, SLEDGE, PAD));
    w.carry = null;
    let blink = 0;
    while (job) {
      w.man.frame = LOOK_UP_PAD[(blink++ >> 1) % 2];
      yield* frame();
    }
    w.man.frame = LOOK_UP_PAD[0];
    yield* hold(4);

    // What is left turns to dust and is gone.
    w.sfx = "crumble";
    while (chunks.length) {
      for (let k = chunks.length - 1; k >= 0; k--) if (chunks[k].rest && rnd(4) === 0) chunks.splice(k, 1);
      stepChunks(chunks);
      drawChunks(w, chunks, () => "d");
      yield;
    }
    w.fx = null;
    w.man.frame = FRONT; // the remote back in his pocket
    yield* wait(3);
    w.man.frame = HANDS_UP;
    w.man.dy = -1; yield* wait(2);
    w.man.dy = 0; yield* wait(8);
    w.man.frame = FRONT;
    for (const c of changes) { const s = w.slots[c.i]; s.value = c.to; s.s = null; s.dy = 0; }
    yield* wait(3);
  },
};
