/**
 * Pure parse/serialize helpers for the DATA converter family.
 *
 * Every function here is framework-free and synchronous so the conversion
 * matrix can be unit-tested with real fixtures (round-trips, unicode, nested
 * structures, edge cases) without any DOM, WASM or network dependency.
 *
 * The model is uniform: parse SOURCE text into a plain JavaScript value, then
 * serialize that value into the TARGET text.
 */
import yaml from "js-yaml";
import Papa from "papaparse";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";

import { InvalidInputError, ConversionFailedError } from "@/core/domain/errors";

/** Any value the data pipeline may move between formats. */
export type DataValue = unknown;

/** Delimiter used by papaparse for a given tabular target/source. */
export const TSV_DELIMITER = "\t";
export const CSV_DELIMITER = ",";

/** Clamp an indent into the descriptor's advertised [0, 8] range. */
export function clampIndent(value: number): number {
  if (!Number.isFinite(value)) return 2;
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > 8) return 8;
  return rounded;
}

// --------------------------------------------------------------------------
// JSON
// --------------------------------------------------------------------------

export function parseJson(text: string): DataValue {
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new InvalidInputError("Input is not valid JSON.", { cause });
  }
}

export function serializeJson(value: DataValue, indent: number): string {
  try {
    const json = JSON.stringify(value, null, clampIndent(indent));
    if (json === undefined) {
      throw new ConversionFailedError("Value could not be serialized to JSON.");
    }
    // JSON.stringify omits a trailing newline; add one for tidy text files.
    return `${json}\n`;
  } catch (cause) {
    if (cause instanceof ConversionFailedError) throw cause;
    throw new ConversionFailedError("Failed to serialize JSON.", { cause });
  }
}

// --------------------------------------------------------------------------
// YAML
// --------------------------------------------------------------------------

export function parseYaml(text: string): DataValue {
  try {
    // js-yaml's DEFAULT_SCHEMA is the safe schema in v4 (no custom JS types).
    return yaml.load(text);
  } catch (cause) {
    throw new InvalidInputError("Input is not valid YAML.", { cause });
  }
}

export function serializeYaml(value: DataValue): string {
  try {
    return yaml.dump(value, { lineWidth: -1, noRefs: true });
  } catch (cause) {
    throw new ConversionFailedError("Failed to serialize YAML.", { cause });
  }
}

// --------------------------------------------------------------------------
// TOML
// --------------------------------------------------------------------------

export function parseTomlText(text: string): DataValue {
  try {
    return parseToml(text);
  } catch (cause) {
    throw new InvalidInputError("Input is not valid TOML.", { cause });
  }
}

/** A TOML document's root must be a table (plain object), never an array/scalar. */
export function assertTomlRoot(value: DataValue): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new InvalidInputError(
      "TOML output requires a top-level table (object); arrays and scalar values cannot be represented as a TOML document.",
    );
  }
  return value;
}

export function serializeTomlText(value: DataValue): string {
  const root = assertTomlRoot(value);
  try {
    const text = stringifyToml(root);
    return text.endsWith("\n") ? text : `${text}\n`;
  } catch (cause) {
    throw new ConversionFailedError("Failed to serialize TOML.", { cause });
  }
}

// --------------------------------------------------------------------------
// XML
// --------------------------------------------------------------------------

/** Default element used to wrap values that have no single natural root. */
export const XML_ROOT_ELEMENT = "root";
/** Element name used for items when wrapping a top-level array. */
export const XML_ITEM_ELEMENT = "item";

export function makeXmlParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: true,
    trimValues: true,
  });
}

export function parseXml(text: string): DataValue {
  // The lenient XMLParser silently repairs malformed markup; validate first so
  // genuinely broken input is reported instead of producing garbage.
  const validation = XMLValidator.validate(text);
  if (validation !== true) {
    throw new InvalidInputError(`Input is not valid XML: ${validation.err.msg}`, {
      context: { line: validation.err.line, col: validation.err.col },
    });
  }
  let parsed: unknown;
  try {
    parsed = makeXmlParser().parse(text);
  } catch (cause) {
    throw new InvalidInputError("Input is not valid XML.", { cause });
  }
  // Unwrap a single declaration/root wrapper so XML -> JSON is natural.
  return unwrapXmlRoot(parsed);
}

