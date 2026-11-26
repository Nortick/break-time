// IDLE "Yawn": at home, he yawns, stretches his arms out to the sides, twists his back left and right, yawns once
// more and blinks awake. His arms keep their length (sleeve + hand): stretched out they are just turned sideways.
import { sprite, type Sprite } from "../gfx";
import { BLINK, FRONT } from "../art";
import { wait, type Scene } from "../scenes/kit";

const LEGS = ["..ppp..", "..p.p..", "..p.p..", ".ss.ss."];

/** Eyes shut, mouth open: the yawn starts. */
const YAWN = sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".ooooo.", ".oo.oo.", "..bbb..", "bbbbbbb", "o.bbb.o", ...LEGS]);
/** Wide yawn: shoulders pulled up, hands drawn in to the body. */
const YAWN_WIDE = sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".ooooo.", ".oo.oo.", ".bb.bb.", "bbbbbbb", ".obbbo.", ...LEGS]);

/**
 * Arms out to the sides at shoulder height, still yawning. 9 wide: one column more on each side for the hands.
 * `lean` turns his upper body: -1 to the left, 1 to the right, the legs stay put.
 */
function stretch(lean: number, eyesOpen: boolean): Sprite {
  const up = [
    "..hhh..", ".hhhhhh", ".ooooo.", eyesOpen ? ".o.o.o." : ".ooooo.", eyesOpen ? ".ooooo." : ".oo.oo.", "..bbb..",
  ];
  const rows = [
    ...up.map((r) => "." + r + "."),
    "obbbbbbbo",
    "...bbb...",
    ...LEGS.map((r) => "." + r + "."),
  ];
  // Shift everything above the legs by `lean`, so he turns at the waist.
  const out = rows.map((r, j) => {
    if (j >= 8 || !lean) return r;
    return lean < 0 ? r.slice(1) + "." : "." + r.slice(0, -1);
  });
  return Object.assign(sprite(out), { ox: -1, oy: 0 });
}

const OUT = stretch(0, false);
const LEFT = stretch(-1, false);
const RIGHT = stretch(1, false);
const OUT_AWAKE = stretch(0, true);

export const yawn: Scene = {
  id: "yawn",
  name: "Yawn",
  tier: "idle",
  *play(w) {
    w.man.frame = FRONT;
    yield* wait(4);
    w.man.frame = YAWN;
    yield* wait(4);
    w.man.frame = YAWN_WIDE;
    yield* wait(6);
    w.man.frame = OUT;
    yield* wait(5);
    for (const f of [LEFT, LEFT, OUT, RIGHT, RIGHT, OUT]) {
      w.man.frame = f;
      yield* wait(3);
    }
    w.man.frame = OUT_AWAKE;
    yield* wait(3);
    w.man.frame = YAWN;
    yield* wait(3);
    w.man.frame = FRONT;
    yield* wait(3);
    w.man.frame = BLINK;
    yield* wait(1);
    w.man.frame = FRONT;
    yield* wait(2);
    w.man.frame = BLINK;
    yield* wait(1);
    w.man.frame = FRONT;
    yield* wait(4);
  },
};
