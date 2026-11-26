// Worker clock: a little worker keeps the clock. When the time changes he changes the digits, each time a different
// way. This file runs the show: the time, which scene comes next, the back display, the buttons.
//
// The scenes are not played here frame by frame (the bar takes only a few draw requests a second, so a scene crawled
// along at a minute long). tools/bake.ts plays them on the PC beforehand and writes each scene as one .anim file, a
// section for each change; here a scene is one draw request with its file and section, and the BUSY Bar plays it by
// itself. While it plays, the digits that don't change stay plain pictures under it. After a scene is changed:
// npm run bake.
import { loadValues } from "@shared/settings";
import { device } from "@shared/device";
import manifest from "./appmeta/manifest.json";
import { Screen, PALETTE, NO_TIMEOUT, sprite, setColor, type Sprite } from "./gfx";
import { BLINK, FRONT, LOOK_UP, SHADES, BOTTLE, BOTTLE_X, BOTTLE_Y, COLON, COLON_X, COLON_Y } from "./art";
import { linedUp } from "./events/lineup";
import { makeWorld, render, type World } from "./world";
import { BACKGROUNDS, OWN_FLOOR, BAKED, TIMER_COLORS, SOUNDS, msOf, cueOf, type Baked } from "./baked";

type Tier = Baked["tier"];

/**
 * For testing a scene: put its id here (e.g. "blower") and every change of the clock plays only it. Leave null for the
 * real thing.
 */
const ONLY: string | null = null;

const IDLE_MS = 250;
/** At rest, an idle (yawn, ...) plays every so often: this many seconds apart, at random between the two. */
const IDLE_EVERY_S = [25, 70];
const SEEN_KEY = "seen";
/** Everything a scene's file draws itself, so the static pictures of them are taken away while it plays. */
const MOVING = ["man", "box", "box_b", "item", "carry", "fx", "tool", "hand", "front"];

function report(err: unknown): void {
  console.error(`worker-clock: ${err instanceof Error ? err.message : String(err)}`);
}

/** The app's settings (the BUSY Bar draws their screen; src/appmeta/settings.json), read once at the start. */
const settings = { hour24: true, night: true, background: "", sound: "normal", garland: "auto", focus: 25, brk: 5 };

/** The New Year garland along the top: always, never, or ("auto") from December 1 to January 14. */
function garlandOn(): boolean {
  if (settings.garland === "on") return true;
  if (settings.garland === "off") return false;
  const d = new Date();
  return d.getMonth() === 11 || (d.getMonth() === 0 && d.getDate() <= 14);
}

/** Night: he sleeps on the box from NIGHT_FROM to NIGHT_TO o'clock (if "night" is on in the settings). */
const NIGHT_FROM = 23, NIGHT_TO = 7;

/** The time as the four digits on the clock: 24-hour 00..23, or 12-hour 01..12 (with the leading zero). */
function timeDigits(): number[] {
  const d = new Date();
  let h = d.getHours();
  const m = d.getMinutes();
  if (!settings.hour24) h = h % 12 || 12;
  return [Math.floor(h / 10), h % 10, Math.floor(m / 10), m % 10];
}

/**
 * The scenes of a tier in a shuffled bag, taken one by one: none comes back before all the others have been shown,
 * and a new bag never starts with the scene the last one ended with.
 */
class Bag {
  private left: Baked[] = [];
  private last: Baked | null = null;
  private readonly all: Baked[];
  constructor(all: Baked[]) {
    this.all = all;
  }
  get size(): number {
    return this.all.length;
  }
  next(): Baked {
    if (!this.left.length) {
      this.left = this.all.slice();
      for (let k = this.left.length - 1; k > 0; k--) {
        const m = Math.floor(Math.random() * (k + 1));
        const t = this.left[k];
        this.left[k] = this.left[m];
        this.left[m] = t;
      }
      if (this.left.length > 1 && this.left[this.left.length - 1] === this.last) this.left.unshift(this.left.pop()!);
    }
    this.last = this.left.pop()!;
    return this.last;
  }
  /** Puts a scene taken but not played back in the bag, so it still comes up this round. */
  again(s: Baked): void {
    this.left.unshift(s);
  }
}

