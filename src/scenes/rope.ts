// Rope and hook: a coil of rope from the box. He throws the hook up over the top of the screen (as over a beam we
// don't see), it comes down and catches the old digit by its top, and he hauls it up and away, hand over hand. Then
// he lets the rope out and the new digit comes down on the hook. Unhooks, coils the rope, back in the box.
import { blank, fromGrid, sprite } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, COIL } from "../art";
import { perDigit, pose14, art14, canvasX, canvasY, wait, type Frames, type Scene } from "./kit";

/** He stands 12 right of the digit. */
const STAND = 12;

/** Arm poses on the 14x14 canvas, the rope in his hand: hands up (reaching for the rope), at the chest, down (pulled). */
const POSES = {
  up: { frame: pose14(art14([[8, 6, "b"], [8, 5, "b"], [7, 4, "o"]])), hand: [7, 4] },
  mid: { frame: pose14(art14([[8, 8, "b"], [7, 7, "o"]])), hand: [7, 7] },
  down: { frame: pose14(art14([[8, 8, "b"], [7, 9, "o"]])), hand: [7, 9] },
};
type Pose = keyof typeof POSES;

/** The hook: a little cradle under the end of the rope. Its top row is where the rope ties on. */
const HOOK = sprite([".m.", "m.m", ".m."]);

export const rope: Scene = {
  id: "rope",
  name: "Rope and hook",
  tier: "ten",
  stepped: true, // the digit moves with his pulls on the rope
  play: perDigit(function* (w, c): Frames {
    const slot = w.slots[c.i];
    const x0 = DIGIT_X[c.i];
    /** The column the rope hangs down in, over the digit's middle; it goes over the top of the screen there. */
    const top = x0 + 3;
    let pose: Pose = "mid";
    /** Where the hook is (its top middle); null when it is in his hand. `over` = the rope goes over the top edge. */
    let hook: { x: number; y: number; over: boolean } | null = null;

    const hand = () => [canvasX(w.man.x, POSES[pose].hand[0]), canvasY(POSES[pose].hand[1])];
    const set = (p: Pose) => {
      pose = p;
      w.man.frame = POSES[p].frame;
    };
    /** Draws the rope (hand to the top edge, then down to the hook, or straight to the hook in the air) and the hook. */
    const draw = () => {
      const X0 = Math.max(0, x0 - 2), W = Math.min(72, x0 + STAND + 2) - X0;
      const g = blank(W, 16);
      const dot = (x: number, y: number, ch: string) => {
        const X = Math.round(x) - X0, Y = Math.round(y);
        if (X >= 0 && X < W && Y >= 0 && Y < 16) g[Y][X] = ch;
      };
      const line = (ax: number, ay: number, bx: number, by: number) => {
        const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
        for (let k = 0; k <= n; k++) dot(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, "c");
      };
      const [hx, hy] = hand();
      if (hook) {
        if (hook.over) {
          line(hx, hy, top, 0);
          for (let y = 0; y < hook.y; y++) dot(top, y, "c");
        } else line(hx, hy, hook.x, hook.y);
        HOOK.rows.forEach((r, j) => {
          for (let i = 0; i < r.length; i++) if (r.charAt(i) !== ".") dot(hook!.x - 1 + i, hook!.y + j, "m");
        });
      }
      w.fx = { s: fromGrid(g), x: X0, y: 0 };
    };
    function* show(n = 1): Frames {
      for (let k = 0; k < n; k++) {
        draw();
        yield;
      }
    }
    /** The hook hangs so its bottom row is just above the digit's top: the digit hangs from it. */
    const hookOn = () => ({ x: top, y: DIGIT_Y + slot.dy - 3, over: true });

    // Ready; a couple of swings, and the throw: the hook flies up out of the top of the screen.
    w.sfx = "whoosh";
    set("mid");
    yield* show(3);
    for (const p of ["up", "mid", "up", "mid"] as Pose[]) { set(p); yield* show(2); }
    set("up");
    const [sx, sy] = hand();
    for (const t of [0.3, 0.6, 0.85, 1]) {
      hook = { x: Math.round(sx + (top - sx) * t), y: Math.round(sy - (sy + 4) * t), over: false };
      yield* show();
    }
    // Over the beam and down onto the digit.
    w.sfx = "crack";
    hook = { x: top, y: -3, over: true };
    yield* show(2);
    set("mid");
    for (let y = -2; y <= DIGIT_Y - 3; y++) { hook = { x: top, y, over: true }; yield* show(); }
    yield* show(3);

    // Haul it up: hands up, grab, pull down; the digit goes up two pixels a pull, and out of the top.
    w.sfx = "ratchet";
    while (DIGIT_Y + slot.dy + 12 > 0) {
      set("up");
      yield* show();
      set("down");
      slot.dy -= 2;
      hook = hookOn();
      yield* show();
    }
    slot.hidden = true;
    for (let k = 0; k < 2; k++) { set("up"); hook = { x: top, y: hook.y - 2, over: true }; yield* show(); set("down"); yield* show(); }
    set("mid");
    yield* show(4);

    // Let the rope out: the new digit comes down on the hook, a bit at a time, slowing at the end.
    w.sfx = "ratchet";
    slot.s = DIGITS[c.to];
    slot.hidden = false;
    slot.dy = -14;
    while (slot.dy < 0) {
      set(slot.dy % 4 === 0 ? "mid" : "down");
      slot.dy = Math.min(0, slot.dy + (slot.dy < -4 ? 2 : 1));
      hook = hookOn();
      yield* show();
    }
    set("mid");
    yield* show(3);

    // A flick of the rope: the hook jumps off the digit and up out of the screen, then he pulls the rope in.
    w.sfx = "whoosh";
    set("up");
    for (const y of [hook.y - 1, hook.y - 3, -3]) { hook = { x: top, y, over: true }; yield* show(); }
    set("mid");
    const [ex, ey] = hand();
    for (const t of [0.25, 0.5, 0.75]) {
      hook = { x: Math.round(top + (ex - top) * t), y: Math.round(-2 + (ey + 2) * t), over: false };
      yield* show();
    }
    hook = null;
    w.fx = null;
    yield* wait(3);
  }, COIL, STAND),
};
