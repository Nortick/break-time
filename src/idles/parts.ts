// Pieces the idles share: the worker's legs, a picture of several small things (notes, balls, steam) put together
// for the effect layer, and where his hands and mouth are when he stands at home.
import { blank, fromGrid, type Sprite } from "../gfx";
import { HOME_X, MAN_Y } from "../art";

export const LEGS = ["..ppp..", "..p.p..", "..p.p..", ".ss.ss."];
/** The head facing us, eyes open; rows 0-4 of his 7x12 frame. */
export const HEAD = ["..hhh..", ".hhhhhh", ".ooooo.", ".o.o.o.", ".ooooo."];
/** The same, eyes shut. */
export const HEAD_SHUT = ["..hhh..", ".hhhhhh", ".ooooo.", ".ooooo.", ".ooooo."];

/** At home: where his hands hang (left, right) and his mouth is, on the display. */
export const HAND_L = { x: HOME_X, y: MAN_Y + 7 };
export const HAND_R = { x: HOME_X + 6, y: MAN_Y + 7 };
export const MOUTH = { x: HOME_X + 3, y: MAN_Y + 4 };

/**
 * Several small pictures as one, for the effect layer (it holds one picture): each piece at its place on the display.
 * Returns the picture and where it goes.
 */
export function compose(pieces: { s: Sprite; x: number; y: number }[]): { s: Sprite; x: number; y: number } | null {
  if (!pieces.length) return null;
  const x0 = Math.min(...pieces.map((p) => p.x)), y0 = Math.min(...pieces.map((p) => p.y));
  const x1 = Math.max(...pieces.map((p) => p.x + p.s.w)), y1 = Math.max(...pieces.map((p) => p.y + p.s.h));
  const g = blank(x1 - x0, y1 - y0);
  for (const p of pieces)
    for (let j = 0; j < p.s.h; j++)
      for (let i = 0; i < p.s.w; i++) {
        const c = p.s.rows[j].charAt(i) || ".";
        if (c !== ".") g[p.y - y0 + j][p.x - x0 + i] = c;
      }
  return { s: fromGrid(g), x: x0, y: y0 };
}