/** The usual scenes: not the easter eggs, not the other takes of a scene. */
const usual = (s: Baked) => !s.rare && !s.variantOf;
/** Minute and ten-minute scenes are one pool: every one of them can do either change. */
const small = new Bag(BAKED.filter((s) => usual(s) && (s.tier === "minute" || s.tier === "ten")));
const bags: Record<Tier, Bag> = {
  minute: small,
  ten: small,
  hour: new Bag(BAKED.filter((s) => usual(s) && s.tier === "hour")),
  idle: new Bag(BAKED.filter((s) => usual(s) && s.tier === "idle")),
  event: new Bag([]), // events are started by their time, never drawn from a bag
  tap: new Bag([]), // taps answer a press of OK, in order (TAPS below)
  night: new Bag([]), // the night's files are played by main() itself
};
/** The easter-egg scenes (runaway digit, the cat...): one of them instead of a usual scene, this often. */
const RARE_CHANCE = 0.1;
const rares = new Bag(BAKED.filter((s) => s.rare && s.tier !== "idle"));
/** How often a scene's other take (the wrong digit painted...) plays instead of it. */
const VARIANT_CHANCE = 1 / 3;
/** The real scenes, for the "seen" count on the back display (idles, taps and other takes don't count). */
const SCENES_ONLY = BAKED.filter((s) => s.tier !== "idle" && s.tier !== "event" && s.tier !== "tap" && s.tier !== "night" && !s.variantOf);
/** His night (src/night) by name: going to sleep, asleep (looping), woken by a press, the morning. */
const nightScene = (id: string) => BAKED.filter((s) => s.id === `night_${id}`)[0];
/** His answers to presses of OK, in order (src/taps): each press the next, after the last the first again. */
const TAPS = BAKED.filter((s) => s.tier === "tap");
/** Nobody pressed for this long: the next press starts the taps over from the first. */
const TAP_RESET_S = 30;

/** What a change of the time is, in the terms of the baked files: its tier, its key, which slots the file draws. */
interface Kind {
  tier: Tier;
  key: string;
  slots: number[];
  colon: boolean;
}

/** Null for a jump that isn't a normal tick of the clock (the clock was set, the bar slept): then no scene. */
function kindOf(from: number[], to: number[]): Kind | null {
  const same = (i: number) => from[i] === to[i];
  if (same(0) && same(1) && same(2) && to[3] === from[3] + 1) return { tier: "minute", key: `m${from[3]}`, slots: [3], colon: false };
  if (same(0) && same(1) && from[3] === 9 && to[3] === 0 && from[2] < 5 && to[2] === from[2] + 1)
    return { tier: "ten", key: `t${from[2]}`, slots: [2, 3], colon: false };
  const h = from[0] * 10 + from[1], n = to[0] * 10 + to[1];
  if (from[2] === 5 && from[3] === 9 && to[2] === 0 && to[3] === 0) {
    if (n === (h + 1) % 24 && !(h === 12 && !settings.hour24))
      return { tier: "hour", key: `h${from[0]}${from[1]}`, slots: [0, 1, 2, 3], colon: true };
    if (h === 12 && n === 1) return { tier: "hour", key: "h12a", slots: [0, 1, 2, 3], colon: true }; // 12-hour clock
  }
  return null;
}

/**
 * A change of the focus timer's countdown (H:MM going down) in the terms of the baked files: p is "f" (focus) or "b"
 * (break). Null for any other jump (the timer started, stopped, its phase changed): then no scene.
 */
function countKind(p: string, from: number[], to: number[]): Kind | null {
  const same = (i: number) => from[i] === to[i];
  if (same(0) && same(1) && same(2) && to[3] === from[3] - 1) return { tier: "minute", key: `${p}m${from[3]}`, slots: [3], colon: false };
  if (same(0) && same(1) && from[3] === 0 && to[3] === 9 && to[2] === from[2] - 1)
    return { tier: "ten", key: `${p}t${from[2]}`, slots: [2, 3], colon: false };
  if (same(0) && from[2] === 0 && from[3] === 0 && to[1] === from[1] - 1 && to[2] === 5 && to[3] === 9)
    return { tier: "hour", key: `${p}h${from[1]}`, slots: [0, 1, 2, 3], colon: true };
  return null;
}

/**
 * A scene of the tier that has a file for this change: now and then an easter egg instead, and now and then a scene's
 * other take instead of it. Null when there is none (then no scene).
 */
function pick(kind: Kind): Baked | null {
  const only = ONLY ? BAKED.filter((s) => s.id === ONLY)[0] : undefined;
  if (only && msOf(only, kind.key)) return only;
  const bag = bags[kind.tier];
  if (!bag.size || kind.tier === "idle") return null;
  if (kind.tier !== "hour" && rares.size && Math.random() < RARE_CHANCE) {
    const egg = rares.next();
    if (msOf(egg, kind.key)) return egg;
  }
  // A scene with no file for this change (a minutes-only one for the tens) waits for its turn: the next one plays.
  let s = bag.next();
  const skipped: Baked[] = [];
  for (let k = 0; k < bag.size && !msOf(s, kind.key); k++) {
    skipped.push(s);
    s = bag.next();
  }
  for (const x of skipped) if (x !== s) bag.again(x);
  if (!msOf(s, kind.key)) return null;
  const other = BAKED.filter((v) => v.variantOf === s.id && msOf(v, kind.key))[0];
  return other && Math.random() < VARIANT_CHANCE ? other : s;
}

function loadSeen(): string[] {
  try {
    const v = localStorage.getItem(SEEN_KEY);
    return v ? v.split(",").filter((id) => SCENES_ONLY.some((s) => s.id === id)) : [];
  } catch {
    return [];
  }
}

