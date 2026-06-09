/**
 * Pure, dependency-free helpers for the canvas-based image converter.
 *
 * Everything in this module is deterministic and runs without a real canvas,
 * WebAssembly or network access, so it is fully unit-testable under happy-dom.
 * The converter class composes these helpers with the browser drawing APIs.
 */
import type { ConversionCapability, ConverterOptionDescriptor } from "@/core/ports/converter";
import type { ConversionOptions } from "@/core/domain/conversion";
import type { FileFormat, FormatId } from "@/core/domain/format";
import { FORMATS } from "@/core/domain/format";

/**
 * Formats the canvas can DECODE. AVIF/GIF/BMP/ICO are decode-only because the
 * canvas cannot reliably re-encode them. SVG is rasterised via an <img> load.
 */
export const IMAGE_SOURCE_FORMATS: readonly FileFormat[] = [
  FORMATS.png,
  FORMATS.jpeg,
  FORMATS.webp,
  FORMATS.gif,
  FORMATS.bmp,
  FORMATS.avif,
  FORMATS.ico,
  FORMATS.svg,
];

/**
 * Formats the canvas can reliably ENCODE. Limited to the trio that
 * `OffscreenCanvas.convertToBlob` / `HTMLCanvasElement.toBlob` support
 * everywhere.
 */
export const IMAGE_TARGET_FORMATS: readonly FileFormat[] = [FORMATS.png, FORMATS.jpeg, FORMATS.webp];

/** Default JPEG/WebP quality, matching the canvas spec default. */
export const DEFAULT_QUALITY = 0.92;

/** Default flatten colour applied when a lossy/opaque target drops alpha. */
export const DEFAULT_BACKGROUND = "#ffffff";

/** The fallback MIME used when (impossibly) a format has no declared types. */
export const FALLBACK_MIME = "application/octet-stream";

/** Targets that are lossy (or otherwise) opaque and need transparency flattening. */
const OPAQUE_TARGET_IDS: ReadonlySet<FormatId> = new Set<FormatId>([FORMATS.jpeg.id]);

/** Targets that accept a quality factor in [0, 1]. */
const LOSSY_TARGET_IDS: ReadonlySet<FormatId> = new Set<FormatId>([FORMATS.jpeg.id, FORMATS.webp.id]);

/** Option keys, centralised so the descriptor and the resolver cannot drift. */
export const OPTION_KEYS = {
  quality: "quality",
  background: "background",
} as const;

/** Whether the given target format expects a `quality` tunable. */
export function targetSupportsQuality(target: FileFormat): boolean {
  return LOSSY_TARGET_IDS.has(target.id);
}

/**
 * Whether the given target cannot represent transparency and therefore needs
 * the source flattened onto a solid background before encoding.
 */
export function targetNeedsFlatten(target: FileFormat): boolean {
  return OPAQUE_TARGET_IDS.has(target.id);
}

/** Picks the canonical MIME type for a format, with a safe fallback. */
export function targetMimeType(target: FileFormat): string {
  return target.mimeTypes[0] ?? FALLBACK_MIME;
}

/** Builds the declarative option descriptors for a single source→target pair. */
export function optionsForTarget(target: FileFormat): readonly ConverterOptionDescriptor[] {
  const descriptors: ConverterOptionDescriptor[] = [];
  if (targetSupportsQuality(target)) {
    descriptors.push({
      kind: "number",
      key: OPTION_KEYS.quality,
      label: "Quality",
      default: DEFAULT_QUALITY,
      min: 0,
      max: 1,
      step: 0.01,
    });
  }
  if (targetNeedsFlatten(target)) {
    descriptors.push({
      kind: "select",
      key: OPTION_KEYS.background,
      label: "Background (flatten transparency)",
      default: DEFAULT_BACKGROUND,
      choices: [
        { value: "#ffffff", label: "White" },
        { value: "#000000", label: "Black" },
        { value: "#808080", label: "Grey" },
      ],
    });
  }
  return descriptors;
}

/**
 * Builds the full capability matrix: every decode source paired with every
 * encodable target, excluding identity (source === target) conversions.
 */
export function buildCapabilities(
  sources: readonly FileFormat[] = IMAGE_SOURCE_FORMATS,
  targets: readonly FileFormat[] = IMAGE_TARGET_FORMATS,
): readonly ConversionCapability[] {
  const capabilities: ConversionCapability[] = [];
  for (const source of sources) {
    for (const target of targets) {
      if (source.id === target.id) continue;
      const options = optionsForTarget(target);
      capabilities.push({
        source,
        target,
        ...(options.length > 0 ? { options } : {}),
      });
    }
  }
  return capabilities;
}

/** Clamps an arbitrary number into the inclusive [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Resolves the effective quality from the supplied options, clamped to [0, 1].
 * Reads the value the same way {@link BaseConverter.numberOption} would, but is
 * kept pure so it can be tested without an instance.
 */
export function resolveQuality(options: ConversionOptions): number {
  const raw = options[OPTION_KEYS.quality];
  let value = DEFAULT_QUALITY;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    value = raw;
  } else if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) value = parsed;
  }
  return clamp(value, 0, 1);
}

/** Resolves the effective background fill colour, normalised to a CSS string. */
export function resolveBackground(options: ConversionOptions): string {
  const raw = options[OPTION_KEYS.background];
  if (typeof raw === "string" && raw.trim().length > 0) {
    const normalized = normalizeColor(raw.trim());
    if (normalized) return normalized;
  }
  return DEFAULT_BACKGROUND;
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGB_COLOR = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i;
const NAMED_COLORS: ReadonlySet<string> = new Set([
  "white",
  "black",
  "grey",
  "gray",
  "red",
  "green",
  "blue",
  "transparent",
]);

/**
 * Validates and normalises a CSS colour string we are willing to feed to
 * `ctx.fillStyle`. Returns `undefined` for anything we do not recognise so the
 * caller can fall back to the default rather than passing garbage to canvas.
 */
export function normalizeColor(input: string): string | undefined {
  const value = input.trim();
  if (HEX_COLOR.test(value)) return value.toLowerCase();
  if (RGB_COLOR.test(value)) return value.toLowerCase();
  if (NAMED_COLORS.has(value.toLowerCase())) return value.toLowerCase();
  return undefined;
}

/**
 * Decides whether a transparent pixel region must be painted over before
 * encoding. Flattening only matters when the target itself cannot store alpha;
 * if the target keeps alpha (png/webp) we never flatten regardless of options.
 */
export function shouldFlatten(target: FileFormat): boolean {
  return targetNeedsFlatten(target);
}

/** Options resolved for an encode pass; consumed by the converter. */
export interface ResolvedEncodeOptions {
  readonly mimeType: string;
  readonly quality: number | undefined;
  readonly flatten: boolean;
  readonly background: string;
}

/**
 * Resolves all encode-time decisions for a target from the raw options bag.
 * Quality is only attached for lossy targets; background only matters when
 * flattening. Kept pure for unit testing.
 */
export function resolveEncodeOptions(
  target: FileFormat,
  options: ConversionOptions,
): ResolvedEncodeOptions {
  return {
    mimeType: targetMimeType(target),
    quality: targetSupportsQuality(target) ? resolveQuality(options) : undefined,
    flatten: shouldFlatten(target),
    background: resolveBackground(options),
  };
}
