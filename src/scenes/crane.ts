// Crane: he takes the crane's control box out of the box and, from home, works the crane: the hook comes down from above,
// catches the old digit by its top, hauls it up out of sight (swaying a little as it comes off), then lowers the new
// one into its place. Old digits go right to left, new ones come left to right.
import { DIGITS, DIGIT_X, DIGIT_Y, FRONT, HOME_X, PAD, LOOK_UP_PAD } from "../art";
import { fetchTool, putBack, walkTo, wait, HOOK, type Frames, type Scene } from "./kit";

export const crane: Scene = {
  id: "crane",
  name: "Crane",
  tier: "ten",
  play: function* (w, changes) {
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    /** The hook's tip: its middle column and its row; null when the crane is out of sight. */
    let hook: { x: number; y: number } | null = null;
    let blink = 0;
    /** One frame: the cable and the hook on the effect layer, the control box's light blinking while the crane works. */
    function* frame(): Frames {
      // The hook on a cable that goes up off the screen: one picture, so it moves along with the digit it holds.
      if (hook) w.sfx = "crane";
      w.fx = hook ? { s: HOOK, x: hook.x - 1, y: hook.y - 15 } : null;
      w.man.frame = LOOK_UP_PAD[hook ? (blink++ >> 1) % 2 : 0];
      yield;
    }

    yield* fetchTool(w, PAD);
    yield* walkTo(w, HOME_X);
    w.carry = null;
    w.man.frame = LOOK_UP_PAD[0];
    yield* wait(3);

    // Off with the old ones, right to left.
    for (const c of changes.slice().sort((a, b) => b.i - a.i)) {
      const slot = w.slots[c.i], x0 = DIGIT_X[c.i];
      hook = { x: x0 + 3, y: -1 };
      while (hook.y < DIGIT_Y - 1) { hook.y++; yield* frame(); }
      yield* frame();
      yield* frame();
      // It comes off the floor, swaying as it goes.
      const sway = [0, 1, 1, 0, -1, -1, 0, 1, 0, 0];
      let k = 0;
      while (DIGIT_Y + slot.dy > -13) {
        slot.dy -= k < 3 ? 1 : 2;
        slot.dx = sway[k % sway.length];
        hook.x = x0 + 3 + slot.dx;
        hook.y = DIGIT_Y + slot.dy - 1;
        k++;
        yield* frame();
      }
      slot.hidden = true;
      slot.dx = slot.dy = 0;
      hook = null;
      yield* frame();
    }
    yield* wait(4);
    // In with the new ones, left to right: down fast, slow at the end, lets go, back up.
    for (const c of changes.slice().sort((a, b) => a.i - b.i)) {
      const slot = w.slots[c.i], x0 = DIGIT_X[c.i];
      slot.hidden = false;
      slot.s = DIGITS[c.to];
      slot.dy = -15;
      hook = { x: x0 + 3, y: DIGIT_Y + slot.dy - 1 };
      while (slot.dy < 0) {
        slot.dy = Math.min(0, slot.dy + (slot.dy < -4 ? 2 : 1));
        hook.y = DIGIT_Y + slot.dy - 1;
        yield* frame();
      }
      yield* frame();
      yield* frame();
      while (hook.y > -1) { hook.y -= 2; yield* frame(); }
      hook = null;
      slot.s = null;
      yield* frame();
    }
    w.fx = null;
    yield* wait(4);
    w.man.frame = FRONT;
    yield* wait(2);
    yield* putBack(w, PAD);
  },
};
