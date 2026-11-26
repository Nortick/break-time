// Hand truck: from the box. He slides its nose plate under the old digit, tips it back (the digit lifts a pixel) and
// pulls it away off the right edge of the screen. He comes back pushing the new digit on the truck, sets it down,
// pulls the truck out from under it, and the truck goes back in the box.
import { sprite } from "../gfx";
import { DIGITS, DIGIT_X, TRUCK_CARRY, WALK_L, WALK_R, WORK_L } from "../art";
import { perDigit, wait, type Frames, type Scene } from "./kit";

/**
 * The truck at work, beside a digit: the nose plate (row 10) under the digit's 7 columns, the upright frame in
 * column 7, his hand on it in column 8, and the wheel. Its top goes at y 3 when tipped back (loaded), 4 when standing.
 */
const TRUCK = sprite([
  ".......m.", ".......m.", ".......m.", ".......m.", ".......m.", ".......m.", ".......m.", ".......mo",
  ".......m.", ".......m.", "mmmmmmmm.", ".......qq",
]);
/** The truck's top row: standing on its plate, and tipped back with a load. */
const DOWN_Y = 4, UP_Y = 3;
/** He stands with his hand on the frame: 9 right of the digit his truck carries. */
const HOLD = 9;
/** Far enough right that he and his load are off the screen. */
const AWAY = 72 + HOLD + 8;

export const cart: Scene = {
  id: "cart",
  name: "Hand truck",
  tier: "ten",
  play: perDigit(function* (w, c): Frames {
    const slot = w.slots[c.i];
    const x0 = DIGIT_X[c.i];
    let truckY = DOWN_Y;
    /** The truck stays at his hand, the load (if any) on its plate. */
    const place = (loaded: boolean) => {
      w.item = { s: TRUCK, x: w.man.x - HOLD, y: truckY };
      if (loaded) slot.dx = w.man.x - HOLD - x0;
    };
    /** Walks to x with the truck, `speed` pixels a frame (2 is hurrying, legs going every frame). */
    function* walk(x: number, loaded: boolean, facing: number, speed = 1): Frames {
      let step = 0;
      while (w.man.x !== x) {
        const d = Math.min(speed, Math.abs(x - w.man.x));
        w.man.x += x < w.man.x ? -d : d;
        step++;
        w.man.frame = (facing < 0 ? WALK_L : WALK_R)[(speed > 1 ? step : step >> 1) % 2];
        place(loaded);
        yield;
      }
    }

    // The plate slides in under the digit.
    w.sfx = "crack";
    w.man.frame = WORK_L;
    place(false);
    yield* wait(2);
    yield* walk(x0 + HOLD, false, -1);
    w.man.frame = WORK_L;
    yield* wait(2);
    // Tipped back: up it comes.
    w.sfx = "pop";
    truckY = UP_Y;
    slot.dy = -1;
    place(true);
    yield* wait(3);
    // Away, pulling it behind him, off the right edge.
    yield* walk(AWAY, true, 1, 2);
    slot.hidden = true;
    w.item = null;
    yield* wait(4);

    // Back with the new one, pushing it in front of him.
    slot.s = DIGITS[c.to];
    slot.hidden = false;
    place(true);
    yield* walk(x0 + HOLD, true, -1, 2);
    w.man.frame = WORK_L;
    slot.dx = 0;
    yield* wait(2);
    // Down, and the truck pulled out from under it.
    w.sfx = "thud";
    truckY = DOWN_Y;
    slot.dy = 0;
    place(false);
    yield* wait(3);
    yield* walk(x0 + HOLD + 4, false, -1);
    w.item = null;
    w.man.frame = WORK_L;
    yield* wait(2);
  }, TRUCK_CARRY, HOLD + 3),
};
