import { describe, expect, it } from "vitest";
import {
  ALL_FORMATS,
  detectFormat,
  extractExtension,
  formatByExtension,
  formatByMimeType,
  FORMATS,
  getFormat,
} from "./format";

describe("format catalog", () => {
  it("exposes unique ids across all formats", () => {
    const ids = ALL_FORMATS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("guarantees at least one extension and mime per format", () => {
    for (const format of ALL_FORMATS) {
      expect(format.extensions.length).toBeGreaterThan(0);
      expect(format.mimeTypes.length).toBeGreaterThan(0);
    }
  });

  it("looks up by id", () => {
    expect(getFormat("png")).toBe(FORMATS.png);
    expect(getFormat("does-not-exist")).toBeUndefined();
  });
});

describe("extractExtension", () => {
  it("returns the lowercase extension without a dot", () => {
    expect(extractExtension("photo.JPG")).toBe("jpg");
    expect(extractExtension("archive.tar.gz")).toBe("gz");
  });

  it("returns empty for names without an extension", () => {
    expect(extractExtension("README")).toBe("");
    expect(extractExtension("trailing.")).toBe("");
  });
});

describe("formatByExtension", () => {
  it("resolves canonical and alternate extensions", () => {
    expect(formatByExtension("png")).toBe(FORMATS.png);
    expect(formatByExtension(".JPG")).toBe(FORMATS.jpeg);
    expect(formatByExtension("yml")).toBe(FORMATS.yaml);
  });
});

describe("formatByMimeType", () => {
  it("matches mime types case-insensitively and ignores parameters", () => {
    expect(formatByMimeType("image/png")).toBe(FORMATS.png);
    expect(formatByMimeType("APPLICATION/JSON; charset=utf-8")).toBe(FORMATS.json);
  });
});

describe("detectFormat", () => {
  it("prefers extension over mime type", () => {
    expect(detectFormat({ name: "data.json", type: "text/plain" })).toBe(FORMATS.json);
  });

  it("falls back to mime type when the extension is unknown", () => {
    expect(detectFormat({ name: "blob", type: "image/webp" })).toBe(FORMATS.webp);
  });

  it("returns undefined when nothing matches", () => {
    expect(detectFormat({ name: "mystery.xyz", type: "" })).toBeUndefined();
  });
});
