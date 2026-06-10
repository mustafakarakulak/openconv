/**
 * Telemetry bootstrap.
 *
 * Wires the OpenTelemetry Web tracer and Logs providers, registers exporters
 * based on configuration, and returns the framework-agnostic {@link Tracer}
 * and {@link Logger} ports the rest of the app consumes. On the server, or
 * when telemetry is disabled, a no-op pipeline is returned instead.
 */
import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { defaultResource, resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  type LogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  StackContextManager,
  WebTracerProvider,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-web";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import type { Logger, Tracer } from "@/core/ports/observability";
import { readObservabilityConfig, type ObservabilityConfig } from "./config";
import { NoopLogger, NoopTracer } from "./noop";
import { OtelLogger } from "./otel-logger";
import { OtelTracer } from "./otel-tracer";

export interface Telemetry {
  readonly tracer: Tracer;
  readonly logger: Logger;
  /** Flushes and shuts down all exporters. */
  shutdown(): Promise<void>;
}

const SERVICE_VERSION = "0.1.0";
const INSTRUMENTATION_SCOPE = "openconv";
/** Standard OTel resource attribute key (stable, not yet a constant export). */
const ATTR_DEPLOYMENT_ENVIRONMENT = "deployment.environment.name";

function noopTelemetry(): Telemetry {
  return {
    tracer: new NoopTracer(),
    logger: new NoopLogger(),
    shutdown: async () => {},
  };
}

export function bootstrapTelemetry(
  config: ObservabilityConfig = readObservabilityConfig(),
): Telemetry {
  // No DOM (SSR/prerender) or explicitly disabled → install a no-op pipeline.
  if (!config.enabled || typeof window === "undefined") {
    return noopTelemetry();
  }

  const resource = defaultResource().merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
      [ATTR_DEPLOYMENT_ENVIRONMENT]: config.environment,
    }),
  );

  // --- Tracing -------------------------------------------------------------
  const spanProcessors: SpanProcessor[] = [];
  if (config.console) {
    spanProcessors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }
  if (config.otlpEndpoint) {
    spanProcessors.push(
      new BatchSpanProcessor(new OTLPTraceExporter({ url: `${config.otlpEndpoint}/v1/traces` })),
    );
  }

  const tracerProvider = new WebTracerProvider({ resource, spanProcessors });
  tracerProvider.register({ contextManager: new StackContextManager() });

  // --- Logging -------------------------------------------------------------
  // Console output is handled by OtelLogger's mirror (trace-tagged, compact),
  // so we only register a network processor here when an endpoint is set.
  const logProcessors: LogRecordProcessor[] = [];
  if (config.otlpEndpoint) {
    logProcessors.push(
      new BatchLogRecordProcessor(new OTLPLogExporter({ url: `${config.otlpEndpoint}/v1/logs` })),
    );
  }

  const loggerProvider = new LoggerProvider({ resource, processors: logProcessors });
  logs.setGlobalLoggerProvider(loggerProvider);

  const apiLogger = loggerProvider.getLogger(INSTRUMENTATION_SCOPE, SERVICE_VERSION);
  const baseLogger = new OtelLogger({
    apiLogger,
    minLevel: config.logLevel,
    mirrorConsole: config.console,
  });

  const apiTracer = tracerProvider.getTracer(INSTRUMENTATION_SCOPE, SERVICE_VERSION);
  const tracer = new OtelTracer(apiTracer, (context) => baseLogger.withContext(context));

  baseLogger.info("telemetry.initialized", {
    "openconv.service.name": config.serviceName,
    "openconv.environment": config.environment,
    "openconv.otlp.enabled": config.otlpEndpoint !== null,
  });

  return {
    tracer,
    logger: baseLogger,
    shutdown: async () => {
      await Promise.allSettled([tracerProvider.shutdown(), loggerProvider.shutdown()]);
    },
  };
}
