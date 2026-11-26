// IDLE "Brow": hot work. He tips his cap up with one hand, wipes his forehead with the other, flicks the sweat off and
// sets the cap back, with a puff of relief.
import { sprite } from "../gfx";
import { FRONT, BLINK, HOME_X, MAN_Y } from "../art";
import { wait, type Scene } from "../scenes/kit";
import { LEGS, compose } from "./parts";

/** Cap tipped up by his right hand, his hair showing under it. */
const TIP = sprite([".hhh...", "hhhhhho", ".sssss.", ".o.o.o.", ".ooooo.", "..bbbb.", "bbbbbb.", "o.bbb..", ...LEGS]);
/** Wiping: his left hand across his forehead, at column `at`, eyes shut. */
const wipe = (at: number) => {
  const brow = ".sssss.".split("");
  brow[at] = "o";
  return sprite([".hhh...", "hhhhhho", brow.join(""), ".ooooo.", ".ooooo.", "b.bbbb.", "bbbbbb.", "..bbb..", ...LEGS]);
};
/** Phew: cap back on, cheeks puffed (mouth open). */
const PHEW = sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".o.o.o.", ".oo.oo.", "..bbb..", "bbbbbbb", "o.bbb.o", ...LEGS]);

export const brow: Scene = {
  id: "brow",
  name: "Brow",
  tier: "idle",
  *play(w) {
    w.man.frame = FRONT;
    yield* wait(3);
    w.man.frame = TIP;
    yield* wait(5);
    for (const at of [1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5]) {
      w.man.frame = wipe(at);
      yield;
    }
    // A flick of the hand: a drop of sweat flies off to the left.
    w.man.frame = TIP;
    for (let k = 0; k < 6; k++) {
      w.fx = compose([{ s: sprite(["a"]), x: HOME_X - 1 - k, y: MAN_Y + 4 - (k < 2 ? k : 2) + (k > 3 ? k - 3 : 0) }]);
      yield;
    }
    w.fx = null;
    yield* wait(3);
    w.man.frame = PHEW;
    w.fx = compose([{ s: sprite(["d.d"]), x: HOME_X + 2, y: MAN_Y + 5 }]);
    yield* wait(4);
    w.fx = null;
    w.man.frame = FRONT;
    yield* wait(3);
    w.man.frame = BLINK;
    yield* wait(1);
    w.man.frame = FRONT;
    yield* wait(3);
  },
};