function main(): void {
  const screen = new Screen();
  const w: World = makeWorld(timeDigits());
  const seen = loadSeen();
  /** The background chosen in the settings ("none": none), or the first one when that isn't one of them. */
  const chosenBg = settings.background === "none" ? "" : BACKGROUNDS.indexOf(settings.background) >= 0 ? settings.background : BACKGROUNDS[0];
  let lastName = "-";
  /** The scene playing now: its file, which slots and the colon it draws, and when it ends. */
  let playing: { path: string; section: string; n: number; slots: number[]; colon: boolean; endAt: number; after?: () => void; hideBottle?: boolean } | null = null;
  /** Scenes played so far: each gets its own element id (scene<n>), since the bar doesn't restart an element sent
   * again with another section. The id now on screen, to take it away. */
  let plays = 0;
  let sceneId = "";
  /** The easter eggs that belong to a time: the digits lined up by height (12:34), the beer bottle out (Friday
   * evening), the year the New Year fireworks went up. */
  let lined = false;
  let beerOut = false;
  let fireworksYear = -1;
  const digitsAre = (t: number[]) => w.slots.every((s, i) => s.value === t[i]);
  /** The clock shows this time of day now (24-hour hh, mm): its scene, if it had one, is over. */
  const showing = (hh: number, mm: number) => {
    const d = new Date();
    return d.getHours() === hh && d.getMinutes() === mm && digitsAre(timeDigits());
  };
  /** 13:37 (01:37 on the 12-hour clock): he stands in hacker shades and the background is the Matrix. */
  const hacker = () => showing(13, 37);
  const fridayEvening = () => { const d = new Date(); return d.getDay() === 5 && d.getHours() >= 18; };
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** A redraw is already on its way for the wheel: more clicks before it only change the time (see the wheel). */
  let wheelSoon = false;
  /** When the back display was last built, and whether draw() last turned PALETTE grey (paused). */
  let lastBackAt = 0;
  let wasPaused = false;
  let stopped = false;
  let restTicks = 0;
  /**
   * The focus timer (Start): the focus, then the break, then the clock again. Shown as H:MM, the minutes left rounded
   * up, in its color (focus blue, break green), with a bar along the floor for what is left. Null: the clock.
   */
  let pomo: { phase: "f" | "b"; endAt: number; total: number; paused: boolean; left: number } | null = null;
  /** The next change of the digits is a jump (the timer started, stopped, changed phase): no scene for it. */
  let jumpNext = false;
  const leftMs = () => (pomo ? (pomo.paused ? pomo.left : pomo.endAt - Date.now()) : 0);
  /** What the clock should show now: the time, or the timer's minutes left. */
  const target = () => {
    if (!pomo) return timeDigits();
    const m = Math.max(0, Math.ceil(leftMs() / 60000));
    return [0, Math.floor(m / 60) % 10, Math.floor((m % 60) / 10), m % 10];
  };
  const phaseOf = (phase: "f" | "b") => {
    const total = 60000 * (phase === "f" ? settings.focus : settings.brk);
    pomo = { phase, endAt: Date.now() + total, total, paused: false, left: total };
    jumpNext = true;
  };
  /** The flash playing now (see flash()): when it swaps the digits (then `change` is done) and when it is over. */
  let flashing: { swapAt: number; endAt: number; change: (() => void) | null; word: string } | null = null;
  /** A long press of OK silences him (or brings the sound back), till the app ends: the setting stays as it is. */
  let muted = true; // starts muted (2026-11-23): sound only after a long OK, so the bar doesn't suddenly make noise
  /** The next tap to play, and when OK was last pressed. */
  let tapNext = 0;
  let tapAt = 0;
  /** Asleep on the box (the night loop plays in place of him and the box). */
  let asleep = false;
  /** Night now (and the setting on). On New Year's Eve he stays up for the fireworks at midnight. */
  const isNight = () => {
    if (!settings.night || pomo) return false; // he stays up while the timer runs
    const d = new Date(), h = d.getHours();
    if (d.getMonth() === 11 && d.getDate() === 31) return false;
    if (d.getMonth() === 0 && d.getDate() === 1 && h === 0 && d.getMinutes() === 0) return false; // the fireworks first
    return h >= NIGHT_FROM || h < NIGHT_TO;
  };
  /** Plays a night file; `after` when it is over. */
  const night = (id: string, after?: () => void) => {
    const s = nightScene(id);
    if (!s || !msOf(s, "i")) {
      if (after) after();
      return;
    }
    start(s, { tier: "night", key: "i", slots: [], colon: false }, w.slots.map((v) => v.value));
    if (playing) playing.after = after;
  };
  const nextIdle = () => Date.now() + 1000 * (IDLE_EVERY_S[0] + Math.random() * (IDLE_EVERY_S[1] - IDLE_EVERY_S[0]));
  let idleAt = nextIdle();

  /**
   * The shift log on the back display: a clipboard with the day's work. Counted since the shift began (the app's start,
   * the morning, or midnight when he doesn't sleep); kept in memory only, so a restart begins a new shift.
   */
  const shift = { start: Date.now(), digits: 0, coffee: 0, lastAt: "", day: new Date().getDate() };
  const newShift = () => {
    shift.start = Date.now();
    shift.digits = 0;
    shift.coffee = 0;
    shift.lastAt = "";
    shift.day = new Date().getDate();
  };
  /** The time as the clock shows it, "HH:MM". */
  const clockText = () => {
    const t = timeDigits();
    return `${t[0]}${t[1]}:${t[2]}${t[3]}`;
  };
  const back = () => {
    lastBackAt = Date.now();
    const B = "back";
    const text = (id: string, t: string, x: number, y: number, font: string, color = "#FFFFFFFF", align = "top_left") =>
      screen.raw(id, { type: "text", display: B, text: t, x, y, align, font, color });
    const rect = (id: string, x: number, y: number, width: number, height: number, color: string) =>
      screen.raw(id, { type: "rectangle", display: B, x, y, width, height, align: "top_left", fill: "solid", fill_colors: [color], border_width: 0, z_index: 0 });
    // The clipboard: a thin frame, and its clip at the top (the right 12 px are the bar's status line).
    const EDGE = "#FFFFFF55";
    rect("b_f1", 2, 4, 144, 1, EDGE);
    rect("b_f2", 2, 78, 144, 1, EDGE);
    rect("b_f3", 2, 4, 1, 75, EDGE);
    rect("b_f4", 145, 4, 1, 75, EDGE);
    rect("b_clip", 58, 1, 32, 6, "#FFFFFFCC");
    const d = new Date();
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    text("b_title", "SHIFT LOG", 7, 9, "bold");
    text("b_date", `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`, 141, 11, "small", "#BBBBBBFF", "top_right");
    rect("b_rule", 7, 22, 134, 1, EDGE);
    const DIM = "#9A9A9AFF";
    if (asleep) {
      text("b_l1", "Off shift: asleep", 7, 26, "small");
    } else {
      const mins = Math.floor((Date.now() - shift.start) / 60000);
      text("b_l1", `On shift   ${Math.floor(mins / 60)}h ${mins % 60}m`, 7, 26, "small");
    }
    // Sound off by a long press of OK: said on the right of the first line.
    if (muted) text("b_mute", "MUTED", 141, 26, "small", "#9A9A9AFF", "top_right");
    else screen.raw("b_mute", null);
    text("b_l2", `Digits replaced   ${shift.digits}`, 7, 36, "small");
    text("b_l3", shift.lastAt ? `Last: ${shift.lastAt} ${lastName}`.slice(0, 26) : "Last: -", 7, 46, "small");
    text("b_l4", `Coffee ${shift.coffee}   Scenes ${seen.length}/${SCENES_ONLY.length}`, 7, 56, "small", DIM);
    // At the bottom: when the next big show (the hour) is; at night, when he gets up.
    const left = Math.max(0, Math.ceil(leftMs() / 1000));
    const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    const next = pomo ? `${pomo.phase === "f" ? "Focus" : "Break"} ${clock} left${pomo.paused ? " (paused)" : ""}` : asleep ? `Wake-up at ${settings.hour24 ? "07:00" : "07:00 AM"}` : `Next big show in ${60 - d.getMinutes()} min`;
    text("b_l5", next, 7, 67, "small", DIM);
  };

  /** Puts the clock on the Screen: at rest all of it; while a scene plays, only what the scene's file doesn't draw. */
  const draw = () => {
    // The digits in the timer's color (the clock's white without it); the Screen sends them again when it changes.
    // Paused: everything grey and still (the background's grey file is one still frame), so it reads as stopped.
    const paused = !!(pomo && pomo.paused);
    if (paused !== wasPaused) {
      for (const c of Object.keys(COLORS)) setColor(c, paused ? GREYS[c] : COLORS[c]);
      wasPaused = paused;
    }
    const digit = pomo ? TIMER_COLORS[pomo.phase] : "#FFFFFF";
    setColor("#", paused ? grey(digit) : digit);
    const still = paused ? "_g" : "";
    render(w, screen);
    // The colon breathes: a looping animation in place of the still one, except while an hour scene draws it itself.
    screen.put("colon", null, 0, 0, 0);
    // The background loops under everything, played by the bar itself (re-sent only when it changes: 13:37).
    const bg = hacker() && BACKGROUNDS.indexOf("matrix") >= 0 ? "matrix" : chosenBg;
    if (bg) screen.raw("bg", { type: "animation", path: `animations/bg_${bg}${still}.anim`, x: 0, y: 0, align: "top_left", loop: true, z_index: 0 });
    else screen.raw("bg", null);
    // The garland, on top of everything (it keeps to the top rows, above the digits).
    if (garlandOn() && BACKGROUNDS.indexOf("garland") >= 0)
      screen.raw("garland", { type: "animation", path: `animations/bg_garland${still}.anim`, x: 0, y: 0, align: "top_left", loop: true, z_index: 11 });
    else screen.raw("garland", null);
    // The plain grey floor line, unless the background draws its own floor.
    screen.put("fuse", null, 0, 0, 0);
    if (pomo) {
      // The timer: a fuse along the floor in its color, burning down from the right, like the bar's own timer: what is
      // left of it is the time left; its end a white-hot spark (a little looping file). Paused: grey and out.
      const width = Math.round((72 * Math.max(0, leftMs())) / pomo.total);
      setColor("U", dim(paused ? grey(digit) : digit, 0.8).slice(0, 7));
      screen.raw("floor", null);
      // Over everything but the flash: above the worker, box and scene files (z 10); the spark one higher still.
      if (width > 0) screen.put("fuse", fuseOf(width), 0, 15, 11);
      if (width > 0 && !paused)
        screen.raw("spark", { type: "animation", path: "animations/fuse_spark.anim", x: Math.max(0, width - 3), y: 12, align: "top_left", loop: true, z_index: 12 });
      else screen.raw("spark", null);
    } else {
      screen.raw("spark", null);
      screen.raw("floor", bg && OWN_FLOOR.indexOf(bg) >= 0 ? null : FLOOR_LINE);
    }
    screen.put("bottle", beerOut && !(playing && playing.hideBottle) ? BOTTLE : null, BOTTLE_X, BOTTLE_Y, 2);
    if ((playing && playing.colon) || (pomo && pomo.paused)) screen.raw("colon_pulse", null);
    else {
      const path = `animations/colon${pomo ? `_${pomo.phase}` : ""}.anim`;
      screen.raw("colon_pulse", { type: "animation", path, x: 0, y: 0, align: "top_left", loop: true, z_index: 1 });
    }
    // Paused: the colon stands still (grey, like the rest).
    if (paused && !(playing && playing.colon)) screen.put("colon", COLON, COLON_X, COLON_Y, 1);
    // Asleep: the night loop draws him and the box, over and over (not while a night file plays).
    const sleepLoop = nightScene("loop");
    if (asleep && !playing && sleepLoop)
      screen.raw("sleep", { type: "animation", path: `animations/${sleepLoop.id}.anim`, section: "i", x: 0, y: 0, align: "top_left", loop: true, z_index: 10 });
    else screen.raw("sleep", null);
    // The flash, over everything (z 13), while it plays.
    if (flashing) screen.raw("flash", { type: "animation", path: `animations/flash_${flashing.word}.anim`, x: 0, y: 0, align: "top_left", loop: false, z_index: 13 });
    else screen.raw("flash", null);
    if (playing || asleep) for (const id of MOVING) screen.put(id, null, 0, 0, 0);
    if (playing) {
      for (const i of playing.slots) screen.put(`d${i}`, null, 0, 0, 0);
      // A new id for each scene: the Screen sends the new one first, then takes the old one away, so nothing blinks.
      const id = `scene${playing.n}`;
      if (sceneId && sceneId !== id) screen.raw(sceneId, null);
      sceneId = id;
      screen.raw(id, { type: "animation", path: playing.path, section: playing.section, x: 0, y: 0, align: "top_left", loop: false, z_index: 10 });
    } else if (sceneId) {
      screen.raw(sceneId, null);
      sceneId = "";
    }
    screen.commit(report);
  };

  /**
   * The sounds of the scene now playing: each at its time from the file's start (the bake noted them, see baked.ts),
   * a little later for the draw request to reach the bar. One plays at a time; a new one cuts the last.
   */
  /** The sound timers not yet fired (a fired one is taken off: clearing it again makes the firmware complain). */
  let sounds: { t: ReturnType<typeof setTimeout>; fired: boolean }[] = [];
  const clearSounds = () => {
    for (const s of sounds) if (!s.fired) clearTimeout(s.t);
    sounds = [];
  };
  let soundFailed = false;
  const SOUND_DELAY_MS = 120;
  const playSound = (name: string) => {
    if (stopped || muted || settings.sound === "off") return;
    const path = `sounds/${name}${settings.sound === "quiet" ? "_q" : ""}.snd`;
    device.AudioPlay({ application_name: manifest.id, path }, NO_TIMEOUT).catch((e: unknown) => {
      if (!soundFailed) report(e); // once is enough: the scene goes on silent
      soundFailed = true;
    });
  };
  const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  /** The notes (see CUES in baked.ts, one file's part of it): 3 characters each, when in tenths of a second (base 36) and which sound. */
  const scheduleSounds = (cues: string | undefined) => {
    clearSounds();
    if (!cues || muted || settings.sound === "off") return;
    for (let k = 0; k + 3 <= cues.length; k += 3) {
      const ms = parseInt(cues.slice(k, k + 2), 36) * 100, name = SOUNDS[LETTERS.indexOf(cues.charAt(k + 2))];
      const s = { t: setTimeout(() => {
        s.fired = true;
        playSound(name);
      }, ms + SOUND_DELAY_MS), fired: false };
      sounds.push(s);
    }
  };

  const start = (scene: Baked, kind: Kind, to: number[]) => {
    if (scene.tier === "minute" || scene.tier === "ten" || scene.tier === "hour") {
      shift.digits += to.filter((v, i) => v !== w.slots[i].value).length;
      shift.lastAt = clockText();
    }
    if (scene.id === "coffee") shift.coffee++;
    to.forEach((v, i) => (w.slots[i].value = v));
    const key = kind.key;
    playing = {
      path: `animations/${scene.id}.anim`,
      section: key,
      n: ++plays,
      slots: kind.slots,
      colon: kind.colon,
      // A little longer than the file: the draw request takes a moment to reach the bar.
      endAt: Date.now() + msOf(scene, key) + 300,
    };
    console.log(`scene ${scene.id} ${key}`);
    scheduleSounds(cueOf(scene, key));
    if (scene.id === "sip") playing.hideBottle = true; // the file draws the bottle as he picks it up
    if (scene.tier === "idle" || scene.tier === "event" || scene.tier === "tap" || scene.tier === "night") {
      if (scene.tier === "event") { lastName = scene.name; back(); }
      w.man.frame = FRONT;
      return;
    }
    lastName = scene.name;
    const id = scene.variantOf ?? scene.id;
    if (seen.indexOf(id) < 0) {
      seen.push(id);
      try {
        localStorage.setItem(SEEN_KEY, seen.join(","));
      } catch (e) {
        report(e);
      }
    }
    back();
    w.man.frame = FRONT;
  };

  /**
   * Plays an event (a show of its time) over the clock as it is; `after` runs when it is over (or at once, when the
   * event has no file). The digits in `slots` are drawn by its file while it plays.
   */
  const event = (id: string, slots: number[], after?: () => void) => {
    const e = BAKED.filter((s) => s.id === id)[0];
    if (!e || !msOf(e, "e")) {
      if (after) after();
      return;
    }
    start(e, { tier: "event", key: "e", slots, colon: false }, w.slots.map((s) => s.value));
    if (playing) playing.after = after;
  };

  /**
   * The timer's jumps (Start, stop, the break over): a soft white flash over the whole display (animations/flash.anim,
   * see tools/bake.ts), and at its brightest `change` swaps the mode and the digits under it.
   */
  const flash = (change: () => void, word: "focus" | "clock") => {
    const now = Date.now();
    flashing = { swapAt: now + FLASH_SWAP_MS, endAt: now + FLASH_MS, change, word };
    playSound("magic");
  };

  const tick = () => {
    timer = null;
    wheelSoon = false;
    if (stopped) return;
    const now = Date.now();
    if (flashing) {
      // Nothing else while the flash plays: at its brightest the new digits go in under it, plain (no scene).
      if (flashing.change && now >= flashing.swapAt) {
        flashing.change();
        flashing.change = null;
        target().forEach((v, i) => (w.slots[i].value = v));
        jumpNext = false;
      }
      if (now >= flashing.endAt) flashing = null;
      else {
        back();
        draw();
        const next = flashing.change ? flashing.swapAt : flashing.endAt;
        timer = setTimeout(tick, Math.max(20, Math.min(IDLE_MS, next - now)));
        return;
      }
    }
    if (playing && now >= playing.endAt) {
      // The file's last frame is the clock at rest, so the static pictures take over where it stops.
      const after = playing.after;
      playing = null;
      if (after) after();
      restTicks = 0;
      if (idleAt - now < 8000) idleAt = now + 8000; // a breather after any scene before the next idle
    }
    if (pomo && !pomo.paused && !playing && leftMs() <= 0) {
      // Time's up while it shows 0:01: no scene for 1 -> 0, the alarm (or the flash) at once, the digits 0:00 under it.
      [0, 0, 0, 0].forEach((v, i) => (w.slots[i].value = v));
      if (pomo.phase === "f") {
        // The focus is over: the alarm clock jumps out of the box and he slaps it quiet; then one of the hour scenes
        // clears the blue digits away and brings the break's green ones (the files bk<minutes>).
        event("alarm", [], () => {
          phaseOf("b");
          const kind: Kind = { tier: "hour", key: `bk${settings.brk}`, slots: [0, 1, 2, 3], colon: true };
          const scene = pick(kind);
          if (scene) {
            jumpNext = false;
            start(scene, kind, target());
          }
        });
      } else {
        // The break is over: the clock again, in a flash.
        flash(() => {
          pomo = null;
        }, "clock");
      }
    }
    if (!playing) {
      const from = w.slots.map((s) => s.value), to = target();
      if (to.some((v, i) => v !== from[i]) && lined) {
        // 12:35 coming: the lined-up digits straighten first; the minute's scene follows on the next tick.
        lined = false;
        event("straighten", [0, 1, 2, 3], () => linedUp(w, false));
      } else if (to.some((v, i) => v !== from[i]) && asleep) {
        // At night the digits change quietly: he sleeps.
        to.forEach((v, i) => (w.slots[i].value = v));
        jumpNext = false;
      } else if (to.some((v, i) => v !== from[i])) {
        const kind = jumpNext ? null : pomo ? countKind(pomo.phase, from, to) : kindOf(from, to);
        jumpNext = false;
        const scene = kind ? pick(kind) : null;
        if (kind && scene) start(scene, kind, to);
        else {
          shift.digits += to.filter((v, i) => v !== from[i]).length;
          to.forEach((v, i) => (w.slots[i].value = v));
        }
      }
    }
    if (beerOut && !fridayEvening()) beerOut = false; // midnight: the bottle is gone
    // Midnight, if he works through the night: a new shift (and the log's date).
    if (!asleep && new Date().getDate() !== shift.day) newShift();
    if (!playing && asleep !== isNight()) {
      // Night falls: off to the box to sleep. Morning: he gets up and goes home.
      if (!asleep) night("in", () => { asleep = true; });
      else night("out", () => { asleep = false; newShift(); });
    }
    if (!playing && !asleep) {
      // The easter eggs of a time, once its scene is over.
      const d = new Date();
      if (!lined && digitsAre([1, 2, 3, 4])) event("lineup", [0, 1, 2, 3], () => { lined = true; linedUp(w, true); });
      else if (d.getMonth() === 0 && d.getDate() === 1 && showing(0, 0) && fireworksYear !== d.getFullYear()) {
        fireworksYear = d.getFullYear();
        event("fireworks", []);
      } else if (fridayEvening() && !beerOut) event("beer", [], () => { beerOut = true; });
    }
    if (!playing && !asleep && now >= idleAt && !(pomo && pomo.paused)) {
      // Now and then an idle, unless the minute turns before it would end (the scene for the new time comes first).
      // None at 13:37 (he stands there in his shades); on a Friday evening, often a sip of his beer.
      idleAt = nextIdle();
      const sip = BAKED.filter((s) => s.id === "sip")[0];
      const idle = hacker() ? null : beerOut && sip && Math.random() < 0.4 ? sip : bags.idle.size ? bags.idle.next() : null;
      // (On the timer: till its next minute; paused, it doesn't change.)
      const toMinute = pomo ? (pomo.paused ? Infinity : leftMs() % 60000 || 60000) : 60000 - (now % 60000);
      if (idle && msOf(idle, "i") + 1500 < toMinute)
        start(idle, { tier: "idle", key: "i", slots: [], colon: false }, w.slots.map((s) => s.value));
    }
    if (!playing) {
      // At rest: he blinks now and then, and sometimes looks up at the clock.
      restTicks++;
      const r = Math.random();
      if (hacker()) w.man.frame = SHADES;
      else if (w.man.frame !== FRONT || (pomo && pomo.paused)) w.man.frame = FRONT; // paused: he stands still
      else if (r < 0.06) w.man.frame = BLINK;
      else if (r < 0.07 && restTicks > 40) w.man.frame = LOOK_UP;
    }
    // The back display says nothing that changes faster than once a second: no need to build it on every tick.
    if (Date.now() - lastBackAt >= 900) back();
    draw();
    // While a scene plays, wake up right when it ends.
    const wait = playing ? Math.max(20, Math.min(IDLE_MS, playing.endAt - Date.now())) : IDLE_MS;
    timer = setTimeout(tick, wait);
  };

  const unbind = listen("input", (event) => {
    if (stopped) return;
    if (event.key === "back" && event.action === "short") {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      clearSounds();
      setTimeout(unbind, 0);
    } else if (event.key === "ok" && event.action === "short" && !playing && asleep) {
      // A press at night: he jumps awake, looks round, grumbles and dozes off again.
      night("wake");
      draw();
    } else if (event.key === "ok" && event.action === "short" && !playing && !(pomo && pomo.paused)) {
      // A press: his answer, the next one in the chain (or the first, after a quiet while).
      const now = Date.now();
      if (now - tapAt > TAP_RESET_S * 1000) tapNext = 0;
      tapAt = now;
      const tap = TAPS[tapNext % TAPS.length];
      tapNext = (tapNext + 1) % TAPS.length;
      if (tap) {
        start(tap, { tier: "tap", key: "i", slots: [], colon: false }, w.slots.map((s) => s.value));
        if (idleAt - now < 8000) idleAt = now + 8000;
        draw();
      }
    } else if (event.key === "start" && (event.action === "press" || event.action === "long")) {
      // Start: the focus timer. On the press itself (not on the release, which comes later and felt laggy on the bar):
      // start it, or pause / go on. Held on (long): stop it, the clock again; the press before it has already paused or
      // resumed, which the stop undoes anyway. The short and repeat that follow are ignored. A scene playing is cut
      // short, so the press is answered at once.
      if (event.action === "long" && !pomo) return;
      if (flashing) return; // a flash is quick: let it finish
      if (playing) {
        const after = playing.after;
        playing = null;
        clearSounds();
        if (after) after();
      }
      if (event.action === "long") flash(() => {
        pomo = null;
      }, "clock");
      else if (!pomo) flash(() => phaseOf("f"), "focus");
      else if (pomo.paused) {
        pomo.endAt = Date.now() + pomo.left;
        pomo.paused = false;
        playSound("beep");
      } else {
        pomo.left = Math.max(0, pomo.endAt - Date.now());
        pomo.paused = true;
        playSound("beep");
      }
      if (timer !== null) clearTimeout(timer);
      tick();
    } else if (event.key === "encoder") {
      // The wheel on the timer (focus or break, running or paused): 5 minutes more or less a click. Not while the
      // flash, the alarm or the change into the break plays, nor once the time is up.
      if (!pomo || flashing || (playing && playing.after) || leftMs() <= 0) return;
      if (playing) {
        playing = null;
        clearSounds();
      }
      const cur = leftMs();
      let next = Math.min(WHEEL_MAX_MS, cur + event.delta * WHEEL_STEP_MS);
      if (event.delta < 0) next = Math.max(next, Math.min(cur, 60000)); // down to a minute left, not to nothing
      if (pomo.paused) pomo.left = next;
      else pomo.endAt = Date.now() + next;
      pomo.total = Math.max(next, pomo.total - cur + next); // the whole of it: the part gone by, and what is left now
      jumpNext = true; // the digits jump, no scene
      // A quick spin sends many clicks at once. Each one only changes the time; the screen is drawn once, a moment
      // after the first (drawing after every click made them queue up on the bar: seconds of lag for a long spin).
      if (wheelSoon) return;
      wheelSoon = true;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(tick, WHEEL_DRAW_MS);
    } else if (event.key === "ok" && event.action === "long") {
      // A long press: sound off, or on again (a short beep says it is back).
      muted = !muted;
      if (muted) clearSounds();
      else playSound("beep");
      back();
      draw();
    }
  });

  back();
  tick();
}

