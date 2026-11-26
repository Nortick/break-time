// Easter egg, the runaway: he comes to change the digit and it jumps, sprouts little arms and legs and runs off to
// the right, behind him and the box, out of the screen. He chases it, gives up at the box with a shrug, goes off
// the screen after it and comes back pushing a new digit into the empty place.
import { blank, fromGrid } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, FRONT, HANDS_UP, HOME_X, LOOK_UP, WORK_L, WALK_L, BOX_STAND } from "../art";
import { walkTo, wait, type Frames, type Scene, layer } from "./kit";

export const runaway: Scene = {
  id: "runaway",
  name: "Runaway",
  tier: "minute",
  rare: true,
  play: function* (w, changes) {
    const order = changes.slice().sort((a, b) => b.i - a.i); // minutes first
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    /** Digits with legs: slot, and which step of the run they are on. */
    const runners: { i: number; step: number }[] = [];
    /** Whether the runners are running off: then their legs go along with the digits between steps (60 fps). */
    let fleeing = false;
    function* frame(): Frames {
      if (runners.length) {
        w.fx = layer((t) => {
          const g = blank(72, 16);
          const set = (x: number, y: number) => { if (x >= 0 && x < 72 && y >= 0 && y < 15) g[y][x] = "#"; };
          for (const r of runners) {
            const slot = w.slots[r.i];
            if (slot.hidden) continue;
            // Where the digit is t of the way to its next step, the same way the bake moves the digit itself.
            const ndy = (r.step + 1) % 4 < 2 ? -2 : -3;
            const mx = fleeing ? Math.trunc(2 * t) : 0, my = fleeing ? Math.trunc((ndy - slot.dy) * t) : 0;
            const x = DIGIT_X[r.i] + slot.dx + mx, bottom = DIGIT_Y + 12 + slot.dy + my;
            const stride = (r.step >> 1) % 2;
            // Legs: straight down, or striding out; little arms pumping at the sides.
            for (let y = bottom; y < 15; y++) {
              if (stride) { set(x + 1 - (y - bottom), y); set(x + 5 + (y - bottom), y); }
              else { set(x + 2, y); set(x + 4, y); }
            }
            set(x - 1, DIGIT_Y + slot.dy + my + 6 + stride);
            set(x + 7, DIGIT_Y + slot.dy + my + 7 - stride);
          }
          return { s: fromGrid(g), x: 0, y: 0 };
        });
      } else w.fx = null;
      yield;
    }
    function* run(g: Frames): Frames {
      while (!g.next().done) yield* frame();
    }
    function* hold(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }

    // He sets off to change it...
    yield* run(walkTo(w, DIGIT_X[order[0].i] + 12));
    w.man.dir = -1;
    w.man.frame = WORK_L;
    yield* hold(3);
    // ...and it jumps up, legs out.
    w.sfx = "boing";
    for (const c of order) {
      const slot = w.slots[c.i];
      for (const dy of [-1, -3, -2]) { slot.dy = dy; yield* frame(); }
      runners.push({ i: c.i, step: 0 });
      yield* hold(2);
    }
    w.man.frame = LOOK_UP;
    yield* hold(6);
    // Off they go, to the right, faster than he can walk; he goes after them.
    let manStep = 0;
    fleeing = true;
    while (runners.some((r) => !w.slots[r.i].hidden) || w.man.x < BOX_STAND) {
      for (const r of runners) {
        const slot = w.slots[r.i];
        if (slot.hidden) continue;
        r.step++;
        slot.dx += 2;
        slot.dy = r.step % 4 < 2 ? -2 : -3;
        if (DIGIT_X[r.i] + slot.dx > 72) slot.hidden = true;
      }
      if (w.man.x < BOX_STAND && runners.some((r) => r.step > 3)) {
        manStep++;
        if (manStep % 2 === 0) w.man.x++;
        w.man.frame = manStep % 4 < 2 ? FRONT : LOOK_UP;
      }
      yield* frame();
    }
    // Gone. He shrugs.
    w.sfx = "grumble";
    runners.length = 0;
    fleeing = false;
    w.man.frame = FRONT;
    yield* hold(4);
    w.man.frame = HANDS_UP;
    yield* hold(6);
    w.man.frame = FRONT;
    yield* hold(3);
    // He goes off after them and brings new ones back, pushing each into its place, the farthest first.
    for (const c of order.slice().reverse()) {
      const slot = w.slots[c.i];
      yield* run(walkTo(w, 80));
      yield* hold(6);
      slot.hidden = false;
      slot.s = DIGITS[c.to];
      slot.dy = 0;
      let step = 0;
      while (DIGIT_X[c.i] + slot.dx > DIGIT_X[c.i]) {
        w.man.x--;
        slot.dx = w.man.x - 8 - DIGIT_X[c.i];
        step++;
        w.man.frame = WALK_L[(step >> 1) % 2];
        yield* frame();
      }
      slot.dx = 0;
      slot.s = null;
      yield* hold(3);
    }
    yield* run(walkTo(w, HOME_X));
    w.man.frame = FRONT;
    yield* wait(3);
  },
};
