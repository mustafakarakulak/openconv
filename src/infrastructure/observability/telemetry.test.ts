import { SpanStatusCode } from "@opentelemetry/api";
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  StackContextManager,
  WebTracerProvider,
} from "@opentelemetry/sdk-trace-web";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LogLevel } from "@/core/ports/observability";
import { OtelLogger } from "./otel-logger";
import { OtelTracer } from "./otel-tracer";

function setup(minLevel: LogLevel = "debug") {
  const spanExporter = new InMemorySpanExporter();
  const tracerProvider = new WebTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(spanExporter)],
  });
  tracerProvider.register({ contextManager: new StackContextManager() });

  const logExporter = new InMemoryLogRecordExporter();
  const loggerProvider = new LoggerProvider({
    processors: [new SimpleLogRecordProcessor(logExporter)],
  });

  const baseLogger = new OtelLogger({
    apiLogger: loggerProvider.getLogger("test"),
    minLevel,
    mirrorConsole: false,
  });
  const tracer = new OtelTracer(tracerProvider.getTracer("test"), (ctx) =>
    baseLogger.withContext(ctx),
  );

  return {
    tracer,
    baseLogger,
    spanExporter,
    logExporter,
    shutdown: async () => {
      await tracerProvider.shutdown();
      await loggerProvider.shutdown();
    },
  };
}

describe("OpenTelemetry pipeline", () => {
  let env: ReturnType<typeof setup>;

  beforeEach(() => {
    env = setup();
  });

  afterEach(async () => {
    await env.shutdown();
  });

  it("correlates a span-scoped log record with its trace and span id", () => {
    const span = env.tracer.startSpan("op", { attributes: { "test.flag": true } });
    span.logger.info("hello", { foo: "bar" });
    span.setStatus("ok");
    span.end();

    const records = env.logExporter.getFinishedLogRecords();
    expect(records).toHaveLength(1);
    const record = records[0]!;
    expect(record.body).toBe("hello");
    expect(record.severityText).toBe("INFO");
    expect(record.attributes.foo).toBe("bar");
    expect(record.spanContext?.traceId).toBe(span.traceId);
    expect(record.spanContext?.spanId).toBe(span.spanId);

    const spans = env.spanExporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]!.name).toBe("op");
  });

  it("links an explicit child span into the parent's trace", async () => {
    let parentTraceId = "";
    let childTraceId = "";
    await env.tracer.withSpan("parent", async (parent) => {
      parentTraceId = parent.traceId;
      await env.tracer.withSpan(
        "child",
        async (child) => {
          childTraceId = child.traceId;
        },
        { parent },
      );
    });

    expect(childTraceId).toBe(parentTraceId);
    expect(env.spanExporter.getFinishedSpans()).toHaveLength(2);
  });

  it("gives unrelated root spans distinct trace ids", () => {
    const a = env.tracer.startSpan("a");
    const b = env.tracer.startSpan("b");
    expect(a.traceId).not.toBe(b.traceId);
    a.end();
    b.end();
  });

  it("records the exception and sets ERROR status when withSpan throws", async () => {
    await expect(
      env.tracer.withSpan("fails", async () => {
        throw new Error("nope");
      }),
    ).rejects.toThrow("nope");

    const span = env.spanExporter.getFinishedSpans().find((s) => s.name === "fails")!;
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.events.some((event) => event.name === "exception")).toBe(true);
  });

  it("attaches OTel exception attributes via logger.error", () => {
    const span = env.tracer.startSpan("err");
    span.logger.error("it failed", new Error("bad thing"));
    span.end();

    const record = env.logExporter.getFinishedLogRecords().at(-1)!;
    expect(record.severityText).toBe("ERROR");
    expect(record.attributes["exception.type"]).toBe("Error");
    expect(record.attributes["exception.message"]).toBe("bad thing");
  });
});

describe("OtelLogger level filtering", () => {
  it("drops records below the configured minimum level", async () => {
    const env = setup("warn");
    env.baseLogger.info("ignored");
    env.baseLogger.warn("kept");

    const bodies = env.logExporter.getFinishedLogRecords().map((r) => r.body);
    expect(bodies).toEqual(["kept"]);
    await env.shutdown();
  });
});
