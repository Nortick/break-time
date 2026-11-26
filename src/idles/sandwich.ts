// IDLE "Sandwich": lunch. He takes a sandwich out of the box, comes home and eats it in three bites, chewing, crumbs
// falling; then pats his belly. Nothing goes back in the box: it is eaten.
import { sprite } from "../gfx";
import { FRONT, BLINK, HOME_X, MAN_Y } from "../art";
import { fetchTool, walkTo, wait, rnd, type Scene } from "../scenes/kit";
import { LEGS, compose } from "./parts";

/** The sandwich: bread, lettuce and tomato; smaller after each bite. */
const BITES = [sprite(["ggg", "GxG", "ggg"]), sprite(["gg", "Gx", "gg"]), sprite(["g", "G", "g"])];
/** Holding it up at his mouth with both hands: mouth closed / open (chewing), eyes open / shut. */
const eat = (open: boolean, shut: boolean) =>
  sprite(["..hhh..", ".hhhhhh", ".ooooo.", shut ? ".ooooo." : ".o.o.o.", open ? ".oo.oo." : ".ooooo.", ".bbbbb.", "bbbbbbb", "..bbb..", ...LEGS]);
/** Patting his belly, content. */
const PAT = [
  sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".ooooo.", ".o...o.", "..bbb..", "bbbbbbb", ".obbbo.", ...LEGS]),
  sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".ooooo.", ".o...o.", "..bbb..", "bbbbbbb", "..obo..", ...LEGS]),
];

export const sandwich: Scene = {
  id: "sandwich",
  name: "Sandwich",
  tier: "idle",
  *play(w) {
    yield* fetchTool(w, BITES[0]);
    yield* walkTo(w, HOME_X);
    w.carry = null;
    const crumbs: { x: number; y: number }[] = [];
    for (let b = 0; b < 3; b++) {
      const s = BITES[b];
      // Up to the mouth, a bite, and he chews it.
      for (let t = 0; t < 14; t++) {
        const chewing = t >= 3;
        w.man.frame = eat(chewing && t % 4 < 2, chewing && t > 8);
        if (t === 3) w.sfx = "gulp";
        if (t === 3 && rnd(2) === 0) crumbs.push({ x: HOME_X + 3 + rnd(2), y: MAN_Y + 6 });
        for (const c of crumbs) if (c.y < 14) c.y++;
        // The sandwich in front of him, at his mouth; the last bite and it is all gone.
        const left = t < 3 ? s : b < 2 ? BITES[b + 1] : null;
        w.front = left ? { s: left, x: HOME_X + 2, y: MAN_Y + 5 } : null;
        w.fx = compose(crumbs.map((c) => ({ s: sprite(["g"]), x: c.x, y: c.y })));
        yield;
      }
    }
    w.fx = compose(crumbs.map((c) => ({ s: sprite(["g"]), x: c.x, y: 14 })));
    for (let k = 0; k < 6; k++) {
      w.man.frame = PAT[k % 2];
      yield* wait(2);
    }
    w.fx = null;
    w.front = null;
    w.man.frame = FRONT;
    yield* wait(3);
    w.man.frame = BLINK;
    yield* wait(1);
    w.man.frame = FRONT;
    yield* wait(3);
  },
};
