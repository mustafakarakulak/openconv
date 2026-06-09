/**
 * File-format domain model and catalog.
 *
 * This module is the single source of truth for every format openConv knows
 * about: its label, MIME types, extensions and the high-level "kind" used to
 * group it in the UI. Converters reference these shared {@link FileFormat}
 * objects by id rather than re-declaring metadata, so format details stay
 * consistent across the whole application.
 */

/** Top-level grouping used for UI organisation and coarse routing. */
export type MediaKind = "image" | "data" | "document" | "audio" | "video";

/**
 * Stable, lowercase identifier for a format (e.g. "png", "json").
 * Kept as a plain string so the catalog remains open for extension by plugins.
 */
export type FormatId = string;

export interface FileFormat {
  /** Stable lowercase id, unique across the catalog. */
  readonly id: FormatId;
  /** Human-facing short label, e.g. "PNG", "JSON". */
  readonly label: string;
  readonly kind: MediaKind;
  /** Associated MIME types; the canonical one comes first. */
  readonly mimeTypes: readonly string[];
  /** File extensions WITHOUT the leading dot, lowercase; canonical first. */
  readonly extensions: readonly string[];
  /** One-line human description. */
  readonly description: string;
}

/**
 * The format catalog. Use the named keys for compile-time-checked references
 * (e.g. `FORMATS.png`). `satisfies` keeps each entry honest against
 * {@link FileFormat} while preserving literal types for the keys.
 */
export const FORMATS = {
  // --- Images --------------------------------------------------------------
  png: {
    id: "png",
    label: "PNG",
    kind: "image",
    mimeTypes: ["image/png"],
    extensions: ["png"],
    description: "Lossless raster image with alpha transparency.",
  },
  jpeg: {
    id: "jpeg",
    label: "JPEG",
    kind: "image",
    mimeTypes: ["image/jpeg"],
    extensions: ["jpg", "jpeg"],
    description: "Lossy raster image, ideal for photographs.",
  },
  webp: {
    id: "webp",
    label: "WebP",
    kind: "image",
    mimeTypes: ["image/webp"],
    extensions: ["webp"],
    description: "Modern lossy/lossless image with great compression.",
  },
  avif: {
    id: "avif",
    label: "AVIF",
    kind: "image",
    mimeTypes: ["image/avif"],
    extensions: ["avif"],
    description: "Next-gen AV1-based image format with high efficiency.",
  },
  gif: {
    id: "gif",
    label: "GIF",
    kind: "image",
    mimeTypes: ["image/gif"],
    extensions: ["gif"],
    description: "Indexed raster image supporting simple animation.",
  },
  bmp: {
    id: "bmp",
    label: "BMP",
    kind: "image",
    mimeTypes: ["image/bmp"],
    extensions: ["bmp"],
    description: "Uncompressed Windows bitmap image.",
  },
  ico: {
    id: "ico",
    label: "ICO",
    kind: "image",
    mimeTypes: ["image/x-icon", "image/vnd.microsoft.icon"],
    extensions: ["ico"],
    description: "Windows icon container.",
  },
  svg: {
    id: "svg",
    label: "SVG",
    kind: "image",
    mimeTypes: ["image/svg+xml"],
    extensions: ["svg"],
    description: "Scalable vector graphics (XML based).",
  },

  // --- Data ----------------------------------------------------------------
  json: {
    id: "json",
    label: "JSON",
    kind: "data",
    mimeTypes: ["application/json"],
    extensions: ["json"],
    description: "JavaScript Object Notation data interchange format.",
  },
  csv: {
    id: "csv",
    label: "CSV",
    kind: "data",
    mimeTypes: ["text/csv"],
    extensions: ["csv"],
    description: "Comma-separated tabular data.",
  },
  tsv: {
    id: "tsv",
    label: "TSV",
    kind: "data",
    mimeTypes: ["text/tab-separated-values"],
    extensions: ["tsv"],
    description: "Tab-separated tabular data.",
  },
  yaml: {
    id: "yaml",
    label: "YAML",
    kind: "data",
    mimeTypes: ["application/yaml", "text/yaml"],
    extensions: ["yaml", "yml"],
    description: "Human-friendly data serialisation format.",
  },
  xml: {
    id: "xml",
    label: "XML",
    kind: "data",
    mimeTypes: ["application/xml", "text/xml"],
    extensions: ["xml"],
    description: "Extensible Markup Language.",
  },
  toml: {
    id: "toml",
    label: "TOML",
    kind: "data",
    mimeTypes: ["application/toml"],
    extensions: ["toml"],
    description: "Tom's Obvious Minimal Language config format.",
  },

  // --- Documents -----------------------------------------------------------
  markdown: {
    id: "markdown",
    label: "Markdown",
    kind: "document",
    mimeTypes: ["text/markdown"],
    extensions: ["md", "markdown"],
    description: "Lightweight plain-text markup language.",
  },
  html: {
    id: "html",
    label: "HTML",
    kind: "document",
    mimeTypes: ["text/html"],
    extensions: ["html", "htm"],
    description: "HyperText Markup Language document.",
  },
  pdf: {
    id: "pdf",
    label: "PDF",
    kind: "document",
    mimeTypes: ["application/pdf"],
    extensions: ["pdf"],
    description: "Portable Document Format.",
  },
  txt: {
    id: "txt",
    label: "Text",
    kind: "document",
    mimeTypes: ["text/plain"],
    extensions: ["txt"],
    description: "Plain UTF-8 text.",
  },

  // --- Audio ---------------------------------------------------------------
  mp3: {
    id: "mp3",
    label: "MP3",
    kind: "audio",
    mimeTypes: ["audio/mpeg"],
    extensions: ["mp3"],
    description: "MPEG-1 Audio Layer III lossy audio.",
  },
  wav: {
    id: "wav",
    label: "WAV",
    kind: "audio",
    mimeTypes: ["audio/wav", "audio/x-wav"],
    extensions: ["wav"],
    description: "Uncompressed waveform audio.",
  },
  ogg: {
    id: "ogg",
    label: "OGG",
    kind: "audio",
    mimeTypes: ["audio/ogg"],
    extensions: ["ogg"],
    description: "Ogg Vorbis lossy audio.",
  },
  aac: {
    id: "aac",
    label: "AAC",
    kind: "audio",
    mimeTypes: ["audio/aac"],
    extensions: ["aac"],
    description: "Advanced Audio Coding lossy audio.",
  },
  flac: {
    id: "flac",
    label: "FLAC",
    kind: "audio",
    mimeTypes: ["audio/flac"],
    extensions: ["flac"],
    description: "Free Lossless Audio Codec.",
  },
  m4a: {
    id: "m4a",
    label: "M4A",
    kind: "audio",
    mimeTypes: ["audio/mp4", "audio/x-m4a"],
    extensions: ["m4a"],
    description: "MPEG-4 audio container (AAC/ALAC).",
  },

  // --- Video ---------------------------------------------------------------
  mp4: {
    id: "mp4",
    label: "MP4",
    kind: "video",
    mimeTypes: ["video/mp4"],
    extensions: ["mp4"],
    description: "MPEG-4 Part 14 video container.",
  },
  webm: {
    id: "webm",
    label: "WebM",
    kind: "video",
    mimeTypes: ["video/webm"],
    extensions: ["webm"],
    description: "Open VP8/VP9 video container.",
  },
  mov: {
    id: "mov",
    label: "MOV",
    kind: "video",
    mimeTypes: ["video/quicktime"],
    extensions: ["mov"],
    description: "Apple QuickTime video container.",
  },
  mkv: {
    id: "mkv",
    label: "MKV",
    kind: "video",
    mimeTypes: ["video/x-matroska"],
    extensions: ["mkv"],
    description: "Matroska multimedia container.",
  },
  avi: {
    id: "avi",
    label: "AVI",
    kind: "video",
    mimeTypes: ["video/x-msvideo"],
    extensions: ["avi"],
    description: "Audio Video Interleave container.",
  },
} as const satisfies Record<string, FileFormat>;

