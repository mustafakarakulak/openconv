/**
 * No-op observability implementations.
 *
 * Installed on the server (no DOM) and whenever telemetry is disabled, so the
 * rest of the app can depend on the ports unconditionally without null checks.
 */
import type { Logger, Span, SpanOptions, SpanStatusCode, Tracer } from "@/core/ports/observability";

const INVALID_TRACE_ID = "00000000000000000000000000000000";
const INVALID_SPAN_ID = "0000000000000000";

export class NoopLogger implements Logger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  child(): Logger {
    return this;
  }
}

const NOOP_LOGGER = new NoopLogger();

export class NoopSpan implements Span {
  readonly traceId = INVALID_TRACE_ID;
  readonly spanId = INVALID_SPAN_ID;
  readonly logger: Logger = NOOP_LOGGER;
  setAttribute(): void {}
  setAttributes(): void {}
  addEvent(): void {}
  recordError(): void {}
  setStatus(_code: SpanStatusCode, _message?: string): void {}
  end(): void {}
}

const NOOP_SPAN = new NoopSpan();

export class NoopTracer implements Tracer {
  startSpan(_name: string, _options?: SpanOptions): Span {
    return NOOP_SPAN;
  }
  async withSpan<T>(
    _name: string,
    fn: (span: Span) => Promise<T> | T,
    _options?: SpanOptions,
  ): Promise<T> {
    return await fn(NOOP_SPAN);
  }
}
