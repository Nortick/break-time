// The kit every scene is built from: what a scene is, timing, walking, the toolbox, the per-digit loop, and the 14x14
// pose canvas for hand-drawn poses with a tool.
//
// HOW TO ADD A SCENE
//   1. Copy _template.ts to a new file in this folder and rename the scene in it.
//   2. Draw the poses (pose14 + art14), write play() as a generator: change the World, `yield` = one step (0.1 s).
//      The files play at 60 fps: tools/bake.ts draws the 5 frames between two steps itself. Whatever moved more than a
//      pixel glides there (digits, tools, the worker, a sprite on fx/front); poses change on the step, like 2D
//      animation. Particles you draw yourself on fx: build the layer with layer() / drawLayer() / drawDots() and draw
//      them t of the way to the next step (x + vx * t), and they fly smoothly too. Motion that must go with the poses
//      (a rope pulled hand over hand): set `stepped: true` on the scene.
//   3. Add it to the list in index.ts. Nothing else changes: main.ts picks scenes from that list.
// Rules of the drawing: like 2D animation, a prop never changes length; motion is whole pose frames swapped and the
// sprite moved. The worker never levitates (his feet stay on the floor) and his arms never grow.
import { blank, fromGrid, mirror, type Sprite } from "../gfx";
import { BOX_RIM, BOX_STAND, BOX_X, DIGITS, DIGIT_X, FRONT, HOME_X, MAN_Y, WALK_L, WALK_R, WORK_L } from "../art";
import { type Fx, type Placed, type World } from "../world";

/** One digit to change: its slot (0–3, left to right), what it shows and what it should show. */
export interface Change {
  i: number;
  from: number;
  to: number;
}

/**
 * minute: a minute digit; ten: the tens of minutes; hour: an hour digit; idle: no digit, he just lives at rest; event:
 * a show main.ts starts at a set time (12:34, New Year, Friday evening), no digit changes; tap: his answer to a press
 * of OK (src/taps), no digit changes; night: his night on the box (src/night), no digit changes.
 */
export type Tier = "minute" | "ten" | "hour" | "idle" | "event" | "tap" | "night";

export interface Scene {
  id: string;
  /** Shown on the back display. ASCII only: the fonts have no other letters. */
  name: string;
  tier: Tier;
  play(w: World, changes: Change[]): Frames;
  /** An easter egg: not in the usual turn of scenes, it comes up only now and then (see main.ts). */
  rare?: boolean;
  /** Another take on the scene with this id: now and then it plays instead of it (see main.ts). */
  variantOf?: string;
  /** For an event: the digits on the clock when it plays, and which of them its file draws (the rest stay still). */
  at?: { digits: number[]; slots: number[] };
  /**
   * Things move on the step only, no in-betweens (see tools/bake.ts): for a scene whose motion goes with the poses,
   * like hauling a rope hand over hand.
   */
  stepped?: boolean;
  /**
   * Minute changes only (one digit), never a change of the tens: for a scene too long to do two digits (2026-11-23:
   * puzzle, bricks). main.ts then picks another scene of the pool for the tens.
   */
  minuteOnly?: boolean;
  /** Its last frame stays as it is (the digits lined up, a bottle left on the floor): main.ts draws that state after. */
  keeps?: boolean;
}

/** The digit drawn smaller or bigger, sw x sh, by nearest pixel. */
export function scaled(s: Sprite, sw: number, sh: number): Sprite {
  const g = blank(sw, sh);
  for (let j = 0; j < sh; j++)
    for (let i = 0; i < sw; i++) g[j][i] = s.rows[Math.floor(((j + 0.5) * s.h) / sh)].charAt(Math.floor(((i + 0.5) * s.w) / sw)) || ".";
  return fromGrid(g);
}

export type Frames = Generator<void, void, void>;

export const rnd = (n: number) => Math.floor(Math.random() * n);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Stands still for n frames. */
export function* wait(n: number): Frames {
  for (let k = 0; k < n; k++) yield;
}

