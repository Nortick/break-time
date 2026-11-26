// Bowling, "Strike!": he takes a bowling ball out of the box, swings it back and rolls it along the floor. It knocks
// the changing digits over like pins, and they tumble away, knocking each other on. He cheers; a pinsetter rack comes
// down from above with the new digits and sets them on the floor. The ball rolls back to him and goes into the box.
import { sprite, blank, fromGrid, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, FRONT, HANDS_UP, LOOK_UP, WORK_L, HOME_X } from "../art";
import { fetchTool, putBack, walkTo, LEGS, wait, type Frames, type Scene } from "./kit";

/** The ball as he carries it: red, a dark finger hole. */
const BALL = sprite([".xx.", "xqxx", "xxxx", ".xx."]);
/** The ball rolling, its finger hole going round: the hole's place in the 4x4 for each quarter turn. */
const HOLES: [number, number][] = [[1, 1], [1, 2], [2, 2], [2, 1]];
const BALL_Y = 11;

/** The worker's upper body facing left (as in kit's pose14), without the arm. */
const UPPER = ["..hhh..", "hhhhh..", ".oooo..", ".o.oo..", ".oooo..", "..bbb..", "..bbb..", "..bbb.."];
/**
 * A pose 18 wide: like kit's pose14 (him in columns 7-13, his feet on row 13), with 4 more columns behind him for the
 * ball in the backswing.
 */
function pose18(art: [number, number, string][], legs: string[] = LEGS[0]): Sprite {
  const g = blank(18, 14);
  [...UPPER, ...legs].forEach((r, j) => {
    for (let i = 0; i < 7; i++) if (r.charAt(i) !== ".") g[2 + j][7 + i] = r.charAt(i);
  });
  for (const [x, y, c] of art) g[y][x] = c;
  return Object.assign(fromGrid(g), { ox: -7, oy: -2 });
}
const ballAt = (x: number, y: number): [number, number, string][] => {
  const out: [number, number, string][] = [];
  BALL.rows.forEach((r, j) => { for (let i = 0; i < 4; i++) if (r.charAt(i) !== ".") out.push([x + i, y + j, r.charAt(i)]); });
  return out;
};
/** Ready: the ball held at his chest, both hands under it. */
const READY = pose18([...ballAt(5, 7), [8, 9, "o"], [9, 10, "b"]]);
/** The backswing: arm straight back, the ball behind him at hip height. */
const BACK = pose18([[12, 9, "b"], [13, 10, "o"], ...ballAt(14, 9)], LEGS[1]);
/** The release: a long step forward, arm down, the ball let go on the floor in front of him. */
const RELEASE = pose18([[8, 9, "b"], [7, 10, "o"], ...ballAt(3, 10)], LEGS[1]);
/** After the release: arm out in front, following through. */
const FOLLOW = pose18([[8, 9, "b"], [7, 8, "b"], [6, 7, "o"]], LEGS[1]);
/** Bending down to take the ball back. */
const PICK = sprite([".......", ".......", "..hhh..", "hhhhh..", ".oooo..", ".o.oo..", ".oooo..", "obbbb..", ".bbbb..", ".ppp...", ".p..p..", "ss..ss."]);

/** A digit flying as a knocked-over pin: its middle, its turn, and how they change each step. */
interface Pin {
  s: Sprite;
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  va: number;
}

