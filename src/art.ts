// The pictures: the clock's digits and the worker's frames. Each is a grid of characters; the colors are in gfx.ts.
import { sprite, mirror, type Sprite } from "./gfx";

const R = (s: string, n: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(s);
  return out;
};

/** Digits 0–9, 7×12, two pixels thick. */
export const DIGITS: Sprite[] = [
  [".#####.", "#######", ...R("##...##", 8), "#######", ".#####."],
  ["...##..", "..###..", ".####..", ...R("...##..", 8), ".######"],
  [".#####.", "#######", "##...##", ".....##", "....###", "...###.", "..###..", ".###...", "###....", "##.....", "#######", "#######"],
  ["######.", "#######", ".....##", ".....##", ".....##", "..#####", "..#####", ".....##", ".....##", ".....##", "#######", "######."],
  [...R("##...##", 5), "#######", "#######", ...R(".....##", 5)],
  ["#######", "#######", "##.....", "##.....", "######.", "#######", ".....##", ".....##", ".....##", "##...##", "#######", ".#####."],
  [".#####.", "#######", "##.....", "##.....", "######.", "#######", ...R("##...##", 4), "#######", ".#####."],
  ["#######", "#######", ".....##", ".....##", "....##.", "....##.", "...##..", "...##..", ...R("..##...", 4)],
  [".#####.", "#######", ...R("##...##", 3), ".#####.", ".#####.", ...R("##...##", 3), "#######", ".#####."],
  [".#####.", "#######", ...R("##...##", 3), "#######", ".######", ...R(".....##", 3), "#######", ".#####."],
].map(sprite);

export const COLON = sprite(["##", "##", "..", "..", "##", "##"]);

/** Where things stand on the 72×16 display. */
export const DIGIT_X = [6, 14, 25, 33];
export const DIGIT_Y = 2;
export const COLON_X = 22;
export const COLON_Y = 5;
export const MAN_Y = 3;
export const HOME_X = 50;
/**
 * The wooden toolbox: closed, lid half up, open. An open box is drawn in two parts: the back (the lid and the dark
 * inside) behind whatever goes in or out of it, the front (its wooden side) over it, so a tool sinks into the box.
 * `y` is where each part's top goes on the display; the box stands on the floor at BOX_X.
 */
export const BOX_X = 59;
/** The top row of the box's front side: a tool below it is hidden by the box. */
export const BOX_RIM = 11;
export interface BoxPic {
  back: Sprite | null;
  backY: number;
  front: Sprite;
  frontY: number;
}
const BOX_SIDE = sprite(["gssssg", "gggggg", "gssssg", "gggggg"]);
export const BOX: BoxPic[] = [
  { back: null, backY: 0, front: sprite(["gggggg", "gssssg", "gggggg", "gssssg", "gggggg"]), frontY: 10 },
  { back: sprite(["..gg..", "...gg.", "....gg", "gkkkkg"]), backY: 7, front: BOX_SIDE, frontY: BOX_RIM },
  { back: sprite([".....g", ".....g", ".....g", "gkkkkg"]), backY: 7, front: BOX_SIDE, frontY: BOX_RIM },
];
/** Where he stands to reach into the box, facing it. */
export const BOX_STAND = 52;
// Tools as he carries them (and as they come out of the box), each held at the bottom.
/** The bat, carried barrel up. */
export const BAT = sprite(["gg", "gg", "gg", ".g", ".g", ".s", ".s"]);
/** The wrench, carried jaw up. */
export const WRENCH = sprite(["r.r", "rrr", ".r.", ".r.", ".r."]);
/** The T-mop carried upright (rag on the crossbar at the top), and the brush beside it. */
export const MOP = sprite(["rrrw", "gggr", ".g.g", ".g.g", ".g..", ".g..", ".g.."]);
/** A coil of rope with the hook hanging from it. */
export const COIL = sprite(["ccc", "c.c", "ccc", ".m.", "m.m"]);
/** The lighter: red body, metal top. */
export const LIGHTER = sprite(["m", "x", "x"]);
/** The flamethrower, carried upright: red tank, the barrel on top. */
export const FLAMER = sprite([".m", ".m", "xx", "xx", "xx"]);
/** The chainsaw, carried bar up: the bar and its chain, the orange engine at the bottom. */
export const SAW = sprite(["r.", "m.", "r.", "m.", "ee", "ee"]);
/** The hand truck, carried folded upright: the frame, the nose plate and the wheel at the bottom. */
export const TRUCK_CARRY = sprite(["m.", "m.", "m.", "m.", "mm", "qq"]);
/** The broom (twigs), carried upright: the handle, the red binding, the bundle of twigs fanning out at the bottom. */
export const BROOM = sprite([".g.", ".g.", ".g.", ".x.", ".y.", "yyy", "ygy"]);
/** The magic wand, carried tip up: white tip, dark body. */
export const WAND = sprite(["w", "m", "m", "m"]);
/** The leaf blower, carried nozzle down: orange motor on top, the tube below. */
export const BLOWER = sprite(["ee", "ee", ".r", ".r", ".r", ".m"]);

