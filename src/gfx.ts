// Sprites as text grids, their XPM encoding, and the screen: a set of elements by id, sent only when they change.
import { device } from "@shared/device";
import manifest from "./appmeta/manifest.json";

const APP = manifest.id;

/**
 * Requests with busy-lib's own timeout pushed far out (10 min) instead of its 3 s: on the real bar its timer breaks
 * when it fires ("TypeError: Expected a function", then "Interval with ID .. is not found" in the bar's log), and the
 * request isn't cut short anyway. Not 0: then busy-lib clears a timer it never set, and the bar logs "Interval with
 * ID 0 is not found" for every request.
 */
export const NO_TIMEOUT = { timeout: 600000 };
/** A draw request not answered for this long is given up on: the next frame goes anyway. */
const STUCK_MS = 5000;

/** A picture: rows of characters, "." is transparent, any other character is a color from PALETTE. */
export interface Sprite {
  w: number;
  h: number;
  rows: string[];
  /** Where the picture sits against the worker's usual 7x12 box, for poses bigger than it. */
  ox?: number;
  oy?: number;
}

/** Every color the app draws with, by the character sprites use for it. */
export const PALETTE: Record<string, string> = {
  "#": "#FFFFFF", // digits
  h: "#4A7BD0", // cap
  b: "#4A7BD0", // overalls
  p: "#2E4C80", // trousers
  o: "#E8A87C", // skin
  s: "#6B4A2E", // shoes
  r: "#8E99A6", // rag, bucket
  w: "#FFFFFF", // brush tip
  d: "#9A9A9A", // dust
  y: "#FFD23F", // spark, star
  g: "#B07A3E", // hammer handle
  m: "#6E7A88", // hammer head
  x: "#C8402E", // red: lighter, flamethrower tank, an ember, a red-hot digit
  e: "#E8742A", // leaf blower body
  a: "#7FB8E0", // a gust of air
  c: "#C9A66B", // rope
  f: "#FF8A1E", // flame
  q: "#4A4A4A", // ash, charred
  v: "#5B3496", // the magician's veil
  V: "#8A5CC8", // the veil's folds, catching the light
  G: "#8BE03A", // acid
  n: "#3F8F2A", // acid, darker; the jerrycan
  l: "#5F6B3A", // olive: the bazooka
  B: "#8A4B1C", // brown glass: the beer bottle
  k: "#000000", // outline: a pixel turned off, which cuts the worker out of a white digit behind him
  K: "#000000", // his eyes: always black (the outline "k" is kept only over the digits), so no background shows through
};

/** Bumped whenever a PALETTE color changes (through setColor): pictures drawn with the old colors are encoded again. */
let palVer = 0;
/** Sets a PALETTE color at run time. Use this, not PALETTE[c] = ..., or the Screen keeps showing the old color. */
export function setColor(c: string, v: string): void {
  if (PALETTE[c] !== v) {
    PALETTE[c] = v;
    palVer++;
  }
}

export function sprite(rows: string[]): Sprite {
  let w = 0;
  for (const r of rows) if (r.length > w) w = r.length;
  return { w, h: rows.length, rows };
}

export function mirror(s: Sprite): Sprite {
  return sprite(s.rows.map((r) => r.padEnd(s.w, ".").split("").reverse().join("")));
}

/** An empty sprite of a size, to draw pixels into with plot(). */
export function blank(w: number, h: number): string[][] {
  const g: string[][] = [];
  for (let j = 0; j < h; j++) {
    const row: string[] = [];
    for (let i = 0; i < w; i++) row.push(".");
    g.push(row);
  }
  return g;
}

/**
 * The sprite with a one-pixel black outline left, right and above (not below: he stands on the floor). On an empty
 * screen the outline shows nothing; over a digit it keeps him from melting into it.
 */
export function outlined(s: Sprite): Sprite {
  const cached = (s as Sprite & { ol?: Sprite }).ol;
  if (cached) return cached;
  const W = s.w + 2, H = s.h + 1;
  const g = blank(W, H);
  const at = (i: number, j: number) => j >= 0 && j < s.h && i >= 0 && i < s.w && (s.rows[j].charAt(i) || ".") !== ".";
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const si = i - 1, sj = j - 1;
      if (at(si, sj)) g[j][i] = s.rows[sj].charAt(si);
      else if (at(si - 1, sj) || at(si + 1, sj) || at(si, sj - 1) || at(si, sj + 1)) g[j][i] = "k";
    }
  const out = fromGrid(g);
  (s as Sprite & { ol?: Sprite }).ol = out;
  return out;
}

/**
 * The worker with black eyes: an empty pixel between two of skin in a row ("o.o") is an eye, filled with "K".
 * Without it the background showed through his eyes.
 */
export function eyed(s: Sprite): Sprite {
  const cached = (s as Sprite & { ey?: Sprite }).ey;
  if (cached) return cached;
  const rows = s.rows.map((r) => r.replace(/o\.(?=o)/g, "oK"));
  const out: Sprite = { ...s, rows };
  (s as Sprite & { ey?: Sprite }).ey = out;
  return out;
}

/** The rows of `s` (drawn with its top at y) that lie above `limit`: for a tool sinking into the box, not the floor. */
export function cropBelow(s: Sprite, y: number, limit: number): Sprite {
  const n = Math.max(0, Math.min(s.h, limit - y));
  return n === s.h ? s : { w: s.w, h: n, rows: s.rows.slice(0, n) };
}

export function fromGrid(g: string[][]): Sprite {
  return sprite(g.map((r) => r.join("")));
}