export const bowling: Scene = {
  id: "bowling",
  name: "Strike!",
  tier: "hour",
  play: function* (w, changes) {
    const order = changes.slice().sort((a, b) => b.i - a.i); // right to left, the way the ball goes
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    /** The ball on the floor: its left column, how far it rolls by the next step, how far it has turned. */
    let ball: { x: number; v: number; turn: number } | null = null;
    const pins: Pin[] = [];
    const standing = order.slice();
    /** The pinsetter: the rack's bar row and how far it moves by the next step; null when it is away. */
    let rack: { y: number; v: number } | null = null;
    const G = 0.35;

    const draw = () => {
      w.fx = {
        ...picture(0),
        at: (t: number) => picture(t),
      };
    };
    function picture(t: number) {
      const g = blank(72, 16);
      const set = (x: number, y: number, c: string) => { if (x >= 0 && x < 72 && y >= 0 && y < 16) g[y][x] = c; };
      if (ball) {
        const bx = Math.round(ball.x + ball.v * t);
        const hole = HOLES[Math.floor(ball.turn + (ball.v ? t * 1.5 * Math.sign(-ball.v) : 0) + 400) % 4];
        BALL.rows.forEach((r, j) => { for (let i = 0; i < 4; i++) if (r.charAt(i) !== ".") set(bx + i, BALL_Y + j, "x"); });
        set(bx + hole[0], BALL_Y + hole[1], "q");
      }
      for (const p of pins) {
        const cx = p.x + p.vx * t, cy = p.y + (p.vy + G) * t, a = p.a + p.va * t;
        const cos = Math.cos(a), sin = Math.sin(a);
        // Every pixel of the digit, in 3x3 bits, turned and put where it lands: no holes in the strokes.
        for (let v = 0; v < 12; v++)
          for (let u = 0; u < 7; u++) {
            if (p.s.rows[v].charAt(u) !== "#") continue;
            for (const su of [0.17, 0.5, 0.83])
              for (const sv of [0.17, 0.5, 0.83]) {
                const dx = u + su - 3.5, dy = v + sv - 6;
                set(Math.floor(cx + dx * cos - dy * sin), Math.floor(cy + dx * sin + dy * cos), "#");
              }
          }
      }
      if (rack) {
        const ry = Math.round(rack.y + rack.v * t);
        for (let y = 0; y < ry - 1; y++) { set(10, y, "m"); set(37, y, "m"); }
        for (let x = 4; x < 42; x++) { set(x, ry - 1, "m"); set(x, ry, "r"); }
        for (const x of [4, 41]) set(x, ry - 1, "y");
      }
      return { s: fromGrid(g), x: 0, y: 0 };
    }
    function* frame(): Frames {
      if (ball) {
        ball.x += ball.v;
        ball.turn += Math.sign(-ball.v) * 1.5;
        if (ball.x < -6 || ball.x > 72) ball = null;
      }
      for (let k = pins.length - 1; k >= 0; k--) {
        const p = pins[k];
        p.vy += G; p.x += p.vx; p.y += p.vy; p.a += p.va;
        if (p.x < -10 || p.y > 26 || p.y < -14) pins.splice(k, 1);
      }
      // A pin goes over when the ball or a flying pin reaches it.
      for (let k = standing.length - 1; k >= 0; k--) {
        const c = standing[k], right = DIGIT_X[c.i] + 7;
        const byBall = ball && ball.v < 0 && ball.x <= right;
        const byPin = pins.some((p) => p.x - 3 <= right && p.x > DIGIT_X[c.i] && p.y > DIGIT_Y + 1);
        if (!byBall && !byPin) continue;
        standing.splice(k, 1);
        w.slots[c.i].hidden = true;
        w.sfx = "hit";
        pins.push({
          s: DIGITS[c.from], x: DIGIT_X[c.i] + 3.5, y: DIGIT_Y + 6,
          vx: -2.6 - Math.random() * 1.2, vy: -2.2 - Math.random() * 1.2, a: 0, va: -(0.22 + Math.random() * 0.2),
        });
      }
      draw();
      yield;
    }
    function* hold(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }

    // The ball from the box; he faces the lane.
    yield* fetchTool(w, BALL);
    w.carry = null;
    w.man.dir = -1;
    w.man.frame = READY;
    yield* hold(8);
    // Swing back... and roll.
    w.man.frame = BACK;
    yield* hold(4);
    w.man.x -= 1;
    w.man.frame = RELEASE;
    yield* hold(2);
    w.sfx = "whoosh";
    ball = { x: w.man.x - 7 + 3, v: -3, turn: 0 };
    w.man.frame = FOLLOW;
    yield* hold(1);
    // He watches it go, holding the pose, till the last pin is down and gone.
    while (ball || pins.length || standing.length) yield* frame();
    w.fx = null;
    // Strike!
    w.sfx = "tada";
    w.man.frame = HANDS_UP;
    for (const dy of [-1, 0, -1, 0]) { w.man.dy = dy; yield* hold(3); }
    w.man.frame = FRONT;
    yield* hold(4);

    // The pinsetter comes down with the new digits under its bar and leaves them on the floor.
    w.man.frame = LOOK_UP;
    for (const c of changes) { const s = w.slots[c.i]; s.hidden = false; s.s = DIGITS[c.to]; }
    const top = DIGIT_Y - 1; // the bar's row with the digits set down
    rack = { y: top - 15, v: 0 };
    while (rack.y < top) {
      const v = Math.min(2, top - rack.y);
      rack.v = v;
      for (const c of changes) w.slots[c.i].dy = rack.y + 1 - DIGIT_Y;
      w.sfx = "crane";
      yield* frame();
      rack.y += v;
    }
    rack.v = 0;
    for (const c of changes) w.slots[c.i].dy = 0;
    w.sfx = "thud";
    w.shake.y = 1;
    yield* frame();
    w.shake.y = 0;
    yield* hold(4);
    while (rack.y > -2) {
      rack.v = -2;
      w.sfx = "crane";
      yield* frame();
      rack.y -= 2;
    }
    rack = null;
    for (const c of changes) w.slots[c.i].s = null;
    w.man.frame = FRONT;
    yield* hold(3);

    // The ball comes back from the left and stops at his feet.
    yield* walkTo(w, HOME_X);
    w.man.dir = -1;
    w.man.frame = WORK_L;
    ball = { x: -5, v: 3, turn: 0 };
    w.sfx = "whoosh";
    const stop = HOME_X - 6;
    while (ball && ball.x + ball.v < stop) yield* frame();
    if (ball) { ball.v = 0; ball.x = stop; }
    yield* hold(3);
    w.man.frame = PICK;
    yield* hold(3);
    ball = null;
    w.fx = null;
    w.carry = BALL;
    w.man.frame = FRONT;
    yield* wait(2);
    yield* putBack(w, BALL);
  },
};
