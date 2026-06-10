import { afterEach, describe, expect, it } from "vitest";
import { __resetFfmpegForTests, coreBaseUrl, runExclusiveMedia } from "./ffmpeg-engine";

afterEach(() => {
  __resetFfmpegForTests();
});

describe("coreBaseUrl", () => {
  it("falls back to the official single-threaded core CDN", () => {
    // NEXT_PUBLIC_FFMPEG_CORE_URL is unset in the test env.
    expect(coreBaseUrl()).toContain("@ffmpeg/core");
  });
});

describe("runExclusiveMedia", () => {
  it("never runs two tasks at the same time", async () => {
    let active = 0;
    let maxActive = 0;
    const task = () =>
      runExclusiveMedia(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await Promise.resolve();
        await Promise.resolve();
        active -= 1;
      });

    await Promise.all([task(), task(), task(), task()]);

    expect(maxActive).toBe(1);
    expect(active).toBe(0);
  });

  it("preserves submission order", async () => {
    const order: number[] = [];
    await Promise.all(
      [1, 2, 3].map((n) =>
        runExclusiveMedia(async () => {
          await Promise.resolve();
          order.push(n);
        }),
      ),
    );
    expect(order).toEqual([1, 2, 3]);
  });

  it("isolates failures so later tasks still run", async () => {
    await expect(
      runExclusiveMedia(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    await expect(runExclusiveMedia(async () => "ok")).resolves.toBe("ok");
  });

  it("returns the task's resolved value", async () => {
    await expect(runExclusiveMedia(async () => 42)).resolves.toBe(42);
  });
});
