// Arkanoid: he plays with the gamepad again, and a paddle on the floor knocks a ball up at the digits. Every hit
// knocks a few pixels out of a changing digit, like bricks; the digits that stay are steel and the ball bounces off
// them. Then multiball: three balls at once. Whatever is left at the end goes in one last blast. "Level 2": the new
// digits are laid row by row, in the colors of brick rows, and flash white.
import { blank, fromGrid, sprite } from "../gfx";
import { COLON, COLON_X, COLON_Y, DIGITS, DIGIT_X, DIGIT_Y, FRONT, HANDS_UP, HOME_X } from "../art";
import { fetchTool, putBack, walkTo, rnd, wait, type Frames, type Scene } from "./kit";
import { GAMEPAD, PLAY } from "./tetris";

/** The play field: left of him; the paddle's row (the ball bounces off it just above). */
const RIGHT = 44;
const PADDLE_Y = 14;
const PADDLE_W = 6;
/** Brick-row colors for the new digits, top to bottom. */
const ROWS = ["x", "x", "e", "e", "y", "y", "G", "G", "a", "a", "V", "V"];

interface Ball { x: number; y: number; vx: number; vy: number; }

export const arkanoid: Scene = {
  id: "arkanoid",
  name: "Arkanoid",
  tier: "hour",
  play: function* (w, changes) {
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    // The bricks: pixels of the changing digits (they break) and of the rest of the clock (steel).
    const brick: Record<string, number> = {}; // "x,y" -> slot, or -1 for steel
    const left: Record<number, Record<string, boolean>> = {};
    for (let i = 0; i < 4; i++) {
      const c = changes.filter((ch) => ch.i === i)[0];
      const s = DIGITS[c ? c.from : w.slots[i].value];
      if (c) left[i] = {};
      for (let j = 0; j < 12; j++)
        for (let k = 0; k < 7; k++)
          if (s.rows[j].charAt(k) === "#") {
            brick[`${DIGIT_X[i] + k},${DIGIT_Y + j}`] = c ? i : -1;
            if (c) left[i][`${k},${j}`] = true;
          }
    }
    COLON.rows.forEach((r, j) => { for (let k = 0; k < r.length; k++) if (r.charAt(k) === "#") brick[`${COLON_X + k},${COLON_Y + j}`] = -1; });
    const redraw = (i: number) => {
      const s = DIGITS[changes.filter((ch) => ch.i === i)[0].from];
      w.slots[i].s = sprite(s.rows.map((r, j) => r.split("").map((ch, k) => (ch === "#" && left[i][`${k},${j}`] ? "#" : ".")).join("")));
    };
    const remaining = () => Object.keys(brick).some((k) => brick[k] >= 0);

    const balls: Ball[] = [];
    let paddle = 30;
    let paddleV = 0;
    const sparks: { x: number; y: number; life: number }[] = [];
    const pic = (t: number) => {
      const g = blank(72, 16);
      const set = (x: number, y: number, c: string) => { if (x >= 0 && x < 72 && y >= 0 && y < 16) g[y][x] = c; };
      for (const s of sparks) set(s.x, s.y, "y");
      for (const b of balls) set(Math.round(b.x + b.vx * 2 * t), Math.round(b.y + b.vy * 2 * t), "f");
      const px = Math.round(paddle + paddleV * t);
      for (let x = px; x < px + PADDLE_W; x++) set(x, PADDLE_Y, x === px || x === px + PADDLE_W - 1 ? "m" : "a");
      return { s: fromGrid(g), x: 0, y: 0 };
    };
    let pose = 0;
    function* frame(): Frames {
      for (let k = sparks.length - 1; k >= 0; k--) if (--sparks[k].life <= 0) sparks.splice(k, 1);
      if (rnd(2) === 0) { pose = (pose + 1) % PLAY.length; w.man.frame = PLAY[pose]; }
      w.fx = { ...pic(0), at: pic };
      yield;
      paddle += paddleV;
    }
    /** Breaks the brick at (x, y), and the ones around it a little. */
    const hit = (x: number, y: number) => {
      const i = brick[`${x},${y}`];
      if (i === undefined) return;
      if (i < 0) { w.sfx = "beep"; return; } // steel
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${x + dx},${y + dy}`;
        if (brick[k] !== i) continue;
        delete brick[k];
        delete left[i][`${x + dx - DIGIT_X[i]},${y + dy - DIGIT_Y}`];
      }
      redraw(i);
      sparks.push({ x, y, life: 2 });
      w.sfx = "pop";
    };
    /** One step of the balls: two pixels each, bouncing off walls, bricks and the paddle. */
    const move = () => {
      for (let n = 0; n < 2; n++)
        for (const b of balls) {
          const nx = b.x + b.vx, ny = b.y + b.vy;
          if (nx < 0 || nx > RIGHT) b.vx = -b.vx;
          else if (brick[`${nx},${b.y}`] !== undefined) { hit(nx, b.y); b.vx = -b.vx; }
          if (ny < 0) b.vy = -b.vy;
          else if (ny >= PADDLE_Y) b.vy = -1;
          else if (brick[`${b.x},${ny}`] !== undefined) { hit(b.x, ny); b.vy = -b.vy; }
          else if (brick[`${b.x + b.vx},${ny}`] !== undefined) { hit(b.x + b.vx, ny); b.vx = -b.vx; b.vy = -b.vy; }
          b.x = Math.max(0, Math.min(RIGHT, b.x + b.vx));
          b.y = Math.max(0, Math.min(PADDLE_Y - 1, b.y + b.vy));
        }
    };
    /** The paddle goes under the ball that is coming down lowest. */
    const steer = () => {
      const down = balls.filter((b) => b.vy > 0).sort((a, b) => b.y - a.y)[0] ?? balls[0];
      const want = Math.max(0, Math.min(RIGHT - PADDLE_W + 1, down.x - 2));
      paddleV = Math.max(-3, Math.min(3, want - paddle));
    };

    yield* fetchTool(w, GAMEPAD);
    yield* walkTo(w, HOME_X);
    w.carry = null;
    w.man.dir = 0;
    yield* frame();
    // Serve.
    balls.push({ x: 33, y: PADDLE_Y - 1, vx: -1, vy: -1 });
    w.sfx = "beep";
    let steps = 0;
    while (remaining() && steps < 110) {
      steps++;
      if (steps === 25) {
        // Multiball!
        w.sfx = "magic";
        const b = balls[0];
        balls.push({ x: b.x, y: b.y, vx: -b.vx, vy: b.vy }, { x: b.x, y: b.y, vx: b.vx, vy: -b.vy });
      }
      move();
      steer();
      yield* frame();
    }
    // The last of it goes in one blast.
    if (remaining()) {
      w.sfx = "boom";
      w.shake.x = 1;
      for (const k of Object.keys(brick)) {
        const i = brick[k];
        if (i < 0) continue;
        const [x, y] = k.split(",").map(Number);
        sparks.push({ x, y, life: 3 });
        delete brick[k];
        delete left[i][`${x - DIGIT_X[i]},${y - DIGIT_Y}`];
      }
      for (const c of changes) redraw(c.i);
      yield* frame();
      w.shake.x = 0;
    }
    balls.length = 0;
    paddleV = 0;
    for (const c of changes) w.slots[c.i].hidden = true;
    for (let k = 0; k < 6; k++) yield* frame();

    // Level 2: the new digits laid a row at a time, in brick colors; then white.
    for (let j = 0; j < 12; j++) {
      for (const c of changes) {
        const s = DIGITS[c.to];
        w.slots[c.i].hidden = false;
        w.slots[c.i].s = sprite(s.rows.map((r, jj) => (jj <= j ? r.replace(/#/g, ROWS[jj]) : ".".repeat(r.length))));
      }
      w.sfx = "beep";
      yield* frame();
    }
    yield* frame();
    w.sfx = "tada";
    for (let k = 0; k < 4; k++) {
      for (const c of changes) w.slots[c.i].s = k % 2 ? DIGITS[c.to] : sprite(DIGITS[c.to].rows.map((r, jj) => r.replace(/#/g, ROWS[jj])));
      yield* frame();
    }
    for (const c of changes) w.slots[c.i].s = null;
    w.fx = null;
    w.man.frame = HANDS_UP;
    w.man.dy = -1; yield* wait(2);
    w.man.dy = 0; yield* wait(6);
    w.man.frame = FRONT;
    yield* wait(2);
    yield* putBack(w, GAMEPAD);
  },
};
