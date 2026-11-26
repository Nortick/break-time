// IDLE "Juggle": he takes three balls (red, yellow, blue) out of the toolbox and juggles them at home, eyes up,
// throwing with one hand then the other. Then he misses one: it drops, bounces, rolls off to the right and
// disappears behind the box (back where it came from). He watches it go, then puts the other two back too.
import { sprite } from "../gfx";
import { FRONT, BLINK, HOME_X, MAN_Y } from "../art";
import { fetchTool, putBack, walkTo, wait, layer, type Scene } from "../scenes/kit";
import { compose } from "./parts";

const BALLS = sprite(["xya"]);
const LEGS = ["..ppp..", "..p.p..", "..p.p..", ".ss.ss."];
const UP = ["..hhh..", ".hhhhhh", ".o.o.o.", ".ooooo.", ".ooooo."]; // eyes up, on the balls
const RIGHT = ["..hhh..", ".hhhhhh", ".ooooo.", ".oo.o..", ".ooooo."]; // eyes right, after the ball
/** Throwing: the left hand up (at the chest), the right down; and the other way round. */
const THROW_L = sprite([...UP, "..bbb..", "obbbbbb", "..bbb.o", ...LEGS]);
const THROW_R = sprite([...UP, "..bbb..", "bbbbbbo", "o.bbb..", ...LEGS]);
const WATCH_R = sprite([...RIGHT, "..bbb..", "bbbbbbb", "o.bbb.o", ...LEGS]);

const COLORS = ["x", "y", "a"].map((c) => sprite([c]));
/** Throw height and the hands' places (where a ball leaves and lands). */
const LX = HOME_X, RX = HOME_X + 6, HAND_Y = MAN_Y + 5, PEAK = 1;
/** Frames for one throw (hand to hand); a ball's full round is two throws. */
const T = 8;

/** Where a ball is, `f` frames into its round: left hand to right over the top, then right to left. */
function ballAt(f: number) {
  const round = f % (2 * T);
  const leftToRight = round < T;
  const u = (round % T) / T;
  const x = leftToRight ? LX + (RX - LX) * u : RX - (RX - LX) * u;
  const y = HAND_Y - (HAND_Y - PEAK) * 4 * u * (1 - u);
  return { x: Math.round(x), y: Math.round(y) };
}

export const juggle: Scene = {
  id: "juggle",
  name: "Juggle",
  tier: "idle",
  *play(w) {
    yield* fetchTool(w, BALLS);
    yield* walkTo(w, HOME_X);
    w.carry = null;
    const offsets = [0, 5, 11];
    const rounds = 3 * 2 * T;
    for (let k = 0; k < rounds; k++) {
      w.man.frame = Math.floor(k / (T / 2)) % 2 ? THROW_R : THROW_L;
      // In front of him; between steps the balls fly on along their arcs (60 fps).
      w.front = layer((t) => compose(offsets.map((o, i) => ({ s: COLORS[i], ...ballAt(k + o + t) }))));
      yield;
    }
    // The miss: the blue ball keeps falling past his right hand; the other two stay in his hands.
    w.front = compose([
      { s: COLORS[0], x: LX, y: MAN_Y + 7 },
      { s: COLORS[1], x: RX, y: MAN_Y + 7 },
    ]);
    w.man.frame = WATCH_R;
    let x = RX + 1, y = HAND_Y, vy = 0, vx = 0.6;
    for (let k = 0; k < 40; k++) {
      vy += 0.35;
      y += vy;
      if (y >= 14) {
        y = 14; // the floor
        vy = -vy * 0.5;
        if (Math.abs(vy) < 0.6) vy = 0;
      }
      x += vx;
      // The rolling ball is on the effect layer, under the box: past x 59 it is behind the box's side, gone back in.
      w.fx = x < 61 ? { s: COLORS[2], x: Math.round(x), y: Math.round(y) } : null;
      yield;
    }
    yield* wait(4);
    w.man.frame = BLINK;
    yield* wait(1);
    w.man.frame = WATCH_R;
    yield* wait(5);
    w.fx = null;
    w.front = null;
    w.man.frame = FRONT;
    yield* putBack(w, sprite(["xy"]));
    yield* wait(3);
  },
};
