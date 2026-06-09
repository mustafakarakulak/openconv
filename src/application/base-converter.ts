/**
 * Convenience base class for converters.
 *
 * Implements the boilerplate of {@link Converter.supports} from the declared
 * capabilities and offers small, type-safe helpers for reading options and
 * cooperating with cancellation. Converters are free to implement the
 * {@link Converter} interface directly instead — this is purely ergonomic.
 */
import { ConversionCanceledError } from "@/core/domain/errors";
import type { ConversionOptions } from "@/core/domain/conversion";
import type { FormatId } from "@/core/domain/format";
import type {
  ConversionCapability,
  Converter,
  ConvertInput,
  ConvertOutput,
  ConverterContext,
} from "@/core/ports/converter";

export abstract class BaseConverter implements Converter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly capabilities: readonly ConversionCapability[];

  abstract convert(input: ConvertInput, context: ConverterContext): Promise<ConvertOutput>;

  supports(source: FormatId, target: FormatId): boolean {
    return this.capabilities.some((c) => c.source.id === source && c.target.id === target);
  }

  protected capabilityFor(source: FormatId, target: FormatId): ConversionCapability | undefined {
    return this.capabilities.find((c) => c.source.id === source && c.target.id === target);
  }

  /** Reads a numeric option, falling back when missing or not a finite number. */
  protected numberOption(options: ConversionOptions, key: string, fallback: number): number {
    const value = options[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return fallback;
  }

  protected booleanOption(options: ConversionOptions, key: string, fallback: boolean): boolean {
    const value = options[key];
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
  }

  protected stringOption(options: ConversionOptions, key: string, fallback: string): string {
    const value = options[key];
    return typeof value === "string" && value.length > 0 ? value : fallback;
  }

  /** Throws {@link ConversionCanceledError} if the signal is already aborted. */
  protected throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw new ConversionCanceledError();
    }
  }
}
