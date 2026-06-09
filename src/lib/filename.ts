import type { FileFormat } from "@/core/domain/format";

/**
 * Derives a sensible output filename by swapping the input's extension for the
 * target format's canonical extension. Falls back to "converted" when the
 * input has no usable base name.
 */
export function deriveOutputName(inputName: string, target: FileFormat): string {
  const extension = target.extensions[0] ?? target.id;
  const lastDot = inputName.lastIndexOf(".");
  const base = lastDot > 0 ? inputName.slice(0, lastDot) : inputName;
  const safeBase = base.trim().length > 0 ? base.trim() : "converted";
  return `${safeBase}.${extension}`;
}
