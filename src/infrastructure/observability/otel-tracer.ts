/**
 * OpenTelemetry-backed {@link Tracer}/{@link Span} port implementation.
 *
 * Bridges the framework-agnostic tracing port onto the OTel API. Parent spans
 * are linked explicitly (via {@link SpanOptions.parent}) rather than relying on
 * async context propagation, which the browser StackContextManager cannot do
 * across `await` boundaries.
 */
import {
  context as otelContext,
  SpanKind as OtelSpanKind,
  SpanStatusCode as OtelSpanStatusCode,
  trace,
  type Context,
  type Span as ApiSpan,
  type Tracer as ApiTracer,
} from "@opentelemetry/api";
import type {
  Attributes,
  Logger,
  Span,
  SpanKind,
  SpanOptions,
  SpanStatusCode,
  Tracer,
} from "@/core/ports/observability";
import { cleanAttributes } from "./attributes";

function mapKind(kind: SpanKind | undefined): OtelSpanKind {
  switch (kind) {
    case "client":
      return OtelSpanKind.CLIENT;
    case "server":
      return OtelSpanKind.SERVER;
    case "producer":
      return OtelSpanKind.PRODUCER;
    case "consumer":
      return OtelSpanKind.CONSUMER;
    default:
      return OtelSpanKind.INTERNAL;
  }
}

function mapStatus(code: SpanStatusCode): OtelSpanStatusCode {
  switch (code) {
    case "ok":
      return OtelSpanStatusCode.OK;
    case "error":
      return OtelSpanStatusCode.ERROR;
    default:
      return OtelSpanStatusCode.UNSET;
  }
}

export class OtelSpanAdapter implements Span {
  constructor(
    /** The underlying OTel span (exposed for parent linkage by the tracer). */
    readonly raw: ApiSpan,
    readonly logger: Logger,
  ) {}

  get traceId(): string {
    return this.raw.spanContext().traceId;
  }

  get spanId(): string {
    return this.raw.spanContext().spanId;
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.raw.setAttribute(key, value);
  }

  setAttributes(attributes: Attributes): void {
    this.raw.setAttributes(cleanAttributes(attributes));
  }

  addEvent(name: string, attributes?: Attributes): void {
    this.raw.addEvent(name, attributes ? cleanAttributes(attributes) : undefined);
  }

  recordError(error: unknown): void {
    if (error instanceof Error) {
      this.raw.recordException(error);
    } else {
      this.raw.recordException({ message: String(error) });
    }
  }

  setStatus(code: SpanStatusCode, message?: string): void {
    this.raw.setStatus(message ? { code: mapStatus(code), message } : { code: mapStatus(code) });
  }

  end(): void {
    this.raw.end();
  }
}

export class OtelTracer implements Tracer {
  constructor(
    private readonly tracer: ApiTracer,
    /** Produces a span-correlated logger for a given OTel context. */
    private readonly loggerFor: (context: Context) => Logger,
  ) {}

  startSpan(name: string, options?: SpanOptions): Span {
    const parent = options?.parent;
    const parentContext =
      parent instanceof OtelSpanAdapter
        ? trace.setSpan(otelContext.active(), parent.raw)
        : otelContext.active();

    const raw = this.tracer.startSpan(
      name,
      {
        kind: mapKind(options?.kind),
        ...(options?.attributes ? { attributes: cleanAttributes(options.attributes) } : {}),
      },
      parentContext,
    );

    const spanContext = trace.setSpan(parentContext, raw);
    return new OtelSpanAdapter(raw, this.loggerFor(spanContext));
  }

  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T,
    options?: SpanOptions,
  ): Promise<T> {
    const span = this.startSpan(name, options);
    const activeContext =
      span instanceof OtelSpanAdapter
        ? trace.setSpan(otelContext.active(), span.raw)
        : otelContext.active();

    try {
      return await otelContext.with(activeContext, () => fn(span));
    } catch (error) {
      span.recordError(error);
      span.setStatus("error", error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      span.end();
    }
  }
}
