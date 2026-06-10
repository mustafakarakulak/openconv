import { describe, it, expect } from "vitest";

import { ConversionCanceledError, InvalidInputError } from "@/core/domain/errors";
import { FORMATS } from "@/core/domain/format";
import type { ConversionProgress, ConvertInput, ConverterContext } from "@/core/ports/converter";
import type { Logger, Span, SpanOptions, Tracer } from "@/core/ports/observability";

import {
  DataConverter,
  HEADER_OPTION,
  INDENT_OPTION,
  asDataFormat,
  buildCapabilities,
  optionsForTarget,
} from "./data-converter";
import { dataConverters } from "./index";

// --- test doubles ----------------------------------------------------------

function makeLogger(): Logger {
  const logger: Logger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => logger,
  };
  return logger;
}

function makeSpan(): Span {
  return {
    traceId: "0".repeat(32),
    spanId: "0".repeat(16),
    logger: makeLogger(),
    setAttribute: () => {},
    setAttributes: () => {},
    addEvent: () => {},
    recordError: () => {},
    setStatus: () => {},
    end: () => {},
  };
}

function makeTracer(): Tracer {
  return {
    startSpan: () => makeSpan(),
    withSpan: async <T>(
      _name: string,
      fn: (span: Span) => Promise<T> | T,
      _options?: SpanOptions,
    ): Promise<T> => fn(makeSpan()),
  };
}

interface TestContext extends ConverterContext {
  readonly progress: ConversionProgress[];
}

function makeContext(signal?: AbortSignal): TestContext {
  const progress: ConversionProgress[] = [];
  return {
    signal: signal ?? new AbortController().signal,
    logger: makeLogger(),
    tracer: makeTracer(),
    reportProgress: (p) => progress.push(p),
    progress,
  };
}

function makeInput(
  sourceId: keyof typeof FORMATS,
  targetId: keyof typeof FORMATS,
  text: string,
  options: Record<string, string | number | boolean> = {},
): ConvertInput {
  const source = FORMATS[sourceId];
  const target = FORMATS[targetId];
  return {
    file: new Blob([text], { type: source.mimeTypes[0] }),
    fileName: `input.${source.extensions[0]}`,
    source,
    target,
    options,
  };
}

// --- capability / supports tests -------------------------------------------

describe("buildCapabilities", () => {
  const caps = buildCapabilities();

  it("references shared FORMATS entries (identity)", () => {
    const jsonToYaml = caps.find((c) => c.source.id === "json" && c.target.id === "yaml");
    expect(jsonToYaml?.source).toBe(FORMATS.json);
    expect(jsonToYaml?.target).toBe(FORMATS.yaml);
  });

  it("attaches the indent option to json and xml targets only", () => {
    const jsonTarget = caps.find((c) => c.source.id === "yaml" && c.target.id === "json");
    expect(jsonTarget?.options).toEqual([INDENT_OPTION]);
    const xmlTarget = caps.find((c) => c.source.id === "json" && c.target.id === "xml");
    expect(xmlTarget?.options).toEqual([INDENT_OPTION]);
  });

  it("attaches the header option to csv and tsv targets", () => {
    const csvTarget = caps.find((c) => c.source.id === "json" && c.target.id === "csv");
    expect(csvTarget?.options).toEqual([HEADER_OPTION]);
    const tsvTarget = caps.find((c) => c.source.id === "csv" && c.target.id === "tsv");
    expect(tsvTarget?.options).toEqual([HEADER_OPTION]);
  });

  it("leaves yaml/toml targets without options", () => {
    const yamlTarget = caps.find((c) => c.source.id === "json" && c.target.id === "yaml");
    expect(yamlTarget?.options).toBeUndefined();
    const tomlTarget = caps.find((c) => c.source.id === "json" && c.target.id === "toml");
    expect(tomlTarget?.options).toBeUndefined();
  });
});

describe("optionsForTarget", () => {
  it("maps targets to their descriptors", () => {
    expect(optionsForTarget("json")).toEqual([INDENT_OPTION]);
    expect(optionsForTarget("xml")).toEqual([INDENT_OPTION]);
    expect(optionsForTarget("csv")).toEqual([HEADER_OPTION]);
    expect(optionsForTarget("tsv")).toEqual([HEADER_OPTION]);
    expect(optionsForTarget("yaml")).toBeUndefined();
    expect(optionsForTarget("toml")).toBeUndefined();
  });
});

