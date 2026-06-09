import type { Attributes } from "@/core/ports/observability";

/** OTel-compatible attribute bag with all undefined entries removed. */
export type FlatAttributes = Record<string, string | number | boolean>;

/** Drops undefined values so callers may spread optional attributes freely. */
export function cleanAttributes(attributes?: Attributes): FlatAttributes {
  const out: FlatAttributes = {};
  if (!attributes) return out;
  for (const key of Object.keys(attributes)) {
    const value = attributes[key];
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * Unwraps an unknown error into OTel semantic-convention exception attributes.
 * Also surfaces an openConv domain error `code` when present.
 */
export function errorAttributes(error: unknown): FlatAttributes {
  if (error === undefined || error === null) return {};
  if (error instanceof Error) {
    const attributes: FlatAttributes = {
      "exception.type": error.name,
      "exception.message": error.message,
    };
    if (error.stack) attributes["exception.stacktrace"] = error.stack;
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") attributes["openconv.error.code"] = code;
    return attributes;
  }
  return { "exception.message": String(error) };
}
