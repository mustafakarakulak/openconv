/**
 * Conversion engine — the application's central use case.
 *
 * Orchestrates a single conversion: resolves the converter, applies option
 * defaults, drives the converter inside a fully-instrumented span, and maps
 * any failure onto the domain error hierarchy. It owns observability and
 * cancellation so converters can stay small and pure.
 */
import type { ConversionRequest, ConversionResult, OutputFile } from "@/core/domain/conversion";
import {
  ConversionCanceledError,
  ConversionFailedError,
  UnsupportedConversionError,
  isOpenConvError,
  toErrorMessage,
} from "@/core/domain/errors";
import type { ConverterContext, ConversionProgress } from "@/core/ports/converter";
import { childTracer, type Logger, type Tracer } from "@/core/ports/observability";
import { deriveOutputName } from "@/lib/filename";
import type { ConverterRegistry } from "./converter-registry";
import { resolveOptions } from "./resolve-options";

export interface ConversionEngineDeps {
  readonly registry: ConverterRegistry;
  readonly tracer: Tracer;
  readonly logger: Logger;
}

export interface ConvertOptions {
  /** Cancels the conversion when aborted. */
  readonly signal?: AbortSignal;
  /** Receives progress updates emitted by the converter. */
  readonly onProgress?: (progress: ConversionProgress) => void;
}

export class ConversionEngine {
  constructor(private readonly deps: ConversionEngineDeps) {}

  async convert(request: ConversionRequest, options: ConvertOptions = {}): Promise<ConversionResult> {
    const { registry, tracer } = this.deps;
    const { jobId, input, target } = request;
    const signal = options.signal ?? new AbortController().signal;

    return tracer.withSpan(
      "conversion.execute",
      async (span): Promise<ConversionResult> => {
        const log = span.logger;
        span.setAttributes({
          "openconv.job.id": jobId,
          "openconv.source.format": input.format.id,
          "openconv.target.format": target.id,
          "openconv.input.name": input.name,
          "openconv.input.size_bytes": input.size,
          "openconv.input.kind": input.format.kind,
        });
        log.info("conversion.started", {
          "openconv.source.format": input.format.id,
          "openconv.target.format": target.id,
          "openconv.input.size_bytes": input.size,
        });

        if (signal.aborted) {
          log.warn("conversion.canceled", { "openconv.reason": "aborted_before_start" });
          throw new ConversionCanceledError();
        }

        const converter = registry.getConverter(input.format.id, target.id);
        if (!converter) {
          log.error("conversion.unsupported", undefined, {
            "openconv.source.format": input.format.id,
            "openconv.target.format": target.id,
          });
          throw new UnsupportedConversionError(input.format.id, target.id);
        }
        span.setAttribute("openconv.converter.id", converter.id);

        const capability = registry.getCapability(input.format.id, target.id);
        const resolvedOptions = resolveOptions(capability, request.options);

        const context: ConverterContext = {
          signal,
          logger: log.child({ "openconv.converter.id": converter.id }),
          tracer: childTracer(tracer, span),
          reportProgress: (progress) => {
            try {
              options.onProgress?.(progress);
            } catch (callbackError) {
              log.warn("conversion.progress_callback_failed", {
                "error.message": toErrorMessage(callbackError),
              });
            }
          },
        };

        const startedAt = performance.now();
        try {
          const produced = await converter.convert(
            {
              file: input.data,
              fileName: input.name,
              source: input.format,
              target,
              options: resolvedOptions,
            },
            context,
          );

          if (signal.aborted) throw new ConversionCanceledError();

          const durationMs = performance.now() - startedAt;
          const output: OutputFile = {
            name: deriveOutputName(input.name, target),
            format: target,
            blob: produced.blob,
            size: produced.blob.size,
          };

          if (produced.attributes) span.setAttributes(produced.attributes);
          span.setAttributes({
            "openconv.output.size_bytes": output.size,
            "openconv.duration_ms": Math.round(durationMs),
          });
          span.setStatus("ok");
          log.info("conversion.succeeded", {
            "openconv.output.size_bytes": output.size,
            "openconv.duration_ms": Math.round(durationMs),
          });

          return { jobId, output, durationMs, traceId: span.traceId };
        } catch (error) {
          const durationMs = Math.round(performance.now() - startedAt);

          if (signal.aborted || error instanceof ConversionCanceledError) {
            const canceled =
              error instanceof ConversionCanceledError ? error : new ConversionCanceledError();
            log.warn("conversion.canceled", { "openconv.duration_ms": durationMs });
            // Re-thrown so withSpan records it; status surfaced for support.
            throw canceled;
          }

          const failure = isOpenConvError(error)
            ? error
            : new ConversionFailedError(`Conversion failed: ${toErrorMessage(error)}`, {
                cause: error,
                context: {
                  source: input.format.id,
                  target: target.id,
                  converter: converter.id,
                },
              });
          log.error("conversion.failed", failure, {
            "openconv.duration_ms": durationMs,
            "openconv.error.code": failure.code,
          });
          throw failure;
        }
      },
      { kind: "internal", attributes: { "openconv.job.id": jobId } },
    );
  }
}
