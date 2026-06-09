/**
 * Pure helpers for the media (audio/video) converter.
 *
 * Everything in this module is side-effect free so it can be exhaustively
 * unit-tested without ever loading or executing ffmpeg.wasm. The converter
 * class composes these helpers and only adds the (untestable in happy-dom)
 * WASM I/O around them.
 */
import type { ConversionOptions } from "@/core/domain/conversion";
import { FORMATS } from "@/core/domain/format";
import type { FileFormat, FormatId } from "@/core/domain/format";
import type {
  ConversionCapability,
  ConverterOptionDescriptor,
} from "@/core/ports/converter";

/** Audio source/target formats this converter understands. */
export const AUDIO_FORMATS: readonly FileFormat[] = [
  FORMATS.mp3,
  FORMATS.wav,
  FORMATS.ogg,
  FORMATS.aac,
  FORMATS.flac,
  FORMATS.m4a,
];

/** Audio formats we can produce as a target. */
export const AUDIO_TARGETS: readonly FileFormat[] = [
  FORMATS.mp3,
  FORMATS.wav,
  FORMATS.ogg,
  FORMATS.aac,
];

/** Video source/target formats this converter understands. */
export const VIDEO_FORMATS: readonly FileFormat[] = [
  FORMATS.mp4,
  FORMATS.webm,
  FORMATS.mov,
  FORMATS.mkv,
  FORMATS.avi,
];

/** Video container formats we can transcode to. */
export const VIDEO_TARGETS: readonly FileFormat[] = [FORMATS.mp4, FORMATS.webm];

/** Audio formats a video can have its track extracted into. */
export const VIDEO_AUDIO_EXTRACT_TARGETS: readonly FileFormat[] = [
  FORMATS.mp3,
  FORMATS.wav,
];

/** Allowed audio bitrate choices (also the values fed to ffmpeg's -b:a). */
export const AUDIO_BITRATES = ["128k", "192k", "256k", "320k"] as const;
export type AudioBitrate = (typeof AUDIO_BITRATES)[number];
export const DEFAULT_AUDIO_BITRATE: AudioBitrate = "192k";

export const DEFAULT_GIF_FPS = 12;
export const MIN_GIF_FPS = 1;
export const MAX_GIF_FPS = 30;
export const DEFAULT_GIF_WIDTH = 480;

/** Option descriptor shared by every lossy audio target. */
export const AUDIO_BITRATE_OPTION: ConverterOptionDescriptor = {
  kind: "select",
  key: "audioBitrate",
  label: "Audio bitrate",
  default: DEFAULT_AUDIO_BITRATE,
  choices: AUDIO_BITRATES.map((value) => ({ value, label: value })),
};

/** Option descriptors for the video → GIF capability. */
export const GIF_OPTIONS: readonly ConverterOptionDescriptor[] = [
  {
    kind: "number",
    key: "fps",
    label: "Frames per second",
    default: DEFAULT_GIF_FPS,
    min: MIN_GIF_FPS,
    max: MAX_GIF_FPS,
    step: 1,
    unit: "fps",
  },
  {
    kind: "number",
    key: "width",
    label: "Width",
    default: DEFAULT_GIF_WIDTH,
    min: 16,
    step: 1,
    unit: "px",
  },
];

/** Targets whose ffmpeg encoding honours the audio-bitrate option. */
const BITRATE_HONOURING_TARGETS: ReadonlySet<FormatId> = new Set([
  FORMATS.mp3.id,
  FORMATS.ogg.id,
  FORMATS.aac.id,
  FORMATS.mp4.id,
  FORMATS.webm.id,
]);

/** Whether a target format exposes the audio-bitrate option in the UI. */
export function targetHasBitrateOption(target: FormatId): boolean {
  return BITRATE_HONOURING_TARGETS.has(target);
}

/**
 * Builds the full capability matrix for the media converter purely from the
 * format arrays. Identity conversions are skipped. Audio targets carry the
 * bitrate option; the video→gif capability carries fps/width.
 */
export function buildCapabilities(): readonly ConversionCapability[] {
  const capabilities: ConversionCapability[] = [];

  // Audio → audio (skip identity).
  for (const source of AUDIO_FORMATS) {
    for (const target of AUDIO_TARGETS) {
      if (source.id === target.id) continue;
      capabilities.push(audioCapability(source, target));
    }
  }

  for (const source of VIDEO_FORMATS) {
    // Video → video (skip identity).
    for (const target of VIDEO_TARGETS) {
      if (source.id === target.id) continue;
      capabilities.push(audioCapability(source, target));
    }
    // Video → audio extraction.
    for (const target of VIDEO_AUDIO_EXTRACT_TARGETS) {
      capabilities.push(audioCapability(source, target));
    }
    // Video → gif.
    capabilities.push({
      source,
      target: FORMATS.gif,
      options: GIF_OPTIONS,
      note: "Animated GIF; tune fps and width to balance size and smoothness.",
    });
  }

  return capabilities;
}

