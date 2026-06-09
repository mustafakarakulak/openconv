/**
 * Observability ports.
 *
 * These are framework-agnostic abstractions over tracing and structured
 * logging. The domain and application layers depend ONLY on these interfaces;
 * the concrete OpenTelemetry-backed implementations live in
 * `infrastructure/observability`. This keeps the core free of any vendor SDK
 * and makes the whole pipeline trivially testable with in-memory fakes.
 *
 * The design follows the OpenTelemetry data model: every log record is
 * correlated with the active span via its `traceId`/`spanId`, severity is
 * expressed on the standard scale, and attributes are flat key/value pairs.
 */

/** Severity levels, ordered. Mirrors a coarse view of OTel SeverityNumber. */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Flat attribute bag attached to spans and log records. Values are limited to
 * the primitives OpenTelemetry accepts; `undefined` entries are dropped by
 * implementations so callers can spread optionals freely.
 */
export type Attributes = Record<string, string | number | boolean | undefined>;

/**
 * Structured logger. Every record is, where possible, correlated with the
 * surrounding trace. Obtain a span-correlated logger from {@link Span.logger}.
 */
export interface Logger {
  debug(message: string, attributes?: Attributes): void;
  info(message: string, attributes?: Attributes): void;
  warn(message: string, attributes?: Attributes): void;
  /**
   * Logs at ERROR severity. The optional `error` is unwrapped into
   * `exception.type` / `exception.message` / `exception.stacktrace`
   * attributes per OTel semantic conventions.
   */
  error(message: string, error?: unknown, attributes?: Attributes): void;
  /** Returns a child logger that merges `attributes` into every record. */
  child(attributes: Attributes): Logger;
}

export type SpanStatusCode = "unset" | "ok" | "error";

export type SpanKind = "internal" | "client" | "server" | "producer" | "consumer";

export interface SpanOptions {
  readonly attributes?: Attributes;
  readonly kind?: SpanKind;
  /**
   * Explicit parent span. Provided because the browser StackContextManager
   * does not propagate context across `await` boundaries — passing the parent
   * explicitly guarantees deterministic span linkage in async code.
   */
  readonly parent?: Span;
}

/**
 * A single unit of work in a trace. Always end exactly once; prefer
 * {@link Tracer.withSpan} which handles ending and error recording for you.
 */
export interface Span {
  /** W3C trace id (32-char lowercase hex). Stable across the whole trace. */
  readonly traceId: string;
  /** W3C span id (16-char lowercase hex). Unique to this span. */
  readonly spanId: string;
  /** A logger whose every record is correlated with THIS span. */
  readonly logger: Logger;

  setAttribute(key: string, value: string | number | boolean): void;
  setAttributes(attributes: Attributes): void;
  addEvent(name: string, attributes?: Attributes): void;
  /** Records an exception event and (does not) change status — call setStatus separately. */
  recordError(error: unknown): void;
  setStatus(code: SpanStatusCode, message?: string): void;
  end(): void;
}

export interface Tracer {
  /** Starts a span. The caller owns its lifetime and must call `end()`. */
  startSpan(name: string, options?: SpanOptions): Span;
  /**
   * Runs `fn` inside a new span. The span is ended automatically; thrown
   * errors are recorded and the status set to error before re-throwing.
   */
  withSpan<T>(name: string, fn: (span: Span) => Promise<T> | T, options?: SpanOptions): Promise<T>;
}

/**
 * Returns a tracer view whose spans are, by default, children of `parent`.
 * Used by the conversion engine to hand converters a tracer that nests under
 * the conversion span without relying on async context propagation.
 */
export function childTracer(tracer: Tracer, parent: Span): Tracer {
  return {
    startSpan: (name, options) =>
      tracer.startSpan(name, { ...options, parent: options?.parent ?? parent }),
    withSpan: (name, fn, options) =>
      tracer.withSpan(name, fn, { ...options, parent: options?.parent ?? parent }),
  };
}
