// Glass (2026-11-23, his idea): a glint runs over the changing digits and they turn to glass. He takes a slingshot out
// of the box and fires one stone: it hits the right digit, cracks run over it (and on into the next one, when two
// change), and the glass bursts into shards that tinkle down onto the floor. New glass digits drop in from the top,
// a glint runs over them and they clear to the clock's own color. Shards twinkle on the floor a moment and are gone.
import { sprite, PALETTE, type Sprite } from "../gfx";
import { DIGITS, DIGIT_X, DIGIT_Y, FRONT } from "../art";
import { fetchTool, putBack, pose14, art14, canvasX, canvasY, drawLayer, rnd, wait, type Frames, type Scene, type Mover } from "./kit";

/** The glass's colors (scenes are only baked, see tools/bake.ts): pale cyan, its glint, and the cracks in it. */
PALETTE["i"] = "#4FA8CC";
PALETTE["I"] = "#FFFFFF";
PALETTE["j"] = "#183C4C";

/** The slingshot: a forked stick, as it comes out of the box. */
const SLING = sprite(["g.g", "ggg", ".g.", ".g."]);

/** Holding it out to the left: the fork (prongs up and down, the band between them) and pulling the band back. */
const HOLD: [number, number, string][] = [[8, 8, "b"], [7, 8, "o"], [6, 8, "g"], [5, 7, "g"], [5, 9, "g"], [4, 7, "g"], [4, 9, "g"]];
const AIM = pose14(art14([...HOLD, [4, 8, "x"]]));
const PULL = pose14(art14([...HOLD, [5, 8, "x"], [6, 7, "x"], [7, 7, "o"], [8, 7, "m"]]));
const SHOT = pose14(art14([...HOLD, [3, 8, "x"]]));

/**
 * A digit as glass: its pixels pale cyan, a glint band (lighter) where x + y/2 is between g and g + 2, cracks (a set of
 * "x,y" keys) dark. `clear` rows from the top (0..12) already back to the clock's own color "#".
 * Glass always shows its shine too (2026-11-23: "not enough glints"): two light streaks across the top left corner
 * and one at the bottom right, like a reflection; and a white star twinkling on it now and then (`star`).
 */
function glassy(d: Sprite, g: number, cracks: Set<string> | null = null, clear = 0, star = -1): Sprite {
  return sprite(
    d.rows.map((r, y) =>
      r
        .split("")
        .map((c, x) => {
          if (c === ".") return c;
          if (y < clear) return c;
          if (cracks && cracks.has(`${x},${y}`)) return "j";
          if (star >= 0 && (star % 97) % 84 === y * 7 + x) return "w";
          const v = x + y / 2 - g;
          if (v >= 0 && v < 2) return "I";
          const sh = x + y;
          return (sh === 2 || sh === 4) && y < 7 ? "I" : sh === 14 && y > 7 ? "I" : "i";
        })
        .join(""),
    ),
  );
}

/** Cracks from (x0, y0) on a digit: a few crooked lines out from there, `len` long each (the same lines for each len). */
function crackLines(x0: number, y0: number, seed: number): (len: number) => Set<string> {
  const dirs = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]];
  let s = seed;
  const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const lines: [number, number][][] = [];
  for (let k = 0; k < 5; k++) {
    const d = dirs[Math.floor(r() * dirs.length)];
    let x = x0, y = y0;
    const pts: [number, number][] = [];
    for (let n = 0; n < 12; n++) {
      x += d[0] + (r() < 0.35 ? (r() < 0.5 ? -1 : 1) : 0);
      y += d[1] + (r() < 0.35 ? (r() < 0.5 ? -1 : 1) : 0);
      pts.push([x, y]);
    }
    lines.push(pts);
  }
  return (len) => {
    const set = new Set<string>([`${x0},${y0}`]);
    for (const l of lines) for (let n = 0; n < Math.min(len, l.length); n++) set.add(`${l[n][0]},${l[n][1]}`);
    return set;
  };
}

/** A shard on its way down: a pixel of glass with its own speed; it lands on the floor and lies there. */
interface Shard extends Mover {
  c: string;
  vx: number;
  vy: number;
  rest: boolean;
}

