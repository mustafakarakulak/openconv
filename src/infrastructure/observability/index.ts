/**
 * Process-wide telemetry singleton.
 *
 * Ensures the OpenTelemetry providers are bootstrapped exactly once per
 * runtime (browser tab). On the server this resolves to the no-op pipeline.
 */
import { bootstrapTelemetry, type Telemetry } from "./telemetry";

let instance: Telemetry | null = null;

export function getTelemetry(): Telemetry {
  if (instance === null) {
    instance = bootstrapTelemetry();
  }
  return instance;
}

export type { Telemetry } from "./telemetry";
export { bootstrapTelemetry } from "./telemetry";
export { readObservabilityConfig, type ObservabilityConfig } from "./config";
