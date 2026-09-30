import { afterEach, expect, it, vi } from "vitest";
import { api, uploadFile } from "./api";
afterEach(() => vi.unstubAllGlobals());
it("shows the API error message", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: "Authentication required" }, { status: 401 }),
      ),
  );
  await expect(api("/api/clients")).rejects.toThrow("Authentication required");
});
it("does not report success when the storage PUT fails", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ url: "https://storage.test/upload", key: "test" }),
    )
    .mockResolvedValueOnce(new Response("", { status: 403 }));
  vi.stubGlobal("fetch", fetcher);
  const progress = vi.fn();
  await expect(
    uploadFile(new File(["test"], "test.png", { type: "image/png" }), progress),
  ).rejects.toThrow("Upload failed (403)");
  expect(progress).not.toHaveBeenCalled();
});
it("returns the persisted key only after storage accepts the file", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ url: "https://storage.test/upload", key: "test" }),
      )
      .mockResolvedValueOnce(new Response("", { status: 200 })),
  );
  const progress = vi.fn();
  const result = await uploadFile(
    new File(["test"], "test.png", { type: "image/png" }),
    progress,
  );
  expect(result.key).toBe("test");
  expect(progress).toHaveBeenCalledWith(100);
});
