/**
 * Converter composition root.
 *
 * Aggregates every converter module into a single configured
 * {@link ConverterRegistry}. This is the only place that knows about all
 * converters; adding a new category is a one-line change here plus a new
 * module directory.
 */
import { ConverterRegistry } from "@/application/converter-registry";
import type { Logger } from "@/core/ports/observability";
import { dataConverters } from "./data";
import { documentConverters } from "./document";
import { imageConverters } from "./image";
import { mediaConverters } from "./media";

export function createConverterRegistry(logger?: Logger): ConverterRegistry {
  const registry = new ConverterRegistry(logger);
  registry.registerAll([
    ...imageConverters,
    ...dataConverters,
    ...documentConverters,
    ...mediaConverters,
  ]);
  return registry;
}
