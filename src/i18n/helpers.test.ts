import { describe, expect, it } from "vitest";
import { interpolate, pick } from "./helpers";

describe("interpolate", () => {
  it("replaces named tokens with params", () => {
    expect(interpolate("{count} files", { count: 3 })).toBe("3 files");
    expect(interpolate("Done in {ms} ms", { ms: 1234 })).toBe("Done in 1234 ms");
  });

  it("supports multiple and repeated tokens", () => {
    expect(interpolate("{a}+{b}={a}{b}", { a: 1, b: 2 })).toBe("1+2=12");
  });

  it("leaves tokens without a matching param untouched", () => {
    expect(interpolate("{count} of {total}", { count: 1 })).toBe("1 of {total}");
  });

  it("returns the template unchanged when there are no tokens", () => {
    expect(interpolate("no tokens here", { x: 1 })).toBe("no tokens here");
  });
});

describe("pick", () => {
  it("returns the matching value", () => {
    expect(pick({ a: "A", b: "B" }, "a", "fallback")).toBe("A");
  });

  it("returns the fallback for an absent key", () => {
    expect(pick({ a: "A" }, "missing", "fallback")).toBe("fallback");
  });

  it("returns the fallback for an empty record", () => {
    expect(pick({}, "anything", "fallback")).toBe("fallback");
  });
});