/**
 * fast-xml-parser produces an object keyed by root element name(s). When there
 * is exactly one such key we unwrap it so downstream JSON/YAML is clean.
 */
export function unwrapXmlRoot(parsed: unknown): DataValue {
  if (!isPlainObject(parsed)) return parsed;
  const keys = Object.keys(parsed).filter((k) => k !== "?xml");
  if (keys.length === 1) {
    const only = keys[0];
    if (only !== undefined) return parsed[only];
  }
  return parsed;
}

/**
 * Wrap a value into a shape fast-xml-parser can build. XML needs exactly one
 * root element; arrays and multi-key objects are wrapped under {@link XML_ROOT_ELEMENT}.
 */
export function wrapXmlValue(value: DataValue): Record<string, unknown> {
  if (Array.isArray(value)) {
    return { [XML_ROOT_ELEMENT]: { [XML_ITEM_ELEMENT]: value } };
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1) {
      // Already a single-rooted document.
      return value;
    }
    return { [XML_ROOT_ELEMENT]: value };
  }
  // Scalars / null become a simple root element with text content.
  return { [XML_ROOT_ELEMENT]: value };
}

export function serializeXml(value: DataValue, indent: number): string {
  const indentBy = clampIndent(indent);
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: " ".repeat(indentBy),
    suppressEmptyNode: true,
  });
  try {
    const built: unknown = builder.build(wrapXmlValue(value));
    return typeof built === "string" ? built : String(built);
  } catch (cause) {
    throw new ConversionFailedError("Failed to serialize XML.", { cause });
  }
}

// --------------------------------------------------------------------------
// CSV / TSV (tabular)
// --------------------------------------------------------------------------

/** A parsed row from tabular input. */
export type TabularRow = Record<string, unknown>;

export function parseDelimited(text: string, delimiter: string): TabularRow[] {
  const result = Papa.parse<TabularRow>(text, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  // papaparse surfaces structural problems via `errors`; fatal ones abort.
  const fatal = result.errors.find((e) => e.type !== "FieldMismatch");
  if (fatal) {
    throw new InvalidInputError(`Failed to parse delimited input: ${fatal.message}`, {
      context: { row: fatal.row, code: fatal.code },
    });
  }
  return result.data;
}

/**
 * Validate that a value is a flat tabular dataset: an array whose every element
 * is either a flat object (no nested objects/arrays) or an array of scalars.
 */
export function assertTabular(value: DataValue): ReadonlyArray<TabularRow | unknown[]> {
  if (!Array.isArray(value)) {
    throw new InvalidInputError(
      "CSV/TSV output requires an array of flat rows; the input is not an array.",
    );
  }
  for (const [i, row] of value.entries()) {
    if (Array.isArray(row)) {
      if (row.some((cell) => !isScalar(cell))) {
        throw new InvalidInputError(
          `CSV/TSV output requires flat rows; row ${i} contains nested values.`,
        );
      }
      continue;
    }
    if (!isPlainObject(row)) {
      throw new InvalidInputError(
        `CSV/TSV output requires each row to be an object or array; row ${i} is a ${typeofLabel(row)}.`,
      );
    }
    for (const cellValue of Object.values(row)) {
      if (!isScalar(cellValue)) {
        throw new InvalidInputError(
          `CSV/TSV output requires flat rows; row ${i} contains a nested object or array.`,
        );
      }
    }
  }
  return value as ReadonlyArray<TabularRow | unknown[]>;
}

export function serializeDelimited(value: DataValue, delimiter: string, header: boolean): string {
  const rows = assertTabular(value);
  try {
    return Papa.unparse(rows as unknown[], { delimiter, header });
  } catch (cause) {
    throw new ConversionFailedError("Failed to serialize delimited output.", { cause });
  }
}

// --------------------------------------------------------------------------
// Type guards
// --------------------------------------------------------------------------

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isScalar(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  );
}

function typeofLabel(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
