/**
 * Domain error hierarchy.
 *
 * All errors thrown by the conversion core extend {@link OpenConvError}, carry
 * a stable machine-readable `code`, and may attach structured `context` for
 * logging. UI and observability layers can branch on `code` without string
 * matching on messages.
 */

export type ErrorContext = Record<string, unknown>;

export abstract class OpenConvError extends Error {
  /** Stable, machine-readable error code. */
  abstract readonly code: string;
  /** Structured context attached at throw site for logs/telemetry. */
  readonly context: ErrorContext;

  constructor(message: string, options?: { cause?: unknown; context?: ErrorContext }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    // Restore prototype chain for instanceof to work across transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
    this.context = options?.context ?? {};
  }
}

/** No registered converter can handle the requested source→target pair. */
export class UnsupportedConversionError extends OpenConvError {
  readonly code = "UNSUPPORTED_CONVERSION";
  constructor(
    readonly source: string,
    readonly target: string,
  ) {
    super(`No converter is registered for ${source} → ${target}.`, {
      context: { source, target },
    });
  }
}

/** The converter ran but failed to produce a valid result. */
export class ConversionFailedError extends OpenConvError {
  readonly code = "CONVERSION_FAILED";
}

/** The conversion was aborted via its AbortSignal. */
export class ConversionCanceledError extends OpenConvError {
  readonly code = "CONVERSION_CANCELED";
  constructor(message = "The conversion was canceled.", options?: { context?: ErrorContext }) {
    super(message, options);
  }
}

/** The provided input was malformed or could not be parsed. */
export class InvalidInputError extends OpenConvError {
  readonly code = "INVALID_INPUT";
}

/** The source format of an input file could not be determined. */
export class FormatDetectionError extends OpenConvError {
  readonly code = "FORMAT_DETECTION_FAILED";
}

/** Type guard for any openConv domain error. */
export function isOpenConvError(value: unknown): value is OpenConvError {
  return value instanceof OpenConvError;
}

/** Normalises an unknown thrown value into a plain message string. */
export function toErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
