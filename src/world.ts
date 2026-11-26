// What is on the stage now: the four digit slots, the worker, his hand and tool, and an effect layer. render() puts
// it all on the Screen; scenes only change this state.
import { outlined, eyed, cropBelow, type Sprite, type Screen } from "./gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, COLON, COLON_X, COLON_Y, MAN_Y, HOME_X, BOX, BOX_X, FRONT } from "./art";

export interface Slot {
  /** The digit the slot shows when no scene has taken it over. */
  value: number;
  /** A scene's picture in place of the digit; null shows the digit. */
  s: Sprite | null;
  dx: number;
  dy: number;
  hidden: boolean;
}

export interface Dot {
  x: number;
  y: number;
  c: string;
}

/** A picture placed on the screen. */
export interface Placed {
  s: Sprite;
  x: number;
  y: number;
}

/**
 * The effect layer (dust, debris, sparks). `at`, if given, draws it a part t (0..1) of the way to the next step, so
 * the 60 fps file shows the particles flying between steps (see tools/bake.ts). Without it the layer changes on the
 * step only.
 */
export interface Fx extends Placed {
  at?: (t: number) => Placed | null;
}

export interface World {
  slots: Slot[];
  /** dir: which way he faces, -1 left, 1 right, 0 the viewer; for where a carried tool is drawn. */
  man: { x: number; dy: number; frame: Sprite; dir: number };
  /** The toolbox: 0 closed, 1 lid half up, 2 open. */
  box: number;
  /** A tool he carries, drawn at his hand. */
  carry: Sprite | null;
  /**
   * A tool on its own, placed by the scene: going into or out of the box, or lying somewhere. Drawn behind the box's
   * front side, and never below the floor.
   */
  item: { s: Sprite; x: number; y: number } | null;
  hand: Dot | null;
  tool: Dot | null;
  fx: Fx | null;
  /** In front of everything, even the box: his legs hanging over the box's side when he sits on it. */
  front: Fx | null;
  /**
   * A sound to start on this step (a name in tools/sfx.ts), or null. The bake notes it with the step's time and takes
   * it away again; main.ts plays the notes as the scene's file plays.
   */
  sfx: string | null;
  /** Moves the whole front display, for a shake. */
  shake: { x: number; y: number };
  ticks: number;
}

export function makeWorld(digits: number[]): World {
  return {
    slots: digits.map((value) => ({ value, s: null, dx: 0, dy: 0, hidden: false })),
    man: { x: HOME_X, dy: 0, frame: FRONT, dir: 0 },
    box: 0,
    carry: null,
    item: null,
    hand: null,
    tool: null,
    fx: null,
    front: null,
    shake: { x: 0, y: 0 },
    sfx: null,
    ticks: 0,
  };
}

/** Back to rest: every slot shows its digit in place, no hand, no tool, no effect. */
export function settle(w: World): void {
  for (const s of w.slots) {
    s.s = null;
    s.dx = 0;
    s.dy = 0;
    s.hidden = false;
  }
  w.hand = null;
  w.tool = null;
  w.fx = null;
  w.front = null;
  w.item = null;
  w.carry = null;
  w.box = 0;
  w.shake.x = w.shake.y = 0;
}

const DOT_CACHE: Record<string, Sprite> = {};
function dot(c: string): Sprite {
  return DOT_CACHE[c] ?? (DOT_CACHE[c] = { w: 1, h: 1, rows: [c] });
}

export function render(w: World, screen: Screen): void {
  screen.shakeX = w.shake.x;
  screen.shakeY = w.shake.y;
  w.slots.forEach((slot, i) => {
    const pic = slot.hidden ? null : (slot.s ?? DIGITS[slot.value]);
    screen.put(`d${i}`, pic, DIGIT_X[i] + slot.dx, DIGIT_Y + slot.dy, 1);
  });
  screen.put("colon", COLON, COLON_X, COLON_Y, 1);
  // The box in two layers with the tool between them: back 1, item 2, front 6 (over the worker's outline too).
  const box = BOX[w.box];
  screen.put("box_b", box.back, BOX_X, box.backY, 1);
  screen.put("item", w.item ? cropBelow(w.item.s, w.item.y, 15) : null, w.item ? w.item.x : 0, w.item ? w.item.y : 0, 2);
  screen.put("box", box.front, BOX_X, box.frontY, 6);
  screen.put("fx", w.fx ? w.fx.s : null, w.fx ? w.fx.x : 0, w.fx ? w.fx.y : 0, 2);
  // The black outline only where he is over the digits (to cut him out of them); elsewhere the background shows.
  const f = eyed(w.man.frame);
  const mx = w.man.x + (f.ox ?? 0), my = MAN_Y + w.man.dy + (f.oy ?? 0);
  const overDigits = mx - 1 < DIGIT_X[3] + 7 && mx + f.w + 1 > DIGIT_X[0] && my - 1 < DIGIT_Y + 12;
  if (overDigits) screen.put("man", outlined(f), mx - 1, my - 1, 3);
  else screen.put("man", f, mx, my, 3);
  const cx = w.man.dir < 0 ? w.man.x - 2 : w.man.dir > 0 ? w.man.x + 6 : w.man.x + 6;
  screen.put("carry", w.carry, cx, MAN_Y + w.man.dy + 5, 4);
  screen.put("tool", w.tool ? dot(w.tool.c) : null, w.tool ? w.tool.x : 0, w.tool ? w.tool.y : 0, 4);
  screen.put("hand", w.hand ? dot(w.hand.c) : null, w.hand ? w.hand.x : 0, w.hand ? w.hand.y : 0, 5);
  screen.put("front", w.front ? w.front.s : null, w.front ? w.front.x : 0, w.front ? w.front.y : 0, 7);
}
