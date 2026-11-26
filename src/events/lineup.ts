// 12:34: after the minute's scene the digits line up by height, 1 the smallest, 4 full size, with a little bounce
// each; the worker looks up, puzzled. At 12:35 "straighten" plays first: they spring back to full size, and only then
// the minute's usual scene. main.ts keeps the lined-up picture on the clock in between (linedUp below).
import { DIGITS, FRONT, LOOK_UP, HANDS_UP } from "../art";
import { scaled, wait, type Frames, type Scene } from "../scenes/kit";
import { type Sprite } from "../gfx";
import { type World } from "../world";

/** How tall each slot's digit is when lined up, left to right. */
const HEIGHTS = [6, 8, 10, 12];

/** Slot i's digit v at height h, standing on the floor in the middle of its place. */
function at(v: number, h: number): { s: Sprite; dx: number; dy: number } {
  const sw = Math.max(3, Math.round((7 * h) / 12));
  return { s: scaled(DIGITS[v], sw, h), dx: Math.floor((7 - sw) / 2), dy: 12 - h };
}

/** Puts the lined-up picture on the World's slots (or takes it off). */
export function linedUp(w: World, on: boolean): void {
  w.slots.forEach((slot, i) => {
    if (on && HEIGHTS[i] < 12) {
      const p = at(slot.value, HEIGHTS[i]);
      slot.s = p.s;
      slot.dx = p.dx;
      slot.dy = p.dy;
    } else {
      slot.s = null;
      slot.dx = slot.dy = 0;
    }
  });
}

/** Each slot from height a to height b, one after another from the left, overshooting a little and settling. */
function* resize(w: World, from: number[], to: number[]): Frames {
  for (let i = 0; i < 4; i++) {
    if (from[i] === to[i]) continue;
    const slot = w.slots[i];
    const steps: number[] = [];
    const d = to[i] > from[i] ? 1 : -1;
    for (let h = from[i] + d; h !== to[i] + d; h += d) steps.push(h);
    steps.push(to[i] + (d > 0 ? 0 : -1), to[i] + (d > 0 ? 1 : 0), to[i]);
    for (const h of steps) {
      const p = at(slot.value, Math.max(2, Math.min(13, h)));
      slot.s = p.s;
      slot.dx = p.dx;
      slot.dy = p.dy;
      yield;
    }
    yield* wait(2);
  }
}

export const lineup: Scene = {
  id: "lineup",
  name: "12:34",
  tier: "event",
  at: { digits: [1, 2, 3, 4], slots: [0, 1, 2, 3] },
  keeps: true,
  play: function* (w) {
    w.man.frame = LOOK_UP;
    yield* wait(4);
    yield* resize(w, [12, 12, 12, 12], HEIGHTS);
    yield* wait(6);
    w.man.frame = HANDS_UP;
    yield* wait(6);
    w.man.frame = FRONT;
  },
};

export const straighten: Scene = {
  id: "straighten",
  name: "12:34",
  tier: "event",
  at: { digits: [1, 2, 3, 4], slots: [0, 1, 2, 3] },
  play: function* (w) {
    linedUp(w, true);
    w.man.frame = LOOK_UP;
    yield* wait(3);
    yield* resize(w, HEIGHTS, [12, 12, 12, 12]);
    linedUp(w, false);
    w.man.frame = FRONT;
    yield* wait(3);
  },
};
