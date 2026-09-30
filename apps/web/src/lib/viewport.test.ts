import { describe, expect, it } from "vitest";
import { FIT, MAX_ZOOM, clampView, containFit, panBy, zoomAt } from "./viewport";

describe("containFit", () => {
  it("fits a wide image to the container width", () => {
    expect(containFit(800, 600, 1600, 800)).toEqual({ w: 800, h: 400 });
  });
  it("fits a tall story to the container height", () => {
    expect(containFit(800, 600, 1080, 1920)).toEqual({ w: 337, h: 600 });
  });
  it("respects padding and survives an unknown size", () => {
    // 700x500 is available after padding, so a 4:3 picture is height-limited.
    expect(containFit(800, 600, 800, 600, 50)).toEqual({ w: 666, h: 500 });
    expect(containFit(800, 600, 0, 0)).toEqual({ w: 800, h: 600 });
    expect(containFit(0, 0, 100, 100).w).toBeGreaterThan(0);
  });
});

describe("clampView", () => {
  it("keeps a picture that is smaller than its container centred", () => {
    expect(clampView({ z: 1, x: 200, y: -50 }, 800, 600, 400, 300)).toEqual(FIT);
  });
  it("stops panning once an edge would leave the container (plus slack)", () => {
    const v = clampView({ z: 2, x: 9999, y: -9999 }, 800, 600, 800, 600);
    expect(v.x).toBe((800 * 2 - 800) / 2 + 48);
    expect(v.y).toBe(-((600 * 2 - 600) / 2 + 48));
  });
  it("limits zoom to the supported range", () => {
    expect(clampView({ z: 99, x: 0, y: 0 }, 800, 600, 800, 600).z).toBe(MAX_ZOOM);
    expect(clampView({ z: 0.2, x: 0, y: 0 }, 800, 600, 800, 600).z).toBe(1);
  });
});

describe("zoomAt", () => {
  const cw = 800;
  const ch = 600;
  const w = 800;
  const h = 600;
  // Content point under a screen point, given a view (all relative to centre).
  const contentUnder = (v: { z: number; x: number; y: number }, px: number, py: number) => [(px - v.x) / v.z, (py - v.y) / v.z];

  it("keeps the point under the cursor fixed", () => {
    const px = 150;
    const py = -90;
    const before = contentUnder(FIT, px, py);
    const zoomed = zoomAt(FIT, 3, px, py, cw, ch, w, h);
    const after = contentUnder(zoomed, px, py);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
  });

  it("returns to the centred fit when zooming back out", () => {
    const zoomed = zoomAt(FIT, 4, 200, 100, cw, ch, w, h);
    expect(zoomAt(zoomed, 1, 200, 100, cw, ch, w, h)).toEqual(FIT);
  });

  it("panning is clamped like everything else", () => {
    const zoomed = zoomAt(FIT, 2, 0, 0, cw, ch, w, h);
    const panned = panBy(zoomed, 5000, 0, cw, ch, w, h);
    expect(panned.x).toBe(clampView({ ...zoomed, x: 5000 }, cw, ch, w, h).x);
    expect(panned.z).toBe(2);
  });
});