/**
 * The XPM2 text of the part of `s` that lies on a W×H display when its top left corner is at (x, y), and where that
 * part goes. Null when nothing of it is on the display or it has no visible pixel.
 */
function encode(s: Sprite, x: number, y: number, W: number, H: number): { data: string; x: number; y: number } | null {
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(W, x + s.w), y1 = Math.min(H, y + s.h);
  if (x1 <= x0 || y1 <= y0) return null;
  const used: Record<string, boolean> = {};
  const rows: string[] = [];
  let any = false;
  for (let j = y0; j < y1; j++) {
    const src = s.rows[j - y];
    let r = "";
    for (let i = x0; i < x1; i++) {
      let c = src.charAt(i - x) || ".";
      if (c !== "." && !PALETTE[c]) c = ".";
      if (c !== ".") { used[c] = true; any = true; }
      r += c;
    }
    rows.push(r);
  }
  if (!any) return null;
  const colors = Object.keys(used);
  let head = `! XPM2\n${x1 - x0} ${y1 - y0} ${colors.length + 1} 1\n. c none\n`;
  for (const c of colors) head += `${c} c ${PALETTE[c]}\n`;
  return { data: head + rows.join("\n") + "\n", x: x0, y: y0 };
}

interface Wanted {
  key: string;
  element: Record<string, unknown>;
}

/** The front display as elements by id. Put what each element should show, then commit(): only changes are sent. */
export class Screen {
  private wanted: Record<string, Wanted> = {};
  /**
   * What each element was last put with. The same picture at the same place in the same colors is not encoded again:
   * on the bar encoding every picture on every tick took most of a tick (400-700 ms), and the wheel's clicks were
   * dropped while it ran.
   */
  private memo: Record<string, { s: Sprite; x: number; y: number; z: number; v: number; sx: number; sy: number }> = {};
  private sent: Record<string, string> = {};
  private busy = false;
  /** When the request in flight went out, and which one it is (see commit()). */
  private since = 0;
  private gen = 0;
  /** A commit came while a request was in flight: send it the moment that request is answered (not on the next tick). */
  private pending = false;
  /** Whether the last commit has been answered, so the next frame can be sent at once. */
  get idle(): boolean {
    return !this.busy;
  }
  /** Moves everything on the front display, for a shake. */
  shakeX = 0;
  shakeY = 0;

  /** Shows sprite `s` as element `id` with its top left corner at (x, y), or hides the element when `s` is null. */
  put(id: string, s: Sprite | null, x: number, y: number, z: number): void {
    if (!s) {
      delete this.wanted[id];
      delete this.memo[id];
      return;
    }
    const m = this.memo[id];
    if (m && m.s === s && m.x === x && m.y === y && m.z === z && m.v === palVer && m.sx === this.shakeX && m.sy === this.shakeY)
      return; // as last time: what it wanted then still stands
    this.memo[id] = { s, x, y, z, v: palVer, sx: this.shakeX, sy: this.shakeY };
    const e = encode(s, Math.round(x) + this.shakeX, Math.round(y) + this.shakeY, 72, 16);
    if (!e) {
      delete this.wanted[id];
      return;
    }
    this.wanted[id] = {
      key: `${e.x},${e.y},${z}|${e.data}`,
      element: { id, type: "xpmbitmap", data: e.data, x: e.x, y: e.y, align: "top_left", z_index: z },
    };
  }

  /** Any other element, such as text on the back display, compared by its JSON. */
  raw(id: string, element: Record<string, unknown> | null): void {
    if (!element) {
      delete this.wanted[id];
      return;
    }
    this.wanted[id] = { key: JSON.stringify(element), element: { ...element, id } };
  }

  /** Sends what changed since the last commit. At most one request is in flight; a later commit sends the rest. */
  commit(report: (e: unknown) => void): void {
    // One request in flight. If one hangs (on the real bar a big .anim can keep it busy for seconds), after STUCK_MS
    // the next frame goes anyway; the late answer of the old one then changes nothing.
    if (this.busy && Date.now() - this.since < STUCK_MS) {
      this.pending = true;
      return;
    }
    this.pending = false;
    const draw: Record<string, unknown>[] = [];
    const keys: Record<string, string> = {};
    const gone: string[] = [];
    for (const id of Object.keys(this.wanted)) {
      const w = this.wanted[id];
      if (this.sent[id] !== w.key) {
        draw.push(w.element);
        keys[id] = w.key;
      }
    }
    for (const id of Object.keys(this.sent)) if (!this.wanted[id]) gone.push(id);
    if (!draw.length && !gone.length) return;
    // The engine loses `this` in async arrow functions, so the state is reached through a plain variable.
    const sent = this.sent;
    const self = this;
    self.busy = true;
    self.since = Date.now();
    const gen = ++self.gen;
    // New elements first, then the old ones go: when a scene's animation starts or ends, the next picture is already
    // on screen before the last one is taken away, so nothing blinks.
    const send = async () => {
      if (draw.length) {
        await device.DisplayDraw({ application_name: APP, priority: 50, elements: draw as never }, NO_TIMEOUT);
        for (const id of Object.keys(keys)) sent[id] = keys[id];
      }
      if (gone.length) {
        await device.DisplayClear({ application_name: APP, element_ids: gone }, NO_TIMEOUT);
        for (const id of gone) delete sent[id];
      }
    };
    send()
      .catch(report)
      .then(() => {
        if (gen !== self.gen) return;
        self.busy = false;
        // Something changed while this one was on its way (a button press, say): out it goes now, not up to a tick later.
        if (self.pending) self.commit(report);
      });
  }
}
