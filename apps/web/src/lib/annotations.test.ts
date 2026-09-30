import { describe, expect, it } from "vitest";
import {
  BRAND,
  Shape,
  anchorOf,
  arrowGeometry,
  boundsOf,
  buildAnnotation,
  commentAnchor,
  describeShapes,
  kindOfShapes,
  parseMarkup,
  placeComments,
  simplify,
  smoothPath,
  spanOf,
  strokePx,
  toApiShapes,
  type Pt,
} from "./annotations";

const style = { c: "#ef4444", s: 6 };
const row = (over: Partial<Parameters<typeof placeComments>[0][number]> = {}) => ({
  id: "c1",
  kind: null,
  x: null,
  y: null,
  timestamp_ms: null,
  start_ms: null,
  end_ms: null,
  shape_json: null,
  ...over,
});

describe("simplify", () => {
  it("collapses a dense straight line to its endpoints", () => {
    const line: Pt[] = Array.from({ length: 200 }, (_, i) => [i / 199, 0.5]);
    expect(simplify(line)).toEqual([line[0], line[199]]);
  });

  it("keeps the corner of an L-shaped stroke", () => {
    const stroke: Pt[] = [];
    for (let i = 0; i <= 50; i++) stroke.push([i / 100, 0.2]);
    for (let i = 1; i <= 50; i++) stroke.push([0.5, 0.2 + i / 100]);
    const out = simplify(stroke);
    expect(out).toHaveLength(3);
    expect(out[1]).toEqual([0.5, 0.2]);
  });

  it("survives a very long stroke without overflowing the stack", () => {
    const zigzag: Pt[] = Array.from({ length: 50_000 }, (_, i) => [(i % 1000) / 1000, (i % 2) / 100]);
    expect(() => simplify(zigzag)).not.toThrow();
  });

  it("does not choke on a closed loop where start and end coincide", () => {
    const circle: Pt[] = Array.from({ length: 64 }, (_, i) => [
      0.5 + 0.2 * Math.cos((i / 63) * 2 * Math.PI),
      0.5 + 0.2 * Math.sin((i / 63) * 2 * Math.PI),
    ]);
    const out = simplify(circle);
    expect(out.length).toBeGreaterThan(8);
    expect(out.length).toBeLessThan(circle.length);
  });
});

describe("markup persistence", () => {
  const shapes: Shape[] = [
    { t: "pen", pts: [[0.1, 0.1], [0.2, 0.2], [0.3, 0.1]], ...style },
    { t: "arrow", a: [0.5, 0.5], b: [0.7, 0.6], ...style },
    { t: "pin", p: [0.9, 0.9], c: BRAND, s: 6 },
  ];

  it("round-trips through the Worker's JSON envelope", () => {
    const json = JSON.stringify({ v: 1, shapes: toApiShapes(shapes) });
    expect(parseMarkup(json)).toEqual(toApiShapes(shapes));
  });

  it("returns nothing for missing or corrupt data instead of throwing", () => {
    expect(parseMarkup(null)).toEqual([]);
    expect(parseMarkup("")).toEqual([]);
    expect(parseMarkup("{not json")).toEqual([]);
    expect(parseMarkup('{"v":1}')).toEqual([]);
    expect(parseMarkup('{"shapes":"nope"}')).toEqual([]);
  });

  it("drops invalid shapes but keeps the valid ones", () => {
    const json = JSON.stringify({
      shapes: [
        { t: "pin", p: [0.2, 0.2], ...style },
        { t: "pin", p: [2, 0.2], ...style }, // outside the frame
        { t: "pen", pts: [[0.1, 0.1]], ...style }, // needs two points
        { t: "pin", p: [0.3, 0.3], c: "red", s: 6 }, // colour must be hex
        { t: "laser", p: [0.3, 0.3], ...style }, // unknown tool
        { t: "pin", p: [0.4, 0.4], c: "#00ff00", s: 999 }, // size out of range
      ],
    });
    expect(parseMarkup(json)).toHaveLength(1);
  });

  it("quantises and simplifies strokes before sending", () => {
    const dense: Pt[] = Array.from({ length: 300 }, (_, i) => [i / 299 + 0.00001234, 0.4]);
    const [out] = toApiShapes([{ t: "pen", pts: dense, ...style }]);
    expect(out.t === "pen" && out.pts).toHaveLength(2);
    expect(out.t === "pen" && out.pts[0]).toEqual([0, 0.4]);
  });

  it("never sends a stroke with fewer than two points (a single tap becomes a dot)", () => {
    const [dot] = toApiShapes([{ t: "pen", pts: [[0.3, 0.3], [0.3, 0.3]], ...style }]);
    expect(dot.t === "pen" && dot.pts.length).toBeGreaterThanOrEqual(2);
  });

  it("clamps out-of-range points that pointer maths can produce at the frame edge", () => {
    const [pin] = toApiShapes([{ t: "pin", p: [1.0004, -0.0003], ...style }]);
    expect(pin.t === "pin" && pin.p).toEqual([1, 0]);
  });
});

