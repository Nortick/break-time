// The focus timer runs out (main.ts): the box's lid flies open and an alarm clock jumps out, over his head, and lands
// on the floor left of him, ringing and rattling. He jumps with fright, then goes over and slaps it quiet, picks it up
// and puts it back in the box. After it, one of the hour scenes clears the focus digits away and brings the break's.
import { sprite } from "../gfx";
import { BOX_X, BOX_RIM, FRONT, HANDS_UP, WORK_L } from "../art";
import { putBack, wait, walkTo, type Scene } from "../scenes/kit";

/** The alarm clock: two brass bells, a red body, a white face with its hands, two little feet. */
const ALARM = sprite(["y...y", ".xxx.", "xwmwx", "xwmmx", "xwwwx", ".x.x."]);
/** Ringing: the bells and the clapper between them shake. */
const RINGING = sprite([".y.y.", "yxyxy", "xwmwx", "xwmmx", "xwwwx", ".x.x."]);
/** Slapped flat for a moment. */
const SQUASHED = sprite(["y.y.y", "xxxxx", "xwmwx", "xwwwx", ".x.x."]);
/** Where it lands: on the floor, left of him. */
const LAND_X = 42;
const LAND_Y = 9;

export const alarm: Scene = {
  id: "alarm",
  name: "Time's up!",
  tier: "event",
  at: { digits: [0, 0, 0, 0], slots: [] },
  *play(w) {
    w.man.frame = FRONT;
    yield* wait(3);
    // The lid flies open and out it jumps, high over his head.
    w.box = 2;
    w.sfx = "boing";
    let x = BOX_X + 1, y = BOX_RIM - 3;
    yield;
    const STEPS = 12;
    const x0 = x, y0 = y;
    for (let k = 1; k <= STEPS; k++) {
      const t = k / STEPS;
      x = Math.round(x0 + (LAND_X - x0) * t);
      y = Math.round(y0 + (LAND_Y - y0) * t - 44 * t * (1 - t));
      w.fx = { s: ALARM, x, y };
      if (k === 3) w.box = 0;
      // He sees it go over him and jumps with fright.
      if (k === 5) { w.man.frame = HANDS_UP; w.sfx = "whoosh"; }
      if (k >= 5 && k <= 9) w.man.dy = [-1, -2, -2, -1, 0][k - 5];
      yield;
    }
    w.sfx = "thud";
    // It rings and rattles on the floor.
    for (let k = 0; k < 22; k++) {
      if (k % 6 === 0) w.sfx = "ring";
      w.fx = { s: k % 2 ? ALARM : RINGING, x: LAND_X + (k % 2 ? 1 : -1) * (k % 4 < 2 ? 1 : 0), y: LAND_Y };
      if (k === 4) w.man.frame = FRONT;
      yield;
    }
    // Over he goes, still ringing, and slaps it quiet.
    w.man.dir = -1;
    let k = 0;
    const ring = () => {
      if (k % 6 === 0) w.sfx = "ring";
      w.fx = { s: k % 2 ? ALARM : RINGING, x: LAND_X + (k % 2 ? 1 : 0), y: LAND_Y };
      k++;
    };
    for (const step of walkTo(w, LAND_X + 6)) { ring(); yield step; }
    w.man.frame = HANDS_UP;
    for (let n = 0; n < 3; n++) { ring(); yield; }
    w.man.frame = WORK_L;
    w.fx = { s: SQUASHED, x: LAND_X, y: LAND_Y + 1 };
    w.sfx = "hit";
    w.shake.y = 1;
    yield;
    w.shake.y = 0;
    yield* wait(3);
    w.fx = { s: ALARM, x: LAND_X, y: LAND_Y };
    yield* wait(6);
    // Picks it up, and back into the box with it.
    w.fx = null;
    yield* putBack(w, ALARM);
    w.man.frame = FRONT;
    w.man.dir = 0;
    yield* wait(3);
  },
};
