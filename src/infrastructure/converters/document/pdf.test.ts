import { describe, it, expect } from "vitest";
import {
  assemblePageText,
  clamp,
  jsPdfConstructorArgs,
  normalizePageSize,
  pageDimensions,
  resolvePdfOptions,
} from "./pdf";

describe("clamp", () => {
  it("clamps below the minimum", () => {
    expect(clamp(-5, 0, 72)).toBe(0);
  });

  it("clamps above the maximum", () => {
    expect(clamp(100, 0, 72)).toBe(72);
  });

  it("passes through in-range values", () => {
    expect(clamp(36, 0, 72)).toBe(36);
  });

  it("returns the minimum for NaN", () => {
    expect(clamp(Number.NaN, 0, 72)).toBe(0);
  });
});

describe("normalizePageSize", () => {
  it("recognises letter case-insensitively", () => {
    expect(normalizePageSize("Letter")).toBe("letter");
    expect(normalizePageSize("LETTER")).toBe("letter");
  });

  it("defaults unknown values to a4", () => {
    expect(normalizePageSize("a4")).toBe("a4");
    expect(normalizePageSize("legal")).toBe("a4");
    expect(normalizePageSize("")).toBe("a4");
  });
});

describe("resolvePdfOptions", () => {
  it("resolves defaults and rounds margin", () => {
    expect(resolvePdfOptions({ pageSize: "a4", margin: 36 })).toEqual({
      pageSize: "a4",
      margin: 36,
    });
  });

  it("clamps an out-of-range margin", () => {
    expect(resolvePdfOptions({ pageSize: "letter", margin: 500 })).toEqual({
      pageSize: "letter",
      margin: 72,
    });
    expect(resolvePdfOptions({ pageSize: "letter", margin: -10 })).toEqual({
      pageSize: "letter",
      margin: 0,
    });
  });

  it("rounds fractional margins", () => {
    expect(resolvePdfOptions({ pageSize: "a4", margin: 18.7 }).margin).toBe(19);
  });

  it("normalises an unknown page size to a4", () => {
    expect(resolvePdfOptions({ pageSize: "tabloid", margin: 10 }).pageSize).toBe("a4");
  });
});

describe("pageDimensions", () => {
  it("returns letter dimensions in points", () => {
    expect(pageDimensions("letter")).toEqual([612, 792]);
  });

  it("returns a4 dimensions in points", () => {
    expect(pageDimensions("a4")).toEqual([595.28, 841.89]);
  });
});

describe("jsPdfConstructorArgs", () => {
  it("builds portrait pt args with the given format", () => {
    expect(jsPdfConstructorArgs("a4")).toEqual({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });
    expect(jsPdfConstructorArgs("letter").format).toBe("letter");
  });
});

describe("assemblePageText", () => {
  it("concatenates item strings", () => {
    expect(assemblePageText([{ str: "Hello " }, { str: "world" }])).toBe("Hello world");
  });

  it("inserts a newline after items flagged with hasEOL", () => {
    expect(
      assemblePageText([
        { str: "line one", hasEOL: true },
        { str: "line two", hasEOL: true },
      ]),
    ).toBe("line one\nline two\n");
  });

  it("handles an empty item list", () => {
    expect(assemblePageText([])).toBe("");
  });
});
