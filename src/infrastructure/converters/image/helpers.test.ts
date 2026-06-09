import { describe, it, expect } from "vitest";
import { FORMATS } from "@/core/domain/format";
import type { ConversionOptions } from "@/core/domain/conversion";
import {
  buildCapabilities,
  clamp,
  DEFAULT_BACKGROUND,
  DEFAULT_QUALITY,
  IMAGE_SOURCE_FORMATS,
  IMAGE_TARGET_FORMATS,
  normalizeColor,
  OPTION_KEYS,
  optionsForTarget,
  resolveBackground,
  resolveEncodeOptions,
  resolveQuality,
  shouldFlatten,
  targetMimeType,
  targetNeedsFlatten,
  targetSupportsQuality,
} from "./helpers";

describe("source/target format catalogs", () => {
  it("decodes the eight declared sources", () => {
    const ids = IMAGE_SOURCE_FORMATS.map((f) => f.id);
    expect(ids).toEqual(["png", "jpeg", "webp", "gif", "bmp", "avif", "ico", "svg"]);
  });

  it("encodes only png, jpeg and webp", () => {
    const ids = IMAGE_TARGET_FORMATS.map((f) => f.id);
    expect(ids).toEqual(["png", "jpeg", "webp"]);
  });

  it("never offers decode-only formats as targets", () => {
    const targetIds = new Set(IMAGE_TARGET_FORMATS.map((f) => f.id));
    for (const id of ["gif", "bmp", "ico", "avif", "svg"]) {
      expect(targetIds.has(id)).toBe(false);
    }
  });
});

describe("buildCapabilities", () => {
  const capabilities = buildCapabilities();

  it("produces sources x targets minus identity pairs", () => {
    // 8 sources * 3 targets = 24, minus identity for png/jpeg/webp (3) = 21.
    expect(capabilities).toHaveLength(21);
  });

  it("excludes identity conversions", () => {
    for (const cap of capabilities) {
      expect(cap.source.id).not.toBe(cap.target.id);
    }
  });

  it("only emits encodable targets", () => {
    const allowed = new Set(["png", "jpeg", "webp"]);
    for (const cap of capabilities) {
      expect(allowed.has(cap.target.id)).toBe(true);
    }
  });

  it("covers every requested decode source at least once", () => {
    const seen = new Set(capabilities.map((c) => c.source.id));
    for (const f of IMAGE_SOURCE_FORMATS) {
      expect(seen.has(f.id)).toBe(true);
    }
  });

  it("attaches quality + background options to jpeg targets", () => {
    const cap = capabilities.find((c) => c.source.id === "png" && c.target.id === "jpeg");
    expect(cap).toBeDefined();
    const keys = (cap?.options ?? []).map((o) => o.key);
    expect(keys).toContain(OPTION_KEYS.quality);
    expect(keys).toContain(OPTION_KEYS.background);
  });

  it("attaches only quality to webp targets", () => {
    const cap = capabilities.find((c) => c.source.id === "png" && c.target.id === "webp");
    expect(cap).toBeDefined();
    const keys = (cap?.options ?? []).map((o) => o.key);
    expect(keys).toEqual([OPTION_KEYS.quality]);
  });

  it("attaches no options to png targets", () => {
    const cap = capabilities.find((c) => c.source.id === "jpeg" && c.target.id === "png");
    expect(cap).toBeDefined();
    expect(cap?.options).toBeUndefined();
  });

  it("respects a custom source/target subset", () => {
    const caps = buildCapabilities([FORMATS.png, FORMATS.gif], [FORMATS.png]);
    // png->png excluded, gif->png kept.
    expect(caps).toHaveLength(1);
    expect(caps[0]?.source.id).toBe("gif");
    expect(caps[0]?.target.id).toBe("png");
  });
});

describe("optionsForTarget", () => {
  it("returns a number descriptor for quality with spec defaults", () => {
    const opts = optionsForTarget(FORMATS.webp);
    const quality = opts.find((o) => o.key === OPTION_KEYS.quality);
    expect(quality).toBeDefined();
    expect(quality?.kind).toBe("number");
    if (quality?.kind === "number") {
      expect(quality.default).toBe(DEFAULT_QUALITY);
      expect(quality.min).toBe(0);
      expect(quality.max).toBe(1);
      expect(quality.step).toBe(0.01);
    }
  });

  it("returns a select descriptor for background defaulting to white", () => {
    const opts = optionsForTarget(FORMATS.jpeg);
    const bg = opts.find((o) => o.key === OPTION_KEYS.background);
    expect(bg).toBeDefined();
    expect(bg?.kind).toBe("select");
    if (bg?.kind === "select") {
      expect(bg.default).toBe(DEFAULT_BACKGROUND);
      expect(bg.choices.map((c) => c.value)).toContain("#ffffff");
    }
  });

  it("returns nothing for png", () => {
    expect(optionsForTarget(FORMATS.png)).toHaveLength(0);
  });
});

describe("targetSupportsQuality / targetNeedsFlatten / targetMimeType", () => {
  it("marks jpeg and webp as lossy/quality-bearing", () => {
    expect(targetSupportsQuality(FORMATS.jpeg)).toBe(true);
    expect(targetSupportsQuality(FORMATS.webp)).toBe(true);
    expect(targetSupportsQuality(FORMATS.png)).toBe(false);
  });

  it("flattens only for jpeg (no alpha)", () => {
    expect(targetNeedsFlatten(FORMATS.jpeg)).toBe(true);
    expect(targetNeedsFlatten(FORMATS.png)).toBe(false);
    expect(targetNeedsFlatten(FORMATS.webp)).toBe(false);
  });

  it("selects the canonical target mime", () => {
    expect(targetMimeType(FORMATS.png)).toBe("image/png");
    expect(targetMimeType(FORMATS.jpeg)).toBe("image/jpeg");
    expect(targetMimeType(FORMATS.webp)).toBe("image/webp");
  });
});

