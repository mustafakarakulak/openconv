import type {
  ConversionOptions,
  ConversionResult,
  ConversionStatus,
} from "@/core/domain/conversion";
import type { FileFormat, FormatId } from "@/core/domain/format";
import type { ConversionProgress } from "@/core/ports/converter";

export interface JobError {
  readonly message: string;
  readonly code?: string;
}

/** A conversion as tracked by the UI, from selection through completion. */
export interface UiJob {
  readonly id: string;
  readonly file: File;
  readonly name: string;
  readonly size: number;
  /** Detected source format, or null when unknown/unsupported. */
  readonly sourceFormat: FileFormat | null;
  /** Chosen target format id, or null when none selected/available. */
  readonly targetId: FormatId | null;
  readonly options: ConversionOptions;
  readonly status: ConversionStatus;
  readonly progress: ConversionProgress | null;
  readonly result: ConversionResult | null;
  readonly error: JobError | null;
}
