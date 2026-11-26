// Human cannonball: he walks off to the right and comes back pushing a circus cannon. He climbs into it; the fuse
// fizzes, BOOM, and he shoots out curled up in a ball, smashing through the changing digits, and out over the left
// edge. The cannon then fires the new digits by itself, each in an arc to its place. He walks back in from the left,
// sooty and dazed, shakes the soot off, and rolls the cannon away.
import { sprite } from "../gfx";
import { DIGITS, DIGIT_X, FRONT, HANDS_UP, HOME_X, WALK_L, WALK_R, DIGIT_Y } from "../art";
import { walkTo, scaled, rnd, wait, type Frames, type Scene } from "./kit";
import { shatter, stepChunks, drawChunks, type Chunk } from "./sledge";

/**
 * The cannon, 17x11, barrel up to the left: a thick grey barrel (darker underneath, a light rim at the muzzle, the
 * mouth dark), a big brown spoked wheel under its back end, and the trail of the carriage behind on the floor.
 */
const CANNON: string[] = (() => {
  const W = 17, H = 11;
  const g: string[][] = [];
  for (let y = 0; y < H; y++) { const r: string[] = []; for (let x = 0; x < W; x++) r.push("."); g.push(r); }
  const ax = 1.5, ay = 1.5, bx = 13.5, by = 6.5; // muzzle and breech
  const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - ax, py = y + 0.5 - ay;
      const t = px * ux + py * uy, d = -px * uy + py * ux; // along, across (+ = underneath)
      if (t < -0.5 || t > L + 0.5 || Math.abs(d) > 2.3) continue;
      g[y][x] = t < 0.8 ? (Math.abs(d) < 1.2 ? "q" : "r") : d > 1.2 ? "q" : d < -1.4 ? "r" : "m";
    }
  for (let k = 0; k <= 6; k++) { const x = Math.round(11 + k * 0.9), y = Math.round(8 + k * 0.35); if (x < W && y < H) g[y][x] = "g"; }
  const wx = 9.5, wy = 7.2;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - wx, dy = y + 0.5 - wy, r = Math.hypot(dx, dy);
      if (r > 3.6) continue;
      if (r < 1) g[y][x] = "q";
      else if (r > 2.5) g[y][x] = "g";
      else if (Math.abs(dx) < 0.6 || Math.abs(dy) < 0.6) g[y][x] = "g";
    }
  return g.map((r) => r.join(""));
})();
const CANNON_Y = 4;
/** Where the muzzle is, from the cannon's left edge and top. */
const MUZZLE = [1, 1];
/** He stands here (from the cannon's left edge) to push it, behind the breech; it stops with its left edge here. */
const PUSH = 17;
const STOP = 40;
/** Curled up in flight: cap, face, overalls; two frames, turning over. */
const BALL = [sprite(["hhh.", "hooo", "bbbo", ".pp."]), sprite([".pp.", "obbb", "oooh", ".hhh"])];
/** Back from his flight: soot on his cap and face, eyes spinning. */
const SOOTY = sprite(["..qhq..", ".hqhhqh", ".oqooo.", ".o.q.o.", ".ooqoo.", "..bbb..", "bbqbbbb", "o.bbb.o", "..ppp..", "..p.p..", "..p.p..", ".ss.ss."]);

