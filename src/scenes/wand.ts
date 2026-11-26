// Abracadabra: he takes a magic wand out of the box. As he walks up to the digit a magician's veil comes down over it
// from above; he waves the wand, sparkles fly, the veil ripples, and when it goes up again the new digit is there.
// With two digits a veil comes down over each, and one spell does both.
import { blank, fromGrid, sprite, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, FRONT, WAND } from "../art";
import { fetchTool, putBack, walkTo, pose14, art14, canvasX, canvasY, stepDots, rnd, wait, type Dot, type Frames, type Scene, layer } from "./kit";

/** He stands 12 right of the rightmost digit: the wand's tip is two pixels right of its veil. */
const STAND = 12;

/** The veil, 9 wide (a pixel over the digit on each side), from the display's top row down to just above the floor. */
function veil(ripple: number): Sprite {
  const folds = ripple % 2 ? [1, 4, 7] : [2, 6];
  const rows = ["..vvvvv..", ".vvvvvvv."];
  for (let j = 0; j < 11; j++) {
    let r = "";
    for (let i = 0; i < 9; i++) r += folds.indexOf(i) >= 0 ? "V" : "v";
    rows.push(r);
  }
  rows.push("yyyyyyyyy", ripple % 2 ? ".y.y.y.y." : "y.y.y.y.y");
  return sprite(rows);
}

/** Wand poses, facing left, on the 14x14 canvas: pointing at the veil, raised, and swept forward. */
const POINT = pose14(art14([[8, 8, "b"], [7, 7, "o"], [6, 6, "m"], [5, 5, "m"], [4, 4, "w"]]));
const RAISED = pose14(art14([[8, 8, "b"], [7, 7, "o"], [6, 6, "m"], [6, 5, "m"], [6, 4, "w"]]));
const SWEPT = pose14(art14([[8, 8, "b"], [7, 8, "o"], [6, 8, "m"], [5, 8, "m"], [4, 8, "w"]]));
/** Where the tip is in each pose, on the canvas. */
const TIP = new Map<Sprite, [number, number]>([[POINT, [4, 4]], [RAISED, [6, 4]], [SWEPT, [4, 8]]]);

export const wand: Scene = {
  id: "wand",
  name: "Abracadabra",
  tier: "minute",
  play: function* (w, changes) {
    const order = changes.slice().sort((a, b) => b.i - a.i);
    for (const c of order) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    const dots: Dot[] = [];
    /** Where the veils' top is now (display row; 0 = down), and how they ripple. */
    let veilY = -16, ripple = 0;
    /** One frame: the veils and the sparkles on the effect layer. */
    /** Which way the veils are going: down onto the digits, up and away, or staying. */
    let veilGo: "down" | "up" | null = "down";
    function* frame(): Frames {
      stepDots(dots);
      w.fx = layer((t) => {
        const g = blank(72, 16);
        const v = veil(ripple);
        // How far the veils move by the next step: they glide between steps (60 fps).
        const vv = veilGo === "down" && veilY < 0 ? (veilY < -4 ? 2 : 1) : veilGo === "up" && veilY > -16 ? -(veilY > -3 ? 1 : 3) : 0;
        const vy = veilY + Math.trunc(vv * t);
        for (const c of order) {
          const x0 = DIGIT_X[c.i] - 1;
          for (let j = 0; j < v.h; j++)
            for (let i = 0; i < v.w; i++) {
              const ch = v.rows[j].charAt(i), Y = vy + j;
              if (ch !== "." && Y >= 0 && Y < 16) g[Y][x0 + i] = ch;
            }
        }
        for (const d of dots) {
          const X = Math.round(d.x + d.vx * t), Y = Math.round(d.y + d.vy * t);
          if (X >= 0 && X < 72 && Y >= 0 && Y < 15) g[Y][X] = d.c;
        }
        return { s: fromGrid(g), x: 0, y: 0 };
      });
      yield;
    }
    function* run(gen: Frames): Frames {
      while (!gen.next().done) yield* frame();
    }
    /** Sparkles off the wand's tip, flying to the veils, and twinkles on the veils themselves. */
    const sparkle = (n: number) => {
      const tip = TIP.get(w.man.frame);
      if (tip) {
        const tx = canvasX(w.man.x, tip[0]), ty = canvasY(tip[1]);
        for (let k = 0; k < n; k++)
          dots.push({ x: tx - 1, y: ty, vx: -0.6 - Math.random(), vy: (Math.random() - 0.5) * 1.2, life: 3 + rnd(4), c: rnd(3) ? "y" : "w" });
      }
      for (const c of order)
        if (rnd(2)) dots.push({ x: DIGIT_X[c.i] - 1 + rnd(9), y: 1 + rnd(13), vx: 0, vy: -0.3, life: 2 + rnd(2), c: rnd(2) ? "y" : "w" });
    };

    yield* fetchTool(w, WAND);
    // The veils come down while he walks over.
    w.sfx = "whoosh";
    const to = DIGIT_X[order[0].i] + STAND;
    let walking: Frames | null = walkTo(w, to);
    w.carry = WAND;
    while (walking || veilY < 0) {
      if (walking && walking.next().done) walking = null;
      if (veilY < 0) veilY += veilY < -4 ? 2 : 1;
      if (!walking) { w.carry = null; w.man.dir = -1; w.man.frame = POINT; }
      yield* frame();
    }
    // Down: the old digits are hidden, the new ones wait under the veils.
    for (const c of order) w.slots[c.i].s = DIGITS[c.to];
    w.carry = null;
    w.man.dir = -1;
    w.man.frame = POINT;
    yield* run(wait(4));
    // The spell: raised, swept, raised, swept... sparkles fly, the veils ripple.
    const SPELL = [RAISED, RAISED, SWEPT, SWEPT, RAISED, POINT, SWEPT, RAISED, POINT, POINT, SWEPT, SWEPT, RAISED, RAISED, POINT, POINT];
    for (let k = 0; k < SPELL.length; k++) {
      if (k % 4 === 0) w.sfx = "magic";
      w.man.frame = SPELL[k];
      if (k % 2) ripple++;
      sparkle(k < 12 ? 2 : 4);
      yield* frame();
    }
    // Pff: a burst of stars, and the veils whisk up.
    w.sfx = "pop";
    for (const c of order)
      for (let k = 0; k < 10; k++)
        dots.push({ x: DIGIT_X[c.i] + 3, y: 7, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 2.5, life: 3 + rnd(4), c: rnd(2) ? "y" : "w" });
    w.man.frame = RAISED;
    veilGo = "up";
    while (veilY > -16) {
      veilY -= veilY > -3 ? 1 : 3;
      yield* frame();
    }
    while (dots.length) yield* frame();
    w.fx = null;
    yield* wait(4);
    w.man.frame = FRONT;
    yield* wait(2);
    yield* putBack(w, WAND);
  },
};