/** A color ("#RRGGBB") at k (60 %), as the display takes it ("#RRGGBBAA"). */
function dim(hex: string, k = 0.6): string {
  const c = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0"));
  return `#${c.join("")}FF`.toUpperCase();
}

/** The timer's fuse, `width` pixels long, in "U" (its color is set in draw()). */
const FUSE_ROW = "U".repeat(72);
const FUSES: Record<number, Sprite> = {};
function fuseOf(width: number): Sprite {
  // One sprite for each width, kept: the Screen then sees the same picture and doesn't encode it again.
  return FUSES[width] || (FUSES[width] = sprite([FUSE_ROW.slice(0, width)]));
}

/** A color ("#RRGGBB") as a grey of the same brightness: the paused timer shows everything grey. */
function grey(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b).toString(16).padStart(2, "0").toUpperCase();
  return `#${v}${v}${v}`;
}
/** The colors as drawn normally (PALETTE is turned grey while the timer is paused, and back). */
const COLORS: Record<string, string> = { ...PALETTE };
const GREYS: Record<string, string> = {};
for (const c of Object.keys(COLORS)) GREYS[c] = grey(COLORS[c]);

/** The wheel on the timer: this much more or less time a click. At most 9:55 (the clock shows H:MM). */
const WHEEL_STEP_MS = 5 * 60000;
const WHEEL_MAX_MS = (9 * 60 + 55) * 60000;
/** The wheel: clicks this close after the first one are drawn together. */
const WHEEL_DRAW_MS = 60;

