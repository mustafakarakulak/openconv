import { describe, it, expect } from "vitest";

import { InvalidInputError, ConversionFailedError } from "@/core/domain/errors";

import {
  CSV_DELIMITER,
  TSV_DELIMITER,
  assertTabular,
  assertTomlRoot,
  clampIndent,
  isPlainObject,
  isScalar,
  parseDelimited,
  parseJson,
  parseTomlText,
  parseXml,
  parseYaml,
  serializeDelimited,
  serializeJson,
  serializeTomlText,
  serializeXml,
  serializeYaml,
  unwrapXmlRoot,
  wrapXmlValue,
} from "./serialization";

describe("clampIndent", () => {
  it("rounds and clamps into [0,8]", () => {
    expect(clampIndent(2)).toBe(2);
    expect(clampIndent(-3)).toBe(0);
    expect(clampIndent(99)).toBe(8);
    expect(clampIndent(2.7)).toBe(3);
  });

  it("falls back to 2 for non-finite values", () => {
    expect(clampIndent(Number.NaN)).toBe(2);
    expect(clampIndent(Number.POSITIVE_INFINITY)).toBe(2);
  });
});

describe("type guards", () => {
  it("isPlainObject distinguishes objects from arrays/null", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject("x")).toBe(false);
  });

  it("isScalar accepts primitives and null/undefined", () => {
    expect(isScalar("x")).toBe(true);
    expect(isScalar(1)).toBe(true);
    expect(isScalar(true)).toBe(true);
    expect(isScalar(null)).toBe(true);
    expect(isScalar(undefined)).toBe(true);
    expect(isScalar({})).toBe(false);
    expect(isScalar([])).toBe(false);
  });
});

describe("JSON", () => {
  it("parses and round-trips nested data", () => {
    const value = parseJson('{"a":1,"b":[1,2,{"c":"x"}],"u":"héllo 世界"}');
    expect(value).toEqual({ a: 1, b: [1, 2, { c: "x" }], u: "héllo 世界" });
  });

  it("serializes with the requested indent and trailing newline", () => {
    const out = serializeJson({ a: 1 }, 2);
    expect(out).toBe('{\n  "a": 1\n}\n');
    const compact = serializeJson({ a: 1 }, 0);
    expect(compact).toBe('{"a":1}\n');
  });

  it("preserves number vs string distinction", () => {
    const out = serializeJson({ n: 1, s: "1" }, 0);
    expect(out).toBe('{"n":1,"s":"1"}\n');
  });

  it("throws InvalidInputError on malformed JSON", () => {
    expect(() => parseJson("{not json}")).toThrow(InvalidInputError);
  });
});

describe("YAML", () => {
  it("round-trips through JSON value identity", () => {
    const value = parseYaml("a: 1\nb:\n  - 1\n  - 2\nc:\n  d: x\n");
    expect(value).toEqual({ a: 1, b: [1, 2], c: { d: "x" } });
  });

  it("serializes unicode and nested structures", () => {
    const out = serializeYaml({ greeting: "héllo 世界", list: [1, 2] });
    expect(out).toContain("greeting:");
    expect(out).toContain("héllo 世界");
    expect(parseYaml(out)).toEqual({ greeting: "héllo 世界", list: [1, 2] });
  });

  it("throws InvalidInputError on malformed YAML", () => {
    expect(() => parseYaml("a: [1, 2\nb: oops")).toThrow(InvalidInputError);
  });
});

describe("TOML", () => {
  it("parses tables and scalars", () => {
    const value = parseTomlText('title = "x"\n[owner]\nname = "Tom"\n');
    expect(value).toEqual({ title: "x", owner: { name: "Tom" } });
  });

  it("serializes an object root with trailing newline", () => {
    const out = serializeTomlText({ a: 1, nested: { b: "x" } });
    expect(out.endsWith("\n")).toBe(true);
    expect(parseTomlText(out)).toEqual({ a: 1, nested: { b: "x" } });
  });

  it("assertTomlRoot rejects arrays and scalars", () => {
    expect(() => assertTomlRoot([1, 2, 3])).toThrow(InvalidInputError);
    expect(() => assertTomlRoot("scalar")).toThrow(InvalidInputError);
    expect(assertTomlRoot({ a: 1 })).toEqual({ a: 1 });
  });

  it("serializeTomlText throws InvalidInputError for array roots", () => {
    expect(() => serializeTomlText([{ a: 1 }])).toThrow(InvalidInputError);
  });

  it("throws InvalidInputError on malformed TOML", () => {
    expect(() => parseTomlText("a = = 1")).toThrow(InvalidInputError);
  });
});

