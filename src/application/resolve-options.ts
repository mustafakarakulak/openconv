import type { ConversionOptions } from "@/core/domain/conversion";
import type { ConversionCapability } from "@/core/ports/converter";

/**
 * Produces the effective option set for a conversion by layering user-provided
 * values on top of the capability's declared descriptor defaults. This lets
 * converters assume every declared option is present.
 */
export function resolveOptions(
  capability: ConversionCapability | undefined,
  provided: ConversionOptions,
): ConversionOptions {
  const resolved: ConversionOptions = {};
  for (const descriptor of capability?.options ?? []) {
    resolved[descriptor.key] = descriptor.default;
  }
  return { ...resolved, ...provided };
}
