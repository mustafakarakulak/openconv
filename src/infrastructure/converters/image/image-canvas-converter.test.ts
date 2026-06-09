import { describe, it, expect, vi } from "vitest";
import { InvalidInputError } from "@/core/domain/errors";
import type { ConversionOptions } from "@/core/domain/conversion";
import type { FileFormat } from "@/core/domain/format";
import type {
  ConversionProgress,
  ConvertInput,
  ConverterContext,
} from "@/core/ports/converter";
import type { Logger, Span, Tracer } from "@/core/ports/observability";
import { ImageCanvasConverter } from "./image-canvas-converter";
import { imageConverters } from "./index";

function makeLogger(): Logger {
  const logger: Logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => logger,
  };
  return logger;
}

function makeSpan(logger: Logger): Span {
  return {
    traceId: "0".repeat(32),
    spanId: "0".repeat(16),
    logger,
    setAttribute: vi.fn(),
    setAttributes: vi.fn(),
    addEvent: vi.fn(),
    recordError: vi.fn(),
    setStatus: vi.fn(),
    end: vi.fn(),
  };
}

function makeTracer(logger: Logger): Tracer {
  return {
    startSpan: () => makeSpan(logger),
    withSpan: async (_name, fn) => fn(makeSpan(logger)),
  };
}

function makeContext(signal?: AbortSignal): {
  ctx: ConverterContext;
  progress: ConversionProgress[];
} {
  const logger = makeLogger();
  const progress: ConversionProgress[] = [];
  const ctx: ConverterContext = {
    signal: signal ?? new AbortController().signal,
    logger,
    tracer: makeTracer(logger),
    reportProgress: (p) => progress.push(p),
  };
  return { ctx, progress };
}

function makeInput(
  source: FileFormat,
  target: FileFormat,
  file: Blob,
  options: ConversionOptions = {},
): ConvertInput {
  return {
    file,
    fileName: `sample.${source.extensions[0] ?? "bin"}`,
    source,
    target,
    options,
  };
}

const png: FileFormat = {
  id: "png",
  label: "PNG",
  kind: "image",
  mimeTypes: ["image/png"],
  extensions: ["png"],
  description: "",
};
const jpeg: FileFormat = {
  id: "jpeg",
  label: "JPEG",
  kind: "image",
  mimeTypes: ["image/jpeg"],
  extensions: ["jpg"],
  description: "",
};

describe("ImageCanvasConverter metadata", () => {
  const c = new ImageCanvasConverter();

  it("has stable id and name", () => {
    expect(c.id).toBe("image-canvas");
    expect(c.name).toBe("Image (Canvas)");
  });

  it("exposes the full capability matrix", () => {
    expect(c.capabilities).toHaveLength(21);
  });
});

describe("ImageCanvasConverter.supports", () => {
  const c = new ImageCanvasConverter();

  it("supports every decode source -> encodable target", () => {
    for (const src of ["png", "jpeg", "webp", "gif", "bmp", "avif", "ico", "svg"]) {
      for (const tgt of ["png", "jpeg", "webp"]) {
        if (src === tgt) continue;
        expect(c.supports(src, tgt)).toBe(true);
      }
    }
  });

  it("rejects identity conversions", () => {
    expect(c.supports("png", "png")).toBe(false);
    expect(c.supports("jpeg", "jpeg")).toBe(false);
  });

  it("rejects decode-only target formats", () => {
    expect(c.supports("png", "gif")).toBe(false);
    expect(c.supports("png", "bmp")).toBe(false);
    expect(c.supports("png", "avif")).toBe(false);
    expect(c.supports("png", "ico")).toBe(false);
    expect(c.supports("png", "svg")).toBe(false);
  });

  it("rejects unknown formats", () => {
    expect(c.supports("png", "mp3")).toBe(false);
    expect(c.supports("totallyfake", "png")).toBe(false);
  });
});

describe("ImageCanvasConverter.convert error paths", () => {
  const c = new ImageCanvasConverter();

  it("rejects an empty file before touching the canvas", async () => {
    const { ctx } = makeContext();
    const input = makeInput(png, jpeg, new Blob([], { type: "image/png" }));
    await expect(c.convert(input, ctx)).rejects.toBeInstanceOf(InvalidInputError);
  });

  it("throws if the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const { ctx } = makeContext(controller.signal);
    const input = makeInput(png, jpeg, new Blob([new Uint8Array([1, 2, 3])]));
    await expect(c.convert(input, ctx)).rejects.toBeTruthy();
  });
});

describe("imageConverters export", () => {
  it("exports exactly one converter instance", () => {
    expect(Array.isArray(imageConverters)).toBe(true);
    expect(imageConverters).toHaveLength(1);
    expect(imageConverters[0]).toBeInstanceOf(ImageCanvasConverter);
  });

  it("the exported instance reports the canvas id", () => {
    expect(imageConverters[0]?.id).toBe("image-canvas");
  });
});
