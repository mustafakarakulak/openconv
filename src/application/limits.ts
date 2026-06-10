/**
 * Per-family input-size ceilings.
 *
 * Every conversion runs in the user's browser, so an oversized file does not
 * threaten a server — it freezes the tab or exhausts memory (ffmpeg.wasm in
 * particular is bounded by the WASM heap). These generous caps turn that
 * silent hang into an explicit, localised error. They are intentionally well
 * above any realistic everyday file; tune them per deployment if needed.
 */
import type { MediaKind } from "@/core/domain/format";

const MiB = 1024 * 1024;

/** Maximum accepted input size, in bytes, per media family. */
export const MAX_INPUT_BYTES: Readonly<Record<MediaKind, number>> = {
  // Parsed/serialised synchronously on the main thread — keep these tighter.
  data: 64 * MiB,
  document: 100 * MiB,
  image: 100 * MiB,
  // Streamed through ffmpeg.wasm; larger but still heap-bounded.
  audio: 512 * MiB,
  video: 1024 * MiB,
};

/** Returns the maximum accepted input size for a media family. */
export function maxInputBytesFor(kind: MediaKind): number {
  return MAX_INPUT_BYTES[kind];
}