/** Walks to x, a pixel a frame, legs moving every other frame. */
export function* walkTo(w: World, x: number): Frames {
  let step = 0;
  while (w.man.x !== x) {
    const dir = x < w.man.x ? -1 : 1;
    w.man.x += dir;
    step++;
    w.man.dir = dir;
    w.man.frame = (dir < 0 ? WALK_L : WALK_R)[(step >> 1) % 2];
    yield;
  }
  w.man.frame = FRONT;
  w.man.dir = 0;
}

export const WORK_R = mirror(WORK_L);

/** Where a carried tool's top is when he stands at the box, facing it (see render() in world.ts). */
const HAND_X = BOX_STAND + 6;
const HAND_Y = MAN_Y + 5;
/** Where a tool stands in the box, in its middle. */
const IN_BOX_X = BOX_X + 2;

/**
 * Goes to the toolbox, opens it, and the tool comes up out of it (hidden by the box's side while it is inside) and
 * into his hand. He leaves carrying it.
 */
export function* fetchTool(w: World, tool: Sprite): Frames {
  yield* walkTo(w, BOX_STAND);
  w.man.frame = WORK_R;
  w.man.dir = 1;
  yield* wait(2);
  w.box = 1; yield* wait(2);
  w.box = 2; yield* wait(2);
  const out = BOX_RIM - tool.h; // fully out of the box
  for (let y = BOX_RIM; y >= out; y--) {
    w.item = { s: tool, x: IN_BOX_X, y };
    yield;
  }
  yield* wait(2);
  w.item = { s: tool, x: (IN_BOX_X + HAND_X) >> 1, y: (out + HAND_Y) >> 1 };
  yield;
  w.item = null;
  w.carry = tool;
  yield* wait(2);
  w.box = 1; yield;
  w.box = 0; yield* wait(2);
}

/**
 * Back to the box: the tool goes from his hand down into it, behind its side. Then home, carrying `then` if given
 * (something he holds on to after, like the crane's remote).
 */
export function* putBack(w: World, tool: Sprite, then: Sprite | null = null): Frames {
  w.carry = tool;
  yield* walkTo(w, BOX_STAND);
  w.man.frame = WORK_R;
  w.man.dir = 1;
  w.box = 1; yield;
  w.box = 2; yield* wait(2);
  const out = BOX_RIM - tool.h;
  w.carry = null;
  w.item = { s: tool, x: (IN_BOX_X + HAND_X) >> 1, y: (out + HAND_Y) >> 1 };
  yield;
  for (let y = out; y <= BOX_RIM; y++) {
    w.item = { s: tool, x: IN_BOX_X, y };
    yield;
  }
  w.item = null;
  w.carry = then;
  w.box = 1; yield;
  w.box = 0; yield* wait(2);
  yield* walkTo(w, HOME_X);
}

/**
 * The usual shape of a scene: (take the tool from the box), then each changing digit in turn, right to left: walk to
 * `stand` pixels right of the digit, run `each` for it, the digit is set to its new value; at the end (put the tool
 * back) and go home. Without a tool he goes bare-handed. `each` only has to animate one digit.
 */
export function perDigit(each: (w: World, c: Change) => Frames, tool?: Sprite, stand = 8) {
  return function* (w: World, changes: Change[]): Frames {
    if (tool) yield* fetchTool(w, tool);
    const order = changes.slice().sort((a, b) => b.i - a.i);
    for (const c of order) {
      yield* walkTo(w, DIGIT_X[c.i] + stand);
      if (tool) w.carry = null; // from here the tool is drawn in his pose frames
      w.man.dir = -1;
      // The slot already holds the new value; the old digit stays on as the scene's picture until the scene changes
      // it. So a scene that lets go of the picture (slot.s = null) shows the new digit, never the old one again.
      const slot = w.slots[c.i];
      slot.value = c.to;
      slot.s = DIGITS[c.from];
      yield* each(w, c);
      slot.s = null;
      slot.dx = slot.dy = 0;
      slot.hidden = false;
      w.hand = w.tool = null;
      w.item = null;
      w.fx = null;
      if (tool) w.carry = tool;
      w.man.frame = FRONT;
      yield* wait(2);
    }
    if (tool) yield* putBack(w, tool);
    else yield* walkTo(w, HOME_X);
  };
}

