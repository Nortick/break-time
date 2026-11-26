// What the worker does at rest, between the changes of the time: every so often main.ts plays one of these (tier
// "idle": no digit changes, he stays at home or comes back to it). To add one: write it in its own file here like
// yawn.ts, list it below, and run `npm run bake`. parts.ts has the pieces they share.
import { type Scene } from "../scenes/kit";
import { yawn } from "./yawn";
import { watch } from "./watch";
import { coffee } from "./coffee";
import { sit } from "./sit";
import { whistle } from "./whistle";
import { juggle } from "./juggle";
import { sip } from "./sip";
import { brow } from "./brow";
import { sandwich } from "./sandwich";
import { bonk } from "./bonk";

export const IDLES: Scene[] = [yawn, watch, coffee, sit, whistle, juggle, brow, sandwich, bonk, sip];
