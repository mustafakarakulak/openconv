import { describe, it, expect } from "vitest";

import { InvalidInputError } from "@/core/domain/errors";

import {
  DEFAULT_HEADER,
  DEFAULT_INDENT,
  buildSupportedPairs,
  defaultPipelineOptions,
  parseFormat,
  runPipeline,
  serializeFormat,
} from "./pipeline";

const opts = defaultPipelineOptions();

describe("defaultPipelineOptions", () => {
  it("uses the documented defaults", () => {
    expect(opts).toEqual({ indent: DEFAULT_INDENT, header: DEFAULT_HEADER });
    expect(DEFAULT_INDENT).toBe(2);
    expect(DEFAULT_HEADER).toBe(true);
  });
});

describe("buildSupportedPairs", () => {
  const pairs = buildSupportedPairs();
  const has = (s: string, t: string): boolean =>
    pairs.some((p) => p.source === s && p.target === t);

  it("includes all pairwise object-format conversions both directions", () => {
    const objs = ["json", "yaml", "toml", "xml"];
    for (const a of objs) {
      for (const b of objs) {
        if (a === b) continue;
        expect(has(a, b)).toBe(true);
      }
    }
  });

  it("includes csv<->tsv", () => {
    expect(has("csv", "tsv")).toBe(true);
    expect(has("tsv", "csv")).toBe(true);
  });

  it("includes tabular<->json/yaml", () => {
    expect(has("csv", "json")).toBe(true);
    expect(has("json", "csv")).toBe(true);
    expect(has("tsv", "json")).toBe(true);
    expect(has("json", "tsv")).toBe(true);
    expect(has("csv", "yaml")).toBe(true);
    expect(has("yaml", "csv")).toBe(true);
  });

  it("never includes identity pairs and has no duplicates", () => {
    const keys = pairs.map((p) => `${p.source}>${p.target}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(pairs.some((p) => p.source === p.target)).toBe(false);
  });

  it("has the expected total count", () => {
    // 12 object pairwise + 2 (csv/tsv) + 6 tabular<->json/yaml = 20.
    expect(pairs).toHaveLength(20);
  });
});

describe("parseFormat / serializeFormat", () => {
  it("parses each object format", () => {
    expect(parseFormat("json", '{"a":1}')).toEqual({ a: 1 });
    expect(parseFormat("yaml", "a: 1")).toEqual({ a: 1 });
    expect(parseFormat("toml", "a = 1")).toEqual({ a: 1 });
    expect(parseFormat("xml", "<root><a>1</a></root>")).toEqual({ a: 1 });
  });

  it("parses tabular formats into row arrays", () => {
    expect(parseFormat("csv", "a,b\n1,2")).toEqual([{ a: 1, b: 2 }]);
    expect(parseFormat("tsv", "a\tb\n1\t2")).toEqual([{ a: 1, b: 2 }]);
  });

  it("serializes each format", () => {
    expect(serializeFormat("json", { a: 1 }, { ...opts, indent: 0 })).toBe('{"a":1}\n');
    expect(serializeFormat("yaml", { a: 1 }, opts)).toContain("a: 1");
    expect(serializeFormat("toml", { a: 1 }, opts)).toContain("a = 1");
    expect(serializeFormat("xml", { root: { a: 1 } }, opts)).toContain("<a>1</a>");
    expect(serializeFormat("csv", [{ a: 1 }], opts)).toBe("a\r\n1");
    expect(serializeFormat("tsv", [{ a: 1 }], opts)).toBe("a\r\n1");
  });
});

describe("runPipeline round-trips", () => {
  it("json -> yaml -> json", () => {
    const json = '{"a":1,"b":[1,2],"c":{"d":"x"}}';
    const yamlText = runPipeline("json", "yaml", json, opts);
    const back = runPipeline("yaml", "json", yamlText, { ...opts, indent: 0 });
    expect(JSON.parse(back)).toEqual({ a: 1, b: [1, 2], c: { d: "x" } });
  });

  it("json -> toml -> json", () => {
    const json = '{"title":"x","owner":{"name":"Tom"}}';
    const tomlText = runPipeline("json", "toml", json, opts);
    const back = runPipeline("toml", "json", tomlText, { ...opts, indent: 0 });
    expect(JSON.parse(back)).toEqual({ title: "x", owner: { name: "Tom" } });
  });

  it("json -> xml -> json (single root)", () => {
    const json = '{"note":{"to":"Tove","from":"Jani"}}';
    const xml = runPipeline("json", "xml", json, opts);
    const back = runPipeline("xml", "json", xml, { ...opts, indent: 0 });
    expect(JSON.parse(back)).toEqual({ to: "Tove", from: "Jani" });
  });

  it("yaml -> toml -> yaml preserves unicode", () => {
    const yamlText = "greeting: héllo 世界\nnested:\n  k: v\n";
    const tomlText = runPipeline("yaml", "toml", yamlText, opts);
    const back = runPipeline("toml", "yaml", tomlText, opts);
    expect(back).toContain("héllo 世界");
  });

  it("csv -> tsv -> csv", () => {
    const csv = "a,b\n1,x\n2,y";
    const tsv = runPipeline("csv", "tsv", csv, opts);
    expect(tsv).toBe("a\tb\r\n1\tx\r\n2\ty");
    const back = runPipeline("tsv", "csv", tsv, opts);
    expect(back).toBe("a,b\r\n1,x\r\n2,y");
  });

  it("csv -> json -> csv (tabular as array of objects)", () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const json = runPipeline("csv", "json", csv, opts);
    expect(JSON.parse(json)).toEqual([
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ]);
    const back = runPipeline("json", "csv", json, opts);
    expect(back).toBe("name,age\r\nAlice,30\r\nBob,25");
  });

  it("csv -> yaml emits an array of row mappings", () => {
    const yamlText = runPipeline("csv", "yaml", "a,b\n1,2", opts);
    expect(yamlText).toContain("- a: 1");
  });

  it("respects header:false when emitting csv", () => {
    const out = runPipeline("json", "csv", '[{"a":1,"b":2}]', { ...opts, header: false });
    expect(out).toBe("1,2");
  });
});

describe("runPipeline edge cases", () => {
  it("handles an empty JSON object", () => {
    expect(runPipeline("json", "yaml", "{}", opts).trim()).toBe("{}");
  });

  it("handles an empty CSV (header only) into an empty JSON array", () => {
    const out = runPipeline("csv", "json", "a,b\n", { ...opts, indent: 0 });
    expect(JSON.parse(out)).toEqual([]);
  });

  it("rejects an array as a TOML target", () => {
    expect(() => runPipeline("json", "toml", "[1,2,3]", opts)).toThrow(InvalidInputError);
  });

  it("rejects a non-tabular value as a CSV target", () => {
    expect(() => runPipeline("json", "csv", '{"a":1}', opts)).toThrow(InvalidInputError);
  });

  it("rejects nested objects when targeting CSV", () => {
    expect(() => runPipeline("json", "csv", '[{"a":{"b":1}}]', opts)).toThrow(InvalidInputError);
  });

  it("propagates parse errors as InvalidInputError", () => {
    expect(() => runPipeline("json", "yaml", "{bad", opts)).toThrow(InvalidInputError);
  });
});
