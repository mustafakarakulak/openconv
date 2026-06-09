/**
 * Reads the client-side observability configuration from NEXT_PUBLIC_* env
 * vars. Next.js statically inlines these at build time, so every access is a
 * literal property read (no dynamic keys).
 */
import type { LogLevel } from "@/core/ports/observability";

export interface ObservabilityConfig {
  /** Master switch; when false a no-op pipeline is installed. */
  readonly enabled: boolean;
  /** Logical service name (service.name). */
  readonly serviceName: string;
  /** Deployment environment (deployment.environment.name). */
  readonly environment: string;
  /** Mirror spans/logs to the browser console. */
  readonly console: boolean;
  /** OTLP/HTTP collector base URL, or null to disable network export. */
  readonly otlpEndpoint: string | null;
  /** Minimum severity to emit. */
  readonly logLevel: LogLevel;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function readLogLevel(value: string | undefined): LogLevel {
  switch (value?.trim().toLowerCase()) {
    case "debug":
      return "debug";
    case "warn":
      return "warn";
    case "error":
      return "error";
    case "info":
      return "info";
    default:
      return "info";
  }
}

function normalizeEndpoint(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

export function readObservabilityConfig(): ObservabilityConfig {
  return {
    enabled: readBoolean(process.env.NEXT_PUBLIC_OTEL_ENABLED, true),
    serviceName: process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME?.trim() || "openconv-web",
    environment: process.env.NEXT_PUBLIC_OTEL_ENVIRONMENT?.trim() || "development",
    console: readBoolean(process.env.NEXT_PUBLIC_OTEL_CONSOLE, true),
    otlpEndpoint: normalizeEndpoint(process.env.NEXT_PUBLIC_OTEL_OTLP_ENDPOINT),
    logLevel: readLogLevel(process.env.NEXT_PUBLIC_LOG_LEVEL),
  };
}
