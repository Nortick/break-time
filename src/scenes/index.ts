// Every scene the worker knows. To add one: write it in its own file here (start from _template.ts), list it below,
// and run `npm run bake`: tools/bake.ts plays every scene in this list into .anim files, and main.ts plays those.
import { type Scene } from "./kit";
import { paint, paintOops } from "./paint";
import { flip } from "./flip";
import { kick } from "./bat";
import { blower } from "./blower";
import { sledge } from "./sledge";
import { rope } from "./rope";
import { lighter, flamer } from "./fire";
import { chainsaw } from "./chainsaw";
import { cart } from "./cart";
import { sand } from "./sand";
import { topple } from "./topple";
import { wand } from "./wand";
import { crane } from "./crane";
import { garden } from "./garden";
import { runaway } from "./runaway";
import { cat } from "./cat";
import { dynamite } from "./dynamite";
import { bazooka } from "./bazooka";
import { acid } from "./acid";
import { bowling } from "./bowling";
import { tetris } from "./tetris";
import { ufo } from "./ufo";
import { rocket } from "./rocket";
import { dozer } from "./dozer";
import { press } from "./press";
import { magnet } from "./magnet";
import { arkanoid } from "./arkanoid";
import { cannon } from "./cannon";
import { flood } from "./flood";
import { glass } from "./glass";
import { tv } from "./tv";
import { printer } from "./printer";
import { puzzle } from "./puzzle";
import { bricks } from "./bricks";

export const SCENES: Scene[] = [paint, flip, kick, blower, lighter, rope, chainsaw, cart, sand, topple, wand, crane, garden, sledge, flamer, dynamite, bazooka, acid, bowling, tetris, ufo, rocket, dozer, press, magnet, arkanoid, cannon, flood, glass, tv, printer, puzzle, bricks, paintOops, runaway, cat];

export { type Scene, type Change, type Tier } from "./kit";
