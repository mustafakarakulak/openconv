"use client";

/**
 * Wires the conversion domain into React. Bootstraps telemetry once, builds
 * the converter registry, and constructs the engine — exposing them through
 * context. Everything here is client-only; the engine never runs on a server.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ConversionEngine } from "@/application/conversion-engine";
import type { ConverterRegistry } from "@/application/converter-registry";
import type { Logger } from "@/core/ports/observability";
import { createConverterRegistry } from "@/infrastructure/converters";
import { getTelemetry } from "@/infrastructure/observability";

interface ConversionContextValue {
  readonly engine: ConversionEngine;
  readonly registry: ConverterRegistry;
  readonly logger: Logger;
}

const ConversionContext = createContext<ConversionContextValue | null>(null);

export function ConversionProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ConversionContextValue>(() => {
    const { tracer, logger } = getTelemetry();
    const registry = createConverterRegistry(logger);
    const engine = new ConversionEngine({ registry, tracer, logger });
    logger.info("app.engine_ready", {
      "openconv.formats": registry.listFormats().length,
      "openconv.converters": registry.listConverters().length,
    });
    return { engine, registry, logger };
  }, []);

  return <ConversionContext.Provider value={value}>{children}</ConversionContext.Provider>;
}

export function useConversionContext(): ConversionContextValue {
  const value = useContext(ConversionContext);
  if (value === null) {
    throw new Error("useConversionContext must be used within a <ConversionProvider>.");
  }
  return value;
}
