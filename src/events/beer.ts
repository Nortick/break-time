// Friday evening (from 18:00, after the hour's scene): he takes a bottle of beer out of the box, comes home and sets it
// on the floor beside him, then has the first long swig and a sigh. It stays there all evening (main.ts draws it), and
// now and then he has a sip ("sip" idle). At midnight it is gone.
import { FRONT, HOME_X, BOTTLE } from "../art";
import { fetchTool, walkTo, wait, type Scene } from "../scenes/kit";
import { bottleAt, swig, CROUCH } from "../idles/sip";

export const beer: Scene = {
  id: "beer",
  name: "Friday!",
  tier: "event",
  at: { digits: [1, 8, 0, 0], slots: [] },
  keeps: true,
  play: function* (w) {
    yield* fetchTool(w, BOTTLE);
    yield* walkTo(w, HOME_X);
    w.carry = null;
    bottleAt(w, "hand");
    w.man.frame = FRONT;
    yield* wait(4);
    w.man.frame = CROUCH;
    bottleAt(w, "floor");
    yield* wait(3);
    w.man.frame = FRONT;
    yield* wait(4);
    yield* swig(w, true);
    bottleAt(w, "floor");
  },
};
