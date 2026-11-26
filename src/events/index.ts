// The events: shows main.ts starts at set times, not when a digit changes (12:34, New Year, Friday evening). To add
// one: write it here, list it below, start it from main.ts. `npm run bake` writes one file for each (<id>_e.anim).
import { type Scene } from "../scenes/kit";
import { lineup, straighten } from "./lineup";
import { fireworks } from "./fireworks";
import { beer } from "./beer";
import { alarm } from "./alarm";

export const EVENTS: Scene[] = [lineup, straighten, fireworks, beer, alarm];
