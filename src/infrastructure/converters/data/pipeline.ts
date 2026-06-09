/**
 * The DATA conversion pipeline.
 *
 * A pipeline turns SOURCE text into TARGET text in two pure phases:
 *   1. parse  — SOURCE text  -> JS value
 *   2. serialize — JS value  -> TARGET text
 *
 * Keeping parse and serialize as separate, pure functions means every
 * source→target pair is just a (parser, serializer) pairing, and the whole
 * matrix can be exercised with real fixtures and no I/O.
 */
import { InvalidInputError, ConversionFailedError } from "@/core/domain/errors";

import {
  CSV_DELIMITER,
  TSV_DELIMITER,
  type DataValue,
  parseDelimited,
  parseJson,
  parseTomlText,
  parseXml,
  parseYaml,
  serializeDelimited,
  serializeJson,
  serializeTomlText,
  serializeXml,
  serializeYaml,
} from "./serialization";

/** Format ids this converter family handles. */
export type DataFormatId = "json" | "yaml" | "toml" | "xml" | "csv" | "tsv";

/** Resolved option values applied to a single conversion. */
export interface PipelineOptions {
  /** Indent width for json/xml targets (already clamped by the caller is fine). */
  readonly indent: number;
  /** Whether csv/tsv output includes a header row. */
  readonly header: boolean;
}

export const DEFAULT_INDENT = 2;
export const DEFAULT_HEADER = true;

export function defaultPipelineOptions(): PipelineOptions {
  return { indent: DEFAULT_INDENT, header: DEFAULT_HEADER };
}

/** Parse SOURCE text into a JS value. */
export function parseFormat(source: DataFormatId, text: string): DataValue {
  switch (source) {
    case "json":
      return parseJson(text);
    case "yaml":
      return parseYaml(text);
    case "toml":
      return parseTomlText(text);
    case "xml":
      return parseXml(text);
    case "csv":
      return parseDelimited(text, CSV_DELIMITER);
    case "tsv":
      return parseDelimited(text, TSV_DELIMITER);
    default:
      // Exhaustiveness guard — unreachable for valid DataFormatId.
      throw new InvalidInputError(`Unsupported source format: ${String(source)}`);
  }
}

/** Serialize a JS value into TARGET text. */
export function serializeFormat(
  target: DataFormatId,
  value: DataValue,
  options: PipelineOptions,
): string {
  switch (target) {
    case "json":
      return serializeJson(value, options.indent);
    case "yaml":
      return serializeYaml(value);
    case "toml":
      return serializeTomlText(value);
    case "xml":
      return serializeXml(value, options.indent);
    case "csv":
      return serializeDelimited(value, CSV_DELIMITER, options.header);
    case "tsv":
      return serializeDelimited(value, TSV_DELIMITER, options.header);
    default:
      throw new ConversionFailedError(`Unsupported target format: ${String(target)}`);
  }
}

/** Run the full text→value→text pipeline for a single pair. */
export function runPipeline(
  source: DataFormatId,
  target: DataFormatId,
  text: string,
  options: PipelineOptions,
): string {
  const value = parseFormat(source, text);
  return serializeFormat(target, value, options);
}

/**
 * The set of supported (source → target) pairs for the DATA family, expressed
 * as a flat list of tuples. Centralised here so the converter's capability
 * array and `supports()` cannot drift from the actual pipeline.
 */
export const OBJECT_FORMATS: readonly DataFormatId[] = ["json", "yaml", "toml", "xml"];
export const TABULAR_FORMATS: readonly DataFormatId[] = ["csv", "tsv"];

export interface FormatPair {
  readonly source: DataFormatId;
  readonly target: DataFormatId;
}

/** Build the full supported-pair list deterministically. */
export function buildSupportedPairs(): FormatPair[] {
  const pairs: FormatPair[] = [];
  const seen = new Set<string>();
  const add = (source: DataFormatId, target: DataFormatId): void => {
    if (source === target) return;
    const key = `${source}>${target}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ source, target });
  };

  // All pairwise among object formats (both directions).
  for (const a of OBJECT_FORMATS) {
    for (const b of OBJECT_FORMATS) add(a, b);
  }
  // csv <-> tsv.
  add("csv", "tsv");
  add("tsv", "csv");
  // Tabular <-> json/yaml (array of row objects model).
  add("csv", "json");
  add("json", "csv");
  add("tsv", "json");
  add("json", "tsv");
  add("csv", "yaml");
  add("yaml", "csv");

  return pairs;
}