describe("geometry", () => {
  it("computes a bounding box across shapes", () => {
    const box = boundsOf([
      { t: "rect", a: [0.2, 0.3], b: [0.4, 0.5], ...style },
      { t: "pin", p: [0.8, 0.1], ...style },
    ]);
    expect(box.x).toBeCloseTo(0.2);
    expect(box.y).toBeCloseTo(0.1);
    expect(box.width).toBeCloseTo(0.6);
    expect(box.height).toBeCloseTo(0.4);
  });

  it("anchors badges at the natural corner of each tool", () => {
    expect(anchorOf({ t: "rect", a: [0.6, 0.7], b: [0.2, 0.1], ...style })).toEqual([0.2, 0.1]);
    expect(anchorOf({ t: "arrow", a: [0.1, 0.2], b: [0.9, 0.9], ...style })).toEqual([0.1, 0.2]);
    expect(anchorOf({ t: "pen", pts: [[0.3, 0.3], [0.4, 0.4]], ...style })).toEqual([0.3, 0.3]);
  });

  it("prefers a pin as the comment anchor when markup has one", () => {
    expect(
      commentAnchor([
        { t: "arrow", a: [0.1, 0.1], b: [0.2, 0.2], ...style },
        { t: "pin", p: [0.7, 0.7], ...style },
      ]),
    ).toEqual([0.7, 0.7]);
    expect(commentAnchor([])).toBeNull();
  });

  it("names the stored kind after what was drawn", () => {
    expect(kindOfShapes([{ t: "pin", p: [0, 0], ...style }])).toBe("point");
    expect(kindOfShapes([{ t: "rect", a: [0, 0], b: [1, 1], ...style }])).toBe("rectangle");
    expect(kindOfShapes([{ t: "pen", pts: [[0, 0], [1, 1]], ...style }])).toBe("drawing");
    expect(
      kindOfShapes([
        { t: "pin", p: [0, 0], ...style },
        { t: "arrow", a: [0, 0], b: [1, 1], ...style },
      ]),
    ).toBe("drawing");
  });

  it("describes markup in plain words", () => {
    expect(describeShapes([{ t: "pin", p: [0, 0], ...style }])).toBe("Pin");
    expect(
      describeShapes([
        { t: "pen", pts: [[0, 0], [1, 1]], ...style },
        { t: "pen", pts: [[0, 0], [1, 1]], ...style },
        { t: "arrow", a: [0, 0], b: [1, 1], ...style },
      ]),
    ).toBe("2 drawings + Arrow");
  });

  it("scales stroke width with the frame but never vanishes on small screens", () => {
    const pen: Shape = { t: "pen", pts: [[0, 0], [1, 1]], c: "#000000", s: 6 };
    expect(strokePx(pen, 1000)).toBe(6);
    expect(strokePx(pen, 200)).toBe(2); // floor
    expect(strokePx({ ...pen, t: "highlight" }, 200)).toBeGreaterThanOrEqual(14);
  });

  it("draws smooth SVG paths and handles degenerate strokes", () => {
    expect(smoothPath([], 100, 100)).toBe("");
    expect(smoothPath([[0.5, 0.5]], 100, 100)).toContain("M50.0,50.0");
    expect(smoothPath([[0, 0], [1, 1]], 100, 100)).toBe("M0.0,0.0L100.0,100.0");
    expect(smoothPath([[0, 0], [0.5, 0.5], [1, 0]], 100, 100)).toContain("Q");
  });

  it("builds an arrowhead that stays inside short arrows", () => {
    const g = arrowGeometry([0.1, 0.1], [0.12, 0.1], 500, 500, 30);
    expect(g.head.startsWith("M60.0,50.0")).toBe(true);
    // A 10px arrow must not get a 44px head that overshoots the tail.
    const tailX = 50;
    const xs = [...g.head.matchAll(/[ML]([\d.-]+),/g)].map((m) => Number(m[1]));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(tailX - 0.1);
  });
});

