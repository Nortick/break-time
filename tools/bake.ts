// BAKE: plays every scene off-device, for every change of the digits it can be shown on, and writes each run as an
// .anim file the BUSY Bar plays by itself (no draw request per frame). Run after changing a scene:  npm run bake
//
// What goes into a file: everything a scene moves (the worker, the box, tools, effects, the digits that change).
// Digits that don't change stay plain pictures on the bar, under the animation, so a file depends only on the change
// (3->4, 19->20, 23:59->00:00), not on the whole time. Hour files hold all four digits and the colon, so a shake moves
// the whole clock. Writes src/animations/<scene>.anim, one file a scene with a section for each change (the key:
// m3, h05, bk15...), and src/baked.ts (which sections exist and how long each is).
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "fs";
import { PALETTE, type Sprite } from "../src/gfx";
import { makeWorld, render, settle } from "../src/world";
import { COLON, COLON_X, COLON_Y, DIGITS, DIGIT_X, DIGIT_Y, FRONT } from "../src/art";
import { SCENES, type Change } from "../src/scenes/index";
import { IDLES } from "../src/idles/index";
import { EVENTS } from "../src/events/index";
import { TAPS } from "../src/taps/index";
import { NIGHT } from "../src/night/index";
import { BACKGROUNDS, levelOf } from "../src/backgrounds/index";

/**
 * The scenes are written in steps of a tenth of a second (one `yield` is one step: a pose held, a pixel walked); the
 * files play at 60 frames a second. Between two steps the bake draws the in-between frames itself: whatever moved more
 * than a pixel (a falling digit, a flying tool, debris, sparks) goes there frame by frame; poses still change on the
 * step, like hand-drawn 2D animation.
 */
const STEP_FPS = 10;
const FPS = 60;
const SUB = FPS / STEP_FPS;
/** Further than this in one step is a jump (a thing put somewhere else), not a move: no in-betweens for it. */
const MAX_MOVE = 12;
const W = 72, H = 16;
const OUT = "src/animations";

/** A run to bake: the change, which slots the file draws, the starting digits. */
interface Job {
  key: string;
  digits: number[];
  changes: Change[];
  /** Slots whose digit is in the file; the others stay static on the bar. */
  slots: number[];
  colon: boolean;
  /** The digits' color in this file (the focus timer's countdown); none: the clock's white. */
  color?: string;
}

/**
 * The focus timer counts down in color: its own set of files, key prefix "f" (focus, sky blue) and "b" (break,
 * green). H:MM, so the changes are a minute down (5 -> 4), ten minutes down (30 -> 29) and an hour down (1:00 -> 0:59).
 * The break is at most 30 minutes, so only the focus has the hour ones. Keep in step with settings.json (focus max).
 */
// Toned down after the real bar (2026-11-22): the brighter "#50B4FF" / "#5AD26E" glared on its LEDs.
const TIMER_COLORS: Record<string, string> = { f: "#3A82B8", b: "#449E52" };
const FOCUS_MAX_H = 2;
/**
 * The focus is over (after the alarm, see src/events/alarm.ts): an hour scene clears the four blue digits away and
 * brings the green ones of the break, 00:0N or 00:NN. One file for each break length here (keep in step with
 * settings.json). In these files the new digits are 10..19: the same digits drawn in "N", the break's green.
 */