// The worker, 7×12. Facing the viewer, or facing left (towards the digits); mirror() turns him right.
export const FRONT = sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".o.o.o.", ".ooooo.", "..bbb..", "bbbbbbb", "o.bbb.o", "..ppp..", "..p.p..", "..p.p..", ".ss.ss."]);
export const BLINK = sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".ooooo.", ".ooooo.", "..bbb..", "bbbbbbb", "o.bbb.o", "..ppp..", "..p.p..", "..p.p..", ".ss.ss."]);
/** Hands up, "ta-da": arms bent, hands at eye level. 9 wide, so it sits one column to the left. */
export const HANDS_UP = Object.assign(
  sprite([
    "...hhh...", "..hhhhhh.", "..ooooo..", "o.o.o.o.o", "b.ooooo.b", ".b.bbb.b.", "..bbbbb..", "...bbb...",
    "...ppp...", "...p.p...", "...p.p...", "..ss.ss..",
  ]),
  { ox: -1, oy: 0 },
);
export const LOOK_UP = sprite(["..hhh..", ".hhhhhh", ".o.o.o.", ".ooooo.", ".ooooo.", "..bbb..", "bbbbbbb", "o.bbb.o", "..ppp..", "..p.p..", "..p.p..", ".ss.ss."]);
/** 13:37: the worker at rest in dark hacker shades, a green glint on them. */
export const SHADES = sprite(["..hhh..", ".hhhhhh", ".ooooo.", ".qqGqq.", ".ooooo.", "..bbb..", "bbbbbbb", "o.bbb.o", "..ppp..", "..p.p..", "..p.p..", ".ss.ss."]);
/**
 * Friday evening: the beer bottle (brown glass, gold cap, white label), and where it stands on the floor, just left of
 * his place. Tipped up for a swig: its neck at his mouth.
 */
export const BOTTLE = sprite([".y.", ".B.", ".B.", "BBB", "BwB", "BwB", "BBB"]);
export const BOTTLE_X = 47;
export const BOTTLE_Y = 8;
export const BOTTLE_TIPPED = sprite(["...BB", ".BBw.", "BBB.."]);
/** The crane's control box, carried: two levers up, a dark box with a red and a yellow button. */
export const PAD = sprite(["m.m", "qqq", "xqy"]);
/**
 * Looking up at the crane, the control box held in both hands in front of him: a dark box with two levers on top,
 * a yellow button, and a red light that blinks [off, on] while the crane works.
 */
export const LOOK_UP_PAD = [false, true].map((light) =>
  sprite([
    "..hhh..", ".hhhhhh", ".o.o.o.", ".ooooo.", ".ooooo.", ".bmbmb.", "bqqqqqb", "oq" + (light ? "x" : "r") + "qyqo",
    ".qqqqq.", "..p.p..", "..p.p..", ".ss.ss.",
  ]),
);
/** The crane's remote, carried: antenna up. */
export const REMOTE = sprite(["m", "m", "r", "r"]);
/** Looking up at the crane, the remote in his right hand (at the picture's right), its light [off, on]. */
export const LOOK_UP_REMOTE = [false, true].map((light) =>
  sprite([
    "..hhh...", ".hhhhhh.", ".o.o.o..", ".ooooo." + (light ? "y" : "m"), ".ooooo.m", "..bbb..m", "bbbbbbbr", "o.bbb.or",
    "..ppp...", "..p.p...", "..p.p...", ".ss.ss..",
  ]),
);

const HEAD = ["..hhh..", "hhhhh..", ".oooo..", ".o.oo..", ".oooo.."];

export const WALK_L = [
  sprite([...HEAD, "..bbb..", ".bbbb..", "..obb..", "..ppp..", ".pp.p..", ".p...p.", "ss...ss"]),
  sprite([...HEAD, "..bbb..", "..bbb..", "..bbo..", "..ppp..", "..pp...", "..pp...", "..sss.."]),
];
export const WALK_R = WALK_L.map(mirror);
/** Standing at work, facing left; the hand and the tool are drawn apart, as they move. */
export const WORK_L = sprite([...HEAD, "..bbb..", ".bbbb..", "..bbb..", "..ppp..", "..p.p..", "..p.p..", ".ss.ss."]);