export const glass: Scene = {
  id: "glass",
  name: "Glass",
  tier: "minute",
  play: function* (w, changes) {
    // Right to left: the stone hits the rightmost one.
    const order = changes.slice().sort((a, b) => b.i - a.i);
    for (const c of order) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    let shards: Shard[] = [];
    /** The glass digits while he goes for the slingshot and aims: a glint runs over them every ~2 s, stars twinkle. */
    let tick = 0;
    const shine = () => {
      tick++;
      const g = (tick % 22) - 6;
      for (const c of order) w.slots[c.i].s = glassy(DIGITS[c.from], g, null, 0, tick % 5 === 0 ? rnd(84) : -1);
    };
    function* glinting(gen: Frames): Frames {
      while (!gen.next().done) {
        shine();
        yield;
      }
    }
    let stone: { x: number; y: number; vx: number; vy: number } | null = null;
    /** The effect layer each step: the stone, the shards (falling ones glide, ones on the floor twinkle). */
    function* frame(): Frames {
      const st = stone, list = shards;
      drawLayer(w, (put) => {
        if (st) put(st.x, st.y, "m", { x: st.x, y: st.y, vx: st.vx, vy: st.vy });
        for (const s of list) put(s.x, s.y, s.rest && rnd(6) === 0 ? "I" : s.c, s.rest ? null : s);
      });
      yield;
      if (stone) {
        stone.x += stone.vx;
        stone.y += stone.vy;
      }
      for (const s of shards) {
        if (s.rest) continue;
        s.x += s.vx;
        s.vy += 0.35;
        s.y += s.vy;
        s.vx *= 0.9;
        if (s.y >= 14) {
          s.y = 14;
          s.rest = true;
        }
        if (!s.rest) s.vy = Math.min(s.vy, 2.5);
      }
    }

    // 1. A glint runs over the digits and leaves them glass.
    w.sfx = "magic";
    for (let g = -4; g <= 12; g++) {
      for (const c of order) {
        const d = DIGITS[c.from];
        // Glass behind the glint, the clock's own color ahead of it.
        w.slots[c.i].s = sprite(d.rows.map((r, y) => r.split("").map((ch, x) => (ch === "." ? ch : x + y / 2 < g + 2 ? glassy(d, g).rows[y].charAt(x) : ch)).join("")));
      }
      yield;
    }
    yield* glinting(wait(4));

    // 2. The slingshot, from the box; he turns and aims from there.
    yield* glinting(fetchTool(w, SLING));
    w.carry = null;
    w.man.dir = -1;
    w.man.frame = AIM;
    yield* glinting(wait(4));
    w.man.frame = PULL;
    yield* glinting(wait(6));
    // 3. Fire: the stone flies to the middle of the rightmost digit.
    w.man.frame = SHOT;
    w.sfx = "whoosh";
    const target = order[0];
    const tx = DIGIT_X[target.i] + 3, ty = DIGIT_Y + 5;
    const sx = canvasX(w.man.x, 3), sy = canvasY(8);
    const steps = Math.max(2, Math.round((sx - tx) / 3));
    stone = { x: sx, y: sy, vx: (tx - sx) / steps, vy: (ty - sy) / steps };
    for (let k = 0; k < steps; k++) {
      shine();
      yield* frame();
    }
    stone = null;
    w.man.frame = AIM;

    // 4. Hit: cracks run from the spot, and on into the next digit to the left.
    w.sfx = "crack";
    const cracksOf = order.map((c, n) => crackLines(n === 0 ? 3 : 6, n === 0 ? 5 : 6, 7 + c.i * 13));
    for (let len = 1; len <= 8; len++) {
      order.forEach((c, n) => {
        // The next digit starts cracking once the cracks reach its side.
        const l = n === 0 ? len : len - 3;
        w.slots[c.i].s = l > 0 ? glassy(DIGITS[c.from], 99, cracksOf[n](l)) : glassy(DIGITS[c.from], 99);
      });
      if (len === 4 && order.length > 1) w.sfx = "crack";
      yield* frame();
    }
    yield* wait(3);

    // 5. It bursts: every pixel of glass a shard, flying out from where the stone hit and down onto the floor.
    w.sfx = "glass";
    for (const c of order) {
      const s = w.slots[c.i].s as Sprite;
      s.rows.forEach((r, y) => {
        for (let x = 0; x < r.length; x++) {
          const ch = r.charAt(x);
          if (ch === ".") continue;
          const X = DIGIT_X[c.i] + x, Y = DIGIT_Y + y;
          const away = X - tx;
          shards.push({
            x: X, y: Y, c: ch === "j" ? "i" : rnd(4) ? "i" : "I", rest: false,
            vx: (away === 0 ? (rnd(2) ? 1 : -1) * 0.5 : Math.sign(away) * 0.4) + (Math.random() - 0.5) * 1.6,
            vy: -1.2 + Math.random() * 1.4,
          });
        }
      });
      w.slots[c.i].hidden = true;
    }
    w.man.frame = FRONT;
    w.man.dir = 0;
    for (let k = 0; k < 14; k++) yield* frame();

    // 6. New glass digits drop in from the top, bump, and sit.
    for (const c of order) {
      const slot = w.slots[c.i];
      slot.hidden = false;
      slot.s = glassy(DIGITS[c.to], 99);
      slot.dy = -15;
    }
    const DROP = [-15, -11, -7, -3, 0, -1, 0];
    for (let k = 0; k < DROP.length; k++) {
      for (const c of order) w.slots[c.i].dy = DROP[k];
      if (k === 4) w.sfx = "click";
      yield* frame();
    }
    // They sit a moment as glass, glinting and twinkling.
    for (let k = 0; k < 14; k++) {
      for (const c of order) w.slots[c.i].s = glassy(DIGITS[c.to], k - 4, null, 0, k % 4 === 1 ? rnd(84) : -1);
      yield* frame();
    }
    // The shards on the floor go, a few at a time, while the glint clears the new digits to the clock's color.
    w.sfx = "magic";
    for (let g = -4; g <= 12; g++) {
      for (const c of order) {
        const d = DIGITS[c.to];
        w.slots[c.i].s = sprite(d.rows.map((r, y) => r.split("").map((ch, x) => (ch === "." ? ch : x + y / 2 < g ? ch : glassy(d, g).rows[y].charAt(x))).join("")));
      }
      shards = shards.filter(() => rnd(5) > 0);
      yield* frame();
    }
    for (const c of order) {
      w.slots[c.i].s = null;
      w.slots[c.i].dy = 0;
    }
    while (shards.length) {
      shards = shards.filter(() => rnd(3) > 0);
      yield* frame();
    }
    w.fx = null;
    yield* wait(3);
    yield* putBack(w, SLING);
  },
};
