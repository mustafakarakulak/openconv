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

/**
 * Extracts the lowercased extension (without the dot) from a filename, or an
 * empty string when there is none. Used for telemetry: the extension is safe to
 * record, whereas the full filename can carry personal data, so we never log
 * the raw name.
 */
export function fileExtension(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const lastDot = base.lastIndexOf(".");
  if (lastDot <= 0) return "";
  return base.slice(lastDot + 1).toLowerCase();
}