describe("XML", () => {
  it("wrapXmlValue keeps a single-rooted object intact", () => {
    expect(wrapXmlValue({ root: { a: 1 } })).toEqual({ root: { a: 1 } });
  });

  it("wrapXmlValue wraps multi-key objects under root", () => {
    expect(wrapXmlValue({ a: 1, b: 2 })).toEqual({ root: { a: 1, b: 2 } });
  });

  it("wrapXmlValue wraps arrays into root/item", () => {
    expect(wrapXmlValue([1, 2])).toEqual({ root: { item: [1, 2] } });
  });

  it("wrapXmlValue wraps scalars under root", () => {
    expect(wrapXmlValue("hi")).toEqual({ root: "hi" });
  });

  it("unwrapXmlRoot strips a single root and ignores ?xml", () => {
    expect(unwrapXmlRoot({ root: { a: 1 } })).toEqual({ a: 1 });
    expect(unwrapXmlRoot({ "?xml": {}, root: { a: 1 } })).toEqual({ a: 1 });
    expect(unwrapXmlRoot({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("serializes and parses round-trips a single-rooted document", () => {
    const xml = serializeXml({ note: { to: "Tove", from: "Jani" } }, 2);
    expect(xml).toContain("<note>");
    expect(xml).toContain("<to>Tove</to>");
    const back = parseXml(xml);
    expect(back).toEqual({ to: "Tove", from: "Jani" });
  });

  it("respects the indent option", () => {
    const xml = serializeXml({ root: { a: 1 } }, 4);
    expect(xml).toContain("    <a>1</a>");
  });

  it("throws InvalidInputError on malformed XML", () => {
    expect(() => parseXml("<a><b></a>")).toThrow(InvalidInputError);
  });
});

describe("delimited (CSV/TSV)", () => {
  it("parses CSV into typed row objects", () => {
    const rows = parseDelimited("a,b\n1,x\n2,y\n", CSV_DELIMITER);
    expect(rows).toEqual([
      { a: 1, b: "x" },
      { a: 2, b: "y" },
    ]);
  });

  it("parses TSV with the tab delimiter", () => {
    const rows = parseDelimited("a\tb\n1\tx\n", TSV_DELIMITER);
    expect(rows).toEqual([{ a: 1, b: "x" }]);
  });

  it("serializes rows to CSV with and without a header", () => {
    const withHeader = serializeDelimited([{ a: 1, b: 2 }], CSV_DELIMITER, true);
    expect(withHeader).toBe("a,b\r\n1,2");
    const noHeader = serializeDelimited([{ a: 1, b: 2 }], CSV_DELIMITER, false);
    expect(noHeader).toBe("1,2");
  });

  it("serializes rows to TSV", () => {
    const out = serializeDelimited([{ a: 1, b: 2 }], TSV_DELIMITER, true);
    expect(out).toBe("a\tb\r\n1\t2");
  });

  it("assertTabular accepts arrays of flat objects", () => {
    expect(assertTabular([{ a: 1 }, { a: 2 }])).toHaveLength(2);
  });

  it("assertTabular accepts arrays of scalar arrays", () => {
    expect(
      assertTabular([
        [1, 2],
        [3, 4],
      ]),
    ).toHaveLength(2);
  });

  it("assertTabular rejects a non-array value", () => {
    expect(() => assertTabular({ a: 1 })).toThrow(InvalidInputError);
  });

  it("assertTabular rejects nested objects in rows", () => {
    expect(() => assertTabular([{ a: { nested: 1 } }])).toThrow(InvalidInputError);
  });

  it("assertTabular rejects nested arrays in scalar-array rows", () => {
    expect(() => assertTabular([[1, [2, 3]]])).toThrow(InvalidInputError);
  });

  it("serializeDelimited surfaces InvalidInputError for non-tabular input", () => {
    expect(() => serializeDelimited({ a: 1 }, CSV_DELIMITER, true)).toThrow(InvalidInputError);
  });
});

describe("error mapping", () => {
  it("serializeJson wraps cyclic structures as ConversionFailedError", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => serializeJson(cyclic, 2)).toThrow(ConversionFailedError);
  });
});