/** Builds one capability, attaching the bitrate option when relevant. */
function audioCapability(source: FileFormat, target: FileFormat): ConversionCapability {
  if (targetHasBitrateOption(target.id)) {
    return { source, target, options: [AUDIO_BITRATE_OPTION] };
  }
  return { source, target };
}

/** Coerces an arbitrary option value into a supported audio bitrate. */
export function resolveAudioBitrate(value: string): AudioBitrate {
  return (AUDIO_BITRATES as readonly string[]).includes(value)
    ? (value as AudioBitrate)
    : DEFAULT_AUDIO_BITRATE;
}

/** Clamps the GIF fps option into the supported [1, 30] range (integer). */
export function resolveGifFps(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GIF_FPS;
  const rounded = Math.round(value);
  if (rounded < MIN_GIF_FPS) return MIN_GIF_FPS;
  if (rounded > MAX_GIF_FPS) return MAX_GIF_FPS;
  return rounded;
}

/** Clamps the GIF width option to a sane positive integer. */
export function resolveGifWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GIF_WIDTH;
  const rounded = Math.round(value);
  return rounded < 1 ? DEFAULT_GIF_WIDTH : rounded;
}

/** Resolved, validated option bundle handed to {@link buildFfmpegArgs}. */
export interface ResolvedMediaOptions {
  readonly audioBitrate: AudioBitrate;
  readonly fps: number;
  readonly width: number;
}

/**
 * Reads, coerces and clamps the raw options bag into a fully-resolved bundle.
 * Pure: depends only on its arguments.
 */
export function resolveMediaOptions(options: ConversionOptions): ResolvedMediaOptions {
  const rawBitrate = options["audioBitrate"];
  const rawFps = options["fps"];
  const rawWidth = options["width"];

  return {
    audioBitrate: resolveAudioBitrate(
      typeof rawBitrate === "string" ? rawBitrate : String(rawBitrate ?? ""),
    ),
    fps: resolveGifFps(toFiniteNumber(rawFps, DEFAULT_GIF_FPS)),
    width: resolveGifWidth(toFiniteNumber(rawWidth, DEFAULT_GIF_WIDTH)),
  };
}

function toFiniteNumber(value: string | number | boolean | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Builds the ffmpeg CLI arguments for a single conversion. PURE — given the
 * same names, target id and options it always returns the same arg vector.
 * The engine prepends ["-nostdin", "-y"] itself, so we only return the
 * meaningful flags between input and output.
 */
export function buildFfmpegArgs(
  inputName: string,
  outputName: string,
  target: FormatId,
  options: ResolvedMediaOptions,
): string[] {
  const args: string[] = ["-i", inputName];

  switch (target) {
    case FORMATS.gif.id: {
      // Build a palette-friendly scale+fps filter for crisp GIFs.
      const filter = `fps=${options.fps},scale=${options.width}:-1:flags=lanczos`;
      args.push("-vf", filter);
      break;
    }
    case FORMATS.mp3.id:
      args.push("-vn", "-c:a", "libmp3lame", "-b:a", options.audioBitrate);
      break;
    case FORMATS.wav.id:
      // WAV is PCM; bitrate does not apply. Drop any video stream.
      args.push("-vn", "-c:a", "pcm_s16le");
      break;
    case FORMATS.ogg.id:
      args.push("-vn", "-c:a", "libvorbis", "-b:a", options.audioBitrate);
      break;
    case FORMATS.aac.id:
      args.push("-vn", "-c:a", "aac", "-b:a", options.audioBitrate);
      break;
    case FORMATS.mp4.id:
      args.push(
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-c:a",
        "aac",
        "-b:a",
        options.audioBitrate,
      );
      break;
    case FORMATS.webm.id:
      args.push(
        "-c:v",
        "libvpx-vp9",
        "-c:a",
        "libopus",
        "-b:a",
        options.audioBitrate,
      );
      break;
    default:
      // Should be unreachable given the capability matrix; let ffmpeg infer
      // from the output extension rather than emitting bad codec flags.
      break;
  }

  args.push(outputName);
  return args;
}

/** Derives the in-memory ffmpeg filenames for a conversion. */
export function ffmpegFileNames(
  source: FileFormat,
  target: FileFormat,
): { inputName: string; outputName: string } {
  const inExt = source.extensions[0] ?? source.id;
  const outExt = target.extensions[0] ?? target.id;
  return { inputName: `input.${inExt}`, outputName: `output.${outExt}` };
}
