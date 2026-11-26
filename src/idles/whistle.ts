// IDLE "Whistle": he whistles a tune, lips pursed, bobbing his head and tapping his foot to the beat; little yellow
// notes float up from his mouth and away.
import { sprite } from "../gfx";
import { FRONT, BLINK, HOME_X, MAN_Y } from "../art";
import { wait, type Scene } from "../scenes/kit";
import { compose } from "./parts";

const CAP = ["..hhh..", ".hhhhhh"];
/** Lips pursed: a dark dot for the mouth. */
const FACE = [".ooooo.", ".o.o.o.", ".oo.oo."];
const BODY = ["..bbb..", "bbbbbbb", "o.bbb.o"];
const STAND = ["..ppp..", "..p.p..", "..p.p..", ".ss.ss."];
/** Right toe up, tapping. */
const TAP = ["..ppp..", "..p.p..", "..p.ps.", ".ss.s.."];
/** Head tilted a pixel to the right, with the beat. */
const tilt = (rows: string[]) => rows.map((r) => "." + r.slice(0, -1));
const POSES = [
  sprite([...CAP, ...FACE, ...BODY, ...STAND]),
  sprite([...tilt(CAP), ...tilt(FACE), ...BODY, ...TAP]),
];
const NOTE = sprite([".y", ".y", "yy"]);
/** Where the notes come from: by his cheek, so each one slides out from behind his head. */
const FROM = { x: HOME_X + 6, y: MAN_Y + 1 };

export const whistle: Scene = {
  id: "whistle",
  name: "Whistle",
  tier: "idle",
  *play(w) {
    w.man.frame = FRONT;
    yield* wait(3);
    const n = 56;
    for (let k = 0; k < n; k++) {
      w.man.frame = POSES[Math.floor(k / 4) % 2];
      if (k % 14 === 0 && k < 42) w.sfx = "whistle";
      // A note every 7 frames (none in the last stretch), each rising and drifting right for 10 frames.
      const notes = [];
      for (let start = 0; start < n - 14; start += 7) {
        const age = k - start;
        if (age < 0 || age >= 10) continue;
        const y = FROM.y - Math.floor(age / 2) - 1;
        const x = FROM.x + Math.floor(age / 3) + (Math.floor((start / 7) % 2) ? 1 : 0);
        if (y >= 0) notes.push({ s: NOTE, x, y });
      }
      w.fx = compose(notes);
      yield;
    }
    w.fx = null;
    w.man.frame = FRONT;
    yield* wait(3);
    w.man.frame = BLINK;
    yield* wait(1);
    w.man.frame = FRONT;
    yield* wait(4);
  },
};
