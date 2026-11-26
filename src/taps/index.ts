// TAPS: what the worker does when someone presses OK at him. Each press plays the next one in the list, getting more
// and more fed up; after the last it starts over, and so it does when nobody has pressed for a while (main.ts:
// TAP_RESET_S). Tier "tap": baked like an idle (key "i", no digits change), but never played on its own.
// To add or change one: edit it here, keep it short (a press wants an answer at once), and run `npm run bake`.
import { sprite, type Sprite } from "../gfx";
import { FRONT, BLINK, HOME_X, MAN_Y } from "../art";
import { fetchTool, putBack, walkTo, wait, type Scene } from "../scenes/kit";
import { LEGS, compose } from "../idles/parts";

/** Pads rows of a 7-wide frame out to `n` columns on the right (for a hand sticking out on that side). */
const wide = (rows: string[], n: number) => rows.map((r) => r.padEnd(n, "."));

// 1. "Hi!": he waves at you, his right hand up by his head, swinging.
const WAVE = [
  sprite(wide(["..hhh..", ".hhhhhh", ".ooooo.o", ".o.o.o.b", ".ooooo.b", "..bbb.b", "bbbbbb.", "o.bbb..", ...LEGS], 8)),
  sprite(wide(["..hhh..", ".hhhhhh", ".ooooo..", ".o.o.o.o", ".ooooo.b", "..bbb.b", "bbbbbb.", "o.bbb..", ...LEGS], 8)),
];
/** Smiling, mouth open: "hi!". */
const HI = (f: Sprite) => sprite(f.rows.map((r, j) => (j === 4 ? ".oo.oo." + r.slice(7) : r)));

const wave: Scene = {
  id: "tap_wave",
  name: "Hi",
  tier: "tap",
  *play(w) {
    w.man.frame = BLINK;
    yield;
    for (let k = 0; k < 8; k++) {
      w.man.frame = k === 2 || k === 3 ? HI(WAVE[k % 2]) : WAVE[k % 2];
      yield* wait(2);
    }
    w.man.frame = FRONT;
    yield* wait(3);
  },
};

// 2. A bow: cap off in his right hand, a bow from the waist, cap back on.
const CAP_OFF = sprite(wide(["", "..sss..", ".ooooo.", ".o.o.o.", ".ooooo.", "..bbb.hh", "bbbbbb.", "o.bbb..", ...LEGS].map((r) => r || "......."), 8));
const BOW = sprite(wide([".......", ".......", "..sss..", ".sssss.", ".ooooo.", "bbbbbbhh", "obbbbbo", "..bbb..", ...LEGS], 8));

const bow: Scene = {
  id: "tap_bow",
  name: "Bow",
  tier: "tap",
  *play(w) {
    w.man.frame = CAP_OFF;
    yield* wait(4);
    w.man.frame = BOW;
    w.sfx = "pop";
    yield* wait(7);
    w.man.frame = CAP_OFF;
    yield* wait(3);
    w.man.frame = FRONT;
    yield* wait(3);
  },
};

// 3. "?": a question mark pops up by his head and he shrugs, palms up.
const SHRUG = Object.assign(
  sprite(["...hhh...", "..hhhhhh.", "..ooooo..", "..o.o.o..", "..ooooo..", "o..bbb..o", "bbbbbbbbb", "...bbb...", ...LEGS.map((r) => "." + r + ".")]),
  { ox: -1, oy: 0 },
);
const QUESTION = sprite(["yyy", "..y", ".y.", "...", ".y."]);

const shrug: Scene = {
  id: "tap_shrug",
  name: "Huh?",
  tier: "tap",
  *play(w) {
    w.fx = compose([{ s: QUESTION, x: HOME_X + 7, y: MAN_Y - 1 }]);
    w.sfx = "boing";
    yield* wait(3);
    for (let k = 0; k < 2; k++) {
      w.man.frame = SHRUG;
      yield* wait(5);
      w.man.frame = FRONT;
      yield* wait(2);
    }
    w.fx = null;
    yield* wait(2);
  },
};

// 4. Arms crossed, frowning, tapping his foot.
const CROSS_TOP = ["..hhh..", ".hhhhhh", ".oqoqo.", ".o.o.o.", ".ooooo.", "..bbb..", "bbooobb", ".bbbbb."];
const FOOT_UP = ["..ppp..", "..p.p..", "..p.pss", ".ss...."];
const CROSS = [sprite([...CROSS_TOP, ...LEGS]), sprite([...CROSS_TOP, ...FOOT_UP])];

const tapFoot: Scene = {
  id: "tap_foot",
  name: "Tap tap",
  tier: "tap",
  *play(w) {
    w.man.frame = CROSS[0];
    yield* wait(3);
    for (let k = 0; k < 8; k++) {
      w.man.frame = CROSS[k % 2 ? 0 : 1];
      yield* wait(2);
    }
    w.man.frame = CROSS[0];
    yield* wait(3);
    w.man.frame = FRONT;
    yield* wait(2);
  },
};

