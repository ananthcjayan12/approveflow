import { describe, expect, it } from "vitest";
import { COMMENT_TEXT, CURSOR, FINGER, frame, LOOP, SCENE_POSTER, SCENES, sceneAt, waypointAt } from "./script";

describe("tour script", () => {
  it("starts at scene 0 and each scene begins where it says", () => {
    expect(frame(0).scene).toBe(0);
    SCENES.forEach((s, i) => expect(sceneAt(s.at)).toBe(i));
    expect(sceneAt(LOOP - 1)).toBe(SCENES.length - 1);
  });

  it("fades out at the end of the loop and back in at the start", () => {
    expect(frame(0).veil).toBe(1);
    expect(frame(1000).veil).toBe(0);
    expect(frame(LOOP - 1).veil).toBeGreaterThan(0.9);
    expect(frame(LOOP / 2).veil).toBe(0);
  });

  it("types each comment out in full before sending it", () => {
    expect(frame(14500).composer?.text).toBe("");
    expect(frame(16300).composer?.text).toBe(COMMENT_TEXT[0]);
    expect(frame(21000).composer?.text).toBe(COMMENT_TEXT[1]);
    expect(frame(24950).composer?.text).toBe(COMMENT_TEXT[2]);
    // once sent, the composer closes and the comment counts
    expect(frame(17100).composer).toBeNull();
    expect(frame(17100).comments).toBe(1);
    expect(frame(25600).comments).toBe(3);
  });

  it("shows one composer at a time", () => {
    for (let t = 0; t < LOOP; t += 50) {
      const f = frame(t);
      const open = [f.pinPlaced && !f.pinPosted, f.boxGrow >= 1 && !f.boxPosted, f.range >= 1 && !f.rangePosted].filter(Boolean).length;
      expect(open).toBeLessThanOrEqual(1);
      expect(Boolean(f.composer)).toBe(open === 1);
    }
  });

  it("moves through the story in order", () => {
    const at = (t: number) => frame(t);
    expect(at(2000).laptop).toBe("upload");
    expect(at(8000).laptop).toBe("send");
    expect(at(11000).linkReady).toBe(true);
    expect(at(12000).phone).toBe("lock");
    expect(at(12000).notif).toBe(true);
    expect(at(14000).phone).toBe("app");
    expect(at(14000).laptop).toBe("live");
    expect(at(26500).liveStatus).toBe("changes");
    expect(at(28500).liveStatus).toBe("v2");
    expect(at(29000).liveStatus).toBe("approved");
    expect(at(31000).phone).toBe("done");
    expect(at(32700).laptop).toBe("dash");
    expect(at(32700).count).toBe(1);
  });

  it("puts the phone on the item being discussed", () => {
    expect(frame(20000).item).toBe(0);
    expect(frame(24000).item).toBe(2);
    expect(frame(28000).item).toBe(0);
    expect(frame(29800).item).toBe(2);
  });

  it("has a poster frame inside each scene", () => {
    SCENE_POSTER.forEach((t, i) => expect(frame(t).scene).toBe(i));
  });

  it("keeps waypoints in time order and finds the one in force", () => {
    for (const list of [CURSOR, FINGER]) {
      list.forEach((w, i) => i && expect(w.t).toBeGreaterThan(list[i - 1].t));
    }
    expect(waypointAt(CURSOR, -1)).toBe(-1);
    expect(CURSOR[waypointAt(CURSOR, 5000)].to).toBe("next-btn");
    expect(FINGER[waypointAt(FINGER, 26900)].to).toBeUndefined();
  });
});
