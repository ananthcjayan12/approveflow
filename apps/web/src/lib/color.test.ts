import { describe, expect, it } from "vitest";
import { readableOn } from "./color";

describe("readableOn", () => {
  it("picks dark text on light colours and white on dark ones", () => {
    expect(readableOn("#ffc53d")).toBe("#111827"); // the old default yellow
    expect(readableOn("#ffffff")).toBe("#111827");
    expect(readableOn("#facc15")).toBe("#111827");
    expect(readableOn("#5b5bd6")).toBe("#ffffff"); // brand indigo
    expect(readableOn("#111827")).toBe("#ffffff");
    expect(readableOn("#ef4444")).toBe("#ffffff");
  });
  it("falls back to white for anything that is not a hex colour", () => {
    expect(readableOn("red")).toBe("#ffffff");
    expect(readableOn("")).toBe("#ffffff");
  });
});
