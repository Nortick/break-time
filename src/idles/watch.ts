// IDLE "Watch": he raises his wrist and looks down at his watch, then looks over at the digits, checks them against
// it and nods twice: all correct. His hand only comes up to his chest (the arms stay short).
import { sprite } from "../gfx";
import { FRONT, BLINK } from "../art";
import { wait, type Scene } from "../scenes/kit";
import { LEGS } from "./parts";

const CAP = ["..hhh..", ".hhhhhh"];
/** Wrist up at the chest, the yellow watch face on it; still looking ahead. */
const WRIST = sprite([...CAP, ".ooooo.", ".o.o.o.", ".ooooo.", "..bbb..", "oybbbbb", "..bbb.o", ...LEGS]);
/** Looking down at the watch: the eyes a row lower. */
const READ = sprite([...CAP, ".ooooo.", ".ooooo.", ".o.o.o.", "..bbb..", "oybbbbb", "..bbb.o", ...LEGS]);
/** Looking left, at the digits. */
const LOOK_L = sprite([...CAP, ".ooooo.", "..o.oo.", ".ooooo.", "..bbb..", "oybbbbb", "..bbb.o", ...LEGS]);
/** A nod: the head dips a pixel, still looking left. */
const NOD = sprite([".......", ...CAP, "..o.oo.", ".ooooo.", "..bbb..", "oybbbbb", "..bbb.o", ...LEGS]);

export const watch: Scene = {
  id: "watch",
  name: "Watch",
  tier: "idle",
  *play(w) {
    w.man.frame = FRONT;
    yield* wait(3);
    w.man.frame = WRIST;
    yield* wait(3);
    w.man.frame = READ;
    yield* wait(10);
    w.man.frame = LOOK_L;
    yield* wait(8);
    w.man.frame = READ;
    yield* wait(5);
    w.man.frame = LOOK_L;
    yield* wait(5);
    for (let k = 0; k < 2; k++) {
      w.man.frame = NOD;
      yield* wait(2);
      w.man.frame = LOOK_L;
      yield* wait(2);
    }
    yield* wait(3);
    w.man.frame = FRONT;
    yield* wait(3);
    w.man.frame = BLINK;
    yield* wait(1);
    w.man.frame = FRONT;
    yield* wait(4);
  },
};
