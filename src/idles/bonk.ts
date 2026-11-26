// IDLE "Bonk": a little digit drops out of nowhere and lands with a thud on the floor right beside him. He jumps with
// fright, hands up; then stares at it, looks up (where did that come from?), at it again, picks it up and flings it
// away to the left, off the screen.
import { sprite, mirror } from "../gfx";
import { FRONT, HANDS_UP, HOME_X, MAN_Y, LOOK_UP } from "../art";
import { wait, rnd, type Scene } from "../scenes/kit";
import { LEGS, compose } from "./parts";

/** A little 7, 3x4. */
const MINI = sprite(["###", "..#", ".#.", ".#."]);
/** Where it lands: on the floor just left of him. */
const LAND_X = HOME_X - 5;
const LAND_Y = 11;
/** Looking down to his left, at it. */
const LOOK_AT = sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".ooooo.", "o.oo.o.", "..bbb..", "bbbbbbb", "o.bbb.o", ...LEGS]);
/** Bending down for it, and the throw to the left: his left arm up and out. */
const CROUCH = sprite([".......", ".......", ".......", "..hhh..", ".hhhhhh", ".ooooo.", ".o.o.o.", ".ooooo.", "bbbbbbb", "o.bbb.o", ".pp.pp.", ".ss.ss."]);
const THROW = Object.assign(mirror(sprite(["..hhh...", ".hhhhhh.", ".ooooo.o", ".o.o.ob.", ".ooooob.", "..bbbb..", "bbbbb...", "o.bbb...", ...LEGS])), { ox: -1, oy: 0 });

export const bonk: Scene = {
  id: "bonk",
  name: "Bonk",
  tier: "idle",
  *play(w) {
    w.man.frame = FRONT;
    yield* wait(4);
    // Down it comes, faster and faster, and lands beside him with a thud and a puff of dust.
    w.sfx = "whoosh";
    let y = -4, v = 0.5;
    while (y < LAND_Y) {
      y = Math.min(LAND_Y, y + v);
      v = Math.min(v + 0.5, 3);
      w.fx = compose([{ s: MINI, x: LAND_X, y: Math.round(y) }]);
      yield;
    }
    const dust: { x: number; y: number; vx: number; life: number }[] = [];
    for (let k = 0; k < 4; k++) {
      dust.push({ x: LAND_X - 1, y: 14 - rnd(2), vx: -0.6 - Math.random() * 0.5, life: 4 + rnd(3) });
      dust.push({ x: LAND_X + 3, y: 14 - rnd(2), vx: 0.6 + Math.random() * 0.5, life: 4 + rnd(3) });
    }
    const show = () => {
      for (let k = dust.length - 1; k >= 0; k--) { dust[k].x += dust[k].vx; if (--dust[k].life <= 0) dust.splice(k, 1); }
      w.fx = compose([{ s: MINI, x: LAND_X, y: LAND_Y }, ...dust.map((d) => ({ s: sprite(["d"]), x: Math.round(d.x), y: d.y }))]);
    };
    // He jumps with fright, hands up.
    w.sfx = "boing";
    w.man.frame = HANDS_UP;
    for (const dy of [-1, -2, -2, -1, 0]) { w.man.dy = dy; show(); yield; }
    for (let k = 0; k < 6; k++) { show(); yield; }
    w.man.dy = 0;
    // Stares at it; looks up; at it again.
    w.man.frame = LOOK_AT;
    yield* wait(8);
    w.man.frame = LOOK_UP;
    yield* wait(8);
    w.man.frame = LOOK_AT;
    yield* wait(6);
    // Picks it up and flings it away to the left, high over the digits and off the screen.
    w.man.frame = CROUCH;
    yield* wait(3);
    w.man.frame = THROW;
    let x = HOME_X - 2;
    y = MAN_Y;
    let vy = -1.5;
    while (x > -4) {
      x -= 3; y += vy; vy += 0.15;
      w.fx = y < 16 ? compose([{ s: MINI, x, y: Math.round(y) }]) : null;
      yield;
    }
    w.fx = null;
    w.man.frame = FRONT;
    yield* wait(5);
  },
};
