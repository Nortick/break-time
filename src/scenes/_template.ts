// TEMPLATE for a new scene: copy this file, rename `example`, and add it to the list in index.ts.
// This file itself is not in the list, so it never plays.
import { DIGITS, WRENCH } from "../art";
import { perDigit, pose14, art14, wait, type Scene } from "./kit";

/** He stands this many pixels right of the digit he works on (13: canvas column 0 is the digit's right edge). */
const STAND = 11;

/** The poses: the worker facing left plus the tool and his arm, drawn on the 14x14 canvas (see kit.ts). */
const POSE_A = pose14(art14([[8, 8, "b"], [7, 8, "o"], [6, 8, "r"]]));
const POSE_B = pose14(art14([[8, 8, "b"], [7, 7, "o"], [6, 6, "r"]]));

export const example: Scene = {
  id: "example", // stays the same forever: the "seen" list on the back display keeps ids
  name: "Example", // ASCII only
  tier: "minute", // "minute" | "ten" | "hour"
  // perDigit: takes the tool from the box, walks to each digit, runs this for it, puts the tool back, goes home.
  play: perDigit(function* (w, c) {
    const slot = w.slots[c.i];
    w.man.frame = POSE_A;
    yield* wait(3); // 3 steps, 0.3 s
    w.man.frame = POSE_B;
    slot.s = DIGITS[c.to]; // what the slot shows; null = its digit; slot.hidden, slot.dx/dy move or hide it
    yield* wait(3);
  }, WRENCH, STAND),
};
