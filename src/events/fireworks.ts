// New Year, 00:00 on January 1st, after the hour's scene: he takes a fireworks battery out of the box, sets it down,
// lights the fuse and steps back; rockets go up one after another and burst into stars of every colour, behind and
// over the digits, a big finale at the end. Then the empty battery goes back in the box.
import { blank, fromGrid, sprite } from "../gfx";
import { FRONT, HANDS_UP, HOME_X, LOOK_UP, WORK_L } from "../art";
import { fetchTool, putBack, walkTo, rnd, wait, layer, type Frames, type Scene } from "../scenes/kit";

/** The battery: a red box of tubes, carried and on the floor; where it stands. */
const BATTERY = sprite(["m.m.m", "xxxxx", "xyxyx"]);
const AT = 40;
const COLORS = ["y", "x", "a", "G", "V", "f", "w"];

export const fireworks: Scene = {
  id: "fireworks",
  name: "Happy New Year",
  tier: "event",
  at: { digits: [0, 0, 0, 0], slots: [] },
  play: function* (w) {
    let down = false, fuse = -1;
    const rockets: { x: number; y: number; vx: number; top: number; c: string }[] = [];
    const stars: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
    function* frame(): Frames {
      for (let k = rockets.length - 1; k >= 0; k--) {
        const r = rockets[k];
        r.y -= 1.2;
        r.x += r.vx;
        if (r.y <= r.top) {
          // Burst: a ring of stars.
          const n = 10 + rnd(6);
          for (let s = 0; s < n; s++) {
            const a = (s / n) * Math.PI * 2, sp = 0.8 + Math.random() * 0.5;
            stars.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp * 1.4, vy: Math.sin(a) * sp, life: 10 + rnd(6), c: r.c });
          }
          rockets.splice(k, 1);
        }
      }
      for (let k = stars.length - 1; k >= 0; k--) {
        const s = stars[k];
        s.x += s.vx; s.y += s.vy; s.vx *= 0.9; s.vy = s.vy * 0.9 + 0.06;
        if (--s.life <= 0) stars.splice(k, 1);
      }
      // Rockets and stars fly on between steps (60 fps); the twinkle still changes on the step.
      w.fx = layer((t) => {
        const g = blank(72, 16);
        const set = (x: number, y: number, c: string) => { const X = Math.round(x), Y = Math.round(y); if (X >= 0 && X < 72 && Y >= 0 && Y < 15) g[Y][X] = c; };
        if (down) {
          BATTERY.rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r.charAt(i) !== ".") set(AT + i, 12 + j, r.charAt(i)); });
          if (fuse >= 0) set(AT + 5 + fuse, 14, rnd(2) ? "y" : "f");
        }
        for (const r of rockets) {
          const x = r.x + r.vx * t, y = r.y - 1.2 * t;
          set(x, y, "y"); set(x - r.vx, y + 1, "f");
        }
        for (const s of stars) set(s.x + s.vx * t, s.y + s.vy * t, s.life < 4 ? (rnd(2) ? s.c : ".") : s.c);
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
    const launch = (top?: number, x?: number) => {
      // It flies up and across to where it bursts: x, at row `top`.
      const tx = x ?? 6 + rnd(60), ty = top ?? 1 + rnd(7);
      w.sfx = "firework";
      const frames = (11 - ty) / 1.2;
      rockets.push({ x: AT + 1 + rnd(3), y: 11, vx: (tx - AT - 2) / frames, top: ty, c: COLORS[rnd(COLORS.length)] });
    };

    yield* run(fetchTool(w, BATTERY));
    yield* run(walkTo(w, AT + 6));
    w.carry = null;
    w.man.dir = -1;
    w.man.frame = WORK_L;
    down = true;
    yield* hold(4);
    // Light the fuse, and back off fast.
    w.hand = { x: AT + 6, y: 14, c: "o" };
    yield* hold(3);
    w.hand = null;
    fuse = 3;
    yield* run(walkTo(w, HOME_X));
    w.man.frame = LOOK_UP;
    while (fuse > 0) { fuse--; yield* hold(3); }
    fuse = -1;
    // The show.
    for (let k = 0; k < 14; k++) {
      launch();
      yield* hold(5 + rnd(5));
    }
    yield* hold(4);
    for (let k = 0; k < 5; k++) launch(2 + rnd(4), 8 + k * 12);
    yield* hold(10);
    w.man.frame = HANDS_UP;
    w.sfx = "tada";
    w.man.dy = -1;
    yield* hold(3);
    w.man.dy = 0;
    while (rockets.length || stars.length) yield* frame();
    yield* hold(6);
    w.man.frame = FRONT;
    // Pick the empty battery up and put it away.
    yield* run(walkTo(w, AT + 6));
    down = false;
    yield* run(putBack(w, BATTERY));
    w.fx = null;
    yield* wait(2);
  },
};
