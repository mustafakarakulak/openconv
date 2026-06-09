/**
 * Media converter module entry point.
 *
 * Exposes the ffmpeg.wasm-backed audio/video converter to the registry.
 */
import type { Converter } from "@/core/ports/converter";
import { MediaConverter } from "./media-converter";

export const mediaConverters: Converter[] = [new MediaConverter()];