describe("asDataFormat", () => {
  it("narrows known ids and rejects others", () => {
    expect(asDataFormat("json")).toBe("json");
    expect(asDataFormat("tsv")).toBe("tsv");
    expect(asDataFormat("png")).toBeUndefined();
    expect(asDataFormat("mp3")).toBeUndefined();
  });
});

describe("DataConverter supports()", () => {
  const conv = new DataConverter();

  it("supports declared pairs and rejects unknown ones", () => {
    expect(conv.supports("json", "yaml")).toBe(true);
    expect(conv.supports("csv", "json")).toBe(true);
    expect(conv.supports("yaml", "csv")).toBe(true);
    expect(conv.supports("json", "json")).toBe(false);
    expect(conv.supports("toml", "csv")).toBe(false);
    expect(conv.supports("png", "json")).toBe(false);
  });

  it("has a stable id and name", () => {
    expect(conv.id).toBe("data-structured");
    expect(conv.name).toBe("Structured Data Converter");
  });
});

describe("dataConverters export", () => {
  it("exposes a single DataConverter instance", () => {
    expect(dataConverters).toHaveLength(1);
    expect(dataConverters[0]).toBeInstanceOf(DataConverter);
  });
});

// --- option resolution -----------------------------------------------------

describe("resolveOptions", () => {
  const conv = new DataConverter();

  it("applies defaults when no options provided", () => {
    expect(conv.resolveOptions(makeInput("json", "json", "{}"))).toEqual({
      indent: 2,
      header: true,
    });
  });

  it("clamps indent into [0,8]", () => {
    expect(conv.resolveOptions(makeInput("json", "json", "{}", { indent: 99 })).indent).toBe(8);
    expect(conv.resolveOptions(makeInput("json", "json", "{}", { indent: -5 })).indent).toBe(0);
  });

  it("reads header booleans", () => {
    expect(conv.resolveOptions(makeInput("json", "csv", "[]", { header: false })).header).toBe(
      false,
    );
  });
});

// --- convert() integration --------------------------------------------------

describe("DataConverter.convert", () => {
  const conv = new DataConverter();

  it("converts json -> yaml and produces the target mime type", async () => {
    const ctx = makeContext();
    const out = await conv.convert(makeInput("json", "yaml", '{"a":1,"b":[1,2]}'), ctx);
    expect(out.blob.type).toBe(FORMATS.yaml.mimeTypes[0]);
    const text = await out.blob.text();
    expect(text).toContain("a: 1");
    expect(out.attributes).toMatchObject({ source: "json", target: "yaml" });
  });

  it("reports progress from 0 to 1", async () => {
    const ctx = makeContext();
    await conv.convert(makeInput("json", "yaml", "{}"), ctx);
    const ratios = ctx.progress.map((p) => p.ratio);
    expect(ratios[0]).toBe(0);
    expect(ratios[ratios.length - 1]).toBe(1);
  });

  it("converts csv -> json honoring header", async () => {
    const ctx = makeContext();
    const out = await conv.convert(makeInput("csv", "json", "a,b\n1,2", { indent: 0 }), ctx);
    expect(JSON.parse(await out.blob.text())).toEqual([{ a: 1, b: 2 }]);
  });

  it("converts json -> csv with header:false", async () => {
    const ctx = makeContext();
    const out = await conv.convert(
      makeInput("json", "csv", '[{"a":1,"b":2}]', { header: false }),
      ctx,
    );
    expect(await out.blob.text()).toBe("1,2");
  });

  it("throws InvalidInputError when targeting TOML with an array root", async () => {
    const ctx = makeContext();
    await expect(conv.convert(makeInput("json", "toml", "[1,2,3]"), ctx)).rejects.toBeInstanceOf(
      InvalidInputError,
    );
  });

  it("throws InvalidInputError on malformed source", async () => {
    const ctx = makeContext();
    await expect(conv.convert(makeInput("json", "yaml", "{bad"), ctx)).rejects.toBeInstanceOf(
      InvalidInputError,
    );
  });

  it("throws ConversionCanceledError when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const ctx = makeContext(controller.signal);
    await expect(conv.convert(makeInput("json", "yaml", "{}"), ctx)).rejects.toBeInstanceOf(
      ConversionCanceledError,
    );
  });
});