/** One pass of a scene over the changing digits (see phased()). */
export interface Phase {
  each: (w: World, c: Change) => Frames;
  /** Visit the digits left to right (default: right to left, the way he comes from home). */
  leftFirst?: boolean;
  /** How far right of the digit he stands for this pass (default: the scene's). */
  stand?: number;
}

/**
 * Like perDigit, in several passes: e.g. first wipe every changing digit off (right to left), then paint them all
 * (left to right). Each pass walks to each digit in its order and runs its `each`. Every slot holds its new value from
 * the start, its old digit stays on as the picture until a pass changes it; at the end everything is set back.
 */
export function phased(phases: Phase[], tool?: Sprite, stand = 8) {
  return function* (w: World, changes: Change[]): Frames {
    if (tool) yield* fetchTool(w, tool);
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    for (const ph of phases) {
      const order = changes.slice().sort((a, b) => (ph.leftFirst ? a.i - b.i : b.i - a.i));
      for (const c of order) {
        if (tool) w.carry = tool;
        yield* walkTo(w, DIGIT_X[c.i] + (ph.stand ?? stand));
        if (tool) w.carry = null;
        w.man.dir = -1;
        yield* ph.each(w, c);
        w.hand = w.tool = null;
        w.item = null;
        w.fx = null;
      }
    }
    for (const c of changes) {
      const slot = w.slots[c.i];
      slot.s = null;
      slot.dx = slot.dy = 0;
      slot.hidden = false;
    }
    w.man.frame = FRONT;
    yield* wait(2);
    if (tool) yield* putBack(w, tool);
    else yield* walkTo(w, HOME_X);
  };
}

// THE POSE CANVAS. A pose with a tool is a 14x14 picture: the worker, facing left, stands in columns 7-13 from row 2
// (his feet on row 13), and the tool and his arm are drawn in front of him. On the display, column c of the canvas is
// at man.x - 7 + c and row r at MAN_Y - 2 + r, so row 1 is the digits' top row and row 12 their bottom row.
// When he stands `stand` pixels right of a digit, column (7 - stand) + k is the digit's column k: for stand 13, column 0
// is the digit's right edge.

/** Leg frames: standing, and a shuffle step. */
export const LEGS = [["..ppp..", "..p.p..", "..p.p..", ".ss.ss."], ["..ppp..", ".pp.p..", ".p..p..", ".s..ss."]];

/** The worker's head and body facing left, without the arm (the pose draws it). */
const UPPER = ["..hhh..", "hhhhh..", ".oooo..", ".o.oo..", ".oooo..", "..bbb..", "..bbb..", "..bbb.."];

/** A whole pose: the worker with `legs`, and `art` (rows of the canvas, "." empty) drawn over him. */
export function pose14(art: string[], legs: string[] = LEGS[0]): Sprite {
  const g = blank(14, 14);
  [...UPPER, ...legs].forEach((r, j) => {
    for (let i = 0; i < 7; i++) if (r.charAt(i) !== ".") g[2 + j][7 + i] = r.charAt(i);
  });
  art.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r.charAt(i) !== ".") g[j][i] = r.charAt(i);
  });
  return Object.assign(fromGrid(g), { ox: -7, oy: -2 });
}

/** The art for pose14 from single pixels: [column, row, color]. Handy for an arm and a thin tool. */
export function art14(plot: [number, number, string][]): string[] {
  const g = blank(14, 14);
  for (const [x, y, c] of plot) g[y][x] = c;
  return g.map((r) => r.join(""));
}

/** Where canvas column c and row r are on the display, for a pose drawn with the worker at x. */
export const canvasX = (manX: number, c: number) => manX - 7 + c;
export const canvasY = (r: number) => MAN_Y - 2 + r;

