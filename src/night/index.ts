// NIGHT: from 23:00 to 7:00 (if "Night sleep" is on in the settings) the worker sleeps on his toolbox and the digits
// change quietly, without scenes. main.ts plays these: "in" when the night comes, "loop" over and over while he sleeps,
// "wake" when someone presses OK at night (he jumps awake, grumbles, dozes off again), "out" in the morning.
// Tier "night": baked like an idle (key "i", no digits change). "loop" and "wake" start from him asleep on the box, and
// "in", "loop" and "wake" end that way (`keeps`), so they join up. After a change: npm run bake.
import { sprite } from "../gfx";
import { FRONT, BLINK, HOME_X } from "../art";
import { walkTo, wait, type Scene } from "../scenes/kit";
import { compose } from "../idles/parts";
import { SEAT_X, SIT, SIT_SHUT, SIT_NOD, SIT_LEGS, Z } from "../idles/sit";
import { type World } from "../world";

/** The z's of his snoring: three, one after another, drifting up and to the right of his head; `k` loops every 30. */
function zs(k: number) {
  return [0, 10, 20]
    .map((start) => (k - start + 30) % 30)
    .filter((age) => age < 10)
    .map((age) => ({ s: Z, x: SEAT_X + 7 + Math.floor(age / 4), y: 8 - Math.floor(age * 0.8) }))
    .filter((z) => z.y >= 0);
}

/** Puts him on the box, asleep: where "loop" and "wake" start. */
function asleep(w: World): void {
  w.man.x = SEAT_X;
  w.man.dy = -2;
  w.man.frame = SIT_NOD;
  w.man.dir = 0;
  w.front = { s: SIT_LEGS[0], x: SEAT_X, y: 10 };
}

/** His head nodding a little as he breathes: down (asleep) and up a pixel (eyes still shut). */
const BREATHE = [SIT_NOD, SIT_SHUT];

const nightIn: Scene = {
  id: "night_in",
  name: "Night",
  tier: "night",
  keeps: true,
  *play(w) {
    // A yawn on the way: the day is over.
    w.man.frame = BLINK;
    yield* wait(3);
    yield* walkTo(w, SEAT_X);
    yield* wait(2);
    w.man.dy = -1;
    yield;
    w.man.dy = -2;
    w.man.frame = SIT;
    w.front = { s: SIT_LEGS[0], x: SEAT_X, y: 10 };
    yield* wait(6);
    w.man.frame = SIT_SHUT;
    yield* wait(8);
    w.man.frame = SIT_NOD;
    for (let k = 0; k < 30; k++) {
      w.fx = compose(zs(k));
      yield;
    }
  },
};

/** Asleep: three seconds that repeat seamlessly (the z's and the nod both go round in 30 steps). */
const nightLoop: Scene = {
  id: "night_loop",
  name: "Zzz",
  tier: "night",
  keeps: true,
  *play(w) {
    asleep(w);
    for (let k = 0; k < 30; k++) {
      w.man.frame = BREATHE[k < 15 ? 0 : 1];
      w.fx = compose(zs(k));
      yield;
    }
    // Back to where it starts, for the seam.
    w.man.frame = BREATHE[0];
    w.fx = compose(zs(0));
  },
};

/** "!" over his head, startled; and the grumble, a little red scribble. */
const BANG = sprite(["y", "y", "y", ".", "y"]);
const GRUMBLE = sprite(["x.x.x", ".x.x."]);
/** Eyes wide open, looking left, then right. */
const SIT_LEFT = sprite(["..hhh..", ".hhhhhh", ".ooooo.", "..o.oo.", ".ooooo.", "..bbb..", "bbbbbbb", "o.bbb.o", "..ppp.."]);
const SIT_RIGHT = sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".oo.o..", ".ooooo.", "..bbb..", "bbbbbbb", "o.bbb.o", "..ppp.."]);
const SIT_FROWN = sprite(["..hhh..", ".hhhhhh", ".oqoqo.", ".o.o.o.", ".oo.oo.", "..bbb..", "bbbbbbb", "o.bbb.o", "..ppp.."]);

const nightWake: Scene = {
  id: "night_wake",
  name: "Huh?!",
  tier: "night",
  keeps: true,
  *play(w) {
    asleep(w);
    yield* wait(2);
    // Startled: he jumps up off the lid, feet kicking, a "!".
    w.fx = compose([{ s: BANG, x: SEAT_X + 3, y: 0 }]);
    w.sfx = "boing";
    w.man.frame = SIT;
    w.man.dy = -4;
    w.front = { s: SIT_LEGS[1], x: SEAT_X, y: 8 };
    yield* wait(2);
    w.man.dy = -2;
    w.front = { s: SIT_LEGS[0], x: SEAT_X, y: 10 };
    yield* wait(3);
    w.fx = null;
    // Who's there? Left, right.
    w.man.frame = SIT_LEFT;
    yield* wait(5);
    w.man.frame = SIT_RIGHT;
    yield* wait(5);
    // Grumbles, and back to sleep.
    w.man.frame = SIT_FROWN;
    w.sfx = "grumble";
    for (let k = 0; k < 8; k++) {
      w.fx = compose([{ s: GRUMBLE, x: SEAT_X + 7, y: 2 + (k % 2) }]);
      yield;
    }
    w.fx = null;
    w.man.frame = SIT_SHUT;
    yield* wait(6);
    w.man.frame = SIT_NOD;
    for (let k = 0; k < 20; k++) {
      w.fx = compose(zs(k));
      yield;
    }
    // Ends asleep, as the loop goes on.
    for (let k = 20; k < 30; k++) {
      w.fx = compose(zs(k));
      yield;
    }
  },
};

const nightOut: Scene = {
  id: "night_out",
  name: "Morning",
  tier: "night",
  *play(w) {
    asleep(w);
    yield* wait(3);
    w.man.frame = SIT_SHUT;
    yield* wait(4);
    w.man.frame = SIT;
    yield* wait(2);
    w.man.frame = sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".ooooo.", ".ooooo.", "..bbb..", "bbbbbbb", "o.bbb.o", "..ppp.."]);
    yield;
    w.man.frame = SIT;
    yield* wait(4);
    // Off the box and home: a new day.
    w.front = null;
    w.man.dy = -1;
    w.man.frame = FRONT;
    yield;
    w.man.dy = 0;
    yield* wait(2);
    yield* walkTo(w, HOME_X);
    w.man.frame = FRONT;
    yield* wait(3);
  },
};

export const NIGHT: Scene[] = [nightIn, nightLoop, nightWake, nightOut];
