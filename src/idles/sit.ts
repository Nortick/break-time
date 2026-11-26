// IDLE "Sit": he walks over to the toolbox and sits on it, legs hanging over its side, swinging his feet; then he
// nods off (z's float up), wakes with a start, hops down and walks home. His legs are drawn in front of the box (the
// world's front layer); the rest of him sits on its lid.
import { sprite } from "../gfx";
import { FRONT, HOME_X } from "../art";
import { walkTo, wait, type Scene } from "../scenes/kit";
import { HEAD, HEAD_SHUT } from "./parts";
import { compose } from "./parts";

/** Where he sits: over the box (x 59-64), his lap on its lid. */
export const SEAT_X = 58;
const BODY = ["..bbb..", "bbbbbbb", "o.bbb.o", "..ppp.."];
/** Sitting: no legs here, they hang in front of the box. Lifted two pixels (dy -2) so his lap is on the lid. */
export const SIT = sprite([...HEAD, ...BODY]);
export const SIT_SHUT = sprite([...HEAD_SHUT, ...BODY]);
/** Dozing: the head dropped a pixel, eyes shut. */
export const SIT_NOD = sprite([".......", "..hhh..", ".hhhhhh", ".ooooo.", ".ooooo.", ...BODY]);
/** Legs hanging over the box's side: both down, the left kicked up, the right kicked up. */
export const SIT_LEGS = [
  sprite(["..p.p..", "..p.p..", ".ss.ss."]),
  sprite(["..s.p..", "....p..", "....ss."]),
  sprite(["..p.s..", "..p....", ".ss...."]),
];
export const Z = sprite(["aaa", "..a", ".a.", "a..", "aaa"]);

export const sit: Scene = {
  id: "sit",
  name: "Sit",
  tier: "idle",
  *play(w) {
    yield* walkTo(w, SEAT_X);
    yield* wait(2);
    // Up onto the lid.
    w.man.dy = -1;
    yield;
    w.man.dy = -2;
    w.man.frame = SIT;
    const legs = (n: number) => (w.front = { s: SIT_LEGS[n], x: SEAT_X, y: 10 });
    legs(0);
    yield* wait(5);
    // Swinging his feet.
    for (let k = 0; k < 5; k++) {
      legs(1);
      yield* wait(2);
      legs(0);
      yield* wait(1);
      legs(2);
      yield* wait(2);
      legs(0);
      yield* wait(1);
    }
    yield* wait(4);
    // Nodding off.
    w.man.frame = SIT_SHUT;
    yield* wait(6);
    w.man.frame = SIT_NOD;
    for (let k = 0; k < 30; k++) {
      // Three z's, one after another, drifting up and to the right of his head.
      const zs = [0, 10, 20]
        .map((start) => k - start)
        .filter((age) => age >= 0 && age < 10)
        .map((age) => ({ s: Z, x: SEAT_X + 7 + Math.floor(age / 4), y: 8 - Math.floor(age * 0.8) }))
        .filter((z) => z.y >= 0);
      w.fx = compose(zs);
      yield;
    }
    w.fx = null;
    // Awake with a start, feet back down, and off the box.
    w.man.frame = SIT;
    w.man.dy = -3;
    yield;
    w.man.dy = -2;
    yield* wait(4);
    w.front = null;
    w.man.dy = -1;
    w.man.frame = FRONT;
    yield;
    w.man.dy = 0;
    yield* wait(2);
    yield* walkTo(w, HOME_X);
    yield* wait(3);
  },
};