/**
 * A crane's hook on its cable, the cable going up off the top of the screen: placed with its top at the hook's row - 15
 * and its left at the hook's column - 1. One picture wherever the hook is, so between steps it glides with the digit it
 * holds (see tools/bake.ts).
 */
export const HOOK: Sprite = fromGrid([...Array.from({ length: 15 }, () => [".", "r", "."]), ["m", "m", "m"]]);

/** Particles, for dust, debris, air: a 1-pixel dot each, drawn by drawDots(). */
export interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  c: string;
}

/** Moves the dots one frame and drops those that are spent or off the display. */
export function stepDots(dots: Dot[]): void {
  for (let k = dots.length - 1; k >= 0; k--) {
    const d = dots[k];
    d.x += d.vx;
    d.y += d.vy;
    d.life--;
    if (d.life <= 0 || d.x < 0 || d.x >= 72 || d.y < 0 || d.y >= 15) dots.splice(k, 1);
  }
}

/**
 * An effect layer drawn by pic(t): the picture now (t = 0), and pic again for the in-between frames up to the next step
 * (t up to 1, see tools/bake.ts). The in-betweens get the same random numbers as the picture now, so a flicker still
 * changes on the step and the scene's random numbers stay as they were.
 */
export function layer(pic: (t: number) => Placed | null): Fx | null {
  const used: number[] = [];
  const real = Math.random;
  let now: Placed | null;
  Math.random = () => {
    const v = real();
    used.push(v);
    return v;
  };
  try {
    now = pic(0);
  } finally {
    Math.random = real;
  }
  if (!now) return null;
  const at = (t: number) => {
    let k = 0;
    const r = Math.random;
    Math.random = () => (k < used.length ? used[k++] : 0.5);
    try {
      return pic(t);
    } finally {
      Math.random = r;
    }
  };
  return { ...now, at };
}

/** Puts the dots on the effect layer, cropped to the columns x0..x1 (a narrower picture is quicker to send). */
export function drawDots(w: World, dots: Dot[], x0 = 0, x1 = 72): void {
  if (!dots.length) {
    w.fx = null;
    return;
  }
  const pic = (t: number) => {
    const g = blank(x1 - x0, 16);
    for (const d of dots) {
      const X = Math.round(d.x + d.vx * t) - x0, Y = Math.round(d.y + d.vy * t);
      if (X >= 0 && X < x1 - x0 && Y >= 0 && Y < 16) g[Y][X] = d.c;
    }
    return { s: fromGrid(g), x: x0, y: 0 };
  };
  w.fx = layer(pic);
}

/** A moving pixel for drawLayer(): where it is and how far it moves by the next step. */
export interface Mover {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  /** Gravity: added to vy before the next step's move. */
  ay?: number;
  /** The lowest row it can fall to (the floor it lands on). */
  floor?: number;
}

/**
 * The effect layer as a picture of the whole screen drawn by `draw`, which plots pixels through `put`. `put(x, y, c,
 * m)` with a mover m places the pixel where m will be a part t of the way to the next step, so it flies smoothly in the
 * 60 fps file; without m the pixel stays where it is. Draws nothing (fx = null) if nothing was plotted.
 */
export function drawLayer(w: World, draw: (put: (x: number, y: number, c: string, m?: Mover | null) => void, t: number) => void, floor = 16): void {
  w.fx = layer((t) => {
    const g = blank(72, 16);
    let any = false;
    draw((x, y, c, m) => {
      const X = Math.round(x + (m && m.vx ? m.vx * t : 0));
      let Y = Math.round(y + (m && (m.vy || m.ay) ? ((m.vy ?? 0) + (m.ay ?? 0)) * t : 0));
      if (m && m.floor !== undefined && Y > m.floor) Y = Math.max(m.floor, Math.round(y));
      if (X >= 0 && X < 72 && Y >= 0 && Y < floor) { g[Y][X] = c; any = true; }
    }, t);
    return any ? { s: fromGrid(g), x: 0, y: 0 } : null;
  });
}
