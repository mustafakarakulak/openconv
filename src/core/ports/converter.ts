/**
 * Converter port.
 *
 * A {@link Converter} is a plugin that knows how to turn bytes of one format
 * into bytes of another, entirely in the browser. The application layer
 * discovers converters through the registry and drives them through the
 * engine; converters never import engine, registry, UI or telemetry SDKs —
 * they receive everything they need through {@link ConverterContext}.
 */
import type { ConversionOptions } from "../domain/conversion";
import type { FileFormat, FormatId } from "../domain/format";
import type { Attributes, Logger, Tracer } from "./observability";

/**
 * Declarative description of a single tunable option a capability exposes, used
 * by the UI to render the appropriate control. Converters read the resolved
 * values from {@link ConvertInput.options}.
 */
export type ConverterOptionDescriptor =
  | {
      readonly kind: "number";
      readonly key: string;
      readonly label: string;
      readonly default: number;
      readonly min?: number;
      readonly max?: number;
      readonly step?: number;
      readonly unit?: string;
    }
  | {
      readonly kind: "boolean";
      readonly key: string;
      readonly label: string;
      readonly default: boolean;
    }
  | {
      readonly kind: "select";
      readonly key: string;
      readonly label: string;
      readonly default: string;
      readonly choices: readonly { readonly value: string; readonly label: string }[];
    };

/**
 * A single supported (source → target) transformation, with optional tunables.
 * The registry aggregates capabilities to build the format graph shown in UI.
 */
export interface ConversionCapability {
  readonly source: FileFormat;
  readonly target: FileFormat;
  /** Optional UI-tunable options for this specific transformation. */
  readonly options?: readonly ConverterOptionDescriptor[];
  /** Optional human note shown in the UI (e.g. caveats, quality hints). */
  readonly note?: string;
}

/** Progress signal emitted by long-running converters. */
export interface ConversionProgress {
  /** Completion ratio in [0, 1]; omit for indeterminate progress. */
  readonly ratio?: number;
  /** Optional human-readable phase description. */
  readonly message?: string;
}

/**
 * Everything a converter needs from the host, injected per invocation. Keeps
 * converters free of singletons and trivially unit-testable.
 */
export interface ConverterContext {
  /** Aborted when the user cancels; converters should poll/await it. */
  readonly signal: AbortSignal;
  /** Logger already correlated with the conversion span (carries traceId). */
  readonly logger: Logger;
  /** Tracer whose spans nest under the conversion span. */
  readonly tracer: Tracer;
  /** Reports progress to the host (forwarded to the UI). */
  reportProgress(progress: ConversionProgress): void;
}

/** The immutable input handed to {@link Converter.convert}. */
export interface ConvertInput {
  /** Raw source bytes. */
  readonly file: Blob;
  /** Original filename (with extension). */
  readonly fileName: string;
  readonly source: FileFormat;
  readonly target: FileFormat;
  /** Resolved options (descriptor defaults already applied by the engine). */
  readonly options: ConversionOptions;
}

/** The result a converter returns. The engine derives the final filename. */
export interface ConvertOutput {
  /** Produced bytes. Its MIME type should match the target format. */
  readonly blob: Blob;
  /**
   * Optional attributes to attach to the conversion span (e.g. width/height,
   * page count) for richer telemetry.
   */
  readonly attributes?: Attributes;
}

/**
 * A pluggable conversion strategy. Implementations should be stateless across
 * invocations (any heavy resource, e.g. a WASM module, may be lazily cached
 * internally but must be safe for concurrent calls).
 */
export interface Converter {
  /** Globally-unique converter id, e.g. "image-canvas". */
  readonly id: string;
  /** Human-facing converter name. */
  readonly name: string;
  /** The transformations this converter can perform. */
  readonly capabilities: readonly ConversionCapability[];
  /** Whether this converter can handle the given pair. */
  supports(source: FormatId, target: FormatId): boolean;
  /** Performs the conversion. Must throw on failure; never return invalid bytes. */
  convert(input: ConvertInput, context: ConverterContext): Promise<ConvertOutput>;
}