// 5. A finger wagged at you: "no, no, no".
const WAG = [
  sprite(["..hhh....", ".hhhhhh..", ".oqoqo..o", ".o.o.o..o", ".ooooo.oo", "..bbb.b..", "bbbbbb...", "o.bbb....", ...wide(LEGS, 9)]),
  sprite(["..hhh....", ".hhhhhh..", ".oqoqo.o.", ".o.o.o..o", ".ooooo.oo", "..bbb.b..", "bbbbbb...", "o.bbb....", ...wide(LEGS, 9)]),
];

const wag: Scene = {
  id: "tap_wag",
  name: "No no no",
  tier: "tap",
  *play(w) {
    for (let k = 0; k < 10; k++) {
      w.man.frame = WAG[k % 2];
      yield* wait(2);
    }
    w.man.frame = FRONT;
    yield* wait(3);
  },
};

// 6. A STOP sign from the box, held up high at you, then put away.
/** The sign as he carries it: a red plate with a white bar, on a short pole. */
const SIGN = sprite(["xxxxx", "xwwwx", "xxxxx", "..g..", "..g.."]);
/** Holding it up: his right hand up, the sign above it. */
const HOLD = sprite(wide(["..hhh..", ".hhhhhh", ".oqoqo.b", ".o.o.o.b", ".ooooo.b", "..bbb.b", "bbbbbb.", "o.bbb..", ...LEGS], 8));

const stop: Scene = {
  id: "tap_stop",
  name: "STOP",
  tier: "tap",
  *play(w) {
    yield* fetchTool(w, SIGN);
    yield* walkTo(w, HOME_X);
    w.carry = null;
    w.man.frame = HOLD;
    // Raised: the pole down to his hand (at the top of the arm), the plate above his head's right side.
    w.sfx = "pop";
    for (const y of [3, 1, 0, 0]) {
      w.fx = compose([{ s: SIGN, x: HOME_X + 5, y }]);
      yield;
    }
    yield* wait(18);
    w.fx = null;
    yield* putBack(w, SIGN);
  },
};

// 7. Turns his back on you and won't look; once, a peek over his shoulder.
const BACK = sprite(["..hhh..", ".hhhhh.", ".sssss.", ".sssss.", "..ooo..", "..bbb..", "bbbbbbb", "o.bbb.o", ...LEGS]);
const PEEK = sprite(["..hhh..", ".hhhhh.", ".ssso.o", ".ssooo.", "..ooo..", "..bbb..", "bbbbbbb", "o.bbb.o", ...LEGS]);

const turn: Scene = {
  id: "tap_turn",
  name: "Hmph",
  tier: "tap",
  *play(w) {
    w.man.frame = BACK;
    yield* wait(12);
    w.man.frame = PEEK;
    yield* wait(3);
    w.man.frame = BACK;
    yield* wait(8);
    w.man.frame = FRONT;
    yield* wait(3);
  },
};

// 8. He drops flat on his back and plays dead (crossed-out eyes, hands up stiff), then gets up and dusts himself off.
/** Knees giving way. */
const SAG = Object.assign(
  sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".o.o.o.", ".oo.oo.", "obbbbbo", "..bbb..", ".pp.pp.", ".pp.pp.", "ss...ss"]),
  { ox: 0, oy: 2 },
);
/** Lying on the floor, head to the left, feet to the right, hands sticking up. */
const DEAD = Object.assign(sprite(["...o..o......", "hhqobbbbpppss", "hhooobbbbppss"]), { ox: -6, oy: 9 });
/** Dusting himself off. */
const DUST = [
  sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".o.o.o.", ".ooooo.", "..bbb..", "bbbbbbb", ".obbbo.", ...LEGS]),
  sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".o.o.o.", ".ooooo.", "..bbb..", "bbbbbbb", "..obo..", ...LEGS]),
];

const dead: Scene = {
  id: "tap_dead",
  name: "Dead",
  tier: "tap",
  *play(w) {
    w.man.frame = SAG;
    yield* wait(2);
    // Down with a little bounce.
    w.man.frame = DEAD;
    w.sfx = "thud";
    w.man.dy = -1;
    yield;
    w.man.dy = 0;
    w.fx = compose([{ s: sprite(["d.d.d"]), x: HOME_X - 4, y: 14 }, { s: sprite(["d.d"]), x: HOME_X + 3, y: 14 }]);
    yield* wait(2);
    w.fx = null;
    yield* wait(20);
    w.man.frame = SAG;
    yield* wait(3);
    for (let k = 0; k < 6; k++) {
      w.man.frame = DUST[k % 2];
      w.fx = k % 2 ? null : compose([{ s: sprite(["d"]), x: HOME_X + (k % 4 ? 0 : 6), y: MAN_Y + 8 }]);
      yield* wait(2);
    }
    w.fx = null;
    w.man.frame = FRONT;
    yield* wait(2);
    w.man.frame = BLINK;
    yield;
    w.man.frame = FRONT;
    yield* wait(2);
  },
};

/** In the order they play, press after press. */
export const TAPS: Scene[] = [wave, bow, shrug, tapFoot, wag, stop, turn, dead];
