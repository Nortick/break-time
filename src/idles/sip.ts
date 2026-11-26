// IDLE "Sip" (Friday evening only, while the beer bottle stands on the floor beside him; main.ts picks it then): he
// bends down to the bottle, lifts it, takes a swig, and puts it back down.
import { sprite } from "../gfx";
import { FRONT, HOME_X, MAN_Y, BOTTLE, BOTTLE_TIPPED, BOTTLE_X, BOTTLE_Y } from "../art";
import { wait, type Frames, type Scene } from "../scenes/kit";
import { type World } from "../world";
import { HEAD_SHUT, LEGS } from "./parts";

/** Bending down, his left hand down at the bottle on the floor beside him. */
export const CROUCH = sprite([".......", ".......", ".......", "..hhh..", ".hhhhhh", ".ooooo.", ".o.o.o.", ".ooooo.", "bbbbbbb", "o.bbb.o", "pp.pp..", "ss.ss.."]);
/** A swig: eyes shut, his left hand up at his face holding the tipped bottle. */
export const SWIG = sprite([...HEAD_SHUT.slice(0, 4), "oooooo.", "b.bbb..", ".bbbbbb", "..bbb.o", ...LEGS]);

/** Where the bottle is: on the floor, in his hand by his side, or tipped up at his mouth. */
export function bottleAt(w: World, where: "floor" | "hand" | "mouth" | null): void {
  if (where === "floor") w.front = { s: BOTTLE, x: BOTTLE_X, y: BOTTLE_Y };
  else if (where === "hand") w.front = { s: BOTTLE, x: HOME_X - 3, y: MAN_Y + 4 };
  else if (where === "mouth") w.front = { s: BOTTLE_TIPPED, x: HOME_X - 3, y: MAN_Y + 4 };
  else w.front = null;
}

/** From the floor to a swig and back down to the floor. */
export function* swig(w: World, long: boolean): Frames {
  w.man.frame = CROUCH;
  yield* wait(3);
  bottleAt(w, "hand");
  w.man.frame = FRONT;
  yield* wait(4);
  bottleAt(w, "mouth");
  w.man.frame = SWIG;
  w.sfx = "gulp";
  yield* wait(long ? 16 : 10);
  bottleAt(w, "hand");
  w.man.frame = FRONT;
  yield* wait(5);
  w.man.frame = CROUCH;
  bottleAt(w, "floor");
  yield* wait(3);
  w.man.frame = FRONT;
  yield* wait(3);
}

export const sip: Scene = {
  id: "sip",
  name: "Sip",
  tier: "idle",
  rare: true,
  play: function* (w) {
    // The bottle stands where main.ts draws it; this file draws it too, so it can be picked up.
    bottleAt(w, "floor");
    yield* wait(3);
    yield* swig(w, false);
  },
};
