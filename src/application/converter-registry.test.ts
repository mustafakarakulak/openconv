import { describe, expect, it } from "vitest";
import { FORMATS } from "@/core/domain/format";
import type { ConversionCapability, Converter } from "@/core/ports/converter";
import { ConverterRegistry } from "./converter-registry";

function fakeConverter(id: string, capabilities: ConversionCapability[]): Converter {
  return {
    id,
    name: id,
    capabilities,
    supports: (s, t) => capabilities.some((c) => c.source.id === s && c.target.id === t),
    convert: async () => ({ blob: new Blob() }),
  };
}

describe("ConverterRegistry", () => {
  it("registers capabilities and resolves the converter for a pair", () => {
    const registry = new ConverterRegistry();
    const converter = fakeConverter("c1", [{ source: FORMATS.json, target: FORMATS.yaml }]);
    registry.register(converter);

    expect(registry.getConverter("json", "yaml")).toBe(converter);
    expect(registry.canConvert("json", "yaml")).toBe(true);
    expect(registry.canConvert("yaml", "json")).toBe(false);
  });

  it("aggregates reachable targets per source", () => {
    const registry = new ConverterRegistry();
    registry.register(
      fakeConverter("c1", [
        { source: FORMATS.json, target: FORMATS.yaml },
        { source: FORMATS.json, target: FORMATS.xml },
      ]),
    );

    const targets = registry
      .targetsFor("json")
      .map((f) => f.id)
      .sort();
    expect(targets).toEqual(["xml", "yaml"]);
    expect(registry.targetsFor("png")).toEqual([]);
  });

  it("keeps the first converter registered for a duplicate pair", () => {
    const registry = new ConverterRegistry();
    const first = fakeConverter("first", [{ source: FORMATS.json, target: FORMATS.yaml }]);
    const second = fakeConverter("second", [{ source: FORMATS.json, target: FORMATS.yaml }]);
    registry.register(first).register(second);

    expect(registry.getConverter("json", "yaml")).toBe(first);
  });

  it("exposes capability metadata for a pair", () => {
    const registry = new ConverterRegistry();
    const capability: ConversionCapability = {
      source: FORMATS.jpeg,
      target: FORMATS.png,
      note: "lossless target",
    };
    registry.register(fakeConverter("img", [capability]));

    expect(registry.getCapability("jpeg", "png")?.note).toBe("lossless target");
    expect(registry.getCapability("jpeg", "webp")).toBeUndefined();
  });

  it("lists distinct known formats", () => {
    const registry = new ConverterRegistry();
    registry.register(fakeConverter("c1", [{ source: FORMATS.json, target: FORMATS.yaml }]));
    const ids = registry
      .listFormats()
      .map((f) => f.id)
      .sort();
    expect(ids).toEqual(["json", "yaml"]);
  });
});
