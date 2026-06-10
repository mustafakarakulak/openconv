import { describe, expect, it, vi } from "vitest";
import type { ConversionRequest, InputFile } from "@/core/domain/conversion";
import {
  ConversionCanceledError,
  ConversionFailedError,
  InputTooLargeError,
  UnsupportedConversionError,
} from "@/core/domain/errors";
import { MAX_INPUT_BYTES } from "./limits";
import { FORMATS } from "@/core/domain/format";
import type { ConvertInput, ConvertOutput, ConverterContext } from "@/core/ports/converter";
import { NoopLogger, NoopTracer } from "@/infrastructure/observability/noop";
import { BaseConverter } from "./base-converter";
import { ConversionEngine } from "./conversion-engine";
import { ConverterRegistry } from "./converter-registry";

class StubConverter extends BaseConverter {
  readonly id = "stub";
  readonly name = "Stub";
  readonly capabilities = [{ source: FORMATS.json, target: FORMATS.yaml }];

  constructor(
    private readonly behaviour: (
      input: ConvertInput,
      ctx: ConverterContext,
    ) => Promise<ConvertOutput>,
  ) {
    super();
  }

  convert(input: ConvertInput, ctx: ConverterContext): Promise<ConvertOutput> {
    return this.behaviour(input, ctx);
  }
}

function makeEngine(converter: StubConverter) {
  const registry = new ConverterRegistry();
  registry.register(converter);
  return new ConversionEngine({ registry, tracer: new NoopTracer(), logger: new NoopLogger() });
}

function makeRequest(overrides: Partial<ConversionRequest> = {}): ConversionRequest {
  const input: InputFile = {
    id: "job-1",
    name: "data.json",
    size: 4,
    format: FORMATS.json,
    data: new Blob(["{}"], { type: "application/json" }),
  };
  return { jobId: "job-1", input, target: FORMATS.yaml, options: {}, ...overrides };
}

describe("ConversionEngine", () => {
  it("runs the converter and returns a derived output file", async () => {
    const engine = makeEngine(
      new StubConverter(async () => ({ blob: new Blob(["a: 1\n"], { type: "application/yaml" }) })),
    );

    const result = await engine.convert(makeRequest());

    expect(result.output.name).toBe("data.yaml");
    expect(result.output.format).toBe(FORMATS.yaml);
    expect(result.output.size).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.traceId).toBe("string");
  });

  it("forwards converter progress to the onProgress callback", async () => {
    const engine = makeEngine(
      new StubConverter(async (_input, ctx) => {
        ctx.reportProgress({ ratio: 0.5, message: "halfway" });
        return { blob: new Blob(["x"]) };
      }),
    );
    const onProgress = vi.fn();

    await engine.convert(makeRequest(), { onProgress });

    expect(onProgress).toHaveBeenCalledWith({ ratio: 0.5, message: "halfway" });
  });

  it("throws UnsupportedConversionError when no converter handles the pair", async () => {
    const engine = makeEngine(new StubConverter(async () => ({ blob: new Blob() })));

    await expect(engine.convert(makeRequest({ target: FORMATS.png }))).rejects.toBeInstanceOf(
      UnsupportedConversionError,
    );
  });

  it("wraps unexpected converter errors as ConversionFailedError", async () => {
    const engine = makeEngine(
      new StubConverter(async () => {
        throw new Error("boom");
      }),
    );

    await expect(engine.convert(makeRequest())).rejects.toBeInstanceOf(ConversionFailedError);
  });

  it("rejects input that exceeds the per-kind size limit", async () => {
    const engine = makeEngine(new StubConverter(async () => ({ blob: new Blob(["a: 1\n"]) })));
    const base = makeRequest();
    const request = makeRequest({
      input: { ...base.input, size: MAX_INPUT_BYTES.data + 1 },
    });

    await expect(engine.convert(request)).rejects.toBeInstanceOf(InputTooLargeError);
  });

  it("throws ConversionCanceledError when the signal is already aborted", async () => {
    const engine = makeEngine(new StubConverter(async () => ({ blob: new Blob() })));
    const controller = new AbortController();
    controller.abort();

    await expect(
      engine.convert(makeRequest(), { signal: controller.signal }),
    ).rejects.toBeInstanceOf(ConversionCanceledError);
  });
});
