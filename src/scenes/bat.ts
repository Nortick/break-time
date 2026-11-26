// Home run: a baseball bat from the box knocks the digit off the screen; the new one falls from the sky.
import { sprite } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, BAT, WORK_L, LOOK_UP, HANDS_UP } from "../art";
import { perDigit, pose14, art14, LEGS, wait, type Scene } from "./kit";

/**
 * The worker with a baseball bat, facing left: wound up over his back shoulder, the swing (bat level, its end at the
 * digit's right edge, 4 in front of him... column 3), and the follow-through. Same 14x14 layout as the mop poses.
 */
const BAT_POSES = [
  // Wound up: straight up behind his head, dark grip in his hands, the thick end at the top.
  art14([[12, 8, "o"], [12, 7, "s"], [12, 6, "s"], [12, 5, "g"], [12, 4, "g"], [13, 4, "g"], [12, 3, "g"], [13, 3, "g"], [12, 2, "g"], [13, 2, "g"]]),
  // The swing: level, the thick end out at column 0.
  art14([[8, 8, "b"], [7, 8, "o"], [6, 8, "s"], [5, 8, "s"], [4, 8, "g"], [3, 8, "g"], [2, 8, "g"], [1, 8, "g"], [0, 8, "g"], [2, 7, "g"], [1, 7, "g"], [0, 7, "g"]]),
  // Follow-through: up and forward over his head.
  art14([[8, 7, "b"], [7, 6, "o"], [6, 5, "s"], [5, 4, "s"], [4, 3, "g"], [3, 2, "g"], [2, 1, "g"], [3, 1, "g"], [1, 0, "g"], [2, 0, "g"]]),
];
const [BAT_WIND, BAT_SWING, BAT_FOLLOW] = [
  pose14(BAT_POSES[0], LEGS[1]), pose14(BAT_POSES[1], LEGS[0]), pose14(BAT_POSES[2], LEGS[0]),
];
const SPARK = sprite(["y.y", ".y.", "y.y"]);

/** Takes a bat from the box and hits the digit out of the screen; the new one falls from the sky. */
export const kick: Scene = {
  id: "kick",
  name: "Home run",
  tier: "minute",
  play: perDigit(function* (w, c) {
    const slot = w.slots[c.i];
    // Wind-up, with a little waggle of the hips.
    w.man.frame = BAT_WIND;
    for (const dx of [0, 1, 0, 1, 0]) { w.man.x += dx ? 1 : 0; yield; yield; w.man.x -= dx ? 1 : 0; }
    w.man.frame = BAT_SWING;
    w.sfx = "hit";
    w.fx = { s: SPARK, x: DIGIT_X[c.i] + 6, y: DIGIT_Y + 5 };
    yield;
    w.fx = null;
    // Off it goes, up and to the left, faster and faster.
    let vx = -1, vy = -3;
    w.man.frame = BAT_FOLLOW;
    while (DIGIT_X[c.i] + slot.dx > -8 && DIGIT_Y + slot.dy > -13) {
      slot.dx += vx;
      slot.dy += vy;
      vx = Math.max(vx - 1, -4);
      yield;
    }
    slot.hidden = true;
    yield* wait(5);
    w.man.frame = WORK_L;
    yield* wait(3);
    w.man.frame = LOOK_UP;
    yield* wait(6);
    slot.hidden = false;
    slot.s = DIGITS[c.to];
    slot.dx = 0;
    slot.dy = -14;
    let v = 1;
    while (slot.dy < 0) {
      slot.dy = Math.min(0, slot.dy + v);
      v = Math.min(v + 1, 4);
      yield;
    }
    w.sfx = "thud";
    w.man.frame = HANDS_UP;
    w.man.dy = -1;
    for (const bnc of [-2, -1, 0]) {
      slot.dy = bnc;
      yield;
    }
    w.man.dy = 0;
    yield* wait(5);
    w.man.frame = WORK_L;
  }, BAT, 13),
};
