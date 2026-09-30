import { describe, expect, it } from "vitest";
import { safeNext } from "./auth";

describe("safeNext", () => {
  it("allows links back into the app", () => {
    expect(safeNext("/app/dashboard")).toBe("/app/dashboard");
    expect(safeNext("/app/projects/pr_123?x=1")).toBe("/app/projects/pr_123?x=1");
    expect(safeNext("/app")).toBe("/app");
    expect(safeNext("/onboarding")).toBe("/onboarding");
  });
  it("refuses anything that could leave the site or loop back to login", () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "/login", "/app.evil.com", "javascript:alert(1)", "app/dashboard", "", null, undefined]) {
      expect(safeNext(bad as string | null | undefined)).toBeNull();
    }
  });
});