/** Union of the statically-known format ids. */
export type KnownFormatId = keyof typeof FORMATS;

/** Every known format as a flat, readonly array. */
export const ALL_FORMATS: readonly FileFormat[] = Object.values(FORMATS);

const BY_ID = new Map<FormatId, FileFormat>(ALL_FORMATS.map((f) => [f.id, f]));

const BY_EXTENSION = new Map<string, FileFormat>();
const BY_MIME = new Map<string, FileFormat>();
for (const format of ALL_FORMATS) {
  for (const ext of format.extensions) {
    // First registration wins so canonical formats own ambiguous extensions.
    if (!BY_EXTENSION.has(ext)) BY_EXTENSION.set(ext, format);
  }
  for (const mime of format.mimeTypes) {
    if (!BY_MIME.has(mime)) BY_MIME.set(mime, format);
  }
}

/** Looks up a format by its id. */
export function getFormat(id: FormatId): FileFormat | undefined {
  return BY_ID.get(id);
}

/** Normalises an extension (strips leading dot, lowercases) and looks it up. */
export function formatByExtension(extension: string): FileFormat | undefined {
  const normalized = extension.replace(/^\./, "").toLowerCase();
  return BY_EXTENSION.get(normalized);
}

/** Looks up a format by MIME type (case-insensitive, parameters stripped). */
export function formatByMimeType(mimeType: string): FileFormat | undefined {
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return BY_MIME.get(normalized);
}

/** Extracts the lowercase extension (without dot) from a filename. */
export function extractExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0 || lastDot === fileName.length - 1) return "";
  return fileName.slice(lastDot + 1).toLowerCase();
}

/**
 * Best-effort detection of a file's format from its name and MIME type.
 * Extension takes precedence over MIME because browsers often report generic
 * or empty MIME types for less-common formats.
 */
export function detectFormat(file: { name: string; type?: string }): FileFormat | undefined {
  const byExt = formatByExtension(extractExtension(file.name));
  if (byExt) return byExt;
  if (file.type) return formatByMimeType(file.type);
  return undefined;
}
