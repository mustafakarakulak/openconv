/**
 * Conversion domain model: the data structures that flow through the engine.
 *
 * These are plain, immutable data shapes with no behaviour and no framework
 * dependencies. The application layer (the engine) operates on them; the UI
 * layer renders them.
 */
import type { FileFormat } from "./format";

/** Lifecycle of a single conversion job, as surfaced to the UI. */
export type ConversionStatus = "pending" | "running" | "succeeded" | "failed" | "canceled";

/**
 * User/runtime-supplied options for a conversion (e.g. JPEG quality). Keys are
 * defined per-capability via {@link ConverterOptionDescriptor}. Converters are
 * responsible for validating and applying them.
 */
export type ConversionOptions = Record<string, string | number | boolean>;

/** A file selected for conversion, with its detected source format. */
export interface InputFile {
  /** Client-generated unique id for this input. */
  readonly id: string;
  /** Original filename including extension. */
  readonly name: string;
  /** Size in bytes. */
  readonly size: number;
  /** Detected source format. */
  readonly format: FileFormat;
  /** The raw file bytes. */
  readonly data: Blob;
}

/** A fully-specified request to convert one input into one target format. */
export interface ConversionRequest {
  /** Unique id for this job; becomes a span/log attribute. */
  readonly jobId: string;
  readonly input: InputFile;
  readonly target: FileFormat;
  readonly options: ConversionOptions;
}

/** The artifact produced by a successful conversion. */
export interface OutputFile {
  /** Suggested download filename, including the target extension. */
  readonly name: string;
  readonly format: FileFormat;
  readonly blob: Blob;
  readonly size: number;
}

/** The result of a successful conversion. */
export interface ConversionResult {
  readonly jobId: string;
  readonly output: OutputFile;
  /** Wall-clock duration of the conversion in milliseconds. */
  readonly durationMs: number;
  /** W3C trace id of the conversion span, for support/correlation. */
  readonly traceId: string;
}
