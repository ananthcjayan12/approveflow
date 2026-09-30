import { describe, expect, it } from "vitest";
import { assignLanes, formatLength, formatSpan, formatTime, isActiveAt, overlapsPortion } from "./timeline";

describe("formatTime", () => {
  it("formats minutes and seconds", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(65.9)).toBe("1:05");
  });
  it("adds tenths without rounding up into the next second", () => {
    expect(formatTime(5.96, true)).toBe("0:05.9");
    expect(formatTime(12, true)).toBe("0:12.0");
  });
  it("handles hours and bad input", () => {
    expect(formatTime(3725)).toBe("1:02:05");
    expect(formatTime(NaN)).toBe("0:00");
    expect(formatTime(-4)).toBe("0:00");
  });
  it("shows a moment as one time and a portion as a range", () => {
    expect(formatSpan({ start: 4, end: 4 })).toBe("0:04");
    expect(formatSpan({ start: 3, end: 8 })).toBe("0:03 – 0:08");
  });
  it("describes lengths", () => {
    expect(formatLength(5)).toBe("5s");
    expect(formatLength(2.46)).toBe("2.5s");
    expect(formatLength(125)).toBe("2m 05s");
  });
});

describe("portion filtering", () => {
  const portion = { start: 3, end: 8 };
  it("matches moments inside the portion, with a little tolerance at the edges", () => {
    expect(overlapsPortion({ start: 5, end: 5 }, portion)).toBe(true);
    expect(overlapsPortion({ start: 8.04, end: 8.04 }, portion)).toBe(true);
    expect(overlapsPortion({ start: 9, end: 9 }, portion)).toBe(false);
    expect(overlapsPortion({ start: 1, end: 1 }, portion)).toBe(false);
  });
  it("matches ranges that merely overlap", () => {
    expect(overlapsPortion({ start: 1, end: 4 }, portion)).toBe(true);
    expect(overlapsPortion({ start: 7, end: 12 }, portion)).toBe(true);
    expect(overlapsPortion({ start: 0, end: 20 }, portion)).toBe(true);
    expect(overlapsPortion({ start: 9, end: 12 }, portion)).toBe(false);
  });
});

describe("markup timing", () => {
  it("shows a moment's markup for about a second after its timestamp", () => {
    const at = { start: 4, end: 4 };
    expect(isActiveAt(at, 3.5)).toBe(false);
    expect(isActiveAt(at, 4)).toBe(true);
    expect(isActiveAt(at, 5)).toBe(true);
    expect(isActiveAt(at, 6)).toBe(false);
  });
  it("shows a portion's markup for the whole portion", () => {
    const range = { start: 3, end: 8 };
    expect(isActiveAt(range, 2.5)).toBe(false);
    expect(isActiveAt(range, 3)).toBe(true);
    expect(isActiveAt(range, 8)).toBe(true);
    expect(isActiveAt(range, 8.5)).toBe(false);
  });
});

describe("assignLanes", () => {
  it("keeps distant markers on one lane", () => {
    const { lanes, count } = assignLanes(
      [{ start: 1, end: 1 }, { start: 8, end: 8 }],
      10,
      500,
    );
    expect(lanes).toEqual([0, 0]);
    expect(count).toBe(1);
  });
  it("stacks markers that would collide", () => {
    const { lanes, count } = assignLanes(
      [{ start: 5, end: 5 }, { start: 5.1, end: 5.1 }, { start: 5.2, end: 5.2 }],
      10,
      500,
    );
    expect(new Set(lanes).size).toBe(3);
    expect(count).toBe(3);
  });
  it("stacks a portion with the moments inside it", () => {
    const { lanes } = assignLanes([{ start: 2, end: 8 }, { start: 4, end: 4 }], 10, 500);
    expect(lanes[0]).not.toBe(lanes[1]);
  });
  it("caps at three lanes and copes with unknown duration", () => {
    const many = Array.from({ length: 8 }, () => ({ start: 5, end: 5 }));
    expect(Math.max(...assignLanes(many, 10, 500).lanes)).toBe(2);
    expect(assignLanes(many, 0, 500).count).toBe(1);
  });
});