export const cannon: Scene = {
  id: "cannon",
  name: "Human cannonball",
  tier: "hour",
  play: function* (w, changes) {
    for (const c of changes) {
      w.slots[c.i].value = c.to;
      w.slots[c.i].s = DIGITS[c.from];
    }
    let chunks: Chunk[] = [];
    let cx: number | null = null; // the cannon's left edge, null: away
    let cv = 0;
    let fuse = false, flash = 0, legs = false;
    let ball: { x: number; y: number; vx: number; vy: number } | null = null;
    const puffs: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
    let tick = 0;
    const extra = (g: string[][], t: number) => {
      const set = (x: number, y: number, c: string) => { if (x >= 0 && x < 72 && y >= 0 && y < 16) g[y][x] = c; };
      for (const p of puffs) set(Math.round(p.x + p.vx * t), Math.round(p.y + p.vy * t), p.c);
      if (cx !== null) {
        const x0 = Math.round(cx + cv * t);
        CANNON.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r.charAt(i) !== ".") set(x0 + i, CANNON_Y + j, r.charAt(i)); });
        const mx = x0 + MUZZLE[0], my = CANNON_Y + MUZZLE[1];
        if (fuse) { set(x0 + 15, CANNON_Y + 5 - (tick % 2), "y"); set(x0 + 15 + (tick % 2), CANNON_Y + 4, "f"); }
        if (flash) for (const [dx, dy] of [[-1, 0], [-2, -1], [-1, -1], [-2, 0], [-3, -1], [0, -1], [-1, 1], [-3, -2]]) set(mx + dx, my + dy, flash > 1 ? "w" : "y");
        // His legs sticking out of the muzzle, kicking, as he wriggles in head first.
        if (legs)
          for (const [base, len] of [[1, tick % 2 ? 4 : 3], [3, tick % 2 ? 3 : 4]]) {
            // Each leg out along the barrel, up to the left, two pixels thick, the shoe at its end.
            for (let k = 1; k <= len; k++) {
              const lx = x0 - k + 1, ly = CANNON_Y + base - Math.round(k * 0.42);
              set(lx, ly, k === len ? "s" : "p"); set(lx, ly + 1, k === len ? "s" : "p");
            }
          }
      }
      if (ball) {
        const bx = Math.round(ball.x + ball.vx * t), by = Math.round(ball.y + ball.vy * t);
        BALL[tick % 2].rows.forEach((r, j) => { for (let i = 0; i < 4; i++) if (r.charAt(i) !== ".") set(bx + i, by + j, r.charAt(i)); });
      }
    };
    function* frame(): Frames {
      tick++;
      if (flash) flash--;
      stepChunks(chunks);
      for (let k = puffs.length - 1; k >= 0; k--) {
        const p = puffs[k];
        p.x += p.vx; p.y += p.vy; p.vx *= 0.85; p.vy *= 0.85;
        if (--p.life <= 0) puffs.splice(k, 1);
      }
      drawChunks(w, chunks, (c) => (c.rest ? "d" : "#"), extra);
      yield;
      if (cx !== null) cx += cv;
      if (ball) { ball.x += ball.vx; ball.y += ball.vy; }
    }
    function* hold(n: number): Frames {
      for (let k = 0; k < n; k++) yield* frame();
    }
    function* run(g: Frames): Frames {
      while (!g.next().done) yield* frame();
    }
    const blast = (x: number) => {
      flash = 3;
      for (let k = 0; k < 10; k++)
        puffs.push({ x: x + MUZZLE[0] - 1, y: CANNON_Y + MUZZLE[1] - 1, vx: -Math.random() * 2, vy: -Math.random() * 1.2, life: 6 + rnd(8), c: rnd(3) ? "d" : "q" });
    };

    // Off to the right, and back pushing the cannon.
    yield* run(walkTo(w, 82));
    yield* hold(3);
    cx = 82 - PUSH;
    let step = 0;
    while (cx > STOP) {
      cv = -Math.min(2, cx - STOP);
      w.man.x = cx - 1 + PUSH;
      w.man.dir = -1;
      w.man.frame = WALK_L[(step++ >> 1) % 2];
      if (step % 6 === 0) w.sfx = "ratchet";
      yield* frame();
    }
    cv = 0;
    w.man.x = cx + PUSH;
    w.man.frame = FRONT;
    w.man.dir = 0;
    yield* hold(4);
    // Round to the front, and in he goes head first, legs kicking, till he is in.
    yield* run(walkTo(w, cx - 7));
    w.man.dir = 1;
    w.man.frame = HANDS_UP;
    yield* hold(4);
    w.man.x = 200; // inside
    legs = true;
    w.sfx = "grumble";
    yield* hold(8);
    legs = false;
    w.sfx = "pop";
    yield* hold(3);
    // ...the fuse fizzes... BOOM.
    fuse = true;
    w.sfx = "fire";
    yield* hold(7);
    fuse = false;
    w.sfx = "boom";
    blast(cx);
    w.shake.x = 1;
    ball = { x: cx + MUZZLE[0] - 4, y: CANNON_Y + MUZZLE[1] - 2, vx: -5, vy: -0.4 };
    yield* frame();
    w.shake.x = 0;
    // Through the digits he goes.
    const standing = changes.slice();
    while (ball && ball.x > -6) {
      for (let k = standing.length - 1; k >= 0; k--) {
        const c = standing[k];
        if (ball.x > DIGIT_X[c.i] + 7) continue;
        standing.splice(k, 1);
        chunks = chunks.concat(shatter(DIGITS[c.from], DIGIT_X[c.i], DIGIT_X[c.i] + 8, Math.round(ball.y) + 2, 0).map((ch) => ({ ...ch, vx: ch.vx - 1.5 })));
        w.slots[c.i].hidden = true;
        w.sfx = "crack";
        w.shake.x = rnd(3) - 1;
      }
      puffs.push({ x: ball.x + 4, y: ball.y + 1, vx: 0.3, vy: 0, life: 4, c: "d" });
      yield* frame();
      w.shake.x = 0;
      if (ball) ball.vy += 0.12;
    }
    ball = null;
    yield* hold(5);

    // The cannon fires the new digits by itself, nearest first, each in an arc to its place.
    for (const c of changes.slice().sort((a, b) => b.i - a.i)) {
      const s = w.slots[c.i];
      w.sfx = "boom";
      blast(cx);
      s.s = DIGITS[c.to];
      s.hidden = false;
      // Out of the muzzle small, growing to full size on the way (its middle follows an arc).
      const mx = cx + MUZZLE[0] - 1, my = CANNON_Y + MUZZLE[1];
      const tx = DIGIT_X[c.i] + 3.5, ty = DIGIT_Y + 6;
      const N = 9;
      for (let k = 1; k <= N; k++) {
        const u = k / N;
        const sw = Math.round(3 + 4 * u), sh = Math.round(5 + 7 * u);
        const mxu = mx + (tx - mx) * u, myu = my + (ty - my) * u - 7 * 4 * u * (1 - u);
        s.s = k === N ? DIGITS[c.to] : scaled(DIGITS[c.to], sw, sh);
        s.dx = Math.round(mxu - sw / 2 - DIGIT_X[c.i]);
        s.dy = Math.round(myu - sh / 2 - DIGIT_Y);
        yield* frame();
      }
      s.dx = s.dy = 0;
      for (const k of chunks)
        if (k.x + 1 >= DIGIT_X[c.i] && k.x <= DIGIT_X[c.i] + 6) { k.rest = false; k.vy = -2; k.vx = k.x < DIGIT_X[c.i] + 3 ? -1.5 : 1.5; }
      w.sfx = "thud";
      w.shake.y = 1;
      s.dy = -1; yield* frame();
      w.shake.y = 0;
      s.dx = s.dy = 0; yield* frame();
      s.s = null;
      yield* hold(3);
    }
    // The rubble turns to dust.
    while (chunks.length || puffs.length) {
      for (let k = chunks.length - 1; k >= 0; k--) if (chunks[k].rest && rnd(4) === 0) chunks.splice(k, 1);
      yield* frame();
    }
    // He walks back in from the left, sooty, and shakes it off.
    w.man.x = -8;
    yield* run(walkTo(w, cx - 8));
    w.man.dir = 0;
    w.man.frame = SOOTY;
    yield* hold(5);
    w.sfx = "grumble";
    for (let k = 0; k < 6; k++) {
      puffs.push({ x: w.man.x + rnd(7), y: 4 + rnd(6), vx: (Math.random() - 0.5) * 2, vy: -0.5, life: 4 + rnd(4), c: "q" });
      w.man.x += k % 2 ? 1 : -1;
      yield* frame();
    }
    w.man.frame = FRONT;
    yield* hold(4);
    // He rolls the cannon away to the right, and comes back home.
    step = 0;
    while (cx !== null && cx < 74) {
      cv = 2;
      w.man.x = cx - 7;
      w.man.dir = 1;
      w.man.frame = WALK_R[(step++ >> 1) % 2];
      yield* frame();
    }
    cx = null;
    yield* run(walkTo(w, 82));
    w.fx = null;
    yield* hold(2);
    yield* walkTo(w, HOME_X);
    w.man.frame = HANDS_UP;
    w.man.dy = -1; yield* wait(2);
    w.man.dy = 0; yield* wait(6);
    w.man.frame = FRONT;
    yield* wait(2);
  },
};
