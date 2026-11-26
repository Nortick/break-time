// The backgrounds: looping animations the bar plays under the clock all the time. Which one is on is chosen in the
// app's settings (src/appmeta/settings.json, field "background": its values are the ids here, plus "none"); matrix
// is only for 13:37. dust.ts and ray.ts are earlier tries, kept to come back to. After a change: npm run bake.
//
// night, flow, steel, sparks, blueprint, rain, lamp and aurora share their pieces (plate, bevel, dust...) in plate.ts.
import { type Background } from "./dust";
import { fan } from "./fan";
import { matrix } from "./matrix";
import { night } from "./night";
import { flow } from "./flow";
import { steel } from "./steel";
import { sparks } from "./sparks";
import { blueprint } from "./blueprint";
import { rain } from "./rain";
import { lamp } from "./lamp";
import { aurora } from "./aurora";
import { garland } from "./garland";

/** The first one is used when the settings can't be read. The garland is not a background but an overlay on top of
 * one (main.ts shows it by the "garland" setting); it is baked here the same way, as bg_garland.anim. */
export const BACKGROUNDS: Background[] = [night, fan, flow, steel, sparks, blueprint, rain, lamp, aurora, matrix, garland];
export { type Background } from "./dust";
/**
 * How bright each one is baked (1 = as drawn). Since 2026-11-22 all at half, as on the real bar they took the eye
 * from the digits; the forge sparks and the fan stay as they are, and the garland (an overlay) too.
 */
export function levelOf(id: string): number {
  return id === "sparks" || id === "fan" || id === "garland" ? 1 : 0.5;
}