/** The flash (animations/flash.anim): how long it plays, and when it is at its brightest (keep in step with bake.ts). */
const FLASH_MS = 1620;
const FLASH_SWAP_MS = 670;

/** The plain grey floor line under him, for the backgrounds that don't draw a floor of their own (and for none). */
const FLOOR_LINE = { type: "rectangle", x: 0, y: 15, width: 72, height: 1, align: "top_left", fill: "solid", fill_colors: ["#303030FF"], border_width: 0, z_index: 0 };

// The settings first (the BUSY Bar answers at once; if it doesn't, the defaults), then the clock.
loadValues()
  .then((v) => {
    if (v) {
      settings.hour24 = v.hour24 !== false;
      settings.night = v.night !== false;
      if (v.sound === "quiet" || v.sound === "off") settings.sound = v.sound;
      if (v.garland === "on" || v.garland === "off") settings.garland = v.garland;
      if (typeof v.background === "string") settings.background = v.background;
      const mins = (x: unknown, lo: number, hi: number, d: number) => (typeof x === "number" && x >= lo ? Math.min(hi, Math.round(x)) : d);
      settings.focus = mins(v.focus, 1, 120, 25);
      settings.brk = Math.max(5, Math.min(30, Math.round(mins(v.break, 1, 30, 5) / 5) * 5)); // the break in 5s: a file for each
    }
  })
  .catch(report)
  .then(() => main());
