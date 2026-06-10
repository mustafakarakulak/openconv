import { describe, it, expect } from "vitest";
import { FORMATS } from "@/core/domain/format";
import { ConversionCanceledError } from "@/core/domain/errors";
import type { ConversionProgress, ConvertInput, ConverterContext } from "@/core/ports/converter";
import type { Logger, Span, Tracer } from "@/core/ports/observability";
import { MediaConverter } from "./media-converter";
import { mediaConverters } from "./index";

// --- Minimal self-contained observability fakes (no infra coupling). -------

function fakeLogger(): Logger {
  const logger: Logger = {
    debug() {},
    info() {},
    warn() {},
    error() {},
    child() {
      return logger;
    },
  };
  return logger;
}

function fakeSpan(): Span {
  return {
    traceId: "0".repeat(32),
    spanId: "0".repeat(16),
    logger: fakeLogger(),
    setAttribute() {},
    setAttributes() {},
    addEvent() {},
    recordError() {},
    setStatus() {},
    end() {},
  };
}

function fakeTracer(): Tracer {
  const span = fakeSpan();
  return {
    startSpan() {
      return span;
    },
    async withSpan(_name, fn) {
      return fn(span);
    },
  };
}

function makeContext(signal: AbortSignal): {
  ctx: ConverterContext;
  progress: ConversionProgress[];
} {
  const progress: ConversionProgress[] = [];
  const ctx: ConverterContext = {
    signal,
    logger: fakeLogger(),
    tracer: fakeTracer(),
    reportProgress(p) {
      progress.push(p);
    },
  };
  return { ctx, progress };
}

function makeInput(): ConvertInput {
  return {
    file: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }),
    fileName: "clip.wav",
    source: FORMATS.wav,
    target: FORMATS.mp3,
    options: {},
  };
}

describe("mediaConverters export", () => {
  it("exports exactly one MediaConverter instance", () => {
    expect(mediaConverters).toHaveLength(1);
    expect(mediaConverters[0]).toBeInstanceOf(MediaConverter);
  });

  it("has a stable id and name", () => {
    const c = mediaConverters[0];
    expect(c?.id).toBe("media-ffmpeg");
    expect(c?.name).toContain("ffmpeg");
  });
});

describe("MediaConverter.supports", () => {
  const c = new MediaConverter();

  it("supports representative audio and video pairs", () => {
    expect(c.supports("wav", "mp3")).toBe(true);
    expect(c.supports("mp3", "wav")).toBe(true);
    expect(c.supports("flac", "ogg")).toBe(true);
    expect(c.supports("mp4", "webm")).toBe(true);
    expect(c.supports("mov", "mp3")).toBe(true);
    expect(c.supports("mp4", "gif")).toBe(true);
    expect(c.supports("avi", "wav")).toBe(true);
  });

  it("rejects identity and out-of-scope pairs", () => {
    expect(c.supports("mp3", "mp3")).toBe(false);
    expect(c.supports("mp4", "mp4")).toBe(false);
    expect(c.supports("mp3", "flac")).toBe(false); // flac not a target
    expect(c.supports("wav", "mkv")).toBe(false); // audio cannot become video
    expect(c.supports("png", "jpeg")).toBe(false); // unrelated kinds
    expect(c.supports("mp3", "gif")).toBe(false); // gif only from video
  });
});

describe("MediaConverter.convert cancellation", () => {
  it("throws ConversionCanceledError before touching ffmpeg when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const { ctx } = makeContext(controller.signal);
    const c = new MediaConverter();

    await expect(c.convert(makeInput(), ctx)).rejects.toBeInstanceOf(ConversionCanceledError);
  });
});
