import { describe, expect, it } from "vitest";
import { initials } from "./format";

describe("initials", () => {
  it("uses the first letters of the first two words", () => {
    expect(initials("Smile Craft Dental")).toBe("SC");
    expect(initials("dr. priya shah")).toBe("DP");
  });
  it("skips symbols such as an ampersand in a studio name", () => {
    expect(initials("Pixel & Post Studio")).toBe("PP");
    expect(initials("& Co")).toBe("C");
  });
  it("copes with one word, accents, and empty input", () => {
    expect(initials("Madonna")).toBe("M");
    expect(initials("Élise Ünal")).toBe("ÉÜ");
    expect(initials("   ")).toBe("?");
    expect(initials("")).toBe("?");
  });
});
