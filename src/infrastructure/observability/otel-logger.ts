/**
 * OpenTelemetry-backed structured logger ({@link Logger} port implementation).
 *
 * Every record is emitted through the OTel Logs API and, where a bound span
 * context exists, correlated with the active trace (traceId/spanId). An
 * optional console mirror prints a compact, trace-tagged line in development.
 */
import { context as otelContext, trace, type Context } from "@opentelemetry/api";
import { SeverityNumber, type Logger as ApiLogger } from "@opentelemetry/api-logs";
import type { Attributes, LogLevel, Logger } from "@/core/ports/observability";
import { cleanAttributes, errorAttributes, type FlatAttributes } from "./attributes";

const SEVERITY_NUMBER: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

/** Numeric ordering used to apply the minimum-level threshold. */
const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface OtelLoggerOptions {
  readonly apiLogger: ApiLogger;
  readonly minLevel: LogLevel;
  readonly mirrorConsole: boolean;
  readonly baseAttributes?: FlatAttributes;
  /** OTel context carrying the span this logger is correlated with. */
  readonly boundContext?: Context;
}

export class OtelLogger implements Logger {
  private readonly apiLogger: ApiLogger;
  private readonly minLevel: LogLevel;
  private readonly mirrorConsole: boolean;
  private readonly baseAttributes: FlatAttributes;
  private readonly boundContext: Context | undefined;

  constructor(options: OtelLoggerOptions) {
    this.apiLogger = options.apiLogger;
    this.minLevel = options.minLevel;
    this.mirrorConsole = options.mirrorConsole;
    this.baseAttributes = options.baseAttributes ?? {};
    this.boundContext = options.boundContext;
  }

  debug(message: string, attributes?: Attributes): void {
    this.emit("debug", message, cleanAttributes(attributes));
  }

  info(message: string, attributes?: Attributes): void {
    this.emit("info", message, cleanAttributes(attributes));
  }

  warn(message: string, attributes?: Attributes): void {
    this.emit("warn", message, cleanAttributes(attributes));
  }

  error(message: string, error?: unknown, attributes?: Attributes): void {
    this.emit("error", message, {
      ...cleanAttributes(attributes),
      ...errorAttributes(error),
    });
  }

  child(attributes: Attributes): Logger {
    return new OtelLogger({
      apiLogger: this.apiLogger,
      minLevel: this.minLevel,
      mirrorConsole: this.mirrorConsole,
      baseAttributes: { ...this.baseAttributes, ...cleanAttributes(attributes) },
      boundContext: this.boundContext,
    });
  }

  /** Returns a logger correlated with the given span context (internal API). */
  withContext(boundContext: Context): OtelLogger {
    return new OtelLogger({
      apiLogger: this.apiLogger,
      minLevel: this.minLevel,
      mirrorConsole: this.mirrorConsole,
      baseAttributes: this.baseAttributes,
      boundContext,
    });
  }

  private emit(level: LogLevel, message: string, attributes: FlatAttributes): void {
    if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[this.minLevel]) return;

    const ctx = this.boundContext ?? otelContext.active();
    const merged: FlatAttributes = { ...this.baseAttributes, ...attributes };

    this.apiLogger.emit({
      severityNumber: SEVERITY_NUMBER[level],
      severityText: level.toUpperCase(),
      body: message,
      attributes: merged,
      context: ctx,
      timestamp: Date.now(),
    });

    if (this.mirrorConsole) this.mirror(level, message, merged, ctx);
  }

  private mirror(
    level: LogLevel,
    message: string,
    attributes: FlatAttributes,
    ctx: Context,
  ): void {
    const spanContext = trace.getSpanContext(ctx);
    const tag = spanContext ? `[trace ${spanContext.traceId.slice(0, 8)}]` : "[trace -------]";
    const line = `${tag} ${message}`;
    const hasAttrs = Object.keys(attributes).length > 0;
    /* eslint-disable no-console */
    switch (level) {
      case "debug":
        hasAttrs ? console.debug(line, attributes) : console.debug(line);
        break;
      case "warn":
        hasAttrs ? console.warn(line, attributes) : console.warn(line);
        break;
      case "error":
        hasAttrs ? console.error(line, attributes) : console.error(line);
        break;
      default:
        hasAttrs ? console.info(line, attributes) : console.info(line);
    }
    /* eslint-enable no-console */
  }
}