describe("clamp", () => {
  it("keeps in-range values", () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
  it("clamps below min and above max", () => {
    expect(clamp(-3, 0, 1)).toBe(0);
    expect(clamp(9, 0, 1)).toBe(1);
  });
  it("falls back to min for non-finite input", () => {
    expect(clamp(Number.NaN, 0, 1)).toBe(0);
    expect(clamp(Number.POSITIVE_INFINITY, 0, 1)).toBe(0);
    expect(clamp(Number.NEGATIVE_INFINITY, 0, 1)).toBe(0);
  });
});

describe("resolveQuality", () => {
  const opt = (v: ConversionOptions[string] | undefined): ConversionOptions =>
    v === undefined ? {} : { [OPTION_KEYS.quality]: v };

  it("defaults to 0.92 when missing", () => {
    expect(resolveQuality(opt(undefined))).toBe(DEFAULT_QUALITY);
  });

  it("reads a numeric option", () => {
    expect(resolveQuality(opt(0.4))).toBe(0.4);
  });

  it("parses a numeric string", () => {
    expect(resolveQuality(opt("0.3"))).toBeCloseTo(0.3);
  });

  it("clamps out-of-range values", () => {
    expect(resolveQuality(opt(5))).toBe(1);
    expect(resolveQuality(opt(-2))).toBe(0);
  });

  it("falls back to default for garbage strings", () => {
    expect(resolveQuality(opt("nope"))).toBe(DEFAULT_QUALITY);
  });
});

describe("resolveBackground", () => {
  const opt = (v: string): ConversionOptions => ({ [OPTION_KEYS.background]: v });

  it("defaults to white when missing", () => {
    expect(resolveBackground({})).toBe(DEFAULT_BACKGROUND);
  });

  it("accepts and lowercases a valid hex colour", () => {
    expect(resolveBackground(opt("#AABBCC"))).toBe("#aabbcc");
  });

  it("accepts a named colour", () => {
    expect(resolveBackground(opt("black"))).toBe("black");
  });

  it("accepts an rgb() colour", () => {
    expect(resolveBackground(opt("rgb(10, 20, 30)"))).toBe("rgb(10, 20, 30)");
  });

  it("rejects invalid colours and falls back to default", () => {
    expect(resolveBackground(opt("javascript:alert(1)"))).toBe(DEFAULT_BACKGROUND);
    expect(resolveBackground(opt("#12"))).toBe(DEFAULT_BACKGROUND);
  });

  it("trims surrounding whitespace", () => {
    expect(resolveBackground(opt("  #fff  "))).toBe("#fff");
  });
});

describe("normalizeColor", () => {
  it("accepts 3 and 6 digit hex", () => {
    expect(normalizeColor("#fff")).toBe("#fff");
    expect(normalizeColor("#FFFFFF")).toBe("#ffffff");
  });
  it("rejects malformed hex", () => {
    expect(normalizeColor("#ff")).toBeUndefined();
    expect(normalizeColor("#fffff")).toBeUndefined();
    expect(normalizeColor("fff")).toBeUndefined();
  });
  it("accepts rgb and rgba", () => {
    expect(normalizeColor("rgb(0,0,0)")).toBe("rgb(0,0,0)");
    expect(normalizeColor("rgba(1,2,3,0.5)")).toBe("rgba(1,2,3,0.5)");
  });
  it("accepts known named colours only", () => {
    expect(normalizeColor("white")).toBe("white");
    expect(normalizeColor("chartreuse")).toBeUndefined();
  });
  it("rejects injection-y values", () => {
    expect(normalizeColor("url(x)")).toBeUndefined();
    expect(normalizeColor("expression(1)")).toBeUndefined();
  });
});

describe("shouldFlatten", () => {
  it("flattens only opaque targets", () => {
    expect(shouldFlatten(FORMATS.jpeg)).toBe(true);
    expect(shouldFlatten(FORMATS.png)).toBe(false);
    expect(shouldFlatten(FORMATS.webp)).toBe(false);
  });
});

describe("resolveEncodeOptions", () => {
  it("resolves a full jpeg encode plan", () => {
    const plan = resolveEncodeOptions(FORMATS.jpeg, {
      [OPTION_KEYS.quality]: 0.5,
      [OPTION_KEYS.background]: "#000000",
    });
    expect(plan).toEqual({
      mimeType: "image/jpeg",
      quality: 0.5,
      flatten: true,
      background: "#000000",
    });
  });

  it("omits quality for png and never flattens", () => {
    const plan = resolveEncodeOptions(FORMATS.png, {});
    expect(plan.mimeType).toBe("image/png");
    expect(plan.quality).toBeUndefined();
    expect(plan.flatten).toBe(false);
    expect(plan.background).toBe(DEFAULT_BACKGROUND);
  });

  it("includes quality but not flatten for webp", () => {
    const plan = resolveEncodeOptions(FORMATS.webp, { [OPTION_KEYS.quality]: "0.8" });
    expect(plan.mimeType).toBe("image/webp");
    expect(plan.quality).toBeCloseTo(0.8);
    expect(plan.flatten).toBe(false);
  });

  it("applies defaults when options are empty", () => {
    const plan = resolveEncodeOptions(FORMATS.jpeg, {});
    expect(plan.quality).toBe(DEFAULT_QUALITY);
    expect(plan.background).toBe(DEFAULT_BACKGROUND);
  });
});