const BREAKS = [5, 10, 15, 20, 25, 30];
PALETTE["N"] = TIMER_COLORS.b;
for (let d = 0; d < 10; d++) DIGITS.push({ ...DIGITS[d], rows: DIGITS[d].rows.map((r) => r.replace(/#/g, "N")) });

function jobs(tier: string, scene?: (typeof SCENES)[number]): Job[] {
  const out: Job[] = [];
  // An event: one file, on the digits it is set for.
  if (tier === "event") {
    const at = scene?.at ?? { digits: [1, 2, 3, 4], slots: [] };
    return [{ key: "e", digits: at.digits, changes: [], slots: at.slots, colon: false }];
  }
  // An idle: he stays at home, no digit changes, so one file, with no digits in it.
  if (tier === "idle" || tier === "tap" || tier === "night") return [{ key: "i", digits: [1, 2, 3, 4], changes: [], slots: [], colon: false }];
  // (No sections for anything but real changes: each is baked and kept in the file.)
  // Minute and ten-minute scenes are one pool: each of them is baked for both kinds of change.
  const small = tier === "minute" || tier === "ten";
  if (small)
    for (let d = 0; d < 9; d++)
      out.push({ key: `m${d}`, digits: [1, 2, 3, d], changes: [{ i: 3, from: d, to: d + 1 }], slots: [3], colon: false });
  const tens = small && !scene?.minuteOnly; // a minutes-only scene has no files for a change of the tens
  if (tens)
    for (let t = 0; t < 5; t++)
      out.push({
        key: `t${t}`, digits: [1, 2, t, 9], slots: [2, 3], colon: false,
        changes: [{ i: 2, from: t, to: t + 1 }, { i: 3, from: 9, to: 0 }],
      });
  // The focus timer's countdown, in its colors.
  for (const p of Object.keys(TIMER_COLORS)) {
    const color = TIMER_COLORS[p];
    if (small) {
      for (let d = 1; d < 10; d++)
        out.push({ key: `${p}m${d}`, digits: [0, 0, 2, d], changes: [{ i: 3, from: d, to: d - 1 }], slots: [3], colon: false, color });
      for (let t = 1; t < 6 && tens; t++)
        out.push({
          key: `${p}t${t}`, digits: [0, 0, t, 0], slots: [2, 3], colon: false, color,
          changes: [{ i: 2, from: t, to: t - 1 }, { i: 3, from: 0, to: 9 }],
        });
    }
    if (tier === "hour" && p === "f")
      for (let h = 1; h <= FOCUS_MAX_H; h++)
        out.push({
          key: `${p}h${h}`, digits: [0, h, 0, 0], slots: [0, 1, 2, 3], colon: true, color,
          changes: [{ i: 1, from: h, to: h - 1 }, { i: 2, from: 0, to: 5 }, { i: 3, from: 0, to: 9 }],
        });
  }
  if (tier === "hour")
    for (const n of BREAKS) {
      const to = [0, 0, Math.floor(n / 10), n % 10];
      out.push({
        key: `bk${n}`, digits: [0, 0, 0, 0], slots: [0, 1, 2, 3], colon: true, color: TIMER_COLORS.f,
        changes: to.map((v, i) => ({ i, from: 0, to: 10 + v })),
      });
    }
  if (tier === "hour") {
    for (let h = 0; h < 24; h++) {
      const n = (h + 1) % 24;
      const from = [Math.floor(h / 10), h % 10, 5, 9], to = [Math.floor(n / 10), n % 10, 0, 0];
      const changes: Change[] = [];
      from.forEach((v, i) => { if (v !== to[i]) changes.push({ i, from: v, to: to[i] }); });
      out.push({ key: `h${String(h).padStart(2, "0")}`, digits: from, changes, slots: [0, 1, 2, 3], colon: true });
    }
    // The 12-hour clock's one change the 24-hour one doesn't have: 12:59 -> 01:00 (the others are the same as 01..11).
    out.push({
      key: "h12a", digits: [1, 2, 5, 9], slots: [0, 1, 2, 3], colon: true,
      changes: [{ i: 0, from: 1, to: 0 }, { i: 1, from: 2, to: 1 }, { i: 2, from: 5, to: 0 }, { i: 3, from: 9, to: 0 }],
    });
  }
  return out;
}

/** Inside a digit's or the colon's place: where the worker's black outline is kept (it blanks the digit behind him). */
function onDigits(x: number, y: number): boolean {
  if (y >= DIGIT_Y && y < DIGIT_Y + 12 && DIGIT_X.some((dx) => x >= dx && x < dx + 7)) return true;
  return x >= COLON_X && x < COLON_X + 2 && y >= COLON_Y && y < COLON_Y + 6;
}

/** The Screen the scenes draw on, as pixels: RGBA, transparent where nothing is. */
interface Item {
  id: string;
  s: Sprite;
  x: number;
  y: number;
  z: number;
  n: number;
  /** Where it is without the shake: what moves between steps (a shake jolts on the step, it isn't smoothed). */
  bx: number;
  by: number;
}

class PixelScreen {
  shakeX = 0;
  shakeY = 0;
  private items: Record<string, Item> = {};
  private n = 0;
  constructor(private job: Job) {}
  put(id: string, s: Sprite | null, x: number, y: number, z: number): void {
    const static_ = (id.charAt(0) === "d" && this.job.slots.indexOf(+id.slice(1)) < 0) || (id === "colon" && !this.job.colon);
    if (!s || static_) { delete this.items[id]; return; }
    const bx = Math.round(x), by = Math.round(y);
    this.items[id] = { id, s, x: bx + this.shakeX, y: by + this.shakeY, z, n: this.n++, bx, by };
  }
  raw(): void {}
  /** What is on the screen now. */
  snapshot(): Item[] {
    return Object.keys(this.items).map((k) => this.items[k]);
  }
}

/** Whether two pictures are frames of the same thing: the same size and placed the same way against its position. */
function sameKind(a: Sprite, b: Sprite): boolean {
  return a.w === b.w && a.h === b.h && (a.ox ?? 0) === (b.ox ?? 0) && (a.oy ?? 0) === (b.oy ?? 0);
}

/**
 * A frame `t` (0..1) of the way from step a to step b: a thing that moved goes along, in its picture from a (a new pose
 * shows on the step, like 2D animation); a thing that changed size, or jumped far, stays as it is in a until b. `own`:
 * the layers that draw their own in-betweens (an effect layer with `at`), drawn for this t.
 */
function between(a: Item[], b: Item[], t: number, own: Record<string, Item | null>): Item[] {
  if (!t) return a;
  const next: Record<string, Item> = {};
  for (const it of b) next[it.id] = it;
  const out: Item[] = [];
  for (const it of a) {
    if (it.id in own) {
      const o = own[it.id];
      if (o) out.push(o);
      continue;
    }
    const nb = next[it.id];
    const dx = nb ? nb.bx - it.bx : 0, dy = nb ? nb.by - it.by : 0;
    if (nb && (dx || dy) && Math.abs(dx) <= MAX_MOVE && Math.abs(dy) <= MAX_MOVE && sameKind(nb.s, it.s))
      out.push({ ...it, x: it.x + Math.trunc(dx * t), y: it.y + Math.trunc(dy * t) });
    else out.push(it);
  }
  return out;
}

/** The items as pixels: RGBA, transparent where nothing is. */
function pixels(items: Item[]): Uint8Array {
  {
    const buf = new Uint8Array(W * H * 4);
    const list = items.slice().sort((a, b) => a.z - b.z || a.n - b.n);
    for (const it of list)
      for (let j = 0; j < it.s.h; j++)
        for (let i = 0; i < it.s.w; i++) {
          const c = it.s.rows[j].charAt(i) || ".";
          const X = it.x + i, Y = it.y + j;
          if (c === "." || !PALETTE[c] || X < 0 || Y < 0 || X >= W || Y >= H) continue;
          if (c === "k" && !onDigits(X, Y)) continue; // the outline only cuts him out of the digits
          const hex = PALETTE[c], o = (Y * W + X) * 4;
          // Stored B, G, R, A. Black ("k", the outline) is opaque: it blanks a static digit behind him.
          buf[o] = parseInt(hex.slice(5, 7), 16);
          buf[o + 1] = parseInt(hex.slice(3, 5), 16);
          buf[o + 2] = parseInt(hex.slice(1, 3), 16);
          buf[o + 3] = 255;
        }
    return buf;
  }
}

/** The same random numbers on every bake, so an unchanged scene bakes to the same file. */
function seed(text: string): void {
  let a = 2166136261;
  for (let k = 0; k < text.length; k++) a = Math.imul(a ^ text.charCodeAt(k), 16777619);
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Plays the scene for the job into frames.
 */
/** A sound note of a scene: when (ms from the file's start) and which (src/sounds/<name>.snd). */
type Cue = [number, string];

/** How long each sound is, in ms (from its file: 44.1 kHz, 16-bit mono). */
const SOUND_MS: Record<string, number> = {};
if (existsSync("src/sounds"))
  for (const f of readdirSync("src/sounds"))
    if (f.endsWith(".snd")) SOUND_MS[f.slice(0, -4)] = Math.round((statSync(`src/sounds/${f}`).size / 2 / 44100) * 1000);
/** Which sounds win when two would overlap: a higher one cuts in, a lower one waits its turn (is dropped). */
const SOUND_RANK: Record<string, number> = { boom: 3, hit: 2, thud: 2, crumble: 2, tada: 2, magic: 2, firework: 2, boing: 2, meow: 2, grumble: 2 };

/**
 * The sound notes of a run, cleaned up: one sound plays at a time on the bar, so a note is dropped while the same
 * sound is still playing (a long fire or saw is noted on every step: it simply goes on), and while a louder-ranked one
 * plays; and unknown names are dropped (with a warning).
 */
function tidy(raw: Cue[], id: string): Cue[] {
  const out: Cue[] = [];
  let playing: { name: string; end: number; rank: number } | null = null;
  for (const [ms, name] of raw) {
    const len = SOUND_MS[name];
    if (len === undefined) { console.warn(`${id}: no sound "${name}" (npm run sfx?)`); continue; }
    const rank = SOUND_RANK[name] ?? 1;
    if (playing && ms < playing.end && (playing.name === name || rank < playing.rank)) continue;
    out.push([ms, name]);
    playing = { name, end: ms + len, rank };
  }
  return out;
}

function run(scene: (typeof SCENES)[number], job: Job): { frames: Uint8Array[]; cues: Cue[] } {
  // The digits ("#") in the job's color for this file only.
  const white = PALETTE["#"];
  if (job.color) PALETTE["#"] = job.color;
  try {
    return play(scene, job);
  } finally {
    PALETTE["#"] = white;
  }
}

function play(scene: (typeof SCENES)[number], job: Job): { frames: Uint8Array[]; cues: Cue[] } {
  seed(scene.tier === "hour" ? scene.id : `${scene.id}_${job.key}`);
  const w = makeWorld(job.digits);
  const screen = new PixelScreen(job);
  const steps: Item[][] = [];
  /** For each step, the layers that draw their own in-betweens (frames 1..SUB-1): fx and front, when they have `at`. */
  const owns: Record<string, (Item | null)[]>[] = [];
  const gen = scene.play(w, job.changes);
  const raw: Cue[] = [];
  let lastBox = w.box, lastShake = false;
  while (!gen.next().done) {
    // The step's sound: the scene's own note, or else the box's lid, or else a shake starting (a blow, a landing).
    const ms = steps.length * (1000 / STEP_FPS);
    const shaking = !!(w.shake.x || w.shake.y);
    let auto: string | null = null;
    if (w.box && !lastBox) auto = "box_open";
    else if (!w.box && lastBox) auto = "box_close";
    else if (shaking && !lastShake) auto = w.shake.x ? "hit" : "thud";
    if (w.sfx || auto) raw.push([ms, w.sfx ?? auto!]);
    w.sfx = null;
    lastBox = w.box;
    lastShake = shaking;
    render(w, screen as never);
    const snap = screen.snapshot();
    steps.push(snap);
    const own: Record<string, (Item | null)[]> = {};
    for (const [id, l] of [["fx", w.fx], ["front", w.front]] as const) {
      const base = snap.filter((it) => it.id === id)[0];
      if (!l || !l.at || !base) continue;
      own[id] = [];
      for (let k = 1; k < SUB; k++) {
        const f = l.at(k / SUB);
        own[id].push(f ? { ...base, s: f.s, x: Math.round(f.x) + w.shake.x, y: Math.round(f.y) + w.shake.y } : null);
      }
    }
    owns.push(own);
  }
  // The last frame is the clock at rest, so the static picture takes over seamlessly; a scene that `keeps` its end
  // state (main.ts draws that state after it) ends as it is.
  if (!scene.keeps) settle(w);
  // ...and he stands facing us, except at night, where the files join up asleep on the box (src/night).
  if (scene.tier !== "night") w.man.frame = FRONT;
  render(w, screen as never);
  steps.push(screen.snapshot());
  const frames: Uint8Array[] = [];
  steps.forEach((a, k) => {
    const b = steps[k + 1];
    if (!b) { frames.push(pixels(a)); return; }
    for (let f = 0; f < SUB; f++)
    {
      const own: Record<string, Item | null> = {};
      if (f) for (const id of Object.keys(owns[k])) own[id] = owns[k][id][f - 1];
      frames.push(pixels(scene.stepped ? a : between(a, b, f / SUB, own)));
    }
  });
  return { frames, cues: tidy(raw, `${scene.id}_${job.key}`) };
}

// THE .anim FORMAT ("bicycle1", the firmware's lib/anim_file), little-endian: a 34-byte header, the section table,
// then the frames. Header: "bicycle1", flags, W, H, pixel format, max mask bits (u16), max pixel bytes (u16), fps, 0,
// the table's length in bytes (u32 @18), the frames' length in bytes (u32 @22), the number of sections (u32 @26), the
// number of frames (u32 @30). A section: its first and last frame (u32, u32, inclusive), the byte offset of its first
// frame from the file's start (u32), its name and a 0. The draw element picks one by `section` and plays only that
// range (tested in the emulator 2026-11-22); "default" is the whole file. A section starts on a full frame (kind 1),
// since the frames before it belong to another clip. Each frame: a byte (kind << 4 | packing), the mask's length in bits (u16), the
// pixel data's length in bytes (u16), the mask, the pixels. Worked out from the firmware's decoder (the emulator's
// screen.wasm) and checked against the bar's own animations:
//   kind 0: same as the frame before. 1: every pixel. 4: a bitmap of the changed pixels (1 = changed, MSB first).
//   2 / 3: the changed pixels as runs, skip and copy by turns (2 starts with a skip, 3 with a copy): each run is 3 bits
//   (0-6), or 7 and then 8 bits (0-255); a longer run is split with a 0-long run of the other kind between.
//   packing 0: the pixels as they are (B, G, R, A). 1: RLE: a byte c; c >= 128: c - 128 pixels as they are follow;
//   else one pixel, repeated c times. 2: QOI (qoiformat.org) ops, no header or end marker, fresh state each frame;
//   its pixels are R, G, B, A (stored as B, G, R, A).
// For each frame the bake writes the smallest of these, like the bar's own files.
const PX = 4;

/** Packing 1: RLE of the pixels. */
function rle(px: Uint8Array): Uint8Array {
  const n = px.length / PX, out: number[] = [];
  const same = (a: number, b: number) => {
    for (let k = 0; k < PX; k++) if (px[a * PX + k] !== px[b * PX + k]) return false;
    return true;
  };
  let i = 0;
  while (i < n) {
    let j = i + 1;
    while (j < n && j - i < 127 && same(i, j)) j++;
    if (j - i >= 2) {
      out.push(j - i);
      for (let k = 0; k < PX; k++) out.push(px[i * PX + k]);
      i = j;
      continue;
    }
    // As they are, up to the next run of 2 or more.
    let e = i + 1;
    while (e < n && e - i < 127 && !(e + 1 < n && same(e, e + 1))) e++;
    out.push(128 + (e - i));
    for (let k = i * PX; k < e * PX; k++) out.push(px[k]);
    i = e;
  }
  return Uint8Array.from(out);
}

/** Packing 2: QOI ops for the pixels (B, G, R, A in, R, G, B, A in the ops). */
function qoi(px: Uint8Array): Uint8Array {
  const n = px.length / PX, out: number[] = [];
  const index = new Array<number>(64).fill(0);
  let pr = 0, pg = 0, pb = 0, pa = 255, run = 0;
  const key = (r: number, g: number, b: number, a: number) => ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
  for (let i = 0; i < n; i++) {
    const b = px[i * PX], g = px[i * PX + 1], r = px[i * PX + 2], a = px[i * PX + 3];
    if (r === pr && g === pg && b === pb && a === pa) {
      run++;
      if (run === 62) { out.push(0xc0 | 61); run = 0; }
      continue;
    }
    if (run) { out.push(0xc0 | (run - 1)); run = 0; }
    const h = (r * 3 + g * 5 + b * 7 + a * 11) % 64, k = key(r, g, b, a);
    if (index[h] === k) out.push(h);
    else {
      index[h] = k;
      if (a === pa) {
        const dr = ((r - pr + 384) & 255) - 128, dg = ((g - pg + 384) & 255) - 128, db = ((b - pb + 384) & 255) - 128;
        const dr_dg = dr - dg, db_dg = db - dg;
        if (dr >= -2 && dr <= 1 && dg >= -2 && dg <= 1 && db >= -2 && db <= 1) out.push(0x40 | ((dr + 2) << 4) | ((dg + 2) << 2) | (db + 2));
        else if (dg >= -32 && dg <= 31 && dr_dg >= -8 && dr_dg <= 7 && db_dg >= -8 && db_dg <= 7) out.push(0x80 | (dg + 32), ((dr_dg + 8) << 4) | (db_dg + 8));
        else out.push(0xfe, r, g, b);
      } else out.push(0xff, r, g, b, a);
    }
    pr = r; pg = g; pb = b; pa = a;
  }
  if (run) out.push(0xc0 | (run - 1));
  return Uint8Array.from(out);
}

/** Bits, MSB first. */
class Bits {
  bytes: number[] = [];
  n = 0;
  put(v: number, w: number): void {
    for (let k = w - 1; k >= 0; k--) {
      if ((this.n & 7) === 0) this.bytes.push(0);
      if ((v >> k) & 1) this.bytes[this.bytes.length - 1] |= 128 >> (this.n & 7);
      this.n++;
    }
  }
}

/** Kinds 2 / 3: the changed pixels as skip/copy runs, starting with a copy or not. */
function runs(changed: boolean[], copyFirst: boolean): Bits {
  const bits = new Bits();
  const run = (v: number) => (v < 7 ? bits.put(v, 3) : (bits.put(7, 3), bits.put(v, 8)));
  let p = 0, copy = copyFirst;
  // The last skip (to the end of the frame) is left out: the decoder stops when the bits run out.
  let last = changed.length;
  while (last > 0 && !changed[last - 1]) last--;
  while (p < last) {
    let q = p;
    while (q < last && changed[q] === copy) q++;
    let len = q - p;
    while (len > 255) { run(255); run(0); len -= 255; }
    run(len);
    p = q;
    copy = !copy;
  }
  return bits;
}

/** A clip of one file: its section name and frames. */
interface Clip {
  name: string;
  frames: Uint8Array[];
}

/** One file of a single clip, the section "default" over all of it. */
function anim(frames: Uint8Array[], fps: number, w = W, h = H): Uint8Array {
  return animSections([{ name: "default", frames }], fps, w, h);
}

/** One file holding several clips, a section each, and "default" over all of them (unless that is the only clip). */
function animSections(clips: Clip[], fps: number, w = W, h = H): Uint8Array {
  const n = w * h;
  const parts: Uint8Array[] = [];
  let maxMask = 0, maxPix = 0;
  /** Each clip's first frame and byte offset into the frame data. */
  const starts: { frame: number; byte: number }[] = [];
  let frameNo = 0, byteNo = 0;
  /** The smallest packing of these pixels: [packing, data]. */
  const pack = (px: Uint8Array): [number, Uint8Array] => {
    let best: [number, Uint8Array] = [0, px];
    for (const [c, d] of [[1, rle(px)], [2, qoi(px)]] as [number, Uint8Array][]) if (d.length < best[1].length) best = [c, d];
    return best;
  };
  for (const clip of clips) {
    starts.push({ frame: frameNo, byte: byteNo });
    const frames = clip.frames;
    frames.forEach((cur, f) => {
      // A clip's first frame is a full one: whatever came before it is another clip.
      const prev = f ? frames[f - 1] : null;
      let kind = 1, bits = 0, mask = new Uint8Array(0);
      let [cmp, pix] = pack(cur);
      if (prev) {
        const changed: boolean[] = [];
        const list: number[] = [];
        for (let p = 0; p < n; p++) {
          let c = false;
          for (let b = 0; b < 4; b++) if (cur[p * 4 + b] !== prev[p * 4 + b]) { c = true; break; }
          changed.push(c);
          if (c) list.push(p);
        }
        if (!list.length) { kind = 0; cmp = 0; pix = new Uint8Array(0); }
        else {
          const sub = new Uint8Array(list.length * 4);
          list.forEach((p, k) => sub.set(cur.subarray(p * 4, p * 4 + 4), k * 4));
          const [sc, sp] = pack(sub);
          let size = 5 + pix.length; // kind 1, every pixel
          const bitmap = new Uint8Array(Math.ceil(n / 8));
          for (const p of list) bitmap[p >> 3] |= 128 >> (p & 7);
          const options: [number, number, Uint8Array][] = [
            [4, n, bitmap],
            ...[false, true].map((cf) => { const r = runs(changed, cf); return [cf ? 3 : 2, r.n, Uint8Array.from(r.bytes)] as [number, number, Uint8Array]; }),
          ];
          for (const [k, nb, m] of options)
            if (5 + m.length + sp.length < size) { size = 5 + m.length + sp.length; kind = k; bits = nb; mask = m; cmp = sc; pix = sp; }
        }
      }
      const head = new Uint8Array(5);
      const dv = new DataView(head.buffer);
      dv.setUint8(0, (kind << 4) | cmp);
      dv.setUint16(1, bits, true);
      dv.setUint16(3, pix.length, true);
      parts.push(head, mask, pix);
      byteNo += head.length + mask.length + pix.length;
      maxMask = Math.max(maxMask, bits);
      maxPix = Math.max(maxPix, pix.length);
    });
    frameNo += frames.length;
  }
  const total = frameNo;
  const body = parts.reduce((s, p) => s + p.length, 0);
  // The section table: "default" over everything first, then the clips (a lone "default" clip is that section).
  const secs: { name: string; first: number; last: number; byte: number }[] = [];
  if (clips.length > 1 || clips[0].name !== "default") secs.push({ name: "default", first: 0, last: total - 1, byte: 0 });
  clips.forEach((c, k) => secs.push({ name: c.name, first: starts[k].frame, last: starts[k].frame + c.frames.length - 1, byte: starts[k].byte }));
  const secLen = secs.reduce((s, e) => s + 12 + e.name.length + 1, 0);
  const HEAD = 34;
  const out = new Uint8Array(HEAD + secLen + body);
  const dv = new DataView(out.buffer);
  out.set(Array.from("bicycle1", (c) => c.charCodeAt(0)), 0);
  dv.setUint8(8, 0); // flags
  dv.setUint8(9, w);
  dv.setUint8(10, h);
  dv.setUint8(11, 2); // BGRA8888
  dv.setUint16(12, maxMask, true);
  dv.setUint16(14, maxPix, true);
  dv.setUint8(16, fps);
  dv.setUint8(17, 0);
  dv.setUint32(18, secLen, true);
  dv.setUint32(22, body, true);
  dv.setUint32(26, secs.length, true);
  dv.setUint32(30, total, true);
  let t = HEAD;
  for (const e of secs) {
    dv.setUint32(t, e.first, true);
    dv.setUint32(t + 4, e.last, true);
    dv.setUint32(t + 8, HEAD + secLen + e.byte, true);
    out.set(Array.from(e.name + "\0", (c) => c.charCodeAt(0)), t + 12);
    t += 12 + e.name.length + 1;
  }
  let at = HEAD + secLen;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/**
 * The sounds of the files, short (the app holds all of baked.ts in its small heap): a run's notes as one string, 3
 * characters a note: when, in tenths of a second from the file's start (2 base-36 digits), and which sound (a letter,
 * its place in SOUNDS). The same string is kept once in CUES; a file's entry is its index there.
 */
const SOUNDS = Object.keys(SOUND_MS).filter((n) => !n.endsWith("_q")).sort();
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CUES: string[] = [];
function cueIndex(cues: Cue[]): number {
  const text = cues
    .map(([ms, n]) => {
      const t = Math.round(ms / 100);
      if (t >= 36 * 36 || SOUNDS.indexOf(n) < 0 || SOUNDS.indexOf(n) >= LETTERS.length) throw new Error(`cue ${ms} ${n} doesn't fit`);
      return t.toString(36).padStart(2, "0") + LETTERS.charAt(SOUNDS.indexOf(n));
    })
    .join("");
  const k = CUES.indexOf(text);
  if (k >= 0) return k;
  CUES.push(text);
  return CUES.length - 1;
}

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith(".anim")) unlinkSync(`${OUT}/${f}`);
const list: string[] = [];
let total = 0, count = 0;
const realRandom = Math.random;
/**
 * baked.ts is kept small (the app holds all of it in its 192 KiB heap; 60 KB of it once kept the app from starting):
 * a scene's changes are a list in KEYS (shared by the scenes that have the same ones), its lengths one string of 3
 * base-36 characters a change (frames), its sounds one string of 2 base-36 characters a change (the index in CUES,
 * "--" for none).
 */
const KEYS: string[] = [];
const b36 = (v: number, n: number) => {
  if (v >= Math.pow(36, n)) throw new Error(`${v} doesn't fit in ${n} base-36 characters`);
  return v.toString(36).padStart(n, "0");
};
for (const scene of [...SCENES, ...IDLES, ...EVENTS, ...TAPS, ...NIGHT]) {
  const keys: string[] = [];
  let lens = "", snd = "";
  let anySound = false;
  const clips: Clip[] = [];
  for (const job of jobs(scene.tier, scene)) {
    const { frames, cues } = run(scene, job);
    keys.push(job.key);
    lens += b36(frames.length, 3);
    if (cues.length) { snd += b36(cueIndex(cues), 2); anySound = true; } else snd += "--";
    clips.push({ name: job.key, frames });
  }
  // One file for the scene, a section for each change (the emulator takes at most 1000 files in an app).
  const data = animSections(clips, FPS);
  writeFileSync(`${OUT}/${scene.id}.anim`, data);
  total += data.length;
  count++;
  let k = KEYS.indexOf(keys.join(","));
  if (k < 0) { KEYS.push(keys.join(",")); k = KEYS.length - 1; }
  const flags = (scene.rare ? ", rare: true" : "") + (scene.variantOf ? `, variantOf: "${scene.variantOf}"` : "");
  list.push(`  { id: "${scene.id}", name: ${JSON.stringify(scene.name)}, tier: "${scene.tier}"${flags}, k: ${k}, f: "${lens}"${anySound ? `, c: "${snd}"` : ""} },`);
  console.log(`${scene.id}: ${keys.length} sections, ${Math.round(data.length / 1024)} KiB`);
}
Math.random = realRandom;
const bgs: string[] = [], floors: string[] = [];
for (const bg of BACKGROUNDS) {
  const frames: Uint8Array[] = [];
  const n = Math.round(bg.fps * bg.seconds);
  const level = levelOf(bg.id);
  for (let k = 0; k < n; k++) {
    const f = bg.frame(k / bg.fps);
    if (level !== 1) for (let o = 0; o < f.length; o += 4) for (let c = 0; c < 3; c++) f[o + c] = Math.round(f[o + c] * level);
    frames.push(f);
  }
  const data = anim(frames, bg.fps);
  writeFileSync(`${OUT}/bg_${bg.id}.anim`, data);
  bgs.push(`"${bg.id}"`);
  if (bg.floor) floors.push(`"${bg.id}"`);
  total += data.length;
  count++;
  console.log(`background ${bg.id}: ${n} frames, ${Math.round(data.length / 1024)} KiB`);
  // The focus timer paused (main.ts): the background stands still and grey, one frame (bg_<id>_g.anim).
  const still = new Uint8Array(frames[0]);
  for (let o = 0; o < still.length; o += 4) {
    const v = Math.round(0.114 * still[o] + 0.587 * still[o + 1] + 0.299 * still[o + 2]); // stored B, G, R
    still[o] = still[o + 1] = still[o + 2] = v;
  }
  const grey = anim([still, still], bg.fps);
  writeFileSync(`${OUT}/bg_${bg.id}_g.anim`, grey);
  total += grey.length;
  count++;
}
// The colon's pulse: a soft breathing loop the bar plays in place of a still colon (main.ts stops it while an hour
// scene, which draws the colon itself, plays).
for (const [file, hex] of [["colon", "#FFFFFF"], ...Object.keys(TIMER_COLORS).map((p) => [`colon_${p}`, TIMER_COLORS[p]])]) {
  const PULSE_FPS = 60, PULSE_S = 2, PULSE_MIN = 0.45; // one breath in 2 s
  const rgb = [5, 3, 1].map((k) => parseInt(hex.slice(k, k + 2), 16)); // stored B, G, R
  const frames: Uint8Array[] = [];
  const n = PULSE_FPS * PULSE_S;
  for (let k = 0; k < n; k++) {
    const b = PULSE_MIN + (1 - PULSE_MIN) * (0.5 + 0.5 * Math.cos((2 * Math.PI * k) / n));
    const buf = new Uint8Array(W * H * 4);
    COLON.rows.forEach((r, j) => {
      for (let i = 0; i < r.length; i++) {
        if (r.charAt(i) === ".") continue;
        const o = ((COLON_Y + j) * W + COLON_X + i) * 4;
        for (let c = 0; c < 3; c++) buf[o + c] = Math.round(rgb[c] * b);
        buf[o + 3] = 255;
      }
    });
    frames.push(buf);
  }
  const data = anim(frames, PULSE_FPS);
  writeFileSync(`${OUT}/${file}.anim`, data);
  total += data.length;
  count++;
  console.log(`colon pulse ${file}: ${n} frames`);
}
// The flash for the focus timer's jumps (Start, stop, the break over; main.ts): soft white light over the whole
// display, brightest in the middle and fading a little towards the edges. It swells up, holds (main.ts swaps the
// digits under it then, at FLASH_SWAP_MS) and dies away. Semi-transparent, like the bar's own transition_flash.
// Since 2026-11-22 a word stands in it, dark on the light, so it says what comes: FOCUS at the start, CLOCK when the
// timer is over (flash_focus.anim, flash_clock.anim); the hold is longer, to read it.
{
  // The letters: thick rounded strokes (capsules 3 px wide) in a 12x14 box, drawn smooth (4x4 samples a pixel), so a
  // word of five fills nearly the whole display.
  type P = [number, number];
  const L = 1.7, R = 10.3, T = 1.7, B = 12.3, MID = 7;
  const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): P[] => {
    const out: P[] = [];
    for (let k = 0; k <= n; k++) { const a = ((a0 + ((a1 - a0) * k) / n) * Math.PI) / 180; out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    return out;
  };
  const GLYPHS: Record<string, P[][]> = {
    F: [[[L, B], [L, T], [R + 0.3, T]], [[L, MID], [R - 1.5, MID]]],
    L: [[[L, T], [L, B], [R + 0.3, B]]],
    O: [arc(6, MID, R - 6, B - MID, 0, 360, 40)],
    C: [arc(6, MID, R - 6, B - MID, 38, 322, 36)],
    U: [[[L, T], [L, 8]], [[R, T], [R, 8]], arc(6, 8, R - 6, B - 8, 0, 180, 20)],
    S: [arc(6, 4.35, R - 6.2, 2.65, -25, -270, 24), arc(6, 9.65, R - 6.2, 2.65, -90, 155, 24)],
    K: [[[L, T], [L, B]], [[R, T], [L + 1.2, MID + 0.6]], [[L + 3.2, MID - 0.6], [R + 0.2, B]]],
  };
  const STROKE = 1.55;
  const segDist = (x: number, y: number, a: P, b: P) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
    return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
  };
  /** How much of the pixel (x, y) of a 12x14 glyph the letter covers, 0..1. */
  const cover = (g: P[][], x: number, y: number) => {
    let hit = 0;
    for (let sy = 0; sy < 4; sy++)
      for (let sx = 0; sx < 4; sx++) {
        const px = x + (sx + 0.5) / 4, py = y + (sy + 0.5) / 4;
        let ins = false;
        for (const line of g) { for (let k = 1; k < line.length && !ins; k++) if (segDist(px, py, line[k - 1], line[k]) <= STROKE) ins = true; if (ins) break; }
        if (ins) hit++;
      }
    return hit / 16;
  };
  const F = 60, UP = 0.22, HOLD = 0.9, DOWN = 0.5;
  const n = Math.round(F * (UP + HOLD + DOWN));
  const smooth = (v: number) => { const c = Math.max(0, Math.min(1, v)); return c * c * (3 - 2 * c); };
  for (const word of ["FOCUS", "CLOCK"]) {
    const ink = new Float32Array(W * H);
    const GW = 12, GH = 14, GAP = 2;
    const tw = word.length * GW + (word.length - 1) * GAP, tx = Math.floor((W - tw) / 2), ty = 1;
    word.split("").forEach((ch, l) => {
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) ink[(ty + y) * W + tx + l * (GW + GAP) + x] = cover(GLYPHS[ch], x, y);
    });
    const frames: Uint8Array[] = [];
    for (let k = 0; k < n; k++) {
      const t = k / F;
      const level = t < UP ? smooth(t / UP) : t < UP + HOLD ? 1 : 1 - smooth((t - UP - HOLD) / DOWN);
      const buf = new Uint8Array(W * H * 4);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const o = (y * W + x) * 4;
          // Towards the edges: a little dimmer (8 px at the sides, 3 at the top and bottom) and a touch blue.
          const e = smooth(Math.min(Math.min(x + 0.5, W - 0.5 - x) / 8, Math.min(y + 0.5, H - 0.5 - y) / 3));
          // The word: dark in the light, its edges soft (k: how much of the pixel is letter).
          const k = ink[y * W + x];
          const light = 0.45 + 0.55 * e;
          const aLight = light * (1 - k), aInk = k;
          const a = level * (aLight + aInk);
          if (a <= 0) continue;
          const mixc = (lc: number, ic: number) => Math.round((lc * aLight + ic * aInk) / (aLight + aInk));
          buf[o] = mixc(255, 40); // B
          buf[o + 1] = mixc(225 + 30 * e, 16); // G
          buf[o + 2] = mixc(205 + 50 * e, 8); // R
          buf[o + 3] = Math.round(255 * a);
        }
      frames.push(buf);
    }
    const data = anim(frames, F);
    writeFileSync(`${OUT}/flash_${word.toLowerCase()}.anim`, data);
    total += data.length;
    count++;
  }
  console.log(`flash: ${n} frames (${Math.round((n * 1000) / F)} ms), swap at ${Math.round((UP + HOLD / 2) * 1000)} ms`);
}
// The fuse's burning tip (the focus timer's line on the floor, main.ts), like the bar's own timer: a small white-hot
// spark, two pixels on the floor and one over them, flickering, with now and then a dim ember drifting up off it.
// FUSE 5x4, the fuse's end at the middle of the bottom row.
{
  const FW = 5, FH = 4, F = 30, N = 60;
  const r = (() => { let a = 777; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();
  const frames: Uint8Array[] = [];
  const set = (buf: Uint8Array, x: number, y: number, c: number[], a: number) => {
    if (x < 0 || x >= FW || y < 0 || y >= FH) return;
    const o = (y * FW + x) * 4;
    buf[o] = c[2]; buf[o + 1] = c[1]; buf[o + 2] = c[0]; buf[o + 3] = Math.round(a);
  };
  let ember: { x: number; y: number; age: number } | null = null;
  for (let k = 0; k < N; k++) {
    const buf = new Uint8Array(FW * FH * 4);
    const hot = 0.85 + 0.15 * Math.sin((k / N) * Math.PI * 8) * (r() > 0.5 ? 1 : 0.6);
    const white = [255, 250, 235].map((v) => v * hot);
    set(buf, 2, 3, white, 255);
    set(buf, 1, 3, white, 255);
    set(buf, 2, 2, [255, 248, 225].map((v) => v * (0.75 + 0.25 * r())), 255);
    set(buf, 3, 3, [200, 120, 50], 120 + 100 * r()); // the glow just past the end
    if (!ember && k % 20 === 5) ember = { x: 2, y: 1, age: 0 };
    if (ember) {
      set(buf, Math.round(ember.x), Math.round(ember.y), [190, 110, 50], 160 * (1 - ember.age / 8));
      ember.age++;
      if (ember.age % 3 === 0) ember.y -= 1;
      if (ember.age % 4 === 2) ember.x += r() > 0.5 ? 1 : -1;
      if (ember.age >= 8 || ember.y < 0) ember = null;
    }
    frames.push(buf);
  }
  const data = anim(frames, F, FW, FH);
  writeFileSync(`${OUT}/fuse_spark.anim`, data);
  total += data.length;
  count++;
  console.log(`fuse spark: ${N} frames`);
}
writeFileSync(
  "src/baked.ts",
  `// Written by tools/bake.ts (npm run bake) — do not edit. Every scene, the changes of the digits it has a file for, how\n` +
    `// long each plays and its sounds. The file is src/animations/<id>.anim, one section a key: key m<d> = minute\n` +
    `// d -> d+1, t<t> = tens of minutes t9 -> (t+1)0, h<HH> = HH:59 -> next hour, h12a = 12:59 -> 01:00 (12-hour clock); the focus timer countdown in color (f = focus, b = break): fm<d> = d -> d-1, ft<t> = t0 -> (t-1)9, fh<h> = h:00 -> (h-1):59; bk<n> = the focus over, into an n-minute break; i = an idle (no digits in it), e = an event.\n` +
    `// Kept small on purpose: the app holds all of it in its 192 KiB heap (see tools/bake.ts).\n` +
    `export interface Baked {\n  id: string;\n  name: string;\n  tier: "minute" | "ten" | "hour" | "idle" | "event" | "tap" | "night";\n  rare?: boolean;\n  variantOf?: string;\n  /** Its changes: the list KEYS[k]. */\n  k: number;\n  /** How long each plays, in frames at ${FPS} fps: 3 base-36 characters each, in the order of KEYS[k]. */\n  f: string;\n  /** Its sounds: 2 base-36 characters each (the index of the notes in CUES, "--" none), in the order of KEYS[k]. */\n  c?: string;\n}\n\n` +
    `/** The lists of changes the scenes have files for, keys joined by commas. */\nexport const KEYS = ${JSON.stringify(KEYS)};\n\n` +
    `export const BAKED: Baked[] = [\n${list.join("\n")}\n];\n\n` +
    `/** Where \`key\` is in the scene's list of changes; -1 when it has no file for it. */\n` +
    `function keyAt(s: Baked, key: string): number {\n  const list = "," + KEYS[s.k] + ",";\n  const p = list.indexOf("," + key + ",");\n  if (p < 0) return -1;\n  let n = 0;\n  for (let i = 0; i < p; i++) if (list.charAt(i) === ",") n++;\n  return n;\n}\n\n` +
    `/** How long the scene's file for \`key\` plays, in ms; 0 when it has none. */\n` +
    `export function msOf(s: Baked, key: string): number {\n  const i = keyAt(s, key);\n  return i < 0 ? 0 : Math.round((parseInt(s.f.slice(i * 3, i * 3 + 3), 36) * 1000) / ${FPS});\n}\n\n` +
    `/** The sound notes of the scene's file for \`key\` (see CUES), or undefined when it has none. */\n` +
    `export function cueOf(s: Baked, key: string): string | undefined {\n  const i = keyAt(s, key);\n  if (i < 0 || !s.c) return undefined;\n  const v = s.c.slice(i * 2, i * 2 + 2);\n  if (v === "--") return undefined;\n  let n = parseInt(v, 36), p = 0;\n  while (n-- > 0) p = CUES.indexOf("|", p) + 1;\n  const e = CUES.indexOf("|", p);\n  return CUES.slice(p, e < 0 ? CUES.length : e);\n}\n\n` +
    `/** The sounds, src/sounds/<name>.snd; a note in CUES names one by a letter: a = the first. */\nexport const SOUNDS = ${JSON.stringify(SOUNDS)};\n` +
    `/** The files' sounds, "|" between one file's notes and the next: 3 characters a note, when (tenths of a second from the file's start, 2 base-36 digits) and which (a letter). */\n` +
    `export const CUES = ${JSON.stringify(CUES.join("|"))};\n\n` +
    `/** The focus timer's digit colors (f = focus, b = break), as baked. */\nexport const TIMER_COLORS: Record<string, string> = ${JSON.stringify(TIMER_COLORS)};\n` +
    `/** The backgrounds: src/animations/bg_<id>.anim, looping. */\nexport const BACKGROUNDS = [${bgs.join(", ")}];\n` +
    `/** The backgrounds that draw the floor themselves (main.ts leaves out its grey floor line under them). */\nexport const OWN_FLOOR = [${floors.join(", ")}];\n`,
);
console.log(`${count} files, ${Math.round(total / 1024)} KiB`);