describe("buildAnnotation", () => {
  const base = { isVideo: false, shapes: [] as Shape[], markedAt: null, now: 0, portion: null, timestamped: true };
  const rect: Shape = { t: "rect", a: [0.2, 0.2], b: [0.4, 0.5], ...style };

  it("leaves a plain image comment unanchored", () => {
    expect(buildAnnotation(base)).toBeUndefined();
  });

  it("sends image markup with its bounding box and a kind that matches", () => {
    const out = buildAnnotation({ ...base, shapes: [rect] });
    expect(out?.kind).toBe("rectangle");
    expect(out?.x).toBeCloseTo(0.2);
    expect(out?.width).toBeCloseTo(0.2);
    expect(out?.height).toBeCloseTo(0.3);
    expect(out?.shapes).toHaveLength(1);
  });

  it("pins a video comment to the current moment, in whole milliseconds", () => {
    expect(buildAnnotation({ ...base, isVideo: true, now: 4.2004 })).toEqual({ kind: "video_timestamp", timestampMs: 4200 });
  });

  it("lets a reviewer leave a general video comment", () => {
    expect(buildAnnotation({ ...base, isVideo: true, timestamped: false, now: 4 })).toBeUndefined();
  });

  it("anchors markup to the frame it was drawn on, even if the playhead moved since", () => {
    const out = buildAnnotation({ ...base, isVideo: true, shapes: [rect], markedAt: 2.5, now: 9 });
    expect(out?.kind).toBe("video_timestamp");
    expect(out?.timestampMs).toBe(2500);
    expect(out?.shapes).toHaveLength(1);
  });

  it("markup implies a moment even when the timestamp was switched off", () => {
    const out = buildAnnotation({ ...base, isVideo: true, shapes: [rect], timestamped: false, markedAt: 3, now: 3 });
    expect(out?.kind).toBe("video_timestamp");
  });

  it("sends a selected portion as a range and lets it win over the moment", () => {
    const out = buildAnnotation({ ...base, isVideo: true, portion: { start: 3.0004, end: 8.5 }, now: 5 });
    expect(out).toEqual({ kind: "video_range", startMs: 3000, endMs: 8500 });
  });
});

describe("placing comments", () => {
  it("numbers only comments that are anchored to something", () => {
    const placed = placeComments([
      row({ id: "a", x: 0.2, y: 0.3, kind: "point" }),
      row({ id: "b" }), // a plain remark
      row({ id: "c", timestamp_ms: 4200, kind: "video_timestamp" }),
      row({ id: "d", shape_json: JSON.stringify({ v: 1, shapes: [{ t: "pen", pts: [[0.1, 0.1], [0.2, 0.2]], ...style }] }) }),
    ]);
    expect(placed.map((p) => p.n)).toEqual([1, null, 2, 3]);
  });

  it("turns pin-only comments from the original UI into pins", () => {
    const [legacy] = placeComments([row({ x: 0.25, y: 0.5, kind: "point" })]);
    expect(legacy.shapes).toEqual([{ t: "pin", p: [0.25, 0.5], c: BRAND, s: 6 }]);
    expect(legacy.anchor).toEqual([0.25, 0.5]);
  });

  it("uses the first shape's colour for the comment", () => {
    const [placed] = placeComments([
      row({ shape_json: JSON.stringify({ shapes: [{ t: "rect", a: [0.1, 0.1], b: [0.3, 0.3], c: "#22c55e", s: 6 }] }) }),
    ]);
    expect(placed.color).toBe("#22c55e");
  });

  it("reads video moments and portions as time spans", () => {
    expect(spanOf(row({ timestamp_ms: 4200 }))).toEqual({ start: 4.2, end: 4.2 });
    expect(spanOf(row({ start_ms: 3000, end_ms: 8000 }))).toEqual({ start: 3, end: 8 });
    expect(spanOf(row())).toBeNull();
  });
});
