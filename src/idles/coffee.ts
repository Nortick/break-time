// IDLE "Coffee": he takes a red mug out of the toolbox, comes back home, holds it at his chest while it steams, sips
// twice with his eyes shut, then puts it back in the box. The mug only goes from chest to mouth (short arms).
import { sprite, type Sprite } from "../gfx";
import { FRONT, HOME_X, MAN_Y } from "../art";
import { fetchTool, putBack, walkTo, wait, type Scene } from "../scenes/kit";
import { HEAD, HEAD_SHUT, LEGS, compose } from "./parts";

/** The mug as he carries it: red, the handle on the right. */
const MUG = sprite(["xx.", "xxx", "xx."]);
/** Holding it in his right hand, out to the side at chest height, so its steam rises clear of his head. */
const pad = (rows: string[]) => rows.map((r) => r + ".");
const HOLD = sprite([...pad(HEAD), "..bbb.xx", "bbbbbbxx", "o.bbb.o.", ...pad(LEGS)]);
const HOLD_SHUT = sprite([...pad(HEAD_SHUT), "..bbb.xx", "bbbbbbxx", "o.bbb.o.", ...pad(LEGS)]);
/** Sipping: the mug at his mouth, eyes shut. */
const SIP = sprite([...HEAD_SHUT.slice(0, 4), ".oooxx.", "..bbxxo", "bbbbbbb", "o.bbb..", ...LEGS]);

const STEAM_X = HOME_X + 6;
const STEAM_TOP = MAN_Y + 4; // just above the mug's rim
/** Two thin wisps rising from the mug and swaying, at frame k. */
function steam(k: number) {
  const pieces: { s: Sprite; x: number; y: number }[] = [];
  const puff = sprite(["d"]);
  for (let wisp = 0; wisp < 2; wisp++)
    for (let n = 0; n < 3; n++) {
      const age = (k + wisp * 3 + n * 2) % 6;
      const y = STEAM_TOP - age;
      if (y < 0) continue;
      const x = STEAM_X + wisp + (Math.sin((k + n * 3 + wisp * 5) * 0.7) > 0.3 ? 1 : 0) - (age > 3 ? 1 : 0);
      pieces.push({ s: puff, x, y });
    }
  return compose(pieces);
}

export const coffee: Scene = {
  id: "coffee",
  name: "Coffee",
  tier: "idle",
  *play(w) {
    yield* fetchTool(w, MUG);
    yield* walkTo(w, HOME_X);
    w.carry = null;
    const hold = function* (n: number, shut = false) {
      for (let k = 0; k < n; k++) {
        w.man.frame = shut ? HOLD_SHUT : HOLD;
        w.fx = steam(w.ticks++);
        yield;
      }
    };
    yield* hold(12);
    for (let sip = 0; sip < 2; sip++) {
      w.fx = null;
      w.man.frame = SIP;
      w.sfx = "gulp";
      yield* wait(sip ? 6 : 8);
      yield* hold(3, true); // eyes still shut: savouring it
      yield* hold(sip ? 10 : 8);
    }
    w.fx = null;
    yield* putBack(w, MUG);
    w.man.frame = FRONT;
    yield* wait(3);
  },
};
