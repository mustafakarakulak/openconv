/**
 * Image converter plugin module.
 *
 * Exposes the canvas-backed image converter as the module's public surface.
 * The registry imports this array to wire the converters into the engine.
 */
import type { Converter } from "@/core/ports/converter";
import { ImageCanvasConverter } from "./image-canvas-converter";

export const imageConverters: Converter[] = [new ImageCanvasConverter()];

export { ImageCanvasConverter } from "./image-canvas-converter";
